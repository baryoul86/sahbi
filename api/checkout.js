import { env, json, fail, getUser, getProfile } from './_lib.js';
import { publicUrl, stripe, chargily } from './_pay.js';

// Crea una pagina di pagamento per Sahbi Pro. POST { provider: 'stripe' | 'chargily' } -> { url }
// POST { provider: 'portal' } -> pagina Stripe per cambiare carta o disdire l'abbonamento.
export async function POST(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const base = publicUrl(request);

  try {
    if (body?.provider === 'portal') {
      if (!env('STRIPE_SECRET_KEY')) return fail('unavailable', 503, 'Indisponible.');
      const profile = await getProfile(user.id);
      if (!profile.stripe_customer_id) return fail('not_found', 404, 'Aucun abonnement par carte.');
      const portal = await stripe('billing_portal/sessions', { customer: profile.stripe_customer_id, return_url: `${base}/` });
      return json({ url: portal.url });
    }

    if (body?.provider === 'stripe') {
      if (!env('STRIPE_SECRET_KEY') || !env('STRIPE_PRICE_ID')) return fail('unavailable', 503, 'Le paiement par carte n’est pas encore disponible.');
      const profile = await getProfile(user.id);
      const session = await stripe('checkout/sessions', {
        mode: 'subscription',
        line_items: { 0: { price: env('STRIPE_PRICE_ID'), quantity: 1 } },
        success_url: `${base}/?paid=1`,
        cancel_url: `${base}/?paid=0`,
        client_reference_id: user.id,
        ...(profile.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email }),
        metadata: { user_id: user.id },
        subscription_data: { metadata: { user_id: user.id } },
        allow_promotion_codes: 'true',
        locale: 'fr',
      });
      return json({ url: session.url });
    }

    if (body?.provider === 'chargily') {
      if (!env('CHARGILY_SECRET_KEY')) return fail('unavailable', 503, 'Le paiement Edahabia / CIB n’est pas encore disponible.');
      const checkout = await chargily('checkouts', {
        amount: Number(env('CHARGILY_PRICE_DZD', '1000')),
        currency: 'dzd',
        success_url: `${base}/?paid=1`,
        failure_url: `${base}/?paid=0`,
        webhook_endpoint: `${base}/api/chargily-webhook`,
        description: 'Sahbi Pro – 30 jours',
        locale: 'fr',
        metadata: { user_id: user.id },
      });
      return json({ url: checkout.checkout_url });
    }
  } catch (e) {
    console.error('Checkout', e.message);
    return fail('upstream', 502, 'Le paiement n’a pas pu démarrer. Réessaie dans un instant.');
  }
  return fail('bad_request', 400, 'Moyen de paiement inconnu.');
}
