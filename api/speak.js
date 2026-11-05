import { env, fail, getUserId, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI } from './_lib.js';

// Sahbi legge ad alta voce una risposta (funzione Pro). Restituisce un file audio mp3.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 3000) : '';
  if (!text) return fail('bad_request', 400, 'Niente da leggere.');

  const { limits, pro } = await getPlan(userId);
  if (!pro && limits.tts <= 0) return fail('pro', 402, 'La voix de Sahbi est réservée à Sahbi Pro.');
  const left = await useCredit(userId, 'tts', limits.tts);
  if (left < 0) return fail('limit', 429, 'Limite de lectures à voix haute atteinte pour aujourd’hui.');

  const upstream = await fetch(`${OPENAI}/audio/speech`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts'),
      voice: env('OPENAI_TTS_VOICE', 'alloy'),
      input: text,
      instructions: "Voix chaleureuse et amicale, débit naturel. Lis le texte dans sa propre langue et avec l'accent qui lui correspond (darija maghrébine, arabe, français, anglais...).",
      response_format: 'mp3',
    }),
  });
  if (!upstream.ok || !upstream.body) {
    await refundCredit(userId, 'tts').catch(() => {});
    console.error('OpenAI speech error', upstream.status);
    return fail('upstream', 502, 'Impossible de lire ce message maintenant.');
  }
  return new Response(upstream.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
}
