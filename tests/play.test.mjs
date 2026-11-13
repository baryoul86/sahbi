import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const sa = { client_email: 'sa@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', GOOGLE_PLAY_SERVICE_ACCOUNT: JSON.stringify(sa) });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
let user = U1, ack = 0, payments = [], extended = [], state = 'SUBSCRIPTION_STATE_ACTIVE', ackState = 'ACKNOWLEDGEMENT_STATE_PENDING';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: user, email: 'u@x.com' });
  if (url === 'https://oauth2.googleapis.com/token') {
    const a = new URLSearchParams(opt.body).get('assertion').split('.');
    assert.ok(crypto.createVerify('RSA-SHA256').update(`${a[0]}.${a[1]}`).verify(crypto.createPublicKey(privateKey), Buffer.from(a[2], 'base64url')));
    return J({ access_token: 'gtok', expires_in: 3600 });
  }
  if (url.includes('/subscriptionsv2/tokens/')) {
    assert.equal(opt.headers.authorization, 'Bearer gtok'); assert.ok(url.includes('/applications/bond.sahbi.app/'));
    if (url.includes('bad')) return J({ error: { message: 'not found' } }, 404);
    return J({ subscriptionState: state, acknowledgementState: ackState, lineItems: [{ productId: 'sahbi_pro', expiryTime: new Date(Date.now() + 30 * 864e5).toISOString(), latestSuccessfulOrderId: 'GPA.1234-5678..0' }] });
  }
  if (url.endsWith(':acknowledge')) { ack++; ackState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; return J({}); }
  if (url.startsWith('https://sb.test/rest/v1/payments')) { const base = decodeURIComponent(url.match(/id=like\.([^&]+)/)[1]).replace('*', ''); const r = payments.find((p) => p.id.startsWith(base)); return J(r ? [{ user_id: r.user }] : []); }
  if (url.endsWith('/rpc/record_payment')) { const b = JSON.parse(opt.body); if (payments.some((p) => p.id === b.p_id)) return J(false); payments.push({ id: b.p_id, user: b.p_user }); return J(true); }
  if (url.endsWith('/rpc/extend_pro_until')) { extended.push(JSON.parse(opt.body)); return J(null); }
  throw new Error('unexpected ' + url);
};
const { POST } = await import('../api/checkout.js');
const cfg = (await (await import('../api/config.js')).GET(new Request('https://w/api/config')).json()).payments;
assert.equal(cfg.googleplay, true); assert.equal(cfg.playSku, 'sahbi_pro');
const req = (b) => new Request('https://www.sahbi.bond/api/checkout', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(b) });
let r = await POST(req({ provider: 'googleplay', token: 'tok-aaaaaaaaaa', sku: 'sahbi_pro' })); let d = await r.json();
assert.equal(r.status, 200, JSON.stringify(d)); assert.equal(ack, 1); assert.equal(payments.length, 1); assert.equal(payments[0].id, 'gp_GPA.1234-5678..0'); assert.equal(extended.length, 1);
r = await POST(req({ provider: 'googleplay', token: 'tok-aaaaaaaaaa', sku: 'sahbi_pro' })); assert.equal(r.status, 200); assert.equal(ack, 1, 'no double ack');
user = U2; r = await POST(req({ provider: 'googleplay', token: 'tok-aaaaaaaaaa', sku: 'sahbi_pro' })); assert.equal(r.status, 409);
user = U1; r = await POST(req({ provider: 'googleplay', token: 'bad-tokenxxxx', sku: 'sahbi_pro' })); assert.equal(r.status, 400);
r = await POST(req({ provider: 'googleplay', token: 'tok-aaaaaaaaaa', sku: 'other' })); assert.equal(r.status, 400);
state = 'SUBSCRIPTION_STATE_EXPIRED'; r = await POST(req({ provider: 'googleplay', token: 'tok-aaaaaaaaaa', sku: 'sahbi_pro' })); assert.equal(r.status, 400);
console.log('play OK');
