import { env, json, fail, getUserId, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI } from './_lib.js';

const MAX_BYTES = 4 * 1024 * 1024; // circa 2-3 minuti di voce

// Riceve l'audio registrato dal microfono e restituisce il testo.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let form;
  try { form = await request.formData(); } catch { return fail('bad_request', 400, 'Audio non valido.'); }
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string' || !audio.size) return fail('bad_request', 400, 'Audio vuoto.');
  if (audio.size > MAX_BYTES) return fail('too_big', 413, 'Registrazione troppo lunga. Massimo circa 2 minuti.');

  const { limits } = await getPlan(userId);
  const left = await useCredit(userId, 'voice', limits.voice);
  if (left < 0) return fail('limit', 429, 'Limite di messaggi vocali di oggi raggiunto.');

  const out = new FormData();
  const name = (audio.type || '').includes('mp4') ? 'audio.mp4' : 'audio.webm';
  out.append('file', audio, name);
  out.append('model', env('OPENAI_TRANSCRIBE_MODEL', 'gpt-4o-mini-transcribe'));

  const upstream = await fetch(`${OPENAI}/audio/transcriptions`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: out,
  });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || typeof data?.text !== 'string') {
    await refundCredit(userId, 'voice').catch(() => {});
    console.error('OpenAI transcribe error', upstream.status, data?.error?.code);
    if (upstream.status !== 400) { const { openaiAlert } = await import('./_alert.js'); await openaiAlert(upstream.status, JSON.stringify(data?.error || {})); }
    return fail('upstream', 502, 'Non ho capito l’audio. Riprova.');
  }
  return json({ text: data.text.trim() });
}
