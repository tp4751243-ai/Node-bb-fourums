'use strict';

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');

const db = require.main.require('./src/database');
const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');
const topics = require.main.require('./src/topics');
const plugins = require.main.require('./src/plugins');
const notifications = require.main.require('./src/notifications');
const batch = require.main.require('./src/batch');
const routeHelpers = require.main.require('./src/routes/helpers');

const tiers = require('./lib/tiers');

const SETTINGS_HASH = 'trust-tiers';
const SWEEP_CRON = '17 * * * *'; // hourly, off the top of the hour
const TIER_GROUPS = tiers.allGroupNames();
const USER_FIELDS = [
	'uid', 'username', 'userslug', 'postcount', 'reputation', 'joindate',
	'email:confirmed', 'banned', 'banned:expire', 'trustTier',
];

const plugin = module.exports;
const locks = new Map();

const log = {
	info: msg => winston.info(`[plugin/trust-tiers] ${msg}`),
	error: (msg, err) => winston.error(`[plugin/trust-tiers] ${msg}\n${err && err.stack ? err.stack : err}`),
};

// Settings are cached by core (and invalidated across processes), so reading them per call is cheap.
async function getConfig() {
	return tiers.normalizeSettings(await meta.settings.get(SETTINGS_HASH));
}

function isLocalUid(uid) {
	return /^\d+$/.test(String(uid)) && parseInt(uid, 10) > 0;
}

/** Serialise work per user so concurrent hooks (vote + post) don't race on group membership. */
function withUserLock(uid, fn) {
	const key = String(uid);
	const run = (locks.get(key) || Promise.resolve()).then(fn);
	const tail = run.catch(() => {});
	locks.set(key, tail);
	tail.then(() => {
		if (locks.get(key) === tail) {
			locks.delete(key);
		}
	});
	return run;
}

function toStats(data, config) {
	const override = config.overrides.get(`uid:${data.uid}`) ||
		config.overrides.get(String(data.username || '').toLowerCase()) ||
		config.overrides.get(String(data.userslug || '').toLowerCase());
	return {
		postcount: data.postcount,
		reputation: data.reputation,
		joindate: data.joindate,
		emailConfirmed: parseInt(data['email:confirmed'], 10) === 1,
		banned: !!data.banned,
		override,
	};
}

// ---------------------------------------------------------------------------
// Groups (one per tier; membership is exclusive so the badge shows one tier)
// ---------------------------------------------------------------------------

function groupValues(tier) {
	return {
		userTitle: tier.name,
		userTitleEnabled: 1,
		description: `${tier.name} (${tier.nameEn}) · דרגת אמון ${tier.level} מתוך ${tiers.MAX_TIER}`,
		icon: tier.icon,
		labelColor: tier.color,
		textColor: '#ffffff',
		disableJoinRequests: 1,
		disableLeave: 1,
	};
}

async function ensureGroups(config) {
	for (const tier of config.tiers) {
		const name = tiers.groupName(tier.level);
		const values = groupValues(tier);
		/* eslint-disable no-await-in-loop */
		if (!await groups.exists(name)) {
			try {
				// system: 1 stops the group being renamed in the ACP (the plugin finds groups by name).
				// hidden must stay 0, otherwise NodeBB will not show the badge.
				await groups.create({ name, system: 1, hidden: 0, private: 1, ...values });
				log.info(`created group ${name}`);
			} catch (err) {
				if (!String(err.message).includes('group-already-exists')) {
					throw err;
				}
			}
		}
		await groups.update(name, values);
		/* eslint-enable no-await-in-loop */
	}
}

// ---------------------------------------------------------------------------
// Recalculation
// ---------------------------------------------------------------------------

