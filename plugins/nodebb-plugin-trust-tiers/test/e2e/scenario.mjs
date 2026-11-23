// End-to-end scenario for nodebb-plugin-trust-tiers + scripts/bootstrap.mjs.
// ONLY run this against a throwaway NodeBB: it creates users and topics, bans a user and changes settings.
//
//   NODEBB_URL=http://localhost:4567 NODEBB_TOKEN=<master token> node scenario.mjs
//
// Needs: the plugin active, scripts/bootstrap.mjs already run, and a master token (scripts/make-token.mjs).
const BASE = process.env.NODEBB_URL || 'http://localhost:4567';
const TOKEN = process.env.NODEBB_TOKEN;
if (!TOKEN) {
	console.error('Set NODEBB_TOKEN to a master API token (see scripts/make-token.mjs).');
	process.exit(1);
}
const ADMIN = 1;
let failures = 0;
const results = [];

function check(name, ok, detail = '') {
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
	if (!ok) failures += 1;
}

async function api(method, path, body, asUid = ADMIN) {
	const url = new URL(`${BASE}/api${path}`);
	url.searchParams.set('_uid', String(asUid));
	const res = await fetch(url, {
		method,
		headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json = null;
	try { json = JSON.parse(text); } catch {}
	return { status: res.status, body: json && json.response !== undefined ? json.response : json, message: json?.status?.message, text };
}


async function sessionNotifications(username, password) {
	const jar = new Map();
	const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
	const call = async (method, path, body, headers = {}) => {
		const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { cookie: cookie(), 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
		for (const c of res.headers.getSetCookie()) { const pair = c.split(';')[0]; const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
		const text = await res.text(); try { return JSON.parse(text); } catch { return null; }
	};
	const cfg = await call('GET', '/api/config');
	await call('POST', '/login', { username, password }, { 'x-csrf-token': cfg.csrf_token });
	const data = await call('GET', '/api/notifications');
	return (data && data.notifications) || [];
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function eventually(fn, timeout = 5000) {
	const end = Date.now() + timeout;
	let last;
	while (Date.now() < end) {
		last = await fn();
		if (last) return last;
		await wait(200);
	}
	return last;
}

const tierOf = async uid => (await api('GET', `/v3/plugins/trust-tiers/users/${uid}`)).body;
const groupsOf = async (uid) => {
	const r = await api('GET', `/v3/users/${uid}`);
	return r.body;
};
async function inGroup(uid, group) {
	const r = await api('GET', `/v3/groups/${group}/members?_uid=1`);
	if (r.status !== 200) {
		const fallback = await api('GET', `/groups/${group}/members`);
		return JSON.stringify(fallback.body || fallback.text).includes(`"uid":${uid}`);
	}
	return JSON.stringify(r.body).includes(`"uid":${uid}`);
}

// ------------------------------------------------------------------ setup
for (const [key, value] of Object.entries({ postDelay: 0, initialPostDelay: 0, newbiePostDelay: 0 })) {
	await api('PUT', `/v3/admin/settings/${key}`, { value });
}
const { categories } = (await api('GET', '/v3/categories')).body;
const cid = name => categories.find(c => c.name === name)?.cid;
const C = {
	general: cid('פונטים עבריים'),
	hiring: cid('דרושים'),
	available: cid('זמינים לעבודה'),
	contests: cid('תחרויות'),
	lounge: cid('חדר המקצוענים'),
};
check('bootstrap created the categories', Object.values(C).every(Boolean), JSON.stringify(C));

const stamp = Date.now().toString(36);
async function createUser(name) {
	const r = await api('POST', '/v3/users', { username: `${name}_${stamp}`, password: 'UserPass!2026x', email: `${name}_${stamp}@example.com` });
	if (r.status !== 200) throw new Error(`create user ${name}: ${r.status} ${r.text.slice(0, 200)}`);
	return r.body.uid;
}
const u1 = await createUser('yossi');
const u2 = await createUser('newbie');

// ------------------------------------------------------------------ tier 1
const t1 = await eventually(async () => ((await tierOf(u1))?.tier === 1 ? await tierOf(u1) : null));
check('new member is tier 1 (Dot)', t1?.tier === 1, JSON.stringify(t1));
check('new member is in group trust-tier-1', await eventually(() => inGroup(u1, 'trust-tier-1')));

let r = await api('POST', '/v3/topics', { cid: C.hiring, title: 'מעמד דרוש לספר', content: 'פרטים בהמשך, עבודה מעניינת' }, u1);
check('tier 1 cannot open a job topic', r.status === 403, `${r.status} ${r.message}`);

r = await api('GET', '/v3/categories', null, u1);
check('tier 1 cannot see the professionals lounge', !r.body.categories.some(c => c.cid === C.lounge));

// ------------------------------------------------------------------ 5 posts
r = await api('POST', '/v3/topics', { cid: C.general, title: 'איזה גופן רש"י מתאים לגוף 8?', content: 'אני מחפש גופן רש"י קריא בגודל קטן' }, u1);
const firstQueued = r.body?.queued === true;
check('first post of a new member waits in the post queue', firstQueued, JSON.stringify(r.body).slice(0, 120));
if (firstQueued) {
	const accept = await api('POST', `/v3/posts/queue/${encodeURIComponent(r.body.id)}`);
	check('moderator approves the first post', accept.status === 200, `${accept.status} ${accept.message}`);
}
const topics = (await api('GET', `/category/${C.general}`, null, u1)).body?.topics || [];
const tid = topics.find(t => t.uid === u1)?.tid;
for (let i = 2; i <= 5; i += 1) {
	r = await api('POST', `/v3/topics/${tid}`, { content: `תגובה מספר ${i}: ניסיתי את ההצעה וזה עובד` }, u1);
	check(`post ${i} published without queue`, r.status === 200 && !r.body.queued, `${r.status} ${r.message || ''}`);
}

let p = await eventually(async () => {
	const x = await tierOf(u1);
	return x && x.next && x.next.missing.posts === 0 ? x : null;
});
check('5 posts but unconfirmed email -> still tier 1, email missing', p?.tier === 1 && p?.next?.missing?.email === true, JSON.stringify(p?.next));

// ------------------------------------------------------------------ email -> tier 2
const email = `yossi_${stamp}@example.com`;
r = await api('POST', `/v3/users/${u1}/emails/${encodeURIComponent(email)}/confirm`);
check('admin confirms the email', r.status === 200, `${r.status} ${r.message}`);
p = await eventually(async () => ((await tierOf(u1))?.tier === 2 ? tierOf(u1) : null));
check('confirmed email + 5 posts -> tier 2 (Letter)', p?.tier === 2, JSON.stringify(p));
check('moved to trust-tier-2 group', await eventually(() => inGroup(u1, 'trust-tier-2')));
check('left trust-tier-1 group', !(await inGroup(u1, 'trust-tier-1')));

const profile = (await api('GET', `/user/${(await groupsOf(u1)).userslug}`)).body;
check('badge switched to the tier-2 badge', JSON.stringify(profile.groupTitleArray) === '["trust-tier-2"]', JSON.stringify(profile.groupTitleArray));
check('trustTier exposed on the profile', String(profile.trustTier) === '2', String(profile.trustTier));

let notifs = [];
await eventually(async () => {
	notifs = await sessionNotifications(`yossi_${stamp}`, 'UserPass!2026x');
	return notifs.some(n => String(n.nid || '').startsWith('trust-tier:'));
}, 8000);
check('promotion notification sent', notifs.some(n => String(n.nid || '').startsWith('trust-tier:') && /אות/.test(n.bodyShort)), notifs.map(n => n.bodyShort).join(' | ').slice(0, 160));

// ------------------------------------------------------------------ jobs
r = await api('POST', '/v3/topics', { cid: C.hiring, title: 'דרוש מעמד לספר שו"ת', content: '400 עמודים, InDesign, תשלום לפי עמוד' }, u1);
check('tier 2 job post goes to moderation', r.status === 202 && r.body.queued === true, `${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);

await api('PUT', '/v3/plugins/trust-tiers/settings', { overrides: `uid:${u1} = 3` });
p = await eventually(async () => ((await tierOf(u1))?.tier === 3 ? tierOf(u1) : null));
check('override lifts the member to tier 3', p?.tier === 3 && p?.reason === 'override', JSON.stringify(p));
r = await api('POST', '/v3/topics', { cid: C.available, title: 'מעמד ותיק זמין לעבודה', content: '12 שנות ניסיון, תיק עבודות בפרופיל' }, u1);
check('tier 3 job post publishes immediately', r.status === 200 && !r.body.queued && r.body.tid > 0, `${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
const jobTid = r.body.tid;

const topic = (await api('GET', `/topic/${jobTid}`)).body;
const author = topic.posts[0].user;
check('badge shows on posts (Hebrew tier title)', (author.selectedGroups || []).some(g => g.name === 'trust-tier-3' && g.userTitle === 'שורה'), JSON.stringify(author.selectedGroups));

// ------------------------------------------------------------------ contest voting
r = await api('POST', '/v3/topics', { cid: C.contests, title: 'תחרות: צורת הדף', content: 'הגשה לדוגמה' }, ADMIN);
const contestPid = r.body.mainPid;
r = await api('PUT', `/v3/posts/${contestPid}/vote`, { delta: 1 }, u2);
check('tier 1 cannot vote in contests', r.status === 403 || r.status === 400, `${r.status} ${r.message}`);
r = await api('PUT', `/v3/posts/${contestPid}/vote`, { delta: 1 }, u1);
check('tier 3 can vote in contests', r.status === 200, `${r.status} ${r.message}`);
r = await api('PUT', `/v3/posts/${contestPid}/vote`, { delta: -1 }, u1);
check('nobody can downvote contest entries', r.status === 403 || r.status === 400, `${r.status} ${r.message}`);

// ------------------------------------------------------------------ lounge (tier 4)
check('tier 3 still cannot see the lounge', !(await api('GET', '/v3/categories', null, u1)).body.categories.some(c => c.cid === C.lounge));
await api('PUT', '/v3/plugins/trust-tiers/settings', { overrides: `uid:${u1} = 4` });
await eventually(async () => ((await tierOf(u1))?.tier === 4));
check('tier 4 sees the lounge', (await api('GET', '/v3/categories', null, u1)).body.categories.some(c => c.cid === C.lounge));

// ------------------------------------------------------------------ ban / unban
r = await api('PUT', `/v3/users/${u1}/ban`, { reason: 'test' });
check('admin bans the member', r.status === 200, `${r.status} ${r.message}`);
p = await eventually(async () => ((await tierOf(u1))?.tier === 0 ? tierOf(u1) : null));
check('banned member loses every tier group', p?.tier === 0 && !(await inGroup(u1, 'trust-tier-4')), JSON.stringify(p));
r = await api('DELETE', `/v3/users/${u1}/ban`, {});
check('admin unbans the member', r.status === 200, `${r.status} ${r.message}`);
p = await eventually(async () => ((await tierOf(u1))?.tier === 4 ? tierOf(u1) : null));
check('unban restores the tier', p?.tier === 4 && await inGroup(u1, 'trust-tier-4'));

// ------------------------------------------------------------------ privileges set by bootstrap
const globalPrivs = (await api('GET', '/v3/categories/0/privileges')).body;
const row = name => globalPrivs.groups.find(g => g.name === name)?.privileges || {};
check('PDF uploads: tier 2 yes, registered-users no', row('trust-tier-2')['groups:upload:post:file'] === true && row('registered-users')['groups:upload:post:file'] === false);
check('signatures: tier 3 yes, tier 2 no, registered-users no', row('trust-tier-3')['groups:signature'] === true && row('trust-tier-2')['groups:signature'] === false && row('registered-users')['groups:signature'] === false);

// ------------------------------------------------------------------ ActivityPub off
const wf = await fetch(`${BASE}/.well-known/webfinger?resource=acct:admin@localhost`);
check('ActivityPub off: webfinger does not answer', wf.status >= 400, `HTTP ${wf.status}`);

// ------------------------------------------------------------------ API + sweep
r = await api('POST', '/v3/plugins/trust-tiers/recalculate', {});
check('admin sweep endpoint works', r.status === 200 && r.body.checked >= 3, JSON.stringify(r.body));
r = await api('POST', '/v3/plugins/trust-tiers/recalculate', {}, u2);
check('non-admins cannot run the sweep', r.status === 403, `${r.status}`);
r = await api('GET', '/v3/plugins/trust-tiers/me', null, u2);
check('/me shows progress for a new member', r.body?.tier === 1 && r.body?.next?.missing?.posts === 5, JSON.stringify(r.body?.next));

// cleanup the override so a re-run starts clean
await api('PUT', '/v3/plugins/trust-tiers/settings', { overrides: '' });

console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
