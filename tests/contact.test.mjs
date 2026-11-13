import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', RESEND_API_KEY: 're_test', ADMIN_EMAIL: 'admin@example.com' });
let mail = null, due = true;
globalThis.fetch = async (url, opt) => {
  if (url.endsWith('/rpc/admin_alert')) return new Response(JSON.stringify(due), { headers: { 'content-type': 'application/json' } });
  if (url === 'https://api.resend.com/emails') { mail = JSON.parse(opt.body); return new Response('{}'); }
  throw new Error(url);
};
const { POST } = await import('../api/config.js');
const send = (body, origin = 'https://www.sahbi.bond') => POST(new Request('https://www.sahbi.bond/api/config?contact=1', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
let r = await send({ name: 'Ali', email: 'ali@example.com', message: 'Bonjour, une question sur Sahbi.' });
assert.equal(r.status, 200); assert.equal(mail.reply_to, 'ali@example.com'); assert.deepEqual(mail.to, ['admin@example.com']); assert.match(mail.text, /une question/);
mail = null; r = await send({ email: 'pas-un-email', message: 'Bonjour, une question.' }); assert.equal(r.status, 400); assert.equal(mail, null);
r = await send({ email: 'a@b.co', message: 'Spam spam spam', website: 'x' }); assert.equal(r.status, 200); assert.equal(mail, null); // robot
r = await send({ email: 'a@b.co', message: 'Bonjour bonjour' }, 'https://evil.com'); assert.equal(r.status, 403); assert.equal(mail, null);
due = false; r = await send({ email: 'a@b.co', message: 'Bonjour bonjour' }); assert.equal(r.status, 429); assert.equal(mail, null);
console.log('contact OK');