async function applyTier(uid, tier, config, notify) {
	const key = `user:${uid}`;
	const [rawTitle, storedTier, memberships] = await Promise.all([
		db.getObjectField(key, 'groupTitle'),
		db.getObjectField(key, 'trustTier'),
		groups.isMemberOfGroups(uid, TIER_GROUPS),
	]);
	const previous = parseInt(storedTier, 10) || 0;
	const target = tier ? tiers.groupName(tier) : null;
	const current = TIER_GROUPS.filter((name, i) => memberships[i]);
	const toLeave = current.filter(name => name !== target);
	const toJoin = target && !current.includes(target);

	if (toJoin) {
		await groups.join(target, uid);
	}
	if (toLeave.length) {
		await groups.leave(toLeave, uid);
	}
	if (toJoin || toLeave.length) {
		// core join/leave rewrite the displayed badges; restore the user's choice with the new tier swapped in
		const desired = tiers.nextGroupTitle(rawTitle === undefined ? null : rawTitle, target, TIER_GROUPS);
		const after = await db.getObjectField(key, 'groupTitle');
		if ((desired ?? null) !== (after ?? null)) {
			if (desired === null) {
				await db.deleteObjectField(key, 'groupTitle');
			} else {
				await db.setObjectField(key, 'groupTitle', desired);
			}
		}
	}

	if (previous !== tier) {
		await user.setUserField(uid, 'trustTier', tier);
		plugins.hooks.fire('action:trust-tiers.changed', { uid, from: previous, to: tier });
		// no notification for first assignment (avoids a burst when the plugin is installed) or after a ban
		if (notify && config.notifyPromotions && previous > 0 && tier > previous) {
			await notifyPromotion(uid, tier, config);
		}
		log.info(`uid ${uid}: tier ${previous} -> ${tier}`);
	}
}

async function notifyPromotion(uid, level, config) {
	const tier = config.tiers[level - 1];
	const [perksHe] = tiers.perks(level) || [''];
	const userslug = await user.getUserField(uid, 'userslug');
	const notification = await notifications.create({
		type: 'trust-tier',
		nid: `trust-tier:${uid}:${level}:${Date.now()}`,
		bodyShort: `🎉 עלית לדרגת ${tier.name} (${tier.nameEn}) · ${perksHe}`,
		path: `/user/${userslug}`,
		importance: 6,
	});
	await notifications.push(notification, [uid]);
}

/**
 * Recalculate tiers for some users. Reads are batched; writes only happen for users whose
 * tier or group membership is out of sync. Returns [{ uid, tier, changed }].
 */
plugin.recalculate = async function (uids, { notify = true, config } = {}) {
	uids = [].concat(uids).filter(isLocalUid).map(uid => parseInt(uid, 10));
	if (!uids.length) {
		return [];
	}
	config = config || await getConfig();
	const [usersData, memberships] = await Promise.all([
		user.getUsersFields(uids, USER_FIELDS),
		Promise.all(TIER_GROUPS.map(name => groups.isMembers(uids, name))),
	]);

	const now = Date.now();
	const results = [];
	for (let i = 0; i < uids.length; i += 1) {
		const data = usersData[i];
		if (data && data.uid) {
			const { tier } = tiers.computeTier(toStats(data, config), config, now);
			const target = tier ? tiers.groupName(tier) : null;
			const current = TIER_GROUPS.filter((name, idx) => memberships[idx][i]);
			const inSync = (parseInt(data.trustTier, 10) || 0) === tier &&
				(target ? current.length === 1 && current[0] === target : !current.length);
			if (!inSync) {
				// eslint-disable-next-line no-await-in-loop
				await withUserLock(data.uid, () => applyTier(data.uid, tier, config, notify));
			}
			results.push({ uid: data.uid, tier, changed: !inSync });
		}
	}
	return results;
};

plugin.recalculateAll = async function () {
	const config = await getConfig();
	let checked = 0;
	let changed = 0;
	await batch.processSortedSet('users:joindate', async (uids) => {
		const results = await plugin.recalculate(uids, { config });
		checked += results.length;
		changed += results.filter(r => r.changed).length;
	}, { batch: 500 });
	log.info(`sweep done: ${checked} users checked, ${changed} updated`);
	return { checked, changed };
};

