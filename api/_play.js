// Google Play Billing (abbonamento comprato dentro l'app Android).
// Su Vercel: GOOGLE_PLAY_SERVICE_ACCOUNT = il file JSON del "service account" Google Cloud (tutto il contenuto),
// ANDROID_PACKAGE (predefinito bond.sahbi.app), PLAY_SUBSCRIPTION_ID (predefinito sahbi_pro).
import crypto from 'node:crypto';
import { env, rpc, supabaseUrl, serviceHeaders } from './_lib.js';

export const playSku = () => env('PLAY_SUBSCRIPTION_ID', 'sahbi_pro');
export const playPackage = () => env('ANDROID_PACKAGE', 'bond.sahbi.app');
export const playTrialOffer = () => env('PLAY_TRIAL_OFFER_ID', 'essai-3j');

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

async function google(path, method = 'GET', body = null) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(playPackage())}/${path}`, {
    method, headers: { authorization: `Bearer ${await accessToken()}`, ...(method !== 'GET' ? { 'content-type': 'application/json' } : {}) },
    ...(method !== 'GET' ? { body: JSON.stringify(body || {}) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(`Google Play ${res.status} ${data?.error?.message || ''}`); e.status = res.status; throw e; }
  return data;
}

// Controllo per la sorveglianza: la chiave funziona e l'abbonamento sahbi_pro esiste ed è attivo su Google Play?
export async function playCheck() {
  if (!playReady()) return 'no-key';
  try {
    const d = await google(`subscriptions/${encodeURIComponent(playSku())}`);
    const plans = (d.basePlans || []).map((b) => `${b.basePlanId}:${b.state}`);
    return plans.some((x) => x.endsWith(':ACTIVE')) ? `ok (${plans.join(', ')})` : `abonnement inactif (${plans.join(', ') || 'aucun forfait'})`;
  } catch (e) { return String(e.message || e).slice(0, 160); }
}

// Prova gratuita su Google Play: offerta "essai-3j" (3 giorni gratis, solo per chi non ha mai avuto un abbonamento),
// attivata e usata anche dall'app (acquisto "compatibile" della Digital Goods API). Si crea una volta dal pannello.
export async function setupPlayTrial() {
  if (!playReady()) return { ok: false, message: 'GOOGLE_PLAY_SERVICE_ACCOUNT manquant sur Vercel.' };
  const sku = playSku(), offerId = playTrialOffer(), days = Number(env('TRIAL_DAYS', '3'));
  const sub = await google(`subscriptions/${encodeURIComponent(sku)}`);
  const bp = (sub.basePlans || []).find((b) => b.state === 'ACTIVE' && b.autoRenewingBasePlanType) || (sub.basePlans || [])[0];
  if (!bp) return { ok: false, message: 'Aucun forfait de base actif.' };
  const regions = (bp.regionalConfigs || []).map((r) => r.regionCode);
  const steps = [];
  const path = `subscriptions/${encodeURIComponent(sku)}/basePlans/${encodeURIComponent(bp.basePlanId)}/offers`;
  let offer = null;
  try { offer = await google(`${path}/${encodeURIComponent(offerId)}`); } catch (e) { if (e.status !== 404) throw e; }
  if (!offer) {
    // Versione delle regioni: si prova la più recente; un paese "non fatturabile" in quella versione si toglie e si riprova.
    let list = [...regions], lastErr = null;
    for (const ver of ['2025/03', '2022/02']) {
      for (let i = 0; i < 25 && !offer; i++) {
        try {
          offer = await google(`${path}?offerId=${encodeURIComponent(offerId)}&regionsVersion.version=${ver}`, 'POST', {
            packageName: playPackage(), productId: sku, basePlanId: bp.basePlanId, offerId,
            phases: [{ recurrenceCount: 1, duration: `P${days}D`, regionalConfigs: list.map((regionCode) => ({ regionCode, free: {} })) }],
            targeting: { acquisitionRule: { scope: { anySubscriptionInApp: {} } } },
            regionalConfigs: list.map((regionCode) => ({ regionCode, newSubscriberAvailability: true })),
            offerTags: [{ tag: 'essai' }],
          });
        } catch (e) {
          lastErr = e;
          const bad = /Region code ([A-Z]{2}) /.exec(e.message || '')?.[1];
          if (e.status === 400 && bad && list.includes(bad)) { list = list.filter((r) => r !== bad); continue; }
          if (e.status === 400 && /regions version|regionsVersion/i.test(e.message || '')) break;
          throw e;
        }
      }
      if (offer) { steps.push(`offre créée (${list.length} pays, régions ${ver})`); break; }
      list = [...regions];
    }
    if (!offer) throw lastErr || new Error('Offre impossible à créer.');
  }
  if (offer.state !== 'ACTIVE') {
    await google(`${path}/${encodeURIComponent(offerId)}:activate`, 'POST', { packageName: playPackage(), productId: sku, basePlanId: bp.basePlanId, offerId });
    steps.push('offre activée');
  }
  // Offerta usata dagli acquisti "compatibili" (come quelli dell'app Sahbi).
  if (bp.autoRenewingBasePlanType?.legacyCompatibleSubscriptionOfferId !== offerId) {
    bp.autoRenewingBasePlanType = { ...bp.autoRenewingBasePlanType, legacyCompatible: true, legacyCompatibleSubscriptionOfferId: offerId };
    await google(`subscriptions/${encodeURIComponent(sku)}?updateMask=basePlans&regionsVersion.version=2025/03`, 'PATCH', { ...sub, basePlans: sub.basePlans.map((b) => (b.basePlanId === bp.basePlanId ? bp : b)) });
    steps.push('offre utilisée par l’app');
  }
  return { ok: true, message: `Essai Google Play (${days} jours) prêt : ${steps.join(', ') || 'déjà en place'}. Pays : ${regions.length}.` };
}

// Paesi dove l'abbonamento ha un prezzo (= dove la gente può pagare con Google Play): codici ISO.
export async function playRegions() {
  if (!playReady()) return [];
  try {
    const d = await google(`subscriptions/${encodeURIComponent(playSku())}`);
    return [...new Set((d.basePlans || []).flatMap((b) => (b.regionalConfigs || []).map((r) => r.regionCode)))].sort();
  } catch { return []; }
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
  // Prova gratuita Google Play (offerta "essai-3j"): Pro leggero per i primi giorni.
  const trialEnd = Date.parse(sub.startTime || 0) + Number(env('TRIAL_DAYS', '3')) * 864e5;
  const isTrial = item.offerDetails?.offerId === playTrialOffer() && trialEnd > Date.now();
  if (order) await rpc('record_payment', { p_id: `gp_${order}`, p_user: userId, p_provider: 'googleplay', p_amount: isTrial ? 0 : Number(env('PLAY_PRICE_CENTS', '650')), p_currency: 'eur' });
  const expiry = new Date(item.expiryTime || 0).getTime();
  if (!(expiry > Date.now())) return { ok: false, code: 'inactive', message: 'Cet abonnement est expiré.' };
  const until = new Date(expiry + 2 * 864e5).toISOString();
  if (isTrial) await rpc('set_trial', { p_user: userId, p_until: new Date(trialEnd).toISOString() }).catch(() => {});
  else await rpc('end_trial', { p_user: userId }).catch(() => {});
  await rpc('extend_pro_until', { p_user: userId, p_until: until });
  return { ok: true, until, trial: isTrial };
}

// Impronte SHA-256 della chiave con cui Google Play firma l'app (Play App Signing), per assetlinks.json.
// Lette dall'API (generatedApks dell'ultima versione), tenute in memoria 12 ore. Errori = lista vuota.
let printsCache = { at: 0, list: [] };
const asPrint = (h) => {
  let hex = String(h || '').replace(/[^0-9a-f]/gi, '');
  if (hex.length !== 64) { try { hex = Buffer.from(String(h), 'base64').toString('hex'); } catch { hex = ''; } }
  return hex.length === 64 ? hex.toUpperCase().match(/../g).join(':') : null;
};
export async function playSigningPrints() {
  if (!playReady()) return [];
  if (Date.now() - printsCache.at < 12 * 3600e3) return printsCache.list;
  let list = [];
  try {
    const edit = await google('edits', 'POST');
    let codes = [];
    try { codes = ((await google(`edits/${edit.id}/bundles`)).bundles || []).map((b) => Number(b.versionCode)).filter(Boolean); }
    finally { await google(`edits/${edit.id}`, 'DELETE').catch(() => {}); }
    const vc = Math.max(0, ...codes);
    if (vc) {
      const g = await google(`generatedApks/${vc}`);
      for (const k of g.generatedApks || []) { const pr = asPrint(k.certificateSha256Hash); if (pr && !list.includes(pr)) list.push(pr); }
    }
  } catch { list = printsCache.list; }
  printsCache = { at: Date.now(), list };
  return list;
}
