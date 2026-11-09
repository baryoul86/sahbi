import { env, json, fail, rpc } from './_lib.js';
import { verifyChargily } from './_pay.js';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Chargily avvisa qui quando un pagamento Edahabia / CIB è riuscito: 30 giorni di Pro (365 con il piano annuale).
export async function POST(request) {
  const raw = await request.text();
  if (!verifyChargily(raw, request.headers.get('signature'), env('CHARGILY_SECRET_KEY'))) {
    const { alert } = await import('./_alert.js');
    await alert('chargily_webhook', 'Un avis de paiement a été refusé (signature invalide). Si ça se répète, vérifie le secret du webhook sur Vercel.', 360);
    return fail('signature', 400, 'Signature invalide.');
  }
  const event = JSON.parse(raw);
  if (event.type === 'checkout.paid') {
    const checkout = event.data || {};
    const userId = checkout.metadata?.user_id;
    if (isUuid(userId) && checkout.id) {
      const isNew = await rpc('record_payment', { p_id: `chargily_${checkout.id}`, p_user: userId, p_provider: 'chargily', p_amount: checkout.amount ?? null, p_currency: checkout.currency ?? 'dzd' });
      // Annuale solo se l'importo pagato corrisponde davvero al prezzo annuale.
      const year = checkout.metadata?.plan === 'year' && Number(checkout.amount) >= Number(env('CHARGILY_PRICE_YEAR_DZD', '10000'));
      if (isNew) await rpc('add_pro_days', { p_user: userId, p_days: year ? 365 : Number(env('CHARGILY_PRO_DAYS', '30')) });
    } else {
      console.error('Chargily checkout.paid senza utente', checkout.id);
    }
  }
  return json({ received: true });
}
