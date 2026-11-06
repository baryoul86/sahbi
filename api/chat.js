import { env, fail, getUserId, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI, generateImage, parsePhoto } from './_lib.js';
import { startVideo, videoEnabled } from './_video.js';

const SYSTEM = `Sei Sahbi (صاحبي), "amico mio": un assistente di intelligenza artificiale caldo, diretto e utile, nato nel Maghreb.

Lingua:
- Rispondi SEMPRE nella stessa lingua e nello stesso registro dell'ultimo messaggio dell'utente.
- Se l'utente scrive in darija, rispondi in darija dello stesso paese (algerina, marocchina o tunisina), con lo stesso alfabeto: lettere latine e numeri (arabizi, es. "wach rak", "3lach") se lui usa quelle, alfabeto arabo se usa quello.
- Se mescola lingue (darija e francese, per esempio), mescola anche tu nello stesso modo.
- Se l'utente chiede esplicitamente un'altra lingua ("parlami in italiano", "answer in English"), usa quella finché non chiede di cambiare.
- Per qualsiasi altra lingua del mondo, rispondi in quella lingua.

Immagini:
- Puoi creare immagini con lo strumento create_image. Usalo quando l'utente vuole VEDERE un'immagine: "fammi/crea/disegna/genera un'immagine", "dessine", "رسم", "dir lia tswira", oppure quando descrive una scena e chiaramente vuole il disegno. Usalo anche per modificare un'immagine creata prima ("falla più scura", "aggiungi un gatto"): riscrivi la descrizione completa con la modifica.
- Se l'utente chiede solo un PROMPT (il testo da usare in un altro programma), scrivilo come testo e non usare lo strumento.
- Nel prompt per lo strumento scrivi una descrizione dettagliata in inglese: soggetto, stile, luce, inquadratura. Rispetta lo stile chiesto.
- Non creare immagini sessuali, violente in modo esplicito, di persone reali riconoscibili o che imitano marchi e personaggi protetti: spiega gentilmente che non puoi e proponi un'alternativa.
- Nella cronologia, "[Image créée : ...]" indica un'immagine che hai già creato con quella descrizione.

Foto dell'utente:
- L'utente può inviare una foto insieme al messaggio. Se fa una domanda sulla foto (spiegare un esercizio, tradurre un documento, leggere una bolletta, descrivere), rispondi guardando la foto.
- Se vuole TRASFORMARE la sua foto (stile cartone animato, anime, 3D, fumetto, acquerello, realistico, cambiare lo sfondo...), usa create_image con edit_photo = true e descrivi in inglese la trasformazione, chiedendo di mantenere riconoscibili persone e composizione.
- Con edit_photo = false l'immagine viene creata da zero, senza la foto.
- Nella cronologia, "[Photo envoyée]" indica una foto mandata prima: non la vedi più, se serve chiedi di rimandarla.
- Non identificare mai chi è una persona nella foto dal suo viso.

{{VIDEO}}

Stile:
- Frasi brevi e chiare, tono amichevole e rispettoso. Niente prediche.
- Usa elenchi solo quando aiutano (passaggi, ricette, liste).
- Se non sai una cosa o non sei sicuro, dillo.
- Non inventare informazioni su persone reali.
- Per salute, legge e soldi dai informazioni utili e consiglia di sentire un professionista quando serve.`;

const TOOLS = [{
  type: 'function',
  function: {
    name: 'create_image',
    description: "Crea un'immagine e la mostra all'utente nella chat.",
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrizione dettagliata in inglese di cosa disegnare o di come trasformare la foto.' },
        edit_photo: { type: 'boolean', description: "true per trasformare la foto che l'utente ha appena inviato; false per creare da zero." },
      },
      required: ['prompt', 'edit_photo'],
      additionalProperties: false,
    },
  },
}];

