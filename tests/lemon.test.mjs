import assert from 'node:assert/strict';
import crypto from 'node:crypto';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', LEMONSQUEEZY_API_KEY: 'lk', LEMONSQUEEZY_STORE_ID: '123', LEMONSQUEEZY_VARIANT_ID: '456', LEMONSQUEEZY_VARIANT_ID_YEAR: '789', LEMONSQUEEZY_WEBHOOK_SECRET: 'whs', PUBLIC_URL: 'https://www.sahbi.bond' });
const U = '11111111-1111-1111-1111-111111111111';
let lastCheckout = null, until = [], payments = [];
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const body = opt.body ? JSON.parse(opt.body) : null;
  if (url.endsWith('/auth/v1/user')) return J({ id: U, email: 'a@b.c' });
  if (url === 'https://api.lemonsqueezy.com/v1/checkouts') { assert.equal(opt.headers.authorization, 'Bearer lk'); lastCheckout = body; return J({ data: { attributes: { url: 'https://sahbi.lemonsqueezy.com/checkout/custom/x' } } }, 201); }
  if (url.includes('/rpc/extend_pro_until')) { until.push(body.p_until); return J(null); }
  if (url.includes('/rpc/record_payment')) { const n = !payments.includes(body.p_id); payments.push(body.p_id); return J(n); }
  if (url.includes('/rpc/admin_alert')) return J(false);
  throw new Error('inatteso ' + url);
};
const checkout = (await import('../api/checkout.js')).POST;
const hook = (await import('../api/stripe-webhook.js')).POST;
const cfg = (await import('../api/config.js')).GET;
let r = await checkout(new Request('https://www.sahbi.bond/api/checkout', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ provider: 'lemonsqueezy', plan: 'year' }) }));
assert.equal((await r.json()).url, 'https://sahbi.lemonsqueezy.com/checkout/custom/x');
assert.equal(lastCheckout.data.relationships.variant.data.id, '789'); assert.equal(lastCheckout.data.attributes.checkout_data.custom.user_id, U);
assert.equal(lastCheckout.data.attributes.product_options.redirect_url, 'https://www.sahbi.bond/?paid=1');
const send = (obj, sig) => { const raw = JSON.stringify(obj); return hook(new Request('https://www.sahbi.bond/api/stripe-webhook?provider=lemonsqueezy', { method: 'POST', body: raw, headers: { 'x-signature': sig ?? crypto.createHmac('sha256', 'whs').update(raw).digest('hex') } })); };
r = await send({ meta: { event_name: 'subscription_created', custom_data: { user_id: U } }, data: { type: 'subscriptions', id: '1', attributes: { status: 'active', renews_at: '2026-12-08T10:00:00Z' } } });
assert.equal(r.status, 200); assert.equal(until.at(-1), '2026-12-10T10:00:00.000Z');
r = await send({ meta: { event_name: 'subscription_payment_success', custom_data: { user_id: U } }, data: { type: 'subscription-invoices', id: '9', attributes: { total: 650, currency: 'EUR', status: 'paid' } } });
assert.deepEqual(payments, ['ls_9']);
r = await send({ meta: { event_name: 'subscription_updated', custom_data: { user_id: U } }, data: { type: 'subscriptions', id: '1', attributes: { status: 'expired' } } });
const n = until.length; assert.equal(n, 2, 'scaduto: niente proroga');
r = await send({ meta: { event_name: 'subscription_created' }, data: {} }, 'falsa'); assert.equal(r.status, 400);
r = cfg(new Request('https://www.sahbi.bond/api/config')); const c = await r.json(); assert.equal(c.payments.lemonsqueezy, true); assert.equal(c.payments.lemonsqueezyYear, true);
console.log('Test Lemon Squeezy OK');
