import { json, fail, getUserId, remainingCredit, limits, generateImage } from './_lib.js';

// Quante immagini restano oggi all'utente.
export async function GET(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const limit = limits().image;
  return json({ remaining: await remainingCredit(userId, 'image', limit), limit });
}

// Crea un'immagine direttamente da una descrizione.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return fail('bad_request', 400, "Descrivi l'immagine che vuoi.");

  const r = await generateImage(userId, prompt);
  if (!r.ok) return fail(r.error, r.status, r.message);
  return json({ image: r.image, remaining: r.remaining, limit: r.limit });
}
