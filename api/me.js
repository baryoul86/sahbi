import { json, fail, getUser, getPlan, remainingCredit } from './_lib.js';
import { remainingVideo, videoEnabled } from './_video.js';

// Stato dell'utente: piano, scadenza del Pro, invito, quanto resta oggi.
export async function GET(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const { profile, pro, limits } = await getPlan(user.id);
  const kinds = ['chat', 'image', 'tts'];
  const left = await Promise.all(kinds.map((k) => remainingCredit(user.id, k, limits[k])));
  // Video: contati per mese (0 se il database non è ancora aggiornato con 003_video.sql).
  const videoLeft = await remainingVideo(user.id, limits.video).catch(() => 0);
  return json({
    email: user.email,
    pro,
    proUntil: profile.pro_until,
    referralCode: profile.referral_code,
    referrals: profile.referrals,
    referredBy: !!profile.referred_by,
    canManageBilling: !!profile.stripe_customer_id,
    limits,
    remaining: { ...Object.fromEntries(kinds.map((k, i) => [k, left[i]])), video: videoLeft },
    videoEnabled: videoEnabled(),
  });
}
