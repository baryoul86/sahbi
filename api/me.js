import { json, fail, getUser, getPlan, remainingCredit } from './_lib.js';
import { remainingVideo, videoEnabled } from './_video.js';
import { getMemory, setMemory } from './_memory.js';
import { isAdmin } from './_alert.js';
import { userSupport } from './_support.js';

// Stato dell'utente: piano, scadenza del Pro, invito, quanto resta oggi, ricordi di Sahbi.
export async function GET(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Session expirée. Recharge la page.');
  const { profile, pro, trial, limits } = await getPlan(user.id);
  if (new URL(request.url).searchParams.has('support')) return userSupport(request, user, pro);
  const kinds = ['chat', 'image', 'tts'];
  const [left, videoLeft, memory] = await Promise.all([
    Promise.all(kinds.map((k) => remainingCredit(user.id, k, limits[k]))),
    // Video: contati per mese (0 se il database non è ancora aggiornato con 003_video.sql).
    remainingVideo(user.id, limits.video).catch(() => 0),
    getMemory(user.id),
  ]);
  return json({
    email: user.email,
    pro,
    proUntil: profile.pro_until,
    trial, trialUntil: profile.trial_until || null, trialEligible: !!profile.trialEligible,
    referralCode: profile.referral_code,
    referrals: profile.referrals,
    referredBy: !!profile.referred_by,
    canManageBilling: !!profile.stripe_customer_id,
    limits,
    remaining: { ...Object.fromEntries(kinds.map((k, i) => [k, left[i]])), video: videoLeft },
    videoEnabled: videoEnabled(),
    memory,
    admin: isAdmin(user.email),
  });
}

// Cancella i ricordi: DELETE /api/me?memory=all oppure ?memory=<numero del ricordo>
export async function DELETE(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Session expirée. Recharge la page.');
  const which = new URL(request.url).searchParams.get('memory');
  if (which == null) return fail('bad_request', 400, 'Demande invalide.');
  try {
    const facts = await getMemory(user.id);
    const i = Number(which);
    const next = which === 'all' ? [] : facts.filter((_, k) => k !== i);
    return json({ memory: await setMemory(user.id, next) });
  } catch (e) {
    console.error('Memoria', e.message);
    return fail('upstream', 502, 'Impossible d’effacer maintenant. Réessaie.');
  }
}

// Assistenza: POST /api/me?support=1 { message, shot?, meta } → messaggio all'amministratore.
export async function POST(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Session expirée. Recharge la page.');
  if (!new URL(request.url).searchParams.has('support')) return fail('bad_request', 400, 'Demande invalide.');
  const { pro } = await getPlan(user.id).catch(() => ({ pro: false }));
  return userSupport(request, user, pro);
}
