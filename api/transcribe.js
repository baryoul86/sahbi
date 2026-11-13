import { env, json, fail, getUserId, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI } from './_lib.js';

const MAX_BYTES = 4 * 1024 * 1024; // circa 2-3 minuti di voce
const HINT = "Transcris exactement ce qui est dit, dans la langue parlée, sans traduire ni résumer. "
  + "La personne parle souvent en darija (algérienne, marocaine, tunisienne), en arabe égyptien, en arabe du Golfe, en arabe standard, en français ou en anglais, et mélange parfois ces langues dans la même phrase. "
  + "Si elle parle darija avec des mots français, garde le mélange tel quel. Écris l'arabe et la darija en lettres arabes quand c'est de l'arabe, et les mots français en français. "
  + "Mots fréquents : Sahbi, wach, kifach, bezzaf, chwiya, mlih, sahit, khoya, wesh, labas, hamdoulah, inchallah, yallah, safi, zwin, bghit, 3afak, ezayak, 3amel eh, shlonak, wesh tabi, Bac, Edahabia.";

// GET = "sveglia" il server appena l'utente preme il microfono, così la trascrizione parte subito dopo.
export function GET() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

// Riceve l'audio registrato dal microfono e restituisce il testo.
// Con stream=1 il testo arriva a pezzi (text/plain) mentre OpenAI lo trascrive.
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');

  let form;
  try { form = await request.formData(); } catch { return fail('bad_request', 400, 'Audio invalide.'); }
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string' || !audio.size) return fail('bad_request', 400, 'Audio vide.');
  if (audio.size > MAX_BYTES) return fail('too_big', 413, 'Enregistrement trop long : 2 minutes maximum.');

  // gpt-4o-transcribe capisce meglio accenti, dialetti e lingue mischiate (costa circa 0,6 centesimi al minuto).
  const model = env('OPENAI_TRANSCRIBE_MODEL', 'gpt-4o-transcribe');
  const wantStream = form.get('stream') === '1' && model.startsWith('gpt-4o');

  // Il controllo del limite e la trascrizione partono INSIEME (prima erano uno dopo l'altro).
  const credit = getPlan(userId).then(({ limits }) => useCredit(userId, 'voice', limits.voice));
  const out = new FormData();
  const name = (audio.type || '').includes('mp4') ? 'audio.mp4' : 'audio.webm';
  out.append('file', audio, name);
  out.append('model', model);
  // Istruzioni per il trascrittore: lingue mischiate, darija scritta come la scrive l'utente, parole tipiche.
  // Più le ultime frasi della chat, così capisce meglio nomi e argomenti.
  const ctx = String(form.get('context') || '').replace(/\s+/g, ' ').slice(-300);
  out.append('prompt', `${HINT}${ctx ? ` Contexte de la conversation : ${ctx}` : ''}`);
  if (wantStream) out.append('stream', 'true');
  const call = fetch(`${OPENAI}/audio/transcriptions`, { method: 'POST', headers: openaiHeaders(), body: out });

  const left = await credit;
  if (left < 0) { call.then((r) => r.body?.cancel()).catch(() => {}); return fail('limit', 429, 'Limite du micro atteinte pour aujourd’hui.'); }

  let upstream;
  try { upstream = await call; } catch { upstream = null; }
  if (!upstream?.ok) {
    const data = await upstream?.json().catch(() => null);
    await refundCredit(userId, 'voice').catch(() => {});
    console.error('OpenAI transcribe error', upstream?.status, data?.error?.code);
    if (upstream && upstream.status !== 400) { const { openaiAlert } = await import('./_alert.js'); await openaiAlert(upstream.status, JSON.stringify(data?.error || {})); }
    return fail('upstream', 502, 'Je n’ai pas compris l’audio. Réessaie.');
  }

  if (!wantStream) {
    const data = await upstream.json().catch(() => null);
    if (typeof data?.text !== 'string') return fail('upstream', 502, 'Je n’ai pas compris l’audio. Réessaie.');
    return json({ text: data.text.trim() });
  }

  // OpenAI manda eventi "data: {...}": giriamo al telefono solo i pezzi di testo.
  const enc = new TextEncoder(), dec = new TextDecoder();
  const body = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = '', sent = false;
      const handle = (line) => {
        if (!line.startsWith('data:')) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') return;
        let ev; try { ev = JSON.parse(raw); } catch { return; }
        if (ev.type === 'transcript.text.delta' && ev.delta) { controller.enqueue(enc.encode(ev.delta)); sent = true; }
        else if (ev.type === 'transcript.text.done' && !sent && ev.text) { controller.enqueue(enc.encode(ev.text)); sent = true; }
      };
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
        }
        if (buf.trim()) handle(buf.trim());
      } catch (e) { console.error('transcribe stream', e.message); }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
