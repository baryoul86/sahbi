import { env, json, fail, getUser, getProfile } from './_lib.js';
import { publicUrl, stripe, chargily, lemon, lemonReady } from './_pay.js';

// Crea una pagina di pagamento per Sahbi Pro. POST { provider: 'stripe' | 'chargily' } -> { url }
// POST { provider: 'portal' } -> pagina Stripe per cambiare carta o disdire l'abbonamento.
export async function POST(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const base = publicUrl(request);
  const year = body?.plan === 'year';

  try {
    if (body?.provider === 'portal') {
      if (!env('STRIPE_SECRET_KEY')) return fail('unavailable', 503, 'Indisponible.');
      const profile = await getProfile(user.id);
      if (!profile.stripe_customer_id) return fail('not_found', 404, 'Aucun abonnement par carte.');
      const portal = await stripe('billing_portal/sessions', { customer: profile.stripe_customer_id, return_url: `${base}/` });
      return json({ url: portal.url });
    }

    if (body?.provider === 'lemonsqueezy') {
      if (!lemonReady(year)) return fail('unavailable', 503, year ? 'L’abonnement annuel n’est pas encore disponible.' : 'Le paiement n’est pas encore disponible.');
      const c = await lemon('checkouts', {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: { email: user.email || undefined, custom: { user_id: user.id } },
            product_options: { redirect_url: `${base}/?paid=1` },
            checkout_options: { embed: false },
          },
          relationships: {
            store: { data: { type: 'stores', id: String(env('LEMONSQUEEZY_STORE_ID')) } },
            variant: { data: { type: 'variants', id: String(env(year ? 'LEMONSQUEEZY_VARIANT_ID_YEAR' : 'LEMONSQUEEZY_VARIANT_ID')) } },
          },
        },
      });
      return json({ url: c?.data?.attributes?.url });
    }

    if (body?.provider === 'stripe') {
      const price = env(year ? 'STRIPE_PRICE_ID_YEAR' : 'STRIPE_PRICE_ID');
      if (!env('STRIPE_SECRET_KEY') || !price) return fail('unavailable', 503, year ? 'L’abonnement annuel n’est pas encore disponible.' : 'Le paiement par carte n’est pas encore disponible.');
      const profile = await getProfile(user.id);
      const session = await stripe('checkout/sessions', {
        mode: 'subscription',
        line_items: { 0: { price, quantity: 1 } },
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
        amount: Number(env(year ? 'CHARGILY_PRICE_YEAR_DZD' : 'CHARGILY_PRICE_DZD', year ? '10000' : '1000')),
        currency: 'dzd',
        success_url: `${base}/?paid=1`,
        failure_url: `${base}/?paid=0`,
        webhook_endpoint: `${base}/api/chargily-webhook`,
        description: year ? 'Sahbi Pro – 1 an' : 'Sahbi Pro – 30 jours',
        locale: 'fr',
        metadata: { user_id: user.id, plan: year ? 'year' : 'month' },
      });
      return json({ url: checkout.checkout_url });
    }
  } catch (e) {
    console.error('Checkout', e.message);
    const { alert } = await import('./_alert.js');
    await alert('checkout_fail', `Le paiement n'a pas pu s'ouvrir : ${e.message}`.slice(0, 300), 120);
    return fail('upstream', 502, 'Le paiement n’a pas pu démarrer. Réessaie dans un instant.');
  }
  return fail('bad_request', 400, 'Moyen de paiement inconnu.');
}
