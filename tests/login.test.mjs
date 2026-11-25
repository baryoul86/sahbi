import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', RESEND_API_KEY: 're_test' });
let errRow = null, mail = null, gens = 0, created = 0, due = true;
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  if (url.endsWith('/rpc/admin_alert')) return J(due);
  if (url.endsWith('/auth/v1/admin/generate_link')) { gens++; return created ? J({ properties: { hashed_token: 'abc123' } }) : J({ msg: 'User not found' }, 404); }
  if (url.endsWith('/auth/v1/admin/users')) { created++; return J({ id: 'u' }); }
  if (url.endsWith('/rest/v1/client_errors')) { errRow = JSON.parse(opt.body); return J({}, 201); }
  if (url === 'https://api.resend.com/emails') { mail = JSON.parse(opt.body); return J({ id: 'm' }); }
  return J({});
};
const { POST } = await import('../api/config.js');
const req = (b) => new Request('https://www.sahbi.bond/api/config?login=1', { method: 'POST', headers: { origin: 'https://www.sahbi.bond', 'content-type': 'application/json' }, body: JSON.stringify(b) });
let r = await POST(req({ email: 'Nouvelle@Example.com.', lang: 'en' }));
assert.equal(r.status, 200); assert.equal(created, 1); assert.equal(gens, 2);
assert.deepEqual(mail.to, ['nouvelle@example.com']); assert.match(mail.html, /https:\/\/www\.sahbi\.bond\/\?th=abc123/); assert.equal(mail.subject, 'Your Sahbi sign-in link');
r = await POST(req({ email: 'a@b.co', ios: true })); assert.match(mail.html, /app-login\.html\?th=abc123/);
r = await POST(req({ email: 'pas-un-email' })); assert.equal(r.status, 400);
due = false; r = await POST(req({ email: 'a@b.co' })); assert.equal(r.status, 429);
due = true;
const er = (b, h = {}) => new Request('https://www.sahbi.bond/api/config?err=1', { method: 'POST', headers: { origin: 'https://www.sahbi.bond', 'x-vercel-ip-country': 'RU', ...h }, body: JSON.stringify(b) });
r = await POST(er({ kind: 'login', message: 'supabase-otp 500 pour lisi@gmail.com', meta: { app: 'web', lang: 'en' } }));
assert.equal(r.status, 200); assert.equal(errRow.kind, 'login'); assert.equal(errRow.meta.country, 'RU'); assert.doesNotMatch(errRow.message, /gmail/);
console.log('login OK');
