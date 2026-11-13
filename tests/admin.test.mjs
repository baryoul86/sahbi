import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', ADMIN_EMAIL: 'Boss@Mail.com', RESEND_API_KEY: 're_x', STRIPE_SECRET_KEY: 'sk_test_1' });
let email = 'boss@mail.com', mails = [], alerts = {}, openaiStatus = 200, dbUp = true;
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const body = typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
  if (url.endsWith('/auth/v1/user')) return J({ id: '11111111-1111-1111-1111-111111111111', email });
  if (url.includes('/rpc/sahbi_today')) return dbUp ? J('2026-11-08') : J({}, 500);
  if (url.includes('/rpc/admin_alert')) { const a = alerts[body.p_kind] ||= { n: 0 }; a.n++; return J(a.n === 1); }
  if (url.includes('/rpc/admin_stats')) return J({ users: 5, users_today: 1, users_week: 3, pro: 2, active_today: 2, usage_today: { chat: 9 }, videos_month: 1, payments_month: [{ provider: 'stripe', currency: 'eur', count: 2, amount: 1300 }], payments_total: [], alerts: [] });
  if (url.includes('/rpc/get_profile')) return J({ pro_until: '2099-01-01', referral_code: 'X', referrals: 0 });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.includes('/rpc/remaining')) return J(3);
  if (url.includes('/rpc/refund_credit')) return J(null);
  if (url.includes('/rest/v1/memories')) return J([]);
  if (url.startsWith('https://api.openai.com/v1/models')) return J({ data: [] }, openaiStatus === 200 ? 200 : 401);
  if (url.endsWith('/chat/completions')) return openaiStatus === 200 ? J({ choices: [{ message: { content: 'pong' } }] }) : new Response(JSON.stringify({ error: { message: 'You exceeded your current quota, please check your plan and billing details.', code: 'insufficient_quota' } }), { status: 429 });
  if (url.startsWith('https://api.stripe.com/v1/balance')) { assert.ok(!opt.method || opt.method === 'GET'); return J({ available: [{ amount: 1200, currency: 'eur' }], pending: [{ amount: 650, currency: 'eur' }] }); }
  if (url === 'https://api.resend.com/emails') { mails.push(body); return J({ id: 'm1' }); }
  throw new Error('inatteso ' + url);
};
const req = (p, h = {}) => new Request(`https://www.sahbi.bond${p}`, { headers: { authorization: 'Bearer t', 'content-type': 'application/json', ...h } });
const { GET } = await import('../api/admin.js');
const chat = (await import('../api/chat.js')).POST;
const me = (await import('../api/me.js')).GET;

let r = await GET(new Request('https://www.sahbi.bond/api/admin?health=1')); let d = await r.json();
assert.equal(r.status, 200); assert.equal(d.ok, true); assert.equal(d.stats, undefined, 'niente dati nel controllo pubblico');
email = 'other@mail.com'; r = await GET(req('/api/admin')); assert.equal(r.status, 403);
email = 'boss@mail.com'; r = await GET(req('/api/admin')); d = await r.json();
assert.equal(r.status, 200); assert.equal(d.stats.users, 5); assert.equal(d.stripe.available, '12.00 EUR'); assert.equal(d.stripe.live, false);
r = await me(req('/api/me')); assert.equal((await r.json()).admin, true);
// cron: un resoconto, poi niente fino a domani
r = await GET(new Request('https://www.sahbi.bond/api/admin?cron=1')); d = await r.json(); assert.equal(d.report, true); assert.equal(mails.length, 1); assert.match(mails[0].subject, /résumé/); assert.match(mails[0].text, /Pro actifs : 2/);
r = await GET(new Request('https://www.sahbi.bond/api/admin?cron=1')); d = await r.json(); assert.equal(d.report, false); assert.equal(mails.length, 1);
// credito OpenAI finito durante una chat → avviso e-mail (una sola volta)
openaiStatus = 429;
r = await chat(new Request('https://www.sahbi.bond/api/chat', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'salut' }] }) }));
assert.equal(r.status, 502); assert.equal(mails.length, 2); assert.match(mails[1].subject, /crédit OpenAI épuisé/); assert.deepEqual(mails[1].to, ['boss@mail.com']);
r = await chat(new Request('https://www.sahbi.bond/api/chat', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'salut' }] }) }));
assert.equal(mails.length, 2, 'non ripete l’e-mail');
// controllo pubblico con OpenAI giù → 503
r = await GET(new Request('https://www.sahbi.bond/api/admin?health=1')); assert.equal(r.status, 503);
console.log('Test amministratore OK');
