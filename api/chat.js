import { env, fail, getUserId, useCredit, refundCredit, limits, openaiHeaders, OPENAI, generateImage } from './_lib.js';

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
        prompt: { type: 'string', description: 'Descrizione dettagliata in inglese di cosa disegnare.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
}];

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

async function imageFrames(userId, prompt) {
  const r = await generateImage(userId, prompt);
  return r.ok
    ? frame({ type: 'image', id: r.id, image: r.image, prompt, remaining: r.remaining, limit: r.limit })
    : frame({ type: 'image_error', error: r.error, message: r.message });
}

const promptFrom = (args) => {
  try { return String(JSON.parse(args || '{}').prompt || '').trim(); } catch { return ''; }
};

export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Richiesta non valida.'); }
  const messages = cleanMessages(body?.messages);
  if (!messages) return fail('bad_request', 400, 'Messaggio vuoto.');

  const left = await useCredit(userId, 'chat', limits().chat);
  if (left < 0) return fail('limit', 429, 'Limite di messaggi di oggi raggiunto.');

  const model = env('OPENAI_CHAT_MODEL', 'gpt-5-nano');
  const payload = {
    model, stream: true, tools: TOOLS, tool_choice: 'auto',
    messages: [{ role: 'system', content: SYSTEM }, ...messages],
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
      const toolCall = msg?.tool_calls?.find((t) => t.function?.name === 'create_image');
      const prompt = toolCall ? promptFrom(toolCall.function.arguments) : '';
      if (plain.ok && (msg?.content || prompt)) {
        let out = msg.content || '';
        if (prompt) out += frame({ type: 'image_start', prompt }) + await imageFrames(userId, prompt);
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
          if (!announced && tool.name === 'create_image') {
            announced = true;
            controller.enqueue(encoder.encode(frame({ type: 'image_start' })));
          }
        }
      }
    },
    async flush(controller) {
      if (tool.name !== 'create_image') return;
      const prompt = promptFrom(tool.args);
      if (!prompt) { controller.enqueue(encoder.encode(frame({ type: 'image_error', error: 'bad_request', message: "Je n'ai pas compris l'image à créer. Décris-la autrement." }))); return; }
      controller.enqueue(encoder.encode(await imageFrames(userId, prompt)));
    },
  }));

  return new Response(stream, { headers });
}
