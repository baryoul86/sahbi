import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', RESEND_API_KEY: 're_test' });
let mail = null, gens = 0, created = 0, due = true;
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  if (url.endsWith('/rpc/admin_alert')) return J(due);
  if (url.endsWith('/auth/v1/admin/generate_link')) { gens++; return created ? J({ properties: { hashed_token: 'abc123' } }) : J({ msg: 'User not found' }, 404); }
  if (url.endsWith('/auth/v1/admin/users')) { created++; return J({ id: 'u' }); }
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
console.log('login OK');
