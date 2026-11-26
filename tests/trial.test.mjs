import assert from 'node:assert/strict';
import crypto from 'node:crypto';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', LEMONSQUEEZY_API_KEY: 'lk', LEMONSQUEEZY_STORE_ID: '123', LEMONSQUEEZY_WEBHOOK_SECRET: 'whs' });
const U = '11111111-1111-1111-1111-111111111111';
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
let profile = {}, calls = [], checkout = null;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const body = opt.body ? JSON.parse(opt.body) : null;
  if (url.endsWith('/auth/v1/user')) return J({ id: U, email: 'a@b.c' });
  if (url.endsWith('/rpc/get_profile')) return J(profile);
  if (url.includes('/rpc/')) { calls.push([url.split('/rpc/')[1], body]); return J(null); }
  if (url.startsWith('https://api.lemonsqueezy.com/v1/variants')) return J({ data: [
    { id: '456', attributes: { is_subscription: true, interval: 'month', status: 'published', has_free_trial: false } },
    { id: '999', attributes: { is_subscription: true, interval: 'month', status: 'published', has_free_trial: true } }] });
  if (url === 'https://api.lemonsqueezy.com/v1/checkouts') { checkout = body; return J({ data: { attributes: { url: 'https://x' } } }, 201); }
  return J({});
};
const { getPlan } = await import('../api/_lib.js');
const future = new Date(Date.now() + 2 * 864e5).toISOString();
// Prova in corso: Pro leggero (niente video, 3 immagini).
profile = { pro_until: future, trial_until: future, trial_used: true };
let p = await getPlan(U);
assert.equal(p.pro, true); assert.equal(p.trial, true); assert.equal(p.limits.video, 0); assert.equal(p.limits.image, 3);
// Pro pagato: limiti completi.
profile = { pro_until: future, trial_until: null, trial_used: true };
p = await getPlan(U); assert.equal(p.trial, false); assert.equal(p.limits.image, 8);
// Checkout: la variante con prova solo a chi non l'ha mai avuta.
const co = (await import('../api/checkout.js')).POST;
const buy = () => co(new Request('https://www.sahbi.bond/api/checkout', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ provider: 'lemonsqueezy', trial: true }) }));
profile = {}; await buy(); assert.equal(checkout.data.relationships.variant.data.id, '999');
profile = { trial_used: true }; await buy(); assert.equal(checkout.data.relationships.variant.data.id, '456');
profile = { pro_until: '2025-01-01T00:00:00Z' }; await buy(); assert.equal(checkout.data.relationships.variant.data.id, '456');
// Webhook: on_trial → set_trial; active → end_trial.
const hook = (await import('../api/stripe-webhook.js')).POST;
const send = (obj) => { const raw = JSON.stringify(obj); return hook(new Request('https://www.sahbi.bond/api/stripe-webhook?provider=lemonsqueezy', { method: 'POST', body: raw, headers: { 'x-signature': crypto.createHmac('sha256', 'whs').update(raw).digest('hex') } })); };
calls = [];
await send({ meta: { event_name: 'subscription_created', custom_data: { user_id: U } }, data: { type: 'subscriptions', id: '1', attributes: { status: 'on_trial', renews_at: '2026-12-01T10:00:00Z', trial_ends_at: '2026-12-01T10:00:00Z' } } });
assert.deepEqual(calls.find((c) => c[0] === 'set_trial')?.[1], { p_user: U, p_until: '2026-12-01T10:00:00.000Z' });
calls = [];
await send({ meta: { event_name: 'subscription_updated', custom_data: { user_id: U } }, data: { type: 'subscriptions', id: '1', attributes: { status: 'active', renews_at: '2027-01-01T10:00:00Z' } } });
assert.ok(calls.some((c) => c[0] === 'end_trial'));
console.log('trial OK');
