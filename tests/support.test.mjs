import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', RESEND_API_KEY: 're_test', ADMIN_EMAIL: 'admin@example.com', SUPPORT_AGENT_KEY_SHA256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' /* "test" */ });
const U = '11111111-1111-4111-8111-111111111111', T = '22222222-2222-4222-8222-222222222222';
const J = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...h } });
let mail = null, inserted = null, patched = null, uploaded = null, who = 'user@example.com', due = true;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: U, email: who });
  if (url.endsWith('/rpc/admin_alert')) return J(due);
  if (url.endsWith('/rpc/get_profile')) return J({ plan: 'free' });
  if (url.includes('/rpc/')) return J(5);
  if (url === 'https://api.resend.com/emails') { mail = JSON.parse(opt.body); return new Response('{}'); }
  if (url.includes('/storage/v1/object/sign/')) return J({ signedURL: '/object/sign/images/support/x.jpg?token=t' });
  if (url.includes('/storage/v1/object/images/support/')) { uploaded = url; return J({}); }
  if (url.includes('/rest/v1/support_tickets')) {
    if (opt.method === 'POST') { inserted = JSON.parse(opt.body); return J([{ id: T, ...inserted }], 201); }
    if (opt.method === 'PATCH') { patched = { url, body: JSON.parse(opt.body) }; return J([]); }
    if (url.includes('status=eq.open') && url.includes('select=id&')) return J([], 200, { 'content-range': '0-0/3' });
    return J([{ id: T, user_id: U, email: 'user@example.com', message: 'Le site ne marche pas, appelle-moi au 06 12 34 56 78 ou ali@mail.com', shot: 'support/x.jpg', meta: { platform: 'app Android', lastError: 'boom' }, status: 'open', created_at: '2026-11-24T10:00:00Z', user_seen: false }]);
  }
  return J([]);
};
const me = await import('../api/me.js');
const admin = await import('../api/admin.js');
const req = (url, body, method = 'POST') => new Request(url, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(500)).toString('base64');

// Utente: invio con screenshot e dati tecnici → riga, file, e-mail all'amministratore.
let r = await me.POST(req('https://w/api/me?support=1', { message: 'Le bouton ne marche pas', shot: png, meta: { platform: 'app Android', lang: 'fr', lastError: 'x', evil: 'no' } }));
assert.equal(r.status, 200);
assert.equal(inserted.user_id, U); assert.equal(inserted.email, 'user@example.com'); assert.equal(inserted.meta.evil, undefined); assert.equal(inserted.meta.pro, false);
assert.match(uploaded, /support\/2222.*\.jpg$/); assert.equal(patched.body.shot.startsWith('support/'), true);
assert.deepEqual(mail.to, ['admin@example.com']); assert.equal(mail.reply_to, 'user@example.com'); assert.match(mail.text, /Le bouton ne marche pas/);
// Messaggio vuoto o troppo frequente.
r = await me.POST(req('https://w/api/me?support=1', { message: '' })); assert.equal(r.status, 400);
due = false; r = await me.POST(req('https://w/api/me?support=1', { message: 'encore un message' })); assert.equal(r.status, 429); due = true;
// Lista dell'utente + "visto".
patched = null; r = await me.GET(req('https://w/api/me?support=1&seen=1', null, 'GET')); const d = await r.json();
assert.equal(d.unseen, 1); assert.match(patched.url, /user_id=eq\.1111.*user_seen=eq\.false/);

// Pannello: solo l'amministratore.
r = await admin.GET(req('https://w/api/admin?support=open', null, 'GET')); assert.equal(r.status, 403);
who = 'admin@example.com';
r = await admin.GET(req('https://w/api/admin?support=open', null, 'GET')); const a = await r.json();
assert.equal(a.open, 3); assert.match(a.tickets[0].shotUrl, /^https:\/\/sb\.test\/storage\/v1\/object\/sign/);
r = await admin.POST(req('https://w/api/admin?support=reply', { id: T, reply: 'Corrigé, merci !' }));
assert.equal(r.status, 200); assert.equal(patched.body.status, 'answered'); assert.equal(patched.body.user_seen, false);
who = 'user@example.com';
r = await admin.POST(req('https://w/api/admin?support=reply', { id: T, reply: 'x' })); assert.equal(r.status, 403);

// Controllo automatico: chiave giusta → testo senza e-mail né telefono; chiave sbagliata → 401.
r = await admin.GET(new Request('https://w/api/admin?support=agent&key=nope')); assert.equal(r.status, 401);
r = await admin.GET(new Request('https://w/api/admin?support=agent&key=test')); const txt = await r.text();
assert.equal(r.status, 200); assert.match(txt, /Le site ne marche pas/); assert.doesNotMatch(txt, /ali@mail\.com|06 12 34|user@example\.com/); assert.match(txt, /\[e-mail\]/); assert.match(txt, /Capture : https/);
console.log('support OK');
