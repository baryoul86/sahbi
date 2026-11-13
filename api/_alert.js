// Avvisi per l'amministratore: registra il problema nel database e manda un'e-mail (al massimo una all'ora per tipo).
// Su Vercel: ADMIN_EMAIL (chi riceve gli avvisi) e RESEND_API_KEY (chiave Resend "Sending access").
import { env, rpc } from './_lib.js';

export const adminEmails = () => env('ADMIN_EMAIL', '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isAdmin = (email) => !!email && adminEmails().includes(String(email).toLowerCase());

export async function sendMail(subject, text, replyTo = '') {
  const to = adminEmails();
  if (!to.length || !env('RESEND_API_KEY')) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env('ALERT_FROM', 'Sahbi <alertes@sahbi.bond>'), to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) console.error('Resend', res.status);
    return res.ok;
  } catch (e) { console.error('Resend', e.message); return false; }
}

// Non blocca mai l'app: se qualcosa va storto qui, si scrive solo nei log.
export async function alert(kind, message, everyMinutes = 60) {
  console.error(`[ALERTE] ${kind}: ${message}`);
  try {
    const due = await rpc('admin_alert', { p_kind: kind, p_message: String(message).slice(0, 500), p_every_minutes: everyMinutes });
    if (due) await sendMail(`⚠️ Sahbi : ${TITLES[kind] || kind}`, `${message}\n\nOuvre le panneau : https://www.sahbi.bond/admin.html\n(Prochain e-mail pour ce problème au plus tôt dans ${everyMinutes} min.)`);
  } catch (e) { console.error('Alerte', e.message); }
}

export const TITLES = {
  openai_quota: 'crédit OpenAI épuisé',
  openai_auth: 'clé OpenAI refusée',
  openai_down: 'OpenAI ne répond pas',
  image_fail: 'la création d’images échoue',
  video_fail: 'la création de vidéos échoue',
  pruna_credit: 'crédit Pruna (vidéos) épuisé',
  db_down: 'la base de données ne répond pas',
  stripe_webhook: 'problème avec les paiements Stripe',
  lemon_webhook: 'problème avec les paiements Lemon Squeezy',
  chargily_webhook: 'problème avec les paiements Chargily',
  checkout_fail: 'le paiement ne s’ouvre pas',
  speech_fail: 'la voix ne marche pas',
};

// Traduce un errore di OpenAI in un tipo di avviso.
export function openaiAlert(status, bodyText = '') {
  if (status === 401 || status === 403) return alert('openai_auth', `OpenAI a refusé la clé (${status}). Vérifie OPENAI_API_KEY sur Vercel.`);
  if (status === 429 && /quota|billing|insufficient/i.test(bodyText)) return alert('openai_quota', 'Le crédit OpenAI est épuisé : Sahbi ne peut plus répondre. Recharge sur platform.openai.com/settings/organization/billing.', 30);
  if (status >= 500) return alert('openai_down', `OpenAI répond avec une erreur ${status}. Souvent temporaire.`, 120);
  return null;
}
