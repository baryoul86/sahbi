import { env, json, fail, getUserId, useCredit, refundCredit, remainingCredit, limits, openaiHeaders, OPENAI } from './_lib.js';

// Quante immagini restano oggi all'utente.
export async function GET(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const limit = limits().image;
  return json({ remaining: await remainingCredit(userId, 'image', limit), limit });
}

export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1000) : '';
  if (!prompt) return fail('bad_request', 400, "Descrivi l'immagine che vuoi.");

  const limit = limits().image;
  const left = await useCredit(userId, 'image', limit);
  if (left < 0) return fail('limit', 429, 'Hai usato tutte le immagini di oggi.');

  const upstream = await fetch(`${OPENAI}/images/generations`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: env('OPENAI_IMAGE_MODEL', 'gpt-image-1-mini'),
      prompt,
      size: env('OPENAI_IMAGE_SIZE', '1024x1024'),
      quality: env('OPENAI_IMAGE_QUALITY', 'medium'),
      output_format: 'jpeg',
      n: 1,
    }),
  });

  const data = await upstream.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!upstream.ok || !b64) {
    await refundCredit(userId, 'image').catch(() => {});
    const blocked = data?.error?.code === 'moderation_blocked';
    console.error('OpenAI image error', upstream.status, data?.error?.code);
    return blocked
      ? fail('blocked', 400, 'Questa immagine non si può creare. Prova con un’altra descrizione.')
      : fail('upstream', 502, 'Non riesco a creare l’immagine ora. Riprova tra poco.');
  }

  return json({ image: `data:image/jpeg;base64,${b64}`, remaining: left, limit });
}
