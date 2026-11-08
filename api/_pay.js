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
