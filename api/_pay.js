// Pagamenti: Stripe (carte, Europa) e Chargily Pay (Edahabia e CIB, Algeria).
import crypto from 'node:crypto';
import { env } from './_lib.js';

export const publicUrl = (request) => env('PUBLIC_URL', new URL(request.url).origin).replace(/\/$/, '');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const hmacHex = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');

// ---------- Stripe ----------

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') form(v, key, out);
    else if (v !== undefined) out.append(key, String(v));
  }
  return out;
}

export async function stripe(path, params, method = 'POST') {
  const res = await fetch(`${env('STRIPE_API_URL', 'https://api.stripe.com/v1')}/${path}`, method === 'GET'
    ? { headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` } }
    : {
      method: 'POST',
      headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form(params),
    });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${data?.error?.message || ''}`);
  return data;
}

// Verifica l'intestazione Stripe-Signature (t=...,v1=...) con il segreto del webhook.
export function verifyStripe(raw, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const signatures = header.split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = hmacHex(secret, `${t}.${raw}`);
  return signatures.some((s) => safeEqual(s, expected));
}

// ---------- Chargily Pay ----------

export const chargilyBase = () => env('CHARGILY_API_URL', 'https://pay.chargily.net/api/v2').replace(/\/$/, '');

export async function chargily(path, body) {
  const res = await fetch(`${chargilyBase()}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('CHARGILY_SECRET_KEY')}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Chargily ${path}: ${res.status} ${data?.message || ''}`);
  return data;
}

// Chargily firma il corpo con HMAC-SHA256 e la chiave segreta, nell'intestazione "signature".
export function verifyChargily(raw, signature, secret) {
  if (!signature || !secret) return false;
  return safeEqual(signature, hmacHex(secret, raw));
}

// ---------- Lemon Squeezy ("Merchant of Record": vende al posto tuo e gestisce l'IVA di tutti i paesi) ----------
export async function lemon(path, body) {
  const res = await fetch(`${env('LEMONSQUEEZY_API_URL', 'https://api.lemonsqueezy.com/v1')}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json', authorization: `Bearer ${env('LEMONSQUEEZY_API_KEY')}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Lemon Squeezy ${path}: ${res.status} ${data?.errors?.[0]?.detail || ''}`);
  return data;
}
// Firma del webhook: intestazione X-Signature = HMAC-SHA256 esadecimale del corpo con il segreto.
export function verifyLemon(raw, signature, secret) {
  if (!signature || !secret) return false;
  return safeEqual(signature, hmacHex(secret, raw));
}
// Basta la chiave API: negozio e prezzo (mensile / annuale) si trovano da soli, se non sono indicati su Vercel.
export const lemonReady = (year = false) => !!(env('LEMONSQUEEZY_API_KEY') && (!year || env('LEMONSQUEEZY_VARIANT_ID_YEAR')));
const lemonCache = {};
export async function lemonIds(year = false) {
  const key = year ? 'year' : 'month';
  if (lemonCache[key]) return lemonCache[key];
  let variant = env(year ? 'LEMONSQUEEZY_VARIANT_ID_YEAR' : 'LEMONSQUEEZY_VARIANT_ID');
  let store = env('LEMONSQUEEZY_STORE_ID');
  let product = null;
  if (!variant) {
    const list = (await lemon('variants?page[size]=100'))?.data || [];
    const ok = list.filter((v) => v.attributes?.is_subscription && v.attributes?.interval === key && v.attributes?.status !== 'draft');
    const pick = ok.find((v) => v.attributes.status === 'published') || ok[0];
    if (!pick) return null;
    variant = pick.id; product = pick.attributes.product_id;
  }
  if (!store) {
    if (product) store = (await lemon(`products/${product}`))?.data?.attributes?.store_id;
    if (!store) store = (await lemon('stores'))?.data?.[0]?.id;
    if (!store) return null;
  }
  return (lemonCache[key] = { store: String(store), variant: String(variant) });
}