/** Tier for a user, computing it on the spot if it was never stored. */
plugin.getTier = async function (uid) {
	if (!isLocalUid(uid)) {
		return 0;
	}
	const stored = parseInt(await user.getUserField(uid, 'trustTier'), 10);
	if (stored > 0) {
		return stored;
	}
	const [result] = await plugin.recalculate([uid], { notify: false });
	return result ? result.tier : 0;
};

plugin.getProgress = async function (uid) {
	const config = await getConfig();
	const [data] = await user.getUsersFields([uid], USER_FIELDS);
	if (!data || !data.uid) {
		return null;
	}
	return { uid: data.uid, ...tiers.progress(toStats(data, config), config) };
};

function recalcSoon(uid) {
	if (!isLocalUid(uid)) {
		return;
	}
	plugin.recalculate([uid]).catch(err => log.error(`recalculating uid ${uid} failed`, err));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

plugin.init = async function ({ router }) {
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/trust-tiers', async (req, res) => {
		res.render('admin/plugins/trust-tiers', {
			title: 'Trust tiers · דרגות אמון',
			// defaults are shown as placeholders; an empty field means "use the default"
			tiers: tiers.DEFAULT_TIERS.map(t => ({ ...t, editable: t.level > 1, group: tiers.groupName(t.level) })),
		});
	});

	try {
		await ensureGroups(await getConfig());
		if (nconf.get('runJobs')) {
			await scheduleSweep();
		}
	} catch (err) {
		// never block the forum from starting; tiers will catch up on the next restart
		log.error('startup failed', err);
	}
};

async function scheduleSweep() {
	const run = () => plugin.recalculateAll();
	let cron = null;
	try {
		cron = require.main.require('./src/cron');
	} catch (err) {
		cron = null; // older NodeBB without the core cron module
	}
	if (cron && typeof cron.addJob === 'function') {
		if (!cron.hasJob('trust-tiers:sweep')) {
			await cron.addJob({ name: 'trust-tiers:sweep', cronTime: SWEEP_CRON, onTick: run });
		}
	} else {
		const { CronJob } = require.main.require('cron');
		CronJob.from({
			cronTime: SWEEP_CRON,
			onTick: () => run().catch(err => log.error('sweep failed', err)),
			start: true,
		});
	}
	// First pass shortly after boot: assigns tiers to existing members and applies changed thresholds.
	setTimeout(() => run().catch(err => log.error('initial sweep failed', err)), 15 * 1000).unref();
}

plugin.addAdminNavigation = async function (header) {
	header.plugins.push({ route: '/plugins/trust-tiers', icon: 'fa-layer-group', name: 'Trust tiers' });
	return header;
};

plugin.onSettingsSet = async function ({ plugin: hash }) {
	if (hash !== SETTINGS_HASH) {
		return;
	}
	try {
		await ensureGroups(await getConfig()); // badge names/colours
		plugin.recalculateAll().catch(err => log.error('sweep after settings change failed', err));
	} catch (err) {
		log.error('applying new settings failed', err);
	}
};

plugin.whitelistFields = async function (hookData) {
	hookData.whitelist.push('trustTier');
	return hookData;
};

plugin.onPostSave = ({ post }) => recalcSoon(post && post.uid);
plugin.onPostChange = ({ post }) => recalcSoon(post && post.uid); // delete / restore
plugin.onPostsPurge = ({ posts }) => (posts || []).forEach(post => recalcSoon(post && post.uid));
plugin.onVote = ({ owner }) => recalcSoon(owner); // reputation of the post author changed
plugin.onUserCreate = ({ user: userData }) => recalcSoon(userData && userData.uid);
plugin.onUserEvent = ({ uid }) => recalcSoon(uid); // login, email confirmed, ban, unban

/**
 * Post queue rules:
 *  - new topics in a jobs category go to the queue below `jobsAutoApproveTier` (default: tier 2 is moderated)
 *  - elsewhere, members from `queueExemptTier` up skip NodeBB's newbie queue
 * Admins and moderators are never affected.
 */
