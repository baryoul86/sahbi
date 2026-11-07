import { json, fail, getUser, getPlan, remainingCredit } from './_lib.js';
import { remainingVideo, videoEnabled } from './_video.js';
import { getMemory, setMemory } from './_memory.js';

// Stato dell'utente: piano, scadenza del Pro, invito, quanto resta oggi, ricordi di Sahbi.
export async function GET(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const { profile, pro, limits } = await getPlan(user.id);
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
    referralCode: profile.referral_code,
    referrals: profile.referrals,
    referredBy: !!profile.referred_by,
    canManageBilling: !!profile.stripe_customer_id,
    limits,
    remaining: { ...Object.fromEntries(kinds.map((k, i) => [k, left[i]])), video: videoLeft },
    videoEnabled: videoEnabled(),
    memory,
  });
}

// Cancella i ricordi: DELETE /api/me?memory=all oppure ?memory=<numero del ricordo>
export async function DELETE(request) {
  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const which = new URL(request.url).searchParams.get('memory');
  if (which == null) return fail('bad_request', 400, 'Richiesta non valida.');
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
