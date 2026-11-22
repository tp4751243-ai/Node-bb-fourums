#!/usr/bin/env node
/**
 * One-time (re-runnable) setup for בית העורכים on a fresh NodeBB v4 install.
 *
 *   - turns ActivityPub federation off
 *   - creates the category tree (language worlds, shared craft, contests, jobs, lounge, announcements)
 *   - wires trust-tier privileges: jobs (tier 2+), contest voting (tier 2+), PDF uploads (tier 2+),
 *     signatures (tier 3+), professionals' lounge (tier 4+)
 *   - registers the jobs categories with nodebb-plugin-trust-tiers
 *
 * Requires nodebb-plugin-trust-tiers to be active (it creates the tier groups) and Node 18+.
 *
 * Usage:
 *   NODEBB_URL=https://forum.example.com NODEBB_TOKEN=<token> node scripts/bootstrap.mjs
 *
 * Create the token in ACP > Settings > API Access. With a master token (uid 0) also set NODEBB_UID
 * to an administrator's uid (default 1). Safe to run again: existing categories are matched by name.
 */

const BASE = String(process.env.NODEBB_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.NODEBB_TOKEN;
const UID = process.env.NODEBB_UID || '1';

if (!BASE || !TOKEN) {
	console.error('Set NODEBB_URL and NODEBB_TOKEN (ACP > Settings > API Access). See the header of this file.');
	process.exit(1);
}

const tierGroups = from => [2, 3, 4, 5].filter(level => level >= from).map(level => `trust-tier-${level}`);
const EVERYONE_POSTING = ['registered-users', 'fediverse'];
const MEMBER_PRIVILEGES = [
	'groups:find', 'groups:read', 'groups:topics:read', 'groups:topics:create', 'groups:topics:reply',
	'groups:topics:crosspost', 'groups:topics:tag', 'groups:posts:edit', 'groups:posts:history',
	'groups:posts:delete', 'groups:posts:upvote', 'groups:posts:downvote', 'groups:topics:delete',
];
const GUEST_PRIVILEGES = ['groups:find', 'groups:read', 'groups:topics:read'];

// Who may do what, per category. "give"/"rescind": [privileges, groups]
const POLICIES = {
	// Jobs boards: opening a topic needs tier 2 (5 posts). Tier 2 posts are queued by the plugin.
	jobs: {
		rescind: [[['groups:topics:create'], EVERYONE_POSTING]],
		give: [[['groups:topics:create'], tierGroups(2)]],
	},
	// Parent of the jobs boards: staff-only topics (posting guide), members use the sub-boards.
	staffTopics: {
		rescind: [[['groups:topics:create'], EVERYONE_POSTING]],
	},
	// Contests: staff announce contests; everyone discusses; only tier 2+ can (up)vote; no downvotes.
	contests: {
		rescind: [[['groups:topics:create', 'groups:posts:upvote', 'groups:posts:downvote'], EVERYONE_POSTING]],
		give: [[['groups:posts:upvote'], tierGroups(2)]],
	},
	// Professionals' lounge: hidden from everyone below tier 4.
	lounge: {
		rescind: [
			[MEMBER_PRIVILEGES, EVERYONE_POSTING],
			[GUEST_PRIVILEGES, ['guests', 'spiders']],
		],
		give: [[MEMBER_PRIVILEGES, tierGroups(4)]],
	},
};

const CATEGORIES = [
	{
		name: 'לשון הקודש', icon: 'fa-scroll', bgColor: '#14213d',
		description: 'ספרי קודש, שו"ת, חידושים, הגהה ומראי מקומות',
		children: [
			{ name: 'עימוד ספרי קודש', description: 'צורת הדף, כתב רש"י, פירושים סביב הטקסט, הערות שוליים' },
			{ name: 'הגהה ומראי מקומות', description: 'שיטות הגהה, ציטוט מקורות, בירור נוסחאות' },
			{ name: 'פענוח כתבי יד וראשי תיבות', description: 'קריאת כתבי יד, ראשי תיבות וקיצורים' },
			{ name: 'ניקוד וטעמים', description: 'ניקוד, טעמי המקרא וכללי דקדוק' },
		],
	},
	{
		name: 'אידיש', icon: 'fa-book-open', bgColor: '#b3261e',
		description: 'עלונים, צייטונגען, ספרי חסידות וכללי כתיב',
		children: [
			{ name: 'כתיב: חסידיש וייווא', description: 'כללי כתיב, אחידות, מילונים' },
			{ name: 'עלונים וצייטונגען', description: 'עימוד והגהה של עלונים ועיתונים שבועיים' },
			{ name: 'איבערזעצונגען · תרגום', description: 'תרגום מאידיש ואל אידיש' },
		],
	},
	{
		name: 'עברית', icon: 'fa-pen-nib', bgColor: '#1f7a4d',
		description: 'עריכה לשונית, ספרותית ואקדמית, וניקוד',
		children: [
			{ name: 'עריכה לשונית, ספרותית ואקדמית', description: 'סגנון, אחידות, עריכת תוכן' },
			{ name: 'ניקוד לספרי ילדים', description: 'ניקוד מלא, כלים ובדיקה' },
			{ name: 'כללי האקדמיה ללשון', description: 'כתיב מלא וחסר, פיסוק, החלטות האקדמיה' },
		],
	},
	{
		name: 'English', icon: 'fa-language', bgColor: '#0e7490',
		description: 'Torah and general editing in English, translation and transliteration',
		children: [
			{ name: 'Transliteration standards', description: 'Ashkenazi or Sephardi, consistency, style sheets' },
			{ name: 'Translating Torah works', description: 'Workflow, terminology, proofreading translations' },
		],
	},
	{
		name: 'כלים ומקצוע', icon: 'fa-toolbox', bgColor: '#c8962e',
		description: 'תוכנות, פונטים, דפוס ועסקים: משותף לכל השפות',
		children: [
			{ name: 'InDesign ותוכנות עימוד', description: 'InDesign, Affinity, QuarkXPress: RTL, GREP, סקריפטים' },
			{ name: 'פונטים עבריים', description: 'זיהוי גופנים, רישוי, ריווח וקרנינג' },
			{ name: 'דפוס והפקה', description: 'הכנה לדפוס, נייר, כריכה, בתי דפוס' },
			{ name: 'תיק עבודות', description: 'הציגו עבודות וקבלו משוב' },
			{ name: 'עסקים ותמחור', description: 'תמחור, חוזים, גבייה' },
		],
	},
	{
		name: 'תחרויות', icon: 'fa-trophy', bgColor: '#a16207', policy: 'contests',
		description: 'תחרויות עימוד ועיצוב. שיפוט: 70% שופטים, 30% הצבעת קהל (מדרגת "אות")',
	},
	{
		key: 'jobs', name: 'לוח משרות', icon: 'fa-briefcase', bgColor: '#334155', policy: 'staffTopics',
		description: 'משרות ופרילנסרים. פרסום מודעות מדרגת "אות" (5 הודעות בפורום)',
		children: [
			{ key: 'jobs', name: 'דרושים', policy: 'jobs', description: 'מעסיקים מחפשים מעמדים, מעצבים, מגיהים, נקדנים ומתרגמים' },
			{ key: 'jobs', name: 'זמינים לעבודה', policy: 'jobs', description: 'אנשי מקצוע מציגים זמינות ותיק עבודות' },
		],
	},
	{
		name: 'חדר המקצוענים', icon: 'fa-mug-hot', bgColor: '#7c3aed', policy: 'lounge',
		description: 'פורום סגור לחברים בדרגת "עמוד" ומעלה',
	},
	{
		name: 'הכרזות והנהלה', icon: 'fa-bullhorn', bgColor: '#475569', policy: 'staffTopics',
		description: 'חדשות האתר, תקנון ומשוב',
	},
];

// Global privileges (ACP > Privileges > Global)
const GLOBAL = {
	give: [
		[['groups:upload:post:file'], tierGroups(2)], // PDFs and other files
		[['groups:signature'], tierGroups(3)], // signatures attract link spam
	],
	rescind: [[['groups:signature'], ['registered-users']]],
};

const SETTINGS = {
	activitypubEnabled: 0, // no federation: the community stays on this site
	// Only a member's very first post (and posts with links by brand-new members) waits for approval.
	// NodeBB's default (1) would hold every post until someone upvotes the author.
	postQueueReputationThreshold: 0,
};

// ---------------------------------------------------------------------------

async function call(method, path, body) {
	const url = new URL(`${BASE}/api/v3${path}`);
	url.searchParams.set('_uid', UID); // needed for master tokens, ignored for user tokens
	const res = await fetch(url, {
		method,
		headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (err) {
		// not JSON (e.g. an HTML error page); reported below
	}
	if (!res.ok) {
		const message = (json && json.status && json.status.message) || text.slice(0, 200);
		const error = new Error(`${method} ${path} -> ${res.status} ${message}`);
		error.status = res.status;
		throw error;
	}
	return json ? json.response : null;
}

async function setPrivileges(cid, policy) {
	for (const [privs, members] of policy.rescind || []) {
		for (const member of members) {
			for (const privilege of privs) {
				// eslint-disable-next-line no-await-in-loop
				await call('DELETE', `/categories/${cid}/privileges/${encodeURIComponent(privilege)}/${encodeURIComponent(member)}`);
			}
		}
	}
	for (const [privs, members] of policy.give || []) {
		for (const member of members) {
			for (const privilege of privs) {
				// eslint-disable-next-line no-await-in-loop
				await call('PUT', `/categories/${cid}/privileges/${encodeURIComponent(privilege)}`, { member });
			}
		}
	}
}

async function ensureCategory(spec, parentCid, order, existing) {
	const found = existing.find(c => c.name === spec.name && Number(c.parentCid) === Number(parentCid));
	let cid;
	if (found) {
		cid = found.cid;
		console.log(`  = ${spec.name} (cid ${cid})`);
	} else {
		const created = await call('POST', '/categories', {
			name: spec.name,
			description: spec.description || '',
			icon: spec.icon || 'fa-comments',
			bgColor: spec.bgColor || '#e2e8f0',
			color: spec.color || '#ffffff',
			parentCid,
			order,
		});
		cid = created.cid;
		console.log(`  + ${spec.name} (cid ${cid})`);
	}
	if (spec.policy) {
		await setPrivileges(cid, POLICIES[spec.policy]);
	}
	return cid;
}

async function main() {
	console.log(`Bootstrapping ${BASE}`);

	try {
		await call('GET', '/plugins/trust-tiers');
	} catch (err) {
		console.error('nodebb-plugin-trust-tiers is not active (its API did not answer).');
		console.error('Activate it in ACP > Extend > Plugins, rebuild and restart NodeBB, then run this again.');
		console.error(err.message);
		process.exit(1);
	}

	console.log('Settings');
	for (const [key, value] of Object.entries(SETTINGS)) {
		await call('PUT', `/admin/settings/${key}`, { value });
		console.log(`  ${key} = ${value}`);
	}

	console.log('Categories');
	const { categories: existing } = await call('GET', '/categories');
	const jobsCids = [];
	let order = 1;
	for (const spec of CATEGORIES) {
		const cid = await ensureCategory(spec, 0, order, existing);
		order += 1;
		let childOrder = 1;
		for (const child of spec.children || []) {
			const childCid = await ensureCategory({ icon: spec.icon, bgColor: spec.bgColor, ...child }, cid, childOrder, existing);
			childOrder += 1;
			if (child.key === 'jobs') {
				jobsCids.push(childCid);
			}
		}
	}

	console.log('Global privileges');
	await setPrivileges(0, GLOBAL);
	console.log('  file uploads: tier 2+, signatures: tier 3+');

	console.log('Trust tiers plugin');
	await call('PUT', '/plugins/trust-tiers/settings', { jobsCids: jobsCids.join(',') });
	console.log(`  jobs categories: ${jobsCids.join(', ')}`);

	const leftovers = existing.filter(c => Number(c.cid) > 0 && Number(c.parentCid) === 0 &&
		!CATEGORIES.some(spec => spec.name === c.name));
	if (leftovers.length) {
		console.log(`\nNodeBB's sample categories are still there: ${leftovers.map(c => `${c.name} (cid ${c.cid})`).join(', ')}.`);
		console.log('Disable or delete them in ACP > Manage > Categories if you do not want them.');
	}
	console.log('\nDone.');
}

main().catch((err) => {
	console.error(`\nFailed: ${err.message}`);
	process.exit(1);
});