const VIDEO_ON = `Video:
- PUOI creare video di 8 secondi con lo strumento create_video, proprio come crei immagini. Non dire mai che non puoi creare video.
- Usalo quando l'utente vuole un VIDEO o un'animazione, in qualsiasi lingua: "fammi un video", "fais une vidéo", "make a video", "anime ma photo", "dir lia video", "اعمل لي فيديو".
- Chiamalo SUBITO, nella stessa risposta: non chiedere conferme, non proporre opzioni, non mostrare il prompt all'utente. Al massimo una frase breve, per esempio "Je crée ta vidéo, ça prend environ une minute."
- Nel prompt scrivi in inglese la scena, il movimento, la camera, lo stile e i suoni. Con from_photo = true il video parte dalla foto appena inviata (per animarla).
- Il piano Pro e il limite mensile li controlla il server: tu chiama sempre lo strumento.
- Persone: va bene una persona generica (un uomo, una donna, una famiglia). Rifiuta solo contenuti sessuali, violenza esplicita, minori in situazioni non adatte, persone reali famose o riconoscibili in situazioni false o umilianti, marchi e personaggi protetti; in quel caso proponi subito un'alternativa.
- Nella cronologia, "[Vidéo créée : ...]" indica un video che hai già creato.`;
const VIDEO_OFF = `Video:
- I video non sono ancora disponibili: se l'utente ne chiede uno, di' in una frase che arriveranno presto su Sahbi e proponi un'immagine.`;

const VIDEO_TOOL = {
  type: 'function',
  function: {
    name: 'create_video',
    description: "Crea davvero un video di 8 secondi e lo mostra all'utente nella chat (circa un minuto di attesa).",
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrizione dettagliata in inglese: scena, movimento, camera, stile, suoni.' },
        from_photo: { type: 'boolean', description: "true per partire dalla foto che l'utente ha appena inviato; false altrimenti." },
      },
      required: ['prompt', 'from_photo'],
      additionalProperties: false,
    },
  },
};

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const SEP = '\u001e'; // separa i messaggi di controllo (immagini) dal testo

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const m of input.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (content) out.push({ role: m.role, content });
  }
  return out.length && out[out.length - 1].role === 'user' ? out : null;
}

const frame = (obj) => `${SEP}${JSON.stringify(obj)}${SEP}`;

async function imageFrames(userId, prompt, opts) {
  const r = await generateImage(userId, prompt, opts);
  return r.ok
    ? frame({ type: 'image', id: r.id, image: r.image, prompt, remaining: r.remaining, limit: r.limit })
    : frame({ type: 'image_error', error: r.error, message: r.message });
}

const parseArgs = (args) => {
  try {
    const a = JSON.parse(args || '{}');
    return { prompt: String(a.prompt || '').trim(), edit: a.edit_photo === true || a.from_photo === true };
  } catch { return { prompt: '', edit: false }; }
};

async function videoFrames(userId, prompt, opts) {
  const r = await startVideo(userId, prompt, opts);
  return r.ok
    ? frame({ type: 'video', id: r.id, prompt, remaining: r.remaining, limit: r.limit })
    : frame({ type: 'video_error', error: r.error, message: r.message });
}

