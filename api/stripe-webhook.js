import { env, json, fail, rpc } from './_lib.js';
import { verifyStripe } from './_pay.js';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Stripe avvisa qui quando un abbonamento viene pagato o rinnovato.
export async function POST(request) {
  const raw = await request.text();
  if (!verifyStripe(raw, request.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'))) {
    return fail('signature', 400, 'Firma non valida.');
  }
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};

  if (event.type === 'checkout.session.completed') {
    const userId = obj.metadata?.user_id || obj.client_reference_id;
    if (isUuid(userId) && obj.customer) await rpc('set_stripe_customer', { p_user: userId, p_customer: obj.customer });
    if (isUuid(userId) && obj.payment_status === 'paid') {
      // Primo mese subito; i rinnovi arrivano con invoice.paid.
      await rpc('extend_pro_until', { p_user: userId, p_until: new Date(Date.now() + 32 * 864e5).toISOString() });
    }
  }

  if (event.type === 'invoice.paid') {
    let userId = obj.parent?.subscription_details?.metadata?.user_id
      || obj.subscription_details?.metadata?.user_id
      || obj.lines?.data?.[0]?.metadata?.user_id;
    if (!isUuid(userId) && obj.customer) userId = await rpc('user_by_stripe_customer', { p_customer: obj.customer });
    if (isUuid(userId)) {
      const isNew = await rpc('record_payment', { p_id: obj.id, p_user: userId, p_provider: 'stripe', p_amount: obj.amount_paid ?? null, p_currency: obj.currency ?? null });
      const end = Math.max(...(obj.lines?.data || []).map((l) => l.period?.end || 0), 0);
      if (isNew && end) await rpc('extend_pro_until', { p_user: userId, p_until: new Date((end + 2 * 86400) * 1000).toISOString() });
    } else {
      console.error('Stripe invoice.paid senza utente', obj.id);
    }
  }

  return json({ received: true });
}
