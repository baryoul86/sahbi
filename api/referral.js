import { json, fail, getUserId, rpc } from './_lib.js';

const MESSAGES = {
  ok: 'Bienvenue ! Toi et ton ami recevez 7 jours de Sahbi Pro.',
  already: 'Tu as déjà utilisé un code d’invitation.',
  too_late: 'Les codes d’invitation sont valables pendant les 7 premiers jours.',
  not_found: 'Ce code d’invitation n’existe pas.',
  own_code: 'Tu ne peux pas utiliser ton propre code.',
};

// Usa un codice invito: POST { code }.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return fail('not_found', 400, MESSAGES.not_found);
  const status = await rpc('apply_referral', { p_user: userId, p_code: code });
  return status === 'ok' ? json({ ok: true, message: MESSAGES.ok }) : fail(status, 400, MESSAGES[status] || 'Code invalide.');
}
