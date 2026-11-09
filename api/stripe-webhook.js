import { env, json, fail, rpc } from './_lib.js';
import { verifyStripe, verifyLemon } from './_pay.js';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Lemon Squeezy (indirizzo /api/lemonsqueezy-webhook, vedi vercel.json): abbonamenti creati, rinnovati, disdetti.
async function lemonWebhook(request, raw) {
  if (!verifyLemon(raw, request.headers.get('x-signature'), env('LEMONSQUEEZY_WEBHOOK_SECRET'))) {
    const { alert } = await import('./_alert.js');
    await alert('lemon_webhook', 'Un avis de paiement Lemon Squeezy a été refusé (signature invalide). Vérifie LEMONSQUEEZY_WEBHOOK_SECRET sur Vercel.', 360);
    return fail('signature', 400, 'Signature invalide.');
  }
  const event = JSON.parse(raw);
  const name = event.meta?.event_name;
  const userId = event.meta?.custom_data?.user_id;
  const a = event.data?.attributes || {};
  if (!isUuid(userId)) { console.error('Lemon Squeezy senza utente', name, event.data?.id); return json({ received: true }); }

  // Abbonamento attivo: Pro fino al prossimo rinnovo (+2 giorni di margine). Se è disdetto, fino alla fine già pagata.
  if (/^subscription_(created|updated|resumed|unpaused|payment_success|payment_recovered)$/.test(name) && event.data?.type === 'subscriptions') {
    const until = ['active', 'on_trial', 'past_due'].includes(a.status) ? a.renews_at : (a.status === 'cancelled' ? a.ends_at : null);
    if (until) await rpc('extend_pro_until', { p_user: userId, p_until: new Date(new Date(until).getTime() + 2 * 864e5).toISOString() });
  }
  // Pagamento riuscito (primo o rinnovo): si registra per il pannello e, per sicurezza, si allunga il Pro.
  if (name === 'subscription_payment_success' && event.data?.type === 'subscription-invoices') {
    const isNew = await rpc('record_payment', { p_id: `ls_${event.data.id}`, p_user: userId, p_provider: 'lemonsqueezy', p_amount: a.total ?? null, p_currency: a.currency ? String(a.currency).toLowerCase() : null });
    // La data esatta (anche per l'annuale) arriva con subscription_updated; qui solo un minimo di 32 giorni.
    if (isNew) await rpc('extend_pro_until', { p_user: userId, p_until: new Date(Date.now() + 32 * 864e5).toISOString() });
  }
  return json({ received: true });
}

// Stripe avvisa qui quando un abbonamento viene pagato o rinnovato.
export async function POST(request) {
  const raw = await request.text();
  if (new URL(request.url).searchParams.get('provider') === 'lemonsqueezy') return lemonWebhook(request, raw);
  if (!verifyStripe(raw, request.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'))) {
    const { alert } = await import('./_alert.js');
    await alert('stripe_webhook', 'Un avis de paiement a été refusé (signature invalide). Si ça se répète, vérifie le secret du webhook sur Vercel.', 360);
    return fail('signature', 400, 'Signature invalide.');
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