export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const messages = cleanMessages(body?.messages);
  if (!messages) return fail('bad_request', 400, 'Messaggio vuoto.');
  const photo = body?.photo ? parsePhoto(body.photo) : null;
  if (body?.photo && !photo) return fail('bad_request', 400, 'Photo non valide ou trop grande.');

  const { limits, pro } = await getPlan(userId);
  const left = await useCredit(userId, 'chat', limits.chat);
  if (left < 0) return fail('limit', 429, pro ? 'Limite di messaggi di oggi raggiunto.' : 'Limite gratuito di oggi raggiunto.');
  const imgOpts = (edit) => ({ limit: limits.image, photo: edit ? photo : null });
  const vidOpts = (fromPhoto) => ({ pro, limit: limits.video, photo: fromPhoto ? photo : null });
  const tools = videoEnabled() ? [...TOOLS, VIDEO_TOOL] : TOOLS;
  const NAMES = tools.map((t) => t.function.name);
  // Esegue lo strumento scelto dal modello e restituisce i messaggi di controllo per il telefono.
  const runTool = (name, prompt, edit) => (name === 'create_video'
    ? videoFrames(userId, prompt, vidOpts(edit))
    : imageFrames(userId, prompt, imgOpts(edit)));
  const startFrame = (name) => frame({ type: name === 'create_video' ? 'video_start' : 'image_start' });

  // La foto va solo nell'ultimo messaggio dell'utente.
  if (photo) {
    const last = messages[messages.length - 1];
    last.content = [
      { type: 'text', text: last.content },
      { type: 'image_url', image_url: { url: photo.dataUrl } },
    ];
  }

  const model = env('OPENAI_CHAT_MODEL', 'gpt-5-nano');
  const payload = {
    model, stream: true, tools, tool_choice: 'auto',
    messages: [{ role: 'system', content: SYSTEM.replace('{{VIDEO}}', videoEnabled() ? VIDEO_ON : VIDEO_OFF) }, ...messages],
  };
  if (model.startsWith('gpt-5')) payload.reasoning_effort = env('OPENAI_REASONING_EFFORT', 'minimal');

  const call = (p) => fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(p),
  });
  const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-remaining': String(left) };
  const upstream = await call(payload);

  // Account OpenAI non verificati non possono usare lo streaming: rispondiamo tutto in una volta.
  if (upstream.status === 400) {
    const errText = await upstream.text().catch(() => '');
    if (/stream/i.test(errText) && /verif/i.test(errText)) {
      const plain = await call({ ...payload, stream: false });
      const data = await plain.json().catch(() => null);
      const msg = data?.choices?.[0]?.message;
      const toolCall = msg?.tool_calls?.find((t) => NAMES.includes(t.function?.name));
      const { prompt, edit } = toolCall ? parseArgs(toolCall.function.arguments) : { prompt: '' };
      if (plain.ok && (msg?.content || prompt)) {
        let out = msg.content || '';
        if (prompt) out += startFrame(toolCall.function.name) + await runTool(toolCall.function.name, prompt, edit);
        return new Response(out, { headers });
      }
    }
    await refundCredit(userId, 'chat').catch(() => {});
    console.error('OpenAI chat error', 400, errText.slice(0, 300));
    return fail('upstream', 502, 'Sahbi non riesce a rispondere ora. Riprova tra poco.');
  }
  if (!upstream.ok || !upstream.body) {
    await refundCredit(userId, 'chat').catch(() => {});
    console.error('OpenAI chat error', upstream.status, await upstream.text().catch(() => ''));
    return fail('upstream', 502, 'Sahbi non riesce a rispondere ora. Riprova tra poco.');
  }

  // Trasforma lo stream di OpenAI in testo semplice; se il modello chiede un'immagine, la crea alla fine.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const tool = { name: '', args: '' };
  let announced = false;
  const stream = upstream.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const data = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!data || data === '[DONE]') continue;
        let delta;
        try { delta = JSON.parse(data).choices?.[0]?.delta; } catch { continue; }
        if (delta?.content) controller.enqueue(encoder.encode(delta.content.replaceAll(SEP, '')));
        for (const tc of delta?.tool_calls || []) {
          if (tc.index && tc.index > 0) continue; // una sola immagine per messaggio
          if (tc.function?.name) tool.name += tc.function.name;
          if (tc.function?.arguments) tool.args += tc.function.arguments;
          if (!announced && NAMES.includes(tool.name)) {
            announced = true;
            controller.enqueue(encoder.encode(startFrame(tool.name)));
          }
        }
      }
    },
    async flush(controller) {
      if (!NAMES.includes(tool.name)) return;
      const { prompt, edit } = parseArgs(tool.args);
      if (!prompt) {
        const video = tool.name === 'create_video';
        controller.enqueue(encoder.encode(frame({ type: video ? 'video_error' : 'image_error', error: 'bad_request', message: video ? "Je n'ai pas compris la vidéo à créer. Décris-la autrement." : "Je n'ai pas compris l'image à créer. Décris-la autrement." })));
        return;
      }
      controller.enqueue(encoder.encode(await runTool(tool.name, prompt, edit)));
    },
  }));

  return new Response(stream, { headers });
}
