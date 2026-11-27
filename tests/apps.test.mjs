import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', GITHUB_BUILD_TOKEN: 'ghp_test' });
const U = '11111111-1111-4111-8111-111111111111';
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const files = {}; let dispatched = null, pro = true, listed = [];
// Chiave finta di GitHub per firmare i token OIDC di prova.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' };
const oidc = (claims) => { const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url'); const p = Buffer.from(JSON.stringify(claims)).toString('base64url'); const s = createSign('RSA-SHA256'); s.update(`${h}.${p}`); return `${h}.${p}.${s.sign(privateKey).toString('base64url')}`; };
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) return J({ id: U, email: 'a@b.c' });
  if (url.endsWith('/rpc/get_profile')) return J(pro ? { pro_until: '2099-01-01T00:00:00Z' } : {});
  if (url.includes('/rpc/')) return J(5);
  if (url === 'https://token.actions.githubusercontent.com/.well-known/jwks') return J({ keys: [jwk] });
  if (url.startsWith('https://api.github.com/')) { dispatched = { url, body: JSON.parse(opt.body), auth: opt.headers.authorization }; return new Response(null, { status: 204 }); }
  if (url.includes('/storage/v1/bucket')) return J({});
  if (url.includes('/storage/v1/object/list/apps')) return J(listed);
  if (url.includes('/storage/v1/object/upload/sign/apps/')) return J({ url: '/object/upload/sign/apps/x?token=up' });
  if (url.includes('/storage/v1/object/sign/apps/')) return J({ signedURL: '/object/sign/apps/x?token=rd' });
  const m = /\/storage\/v1\/object\/apps\/(.+)$/.exec(url);
  if (m) { if (opt.method === 'POST') { files[m[1]] = opt.body; return J({}); } return files[m[1]] ? new Response(files[m[1]]) : J({}, 404); }
  return J({});
};
const lib = await import('../api/library.js');
const req = (path, body, method = 'POST', auth = 'Bearer t') => new Request(`https://www.sahbi.bond/api/library?${path}`, { method, headers: { authorization: auth, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
// Creazione: nome pulito, pacchetto, versione 1, indirizzo di caricamento.
let r = await lib.POST(req('app=build', { name: 'Moto <Rush> @x', color: '#123456', size: 5000 }));
let d = await r.json(); assert.equal(r.status, 200, JSON.stringify(d));
const id = d.id; assert.match(id, /^[a-z0-9]{12}$/); assert.match(d.uploadUrl, /token=up/);
let job = JSON.parse(files[`jobs/${id}.json`]);
assert.equal(job.name, 'Moto Rush x'); assert.match(job.packageId, /^app\.motorushx\.[0-9a-f]{6}$/); assert.equal(job.versionCode, 1); assert.equal(job.color, '#123456');
// Avvio: il lavoro parte su GitHub con solo il numero.
r = await lib.POST(req(`app=start&id=${id}`)); assert.equal((await r.json()).status, 'building');
assert.match(dispatched.url, /actions\/workflows\/app-build\.yml\/dispatches$/); assert.deepEqual(dispatched.body, { ref: 'main', inputs: { job: id } }); assert.equal(dispatched.auth, 'Bearer ghp_test');
// GitHub senza token valido: rifiutato.
r = await lib.GET(req(`app=job&id=${id}`, null, 'GET', 'Bearer x.y.z')); assert.equal(r.status, 403);
const now = Math.floor(Date.now() / 1000);
const good = { iss: 'https://token.actions.githubusercontent.com', aud: 'sahbi-apps', exp: now + 300, nbf: now - 10, repository: 'baryoul86/sahbi', workflow_ref: 'baryoul86/sahbi/.github/workflows/app-build.yml@refs/heads/main', run_id: '9' };
r = await lib.GET(req(`app=job&id=${id}`, null, 'GET', `Bearer ${oidc({ ...good, workflow_ref: 'baryoul86/sahbi/.github/workflows/altro.yml@refs/heads/main' })}`)); assert.equal(r.status, 403);
r = await lib.GET(req(`app=job&id=${id}`, null, 'GET', `Bearer ${oidc({ ...good, repository: 'altro/repo' })}`)); assert.equal(r.status, 403);
r = await lib.GET(req(`app=job&id=${id}`, null, 'GET', `Bearer ${oidc(good)}`)); d = await r.json();
assert.equal(r.status, 200); assert.equal(d.packageId, job.packageId); assert.ok(d.keyPass && d.aabUpload && d.kitUpload && d.html);
// Fine: pronto, l'utente riceve i link.
r = await lib.POST(req(`app=done&id=${id}`, { ok: true }, 'POST', `Bearer ${oidc(good)}`)); assert.equal(r.status, 200);
r = await lib.GET(req(`app=status&id=${id}`, null, 'GET')); d = await r.json();
assert.equal(d.status, 'ready'); assert.match(d.aab, /token=rd/); assert.ok(d.keyPass);
// Limite mensile e solo Pro.
// Aggiornamento (stesso nome): stessa chiave e pacchetto, versione 2.
listed = [{ name: `${id}.json` }];
r = await lib.POST(req('app=build', { name: 'moto rush x', size: 10 })); d = await r.json(); assert.equal(d.update, true); assert.equal(d.version, 2);
assert.equal(JSON.parse(files[`jobs/${d.id}.json`]).packageId, job.packageId);
// 5 app nuove questo mese: la sesta no, ma l'aggiornamento sì.
const m = new Date().toISOString();
for (let i = 0; i < 5; i++) files[`jobs/n${i}xxxxxxxxxx.json`] = JSON.stringify({ id: `n${i}`, name: `App ${i}`, created: m, status: 'ready' });
listed = [0, 1, 2, 3, 4].map((i) => ({ name: `n${i}xxxxxxxxxx.json` }));
r = await lib.POST(req('app=build', { name: 'Altra', size: 10 })); assert.equal(r.status, 429);
r = await lib.POST(req('app=build', { name: 'App 2', size: 10 })); assert.equal(r.status, 200);
pro = false; listed = [];
r = await lib.POST(req('app=build', { name: 'Altra', size: 10 })); assert.equal(r.status, 402);
console.log('apps OK');
