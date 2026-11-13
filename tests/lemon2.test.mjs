import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', LEMONSQUEEZY_API_KEY: 'lk', PUBLIC_URL: 'https://www.sahbi.bond' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let sent = null, calls = [];
globalThis.fetch = async (url, opt = {}) => {
  calls.push(url);
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111', email: 'u@x.com' });
  if (url.includes('/variants')) return J({ data: [
    { id: '900', attributes: { is_subscription: false, interval: null, status: 'pending', product_id: 5 } },
    { id: '901', attributes: { is_subscription: true, interval: 'month', status: 'pending', product_id: 7 } } ] });
  if (url.endsWith('/products/7')) return J({ data: { attributes: { store_id: 321 } } });
  if (url.endsWith('/checkouts')) { sent = JSON.parse(opt.body); return J({ data: { attributes: { url: 'https://x/checkout' } } }, 201); }
  return J({}, 404);
};
const { POST } = await import('../api/checkout.js');
const cfg = (await (await import('../api/config.js')).GET(new Request('https://www.sahbi.bond/api/config')).json()).payments;
assert.equal(cfg.lemonsqueezy, true); assert.equal(cfg.lemonsqueezyYear, false);
const req = (b) => new Request('https://www.sahbi.bond/api/checkout', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(b) });
let r = await POST(req({ provider: 'lemonsqueezy' })); const d = await r.json();
assert.equal(d.url, 'https://x/checkout');
assert.equal(sent.data.relationships.variant.data.id, '901'); assert.equal(sent.data.relationships.store.data.id, '321');
const n = calls.length; await POST(req({ provider: 'lemonsqueezy' })); assert.equal(calls.filter((u) => u.includes('variants')).length, 1, 'cache');
r = await POST(req({ provider: 'lemonsqueezy', plan: 'year' })); assert.equal(r.status, 503);
console.log('lemon2 OK');
