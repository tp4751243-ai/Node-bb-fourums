'use strict';

/**
 * Pure trust-tier logic for בית העורכים.
 *
 * Nothing in this file touches NodeBB, so it can be unit tested with `node --test`.
 * library.js feeds it user stats and applies the result (groups, badges, queue rules).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TIER = 1;
const MAX_TIER = 5;
const GROUP_PREFIX = 'trust-tier-';

// Typographic ladder: a dot grows into a letter, a line, a page, a book.
const DEFAULT_TIERS = Object.freeze([
	{ level: 1, key: 'dot', name: 'נקודה', nameEn: 'Dot', icon: 'fa-circle', color: '#64748b', posts: 0, reputation: 0, days: 0 },
	{ level: 2, key: 'letter', name: 'אות', nameEn: 'Letter', icon: 'fa-font', color: '#2563eb', posts: 5, reputation: 0, days: 0 },
	{ level: 3, key: 'line', name: 'שורה', nameEn: 'Line', icon: 'fa-grip-lines', color: '#0e7490', posts: 30, reputation: 15, days: 14 },
	{ level: 4, key: 'page', name: 'עמוד', nameEn: 'Page', icon: 'fa-file-lines', color: '#7c3aed', posts: 100, reputation: 60, days: 60 },
	{ level: 5, key: 'book', name: 'ספר', nameEn: 'Book', icon: 'fa-book', color: '#b45309', posts: 300, reputation: 200, days: 180 },
]);

// What each tier unlocks. Privileges are granted to the tier groups (see scripts/bootstrap.mjs);
// the job-queue rule is enforced by library.js. Shown in notifications and the public API.
const PERKS = Object.freeze({
	1: ['כתיבה בפורום והשתתפות בתחרויות', 'Post in the forum and enter contests'],
	2: ['פרסום משרות (באישור מנהל), העלאת קבצי PDF, הצבעה בתחרויות', 'Post jobs (moderated), upload PDFs, vote in contests'],
	3: ['משרות מתפרסמות מיד, חתימה עם קישורים', 'Jobs publish instantly, signature with links'],
	4: ['גישה לחדר המקצוענים, מועמדות לשיפוט תחרויות', 'Professionals\' lounge, eligible to judge contests'],
	5: ['מועמדות למנחה/מנטור, מודעת "זמין לעבודה" מקודמת', 'Moderator/mentor candidate, featured "available" listing'],
});

const DEFAULT_SETTINGS = Object.freeze({
	requireEmail: true, // tiers 2+ need a confirmed email
	jobsCids: [], // category ids of the jobs board(s)
	jobsAutoApproveTier: 3, // new job topics from lower tiers go to the post queue
	queueExemptTier: 2, // from this tier up, skip NodeBB's newbie post queue elsewhere (0 = never)
	notifyPromotions: true,
});

function toInt(value, fallback, min = 0) {
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) && n >= min ? n : fallback;
}

function toBool(value, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}
	return value === true || value === 1 || ['on', 'true', '1', 'yes'].includes(String(value).toLowerCase());
}

function clampTier(level) {
	return Math.min(MAX_TIER, Math.max(MIN_TIER, toInt(level, MIN_TIER, MIN_TIER)));
}

function groupName(level) {
	return `${GROUP_PREFIX}${level}`;
}

function allGroupNames() {
	return DEFAULT_TIERS.map(t => groupName(t.level));
}

/**
 * Parse "manual overrides" from the ACP textarea. One per line:
 *   username = 4
 *   uid:17 = 2
 * Lines starting with # are comments. Keys are matched case-insensitively.
 */
function parseOverrides(text) {
	const map = new Map();
	String(text || '').split(/\r?\n/).forEach((line) => {
		const clean = line.trim();
		if (!clean || clean.startsWith('#')) {
			return;
		}
		const match = clean.match(/^(.+?)\s*[:=]\s*([1-5])$/);
		if (match) {
			map.set(match[1].trim().toLowerCase(), Number(match[2]));
		}
	});
	return map;
}

/**
 * Turn the raw ACP settings hash (all strings) into a validated config.
 * Thresholds are forced to be non-decreasing so a higher tier is never easier than a lower one.
 */
