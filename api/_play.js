// Google Play Billing (abbonamento comprato dentro l'app Android).
// Su Vercel: GOOGLE_PLAY_SERVICE_ACCOUNT = il file JSON del "service account" Google Cloud (tutto il contenuto),
// ANDROID_PACKAGE (predefinito bond.sahbi.app), PLAY_SUBSCRIPTION_ID (predefinito sahbi_pro).
import crypto from 'node:crypto';
import { env, rpc, supabaseUrl, serviceHeaders } from './_lib.js';

export const playSku = () => env('PLAY_SUBSCRIPTION_ID', 'sahbi_pro');
export const playPackage = () => env('ANDROID_PACKAGE', 'bond.sahbi.app');

function account() {
  const raw = env('GOOGLE_PLAY_SERVICE_ACCOUNT', '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}
export const playReady = () => !!account()?.private_key;

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
let cached = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const sa = account();
  if (!sa?.private_key || !sa.client_email) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT non valido');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google OAuth ${res.status} ${data.error || ''}`);
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

async function google(path, method = 'GET') {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(playPackage())}/${path}`, {
    method, headers: { authorization: `Bearer ${await accessToken()}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(`Google Play ${res.status} ${data?.error?.message || ''}`); e.status = res.status; throw e; }
  return data;
}

// Chi possiede già questo abbonamento? (stesso ordine di base "GPA.xxx", i rinnovi aggiungono "..0", "..1")
async function ownerOf(baseOrder) {
  const url = `${supabaseUrl()}/rest/v1/payments?select=user_id&provider=eq.googleplay&id=like.${encodeURIComponent(`gp_${baseOrder}*`)}&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.user_id || null;
}

const VALID = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];

// Controlla l'acquisto da Google, lo conferma (entro 3 giorni, se no Google rimborsa) e allunga il Pro.
// Ritorna { ok, until } oppure { ok:false, code, message }.
export async function verifyPlay(userId, token, sku = playSku()) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 4000) return { ok: false, code: 'bad_request', message: 'Achat invalide.' };
  if (sku !== playSku()) return { ok: false, code: 'bad_request', message: 'Produit inconnu.' };
  const sub = await google(`purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
  const item = (sub.lineItems || []).find((l) => l.productId === sku);
  if (!item) return { ok: false, code: 'bad_request', message: 'Produit inconnu.' };
  const order = item.latestSuccessfulOrderId || sub.latestOrderId || '';
  const base = order.split('..')[0];
  if (base) {
    const owner = await ownerOf(base);
    if (owner && owner !== userId) return { ok: false, code: 'taken', message: 'Cet abonnement Google Play est déjà lié à un autre compte Sahbi.' };
  }
  if (!VALID.includes(sub.subscriptionState)) return { ok: false, code: 'inactive', message: 'Cet abonnement n’est plus actif.' };
  if (sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    await google(`purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST');
  }
  if (order) await rpc('record_payment', { p_id: `gp_${order}`, p_user: userId, p_provider: 'googleplay', p_amount: Number(env('PLAY_PRICE_CENTS', '650')), p_currency: 'eur' });
  const expiry = new Date(item.expiryTime || 0).getTime();
  if (!(expiry > Date.now())) return { ok: false, code: 'inactive', message: 'Cet abonnement est expiré.' };
  const until = new Date(expiry + 2 * 864e5).toISOString();
  await rpc('extend_pro_until', { p_user: userId, p_until: until });
  return { ok: true, until };
}
