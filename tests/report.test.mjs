import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', RESEND_API_KEY: 're_test', ADMIN_EMAIL: 'admin@example.com' });
let mail = null;
globalThis.fetch = async (url, opt) => {
  if (url.endsWith('/auth/v1/user')) return opt.headers.authorization === 'Bearer good' ? new Response(JSON.stringify({ id: 'u1' })) : new Response('{}', { status: 401 });
  if (url.endsWith('/rpc/admin_alert')) return new Response('true', { headers: { 'content-type': 'application/json' } });
  if (url === 'https://api.resend.com/emails') { mail = JSON.parse(opt.body); return new Response('{}'); }
  throw new Error(url);
};
const { POST } = await import('../api/config.js');
const send = (body, auth = 'Bearer good') => POST(new Request('https://www.sahbi.bond/api/config?report=1', { method: 'POST', headers: { origin: 'https://www.sahbi.bond', authorization: auth }, body: JSON.stringify(body) }));
let r = await send({ kind: 'image', reason: 'Choquant ou violent', note: 'pas bien', content: 'un chat', url: 'https://x.supabase.co/img.png' });
assert.equal(r.status, 200); assert.match(mail.subject, /contenu signalé \(image\)/); assert.match(mail.text, /img\.png/); assert.match(mail.text, /u1/);
mail = null; r = await send({ kind: 'text', content: 'x' }, 'Bearer bad'); assert.equal(r.status, 401); assert.equal(mail, null);
r = await send({ kind: 'text', url: 'javascript:alert(1)', content: 'abc' }); assert.equal(r.status, 200); assert.doesNotMatch(mail.text, /javascript/);
console.log('report OK');
