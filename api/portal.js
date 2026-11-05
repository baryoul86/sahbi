import { env, json, fail, getUserId, getProfile } from './_lib.js';
import { publicUrl, stripe } from './_pay.js';

// Pagina Stripe dove l'abbonato cambia carta o disdice l'abbonamento.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  if (!env('STRIPE_SECRET_KEY')) return fail('unavailable', 503, 'Indisponible.');
  const profile = await getProfile(userId);
  if (!profile.stripe_customer_id) return fail('not_found', 404, 'Aucun abonnement par carte.');
  try {
    const s = await stripe('billing_portal/sessions', { customer: profile.stripe_customer_id, return_url: `${publicUrl(request)}/` });
    return json({ url: s.url });
  } catch (e) {
    console.error('Portal', e.message);
    return fail('upstream', 502, 'Impossible d’ouvrir la gestion de l’abonnement.');
  }
}