plugin.shouldQueue = async function (hookData) {
	try {
		const { uid, data } = hookData;
		if (!isLocalUid(uid) || !data || data.hasOwnProperty('crosspostCid')) {
			return hookData;
		}
		const config = await getConfig();
		const isNewTopic = !data.tid && data.cid !== undefined;
		const cid = parseInt(isNewTopic ? data.cid : await topics.getTopicField(data.tid, 'cid'), 10);
		const isJobTopic = isNewTopic && config.jobsCids.includes(cid);
		if (!isJobTopic && !hookData.shouldQueue) {
			return hookData;
		}
		if (await user.isPrivileged(uid)) {
			return hookData;
		}
		const tier = await plugin.getTier(uid);
		if (isJobTopic && tier < config.jobsAutoApproveTier) {
			hookData.shouldQueue = true;
		} else if (config.queueExemptTier && tier >= config.queueExemptTier) {
			hookData.shouldQueue = false;
		}
	} catch (err) {
		log.error('post queue check failed', err);
	}
	return hookData;
};

// ---------------------------------------------------------------------------
// Write API: /api/v3/plugins/trust-tiers/...
// ---------------------------------------------------------------------------

plugin.addApiRoutes = async function ({ router, middleware, helpers }) {
	const ensureAdmin = async (req, res, next) => {
		try {
			if (await user.isAdministrator(req.uid)) {
				return next();
			}
			helpers.formatApiResponse(403, res);
		} catch (err) {
			helpers.formatApiResponse(500, res, err);
		}
	};
	const handle = fn => async (req, res) => {
		try {
			helpers.formatApiResponse(200, res, await fn(req));
		} catch (err) {
			helpers.formatApiResponse(400, res, err);
		}
	};

	// Public: the ladder and what each step unlocks (for an explainer page)
	routeHelpers.setupApiRoute(router, 'get', '/trust-tiers', [], handle(async () => {
		const config = await getConfig();
		return {
			requireEmail: config.requireEmail,
			jobsAutoApproveTier: config.jobsAutoApproveTier,
			tiers: config.tiers.map(t => ({
				level: t.level,
				key: t.key,
				name: t.name,
				nameEn: t.nameEn,
				icon: t.icon,
				color: t.color,
				group: tiers.groupName(t.level),
				requirements: { posts: t.posts, reputation: t.reputation, days: t.days },
				perks: tiers.perks(t.level),
			})),
		};
	}));

	// Logged in: your tier and what's missing for the next one
	routeHelpers.setupApiRoute(router, 'get', '/trust-tiers/me', [middleware.ensureLoggedIn], handle(
		async req => plugin.getProgress(req.uid)
	));

	routeHelpers.setupApiRoute(router, 'get', '/trust-tiers/users/:uid', [middleware.ensureLoggedIn], handle(async (req) => {
		const result = await plugin.getProgress(req.params.uid);
		if (!result) {
			throw new Error('[[error:no-user]]');
		}
		return result;
	}));

	// Admin: re-run the sweep now
	routeHelpers.setupApiRoute(router, 'post', '/trust-tiers/recalculate', [middleware.ensureLoggedIn, ensureAdmin], handle(
		async () => plugin.recalculateAll()
	));

	// Admin: change settings (used by scripts/bootstrap.mjs to register the jobs category)
	routeHelpers.setupApiRoute(router, 'put', '/trust-tiers/settings', [middleware.ensureLoggedIn, ensureAdmin], handle(async (req) => {
		const allowed = /^(t[1-5]_(name|posts|reputation|days)|requireEmail|jobsCids|jobsAutoApproveTier|queueExemptTier|notifyPromotions|overrides)$/;
		const values = {};
		Object.entries(req.body || {}).forEach(([key, value]) => {
			if (allowed.test(key)) {
				values[key] = Array.isArray(value) ? value.join(',') : String(value);
			}
		});
		if (!Object.keys(values).length) {
			throw new Error('[[error:invalid-data]]');
		}
		await meta.settings.set(SETTINGS_HASH, values);
		return meta.settings.get(SETTINGS_HASH);
	}));
};
