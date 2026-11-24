import assert from 'node:assert/strict';
// Pubblicazione in un clic: solo Pro, niente pagine-trappola, nome del sito dell'utente protetto.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' });
const U = '11111111-1111-4111-8111-111111111111', V = '22222222-2222-4222-8222-222222222222';
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let user = U, pro = true; const meta = {}; const deleted = [];
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: user });
  if (url.includes('/rpc/get_profile')) return J({ pro_until: pro ? '2099-01-01T00:00:00Z' : null });
  if (url.includes('/rpc/')) return J(true);
  if (url.endsWith('/storage/v1/bucket/sites')) return J({ id: 'sites' });
  const m = url.match(/site-meta\/([a-z0-9-]+)\.json$/);
  if (m) { if (opt.method === 'POST') { meta[m[1]] = JSON.parse(opt.body).owner; return J({}); } return meta[m[1]] ? J({ owner: meta[m[1]] }) : J({}, 404); }
  if (url.includes('/object/upload/sign/sites/')) return J({ url: '/object/upload/sign/sites/x/index.html?token=t' });
  if (url.endsWith('/object/sites') && opt.method === 'DELETE') { deleted.push(JSON.parse(opt.body)); return J([]); }
  return J([]);
};
const { POST } = await import('../api/library.js');
const req = (q, b) => new Request(`https://w/api/library?${q}`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: b ? JSON.stringify(b) : undefined });
let r = await POST(req('publish=1', { title: 'Parfums Tunis', text: '<html><body><h1>Parfums</h1></body></html>', size: 3000 }));
let d = await r.json(); assert.equal(r.status, 200, JSON.stringify(d));
assert.match(d.slug, /^parfums-tunis-[a-z0-9]{4}$/); assert.match(d.url, /sahbi-sites\.vercel\.app\/parfums-tunis-/); assert.match(d.uploadUrl, /upload\/sign\/sites/);
const slug = d.slug;
// Ripubblicare = stesso indirizzo.
d = await (await POST(req('publish=1', { slug, title: 'x', text: '<p>v2</p>', size: 10 }))).json(); assert.equal(d.slug, slug);
// Pagine-trappola rifiutate.
assert.equal((await POST(req('publish=1', { title: 'x', text: '<form><input type="password"></form>', size: 10 }))).status, 422);
assert.equal((await POST(req('publish=1', { title: 'x', text: '<form>Connexion PayPal <input name="email"></form>', size: 10 }))).status, 422);
assert.equal((await POST(req('publish=1', { title: 'x', text: '<input name="cvv">', size: 10 }))).status, 422);
// Un altro utente non può prendere lo stesso nome: riceve un nome nuovo.
user = V; d = await (await POST(req('publish=1', { slug, title: 'Autre', text: '<p>a</p>', size: 10 }))).json(); assert.notEqual(d.slug, slug);
assert.equal((await POST(req(`unpublish=1&slug=${slug}`))).status, 404);
user = U; assert.equal((await POST(req(`unpublish=1&slug=${slug}`))).status, 200); assert.equal(deleted.length, 1);
pro = false; assert.equal((await POST(req('publish=1', { title: 'x', text: '<p>a</p>', size: 10 }))).status, 402);
console.log('publish OK');