function normalizeSettings(raw) {
	raw = raw || {};
	const tiers = [];
	let previous = null;
	for (const base of DEFAULT_TIERS) {
		const n = base.level;
		const tier = {
			...base,
			name: String(raw[`t${n}_name`] || '').trim() || base.name,
			posts: n === 1 ? 0 : toInt(raw[`t${n}_posts`], base.posts),
			// may be negative, e.g. -5 to tolerate a few downvotes
			reputation: n === 1 ? 0 : toInt(raw[`t${n}_reputation`], base.reputation, -100000),
			days: n === 1 ? 0 : toInt(raw[`t${n}_days`], base.days),
		};
		if (previous) {
			tier.posts = Math.max(tier.posts, previous.posts);
			tier.reputation = Math.max(tier.reputation, previous.reputation);
			tier.days = Math.max(tier.days, previous.days);
		}
		tiers.push(tier);
		// tier 1 has no requirements, so it does not set a floor for tier 2
		previous = n === MIN_TIER ? null : tier;
	}

	const jobsCids = String(raw.jobsCids || '')
		.split(/[\s,]+/)
		.map(cid => toInt(cid, 0, 1))
		.filter(Boolean);

	return {
		tiers,
		requireEmail: toBool(raw.requireEmail, DEFAULT_SETTINGS.requireEmail),
		jobsCids: [...new Set(jobsCids)],
		jobsAutoApproveTier: Math.min(MAX_TIER + 1, toInt(raw.jobsAutoApproveTier, DEFAULT_SETTINGS.jobsAutoApproveTier)),
		queueExemptTier: Math.min(MAX_TIER + 1, toInt(raw.queueExemptTier, DEFAULT_SETTINGS.queueExemptTier)),
		notifyPromotions: toBool(raw.notifyPromotions, DEFAULT_SETTINGS.notifyPromotions),
		overrides: parseOverrides(raw.overrides),
	};
}

/** What is still missing for `stats` to qualify for `tier`. All zero/false = qualifies. */
function missingFor(stats, tier, config, now) {
	const ageDays = stats.joindate ? Math.floor((now - stats.joindate) / DAY_MS) : 0;
	return {
		posts: Math.max(0, tier.posts - (stats.postcount || 0)),
		reputation: Math.max(0, tier.reputation - (stats.reputation || 0)), // net-negative users stay at tier 1
		days: Math.max(0, tier.days - ageDays),
		email: tier.level > 1 && config.requireEmail && !stats.emailConfirmed,
	};
}

function qualifies(missing) {
	return !missing.posts && !missing.reputation && !missing.days && !missing.email;
}

/**
 * stats: { postcount, reputation, joindate (ms), emailConfirmed, banned, override }
 * Returns { tier, reason } where tier 0 means "no tier" (banned).
 * Tiers are cumulative: to reach tier 4 you must also meet tiers 2 and 3.
 */
function computeTier(stats, config, now = Date.now()) {
	if (!stats || stats.banned) {
		return { tier: 0, reason: 'banned' };
	}
	if (stats.override) {
		return { tier: clampTier(stats.override), reason: 'override' };
	}
	let tier = MIN_TIER;
	for (const definition of config.tiers) {
		if (definition.level === MIN_TIER) {
			continue;
		}
		if (!qualifies(missingFor(stats, definition, config, now))) {
			break;
		}
		tier = definition.level;
	}
	return { tier, reason: 'earned' };
}

/** Current tier plus what is needed for the next one (for profile widgets and the API). */
function progress(stats, config, now = Date.now()) {
	const { tier, reason } = computeTier(stats, config, now);
	const nextDefinition = tier > 0 && reason === 'earned' ? config.tiers.find(t => t.level === tier + 1) : null;
	return {
		tier,
		reason,
		name: tier ? config.tiers[tier - 1].name : null,
		next: nextDefinition ? {
			tier: nextDefinition.level,
			name: nextDefinition.name,
			missing: missingFor(stats, nextDefinition, config, now),
		} : null,
	};
}

function perks(level) {
	return PERKS[level] || null;
}

function parseTitle(raw) {
	if (raw === undefined || raw === null || raw === '') {
		return [];
	}
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
	} catch (err) {
		return [String(raw)];
	}
}

/**
 * Decide which badges a user displays after a tier change. `raw` is the stored `groupTitle`:
 *   null/undefined -> never chosen: show the new tier badge
 *   '' or '[]'     -> user chose to show no badge: keep it that way
 *   JSON array     -> swap any tier badge for the new one, keep the user's other choices
 * Returns the raw value to store, or null to delete the field.
 */
function nextGroupTitle(raw, newGroup, tierGroups = allGroupNames()) {
	if (raw === undefined || raw === null) {
		return newGroup ? JSON.stringify([newGroup]) : null;
	}
	const titles = parseTitle(raw);
	if (!titles.some(title => tierGroups.includes(title))) {
		return raw;
	}
	const result = [];
	for (const title of titles) {
		const next = tierGroups.includes(title) ? newGroup : title;
		if (next && !result.includes(next)) {
			result.push(next);
		}
	}
	return result.length ? JSON.stringify(result) : null;
}

module.exports = {
	DAY_MS,
	MIN_TIER,
	MAX_TIER,
	GROUP_PREFIX,
	DEFAULT_TIERS,
	DEFAULT_SETTINGS,
	groupName,
	allGroupNames,
	parseOverrides,
	normalizeSettings,
	missingFor,
	computeTier,
	progress,
	perks,
	parseTitle,
	nextGroupTitle,
};
