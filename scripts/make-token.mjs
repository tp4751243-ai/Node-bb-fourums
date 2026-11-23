// Log in as an admin and mint a master API token. Prints only the token.
// Used by local/setup.sh (for bootstrap.mjs) and by the end-to-end test.
//   NODEBB_URL=http://localhost:4567 NODEBB_ADMIN_USERNAME=admin NODEBB_ADMIN_PASSWORD=... node scripts/make-token.mjs
const BASE = (process.env.NODEBB_URL || 'http://localhost:4567').replace(/\/+$/, '');
const USERNAME = process.env.ADMIN_USER || process.env.NODEBB_ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASS || process.env.NODEBB_ADMIN_PASSWORD;
if (!PASSWORD) {
	console.error('Set NODEBB_ADMIN_PASSWORD');
	process.exit(1);
}

const jar = new Map();
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function req(method, path, body, headers = {}) {
	const res = await fetch(BASE + path, {
		method,
		redirect: 'manual',
		headers: { cookie: cookie(), 'content-type': 'application/json', ...headers },
		body: body ? JSON.stringify(body) : undefined,
	});
	for (const c of res.headers.getSetCookie()) {
		const pair = c.split(';')[0];
		const i = pair.indexOf('=');
		jar.set(pair.slice(0, i), pair.slice(i + 1));
	}
	const text = await res.text();
	let json = null;
	try { json = JSON.parse(text); } catch {}
	return { status: res.status, json, text };
}

let cfg = (await req('GET', '/api/config')).json;
const login = await req('POST', '/login', { username: USERNAME, password: PASSWORD }, { 'x-csrf-token': cfg.csrf_token });
if (login.status >= 400) throw new Error(`login failed ${login.status} ${login.text.slice(0, 200)}`);
cfg = (await req('GET', '/api/config')).json;
const created = await req('POST', '/api/v3/admin/tokens', { uid: 0, description: 'temporary setup token', password: PASSWORD }, { 'x-csrf-token': cfg.csrf_token });
if (created.status !== 200) throw new Error(`token failed ${created.status} ${created.text.slice(0, 300)}`);
console.log(created.json.response.secret);
