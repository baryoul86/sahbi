// Accesso di prova per l'esame Apple: solo review@sahbi.bond con la password giusta.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'k', REVIEW_PASSWORD_SHA256: createHash('sha256').update('giusta').digest('hex') });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let links = 0;
globalThis.fetch = async (url, opt = {}) => {
  if (url.endsWith('/rpc/admin_alert')) return J(true);
  if (url.endsWith('/auth/v1/admin/users')) return J({ msg: 'exists' }, 422);
  if (url.endsWith('/auth/v1/admin/generate_link')) { links++; assert.equal(JSON.parse(opt.body).email, 'review@sahbi.bond'); return J({ hashed_token: 'th123' }); }
  throw new Error('unexpected ' + url);
};
const { POST } = await import('../api/config.js');
const req = (b) => new Request('https://w/api/config?review=1', { method: 'POST', body: JSON.stringify(b) });
let r = await POST(req({ email: 'review@sahbi.bond', password: 'sbagliata' })); assert.equal(r.status, 401);
r = await POST(req({ email: 'altro@x.com', password: 'giusta' })); assert.equal(r.status, 401);
assert.equal(links, 0);
r = await POST(req({ email: 'Review@Sahbi.bond ', password: 'giusta' })); assert.equal(r.status, 200); assert.equal((await r.json()).tokenHash, 'th123');
console.log('review OK');
