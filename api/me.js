import { json, fail, getUser, getPlan, remainingCredit } from './_lib.js';

// Stato dell'utente: piano, scadenza del Pro, invito, quanto resta oggi.
export async function GET(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const { profile, pro, limits } = await getPlan(user.id);
  const kinds = ['chat', 'image', 'tts'];
  const left = await Promise.all(kinds.map((k) => remainingCredit(user.id, k, limits[k])));
  return json({
    email: user.email,
    pro,
    proUntil: profile.pro_until,
    referralCode: profile.referral_code,
    referrals: profile.referrals,
    referredBy: !!profile.referred_by,
    canManageBilling: !!profile.stripe_customer_id,
    limits,
    remaining: Object.fromEntries(kinds.map((k, i) => [k, left[i]])),
  });
}
