// Acquisto Apple (app iPhone): firma JWS verificata fino alla radice, legame con l'account, Pro allungato.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Catena di certificati finta (radice → intermedio Apple → foglia "ricevute"), con le estensioni Apple.
const d = mkdtempSync(join(tmpdir(), 'apl-'));
const sh = (c) => execSync(c, { cwd: d, stdio: 'pipe' });
writeFileSync(join(d, 'ext.cnf'), '[mid]\nbasicConstraints=critical,CA:true\n1.2.840.113635.100.6.2.1=ASN1:NULL\n[leaf]\n1.2.840.113635.100.6.11.1=ASN1:NULL\n');
const mk = (n) => sh(`openssl ecparam -name prime256v1 -genkey -noout -out ${n}.key && openssl pkcs8 -topk8 -nocrypt -in ${n}.key -out ${n}.p8`);
mk('root'); mk('mid'); mk('leaf');
sh('openssl req -x509 -new -key root.key -subj /CN=FakeRoot -days 30 -out root.pem');
sh('openssl req -new -key mid.key -subj /CN=FakeMid -out mid.csr && openssl x509 -req -in mid.csr -CA root.pem -CAkey root.key -CAcreateserial -days 30 -extfile ext.cnf -extensions mid -out mid.pem');
sh('openssl req -new -key leaf.key -subj /CN=FakeLeaf -out leaf.csr && openssl x509 -req -in leaf.csr -CA mid.pem -CAkey mid.key -CAcreateserial -days 30 -extfile ext.cnf -extensions leaf -out leaf.pem');
const der = (n) => new crypto.X509Certificate(readFileSync(join(d, `${n}.pem`))).raw.toString('base64');
const rootFp = crypto.createHash('sha256').update(new crypto.X509Certificate(readFileSync(join(d, 'root.pem'))).raw).digest('hex');
const leafKey = crypto.createPrivateKey(readFileSync(join(d, 'leaf.p8')));
const otherKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const jws = (payload, key = leafKey, x5c = [der('leaf'), der('mid'), der('root')]) => {
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', x5c })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${s}`;
};

Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', APPLE_ROOT_SHA256: rootFp });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
let user = U1; const payments = [], extended = [];
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: user, email: 'u@x.com' });
  if (url.startsWith('https://sb.test/rest/v1/payments')) { const base = decodeURIComponent(url.match(/id=like\.([^&]+)/)[1]).replace('*', ''); const r = payments.find((p) => p.id.startsWith(base)); return J(r ? [{ user_id: r.user }] : []); }
  if (url.endsWith('/rpc/record_payment')) { const b = JSON.parse(opt.body); if (payments.some((p) => p.id === b.p_id)) return J(false); payments.push({ id: b.p_id, user: b.p_user, amount: b.p_amount, provider: b.p_provider }); return J(true); }
  if (url.endsWith('/rpc/extend_pro_until')) { extended.push(JSON.parse(opt.body)); return J(null); }
  throw new Error('unexpected ' + url);
};
const { POST } = await import('../api/checkout.js');
const req = (b) => new Request('https://www.sahbi.bond/api/checkout', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(b) });
const tx = (o = {}) => ({ bundleId: 'bond.sahbi.app', productId: 'sahbi_pro_monthly', transactionId: '2000001', originalTransactionId: '2000000', expiresDate: Date.now() + 30 * 864e5, environment: 'Production', price: 6990, currency: 'EUR', appAccountToken: U1, ...o });

let r = await POST(req({ provider: 'appstore', jws: jws(tx()) }));
assert.equal(r.status, 200, await r.clone().text());
assert.equal(extended.length, 1); assert.equal(payments[0].amount, 699); assert.equal(payments[0].provider, 'appstore');
// Rinnovo: stessa transazione originale, nuova transazione.
r = await POST(req({ provider: 'appstore', jws: jws(tx({ transactionId: '2000002' })) })); assert.equal(r.status, 200); assert.equal(payments.length, 2);
// Firma falsa, catena senza la radice giusta, prodotto sbagliato.
r = await POST(req({ provider: 'appstore', jws: jws(tx(), otherKey) })); assert.equal(r.status, 400);
r = await POST(req({ provider: 'appstore', jws: jws(tx(), leafKey, [der('leaf'), der('mid'), der('mid')]) })); assert.equal(r.status, 400);
r = await POST(req({ provider: 'appstore', jws: jws(tx({ productId: 'altro' })) })); assert.equal(r.status, 400);
r = await POST(req({ provider: 'appstore', jws: 'abc' })); assert.equal(r.status, 400);
// Un altro account non può usare lo stesso abbonamento.
user = U2;
r = await POST(req({ provider: 'appstore', jws: jws(tx({ appAccountToken: undefined, transactionId: '2000003' })) })); assert.equal(r.status, 409);
r = await POST(req({ provider: 'appstore', jws: jws(tx({ originalTransactionId: '3000000' })) })); assert.equal(r.status, 409); // token = U1
// Scaduto: niente Pro.
r = await POST(req({ provider: 'appstore', jws: jws(tx({ originalTransactionId: '4000000', transactionId: '4000001', appAccountToken: U2, expiresDate: Date.now() - 1000 })) })); assert.equal(r.status, 400);
assert.equal(extended.length, 2);
console.log('apple OK');
