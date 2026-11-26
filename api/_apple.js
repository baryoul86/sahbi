// Abbonamento Sahbi Pro comprato con Apple (app iPhone, StoreKit 2).
// L'app manda la transazione firmata da Apple (JWS); qui si controlla la firma fino al certificato radice di Apple,
// poi si allunga il Pro fino alla scadenza dell'abbonamento (+2 giorni di margine per il rinnovo).
import { X509Certificate, createHash, verify } from 'node:crypto';
import { env, rpc, supabaseUrl, serviceHeaders } from './_lib.js';

export const appleBundle = () => env('APPLE_BUNDLE_ID', 'bond.sahbi.app');
export const appleSku = () => env('APPLE_PRODUCT_ID', 'sahbi_pro_monthly');
// Impronta SHA-256 di "Apple Root CA - G3" (pubblica, da https://www.apple.com/certificateauthority/).
const ROOT = () => env('APPLE_ROOT_SHA256', '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179').replace(/[^0-9A-F]/gi, '').toUpperCase();
// Estensioni Apple: certificato intermedio WWDR (1.2.840.113635.100.6.2.1) e firma delle ricevute (1.2.840.113635.100.6.11.1).
const OID_LEAF = Buffer.from('060a2a864886f76364060b01', 'hex');
const OID_MID = Buffer.from('060a2a864886f763640602', 'hex');
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function decodeAppleJws(jws) {
  if (typeof jws !== 'string' || jws.length > 20000) throw new Error('bad');
  const [h, p, s] = jws.split('.');
  if (!h || !p || !s) throw new Error('bad');
  const head = JSON.parse(b64u(h).toString());
  if (head.alg !== 'ES256' || !Array.isArray(head.x5c) || head.x5c.length !== 3) throw new Error('bad');
  const [leaf, mid, root] = head.x5c.map((c) => new X509Certificate(Buffer.from(c, 'base64')));
  const fp = createHash('sha256').update(root.raw).digest('hex').toUpperCase();
  if (fp !== ROOT()) throw new Error('root');
  if (!root.verify(root.publicKey) || !mid.verify(root.publicKey) || !leaf.verify(mid.publicKey)) throw new Error('chain');
  if (!mid.raw.includes(OID_MID) || !leaf.raw.includes(OID_LEAF)) throw new Error('oid');
  if (!verify('sha256', Buffer.from(`${h}.${p}`), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, b64u(s))) throw new Error('sig');
  return JSON.parse(b64u(p).toString());
}

async function ownerOf(original) {
  const url = `${supabaseUrl()}/rest/v1/payments?select=user_id&provider=in.(appstore,appstore_test)&id=like.${encodeURIComponent(`as_${original}_*`)}&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.user_id || null;
}

// Ritorna { ok, until } oppure { ok:false, code, message }.
export async function verifyApple(userId, jws) {
  let t;
  try { t = decodeAppleJws(jws); } catch { return { ok: false, code: 'bad_request', message: 'Achat Apple invalide.' }; }
  if (t.bundleId !== appleBundle() || t.productId !== appleSku()) return { ok: false, code: 'bad_request', message: 'Produit inconnu.' };
  if (t.appAccountToken && String(t.appAccountToken).toLowerCase() !== String(userId).toLowerCase()) return { ok: false, code: 'taken', message: 'Cet abonnement Apple est lié à un autre compte Sahbi.' };
  const original = String(t.originalTransactionId || t.transactionId || '');
  if (!original) return { ok: false, code: 'bad_request', message: 'Achat Apple invalide.' };
  const owner = await ownerOf(original);
  if (owner && owner !== userId) return { ok: false, code: 'taken', message: 'Cet abonnement Apple est déjà lié à un autre compte Sahbi.' };
  if (t.revocationDate) return { ok: false, code: 'inactive', message: 'Cet abonnement a été remboursé.' };
  const expiry = Number(t.expiresDate || 0);
  // Prova gratuita Apple (offerta introduttiva "FREE_TRIAL"): Pro leggero fino alla fine della prova.
  const isTrial = Number(t.offerType) === 1 && String(t.offerDiscountType || '').toUpperCase() === 'FREE_TRIAL';
  // Il primo acquisto si registra sempre (lega l'abbonamento a questo account), anche se poi è scaduto.
  await rpc('record_payment', {
    p_id: `as_${original}_${t.transactionId}`, p_user: userId, p_provider: t.environment === 'Production' ? 'appstore' : 'appstore_test',
    p_amount: isTrial ? 0 : t.environment === 'Production' ? Math.round(Number(t.price || 0) / 10) || Number(env('APPLE_PRICE_CENTS', '699')) : 0,
    p_currency: String(t.currency || 'eur').toLowerCase(),
  }).catch(() => {}); // già registrato (stessa transazione)
  if (!(expiry > Date.now())) return { ok: false, code: 'inactive', message: 'Cet abonnement est expiré.' };
  const until = new Date(expiry + 2 * 864e5).toISOString();
  if (isTrial) await rpc('set_trial', { p_user: userId, p_until: new Date(expiry).toISOString() }).catch(() => {});
  else await rpc('end_trial', { p_user: userId }).catch(() => {});
  await rpc('extend_pro_until', { p_user: userId, p_until: until });
  return { ok: true, until, trial: isTrial };
}
