import { env, fail, getUserId, useCredit, refundCredit, limits, openaiHeaders, OPENAI } from './_lib.js';

const SYSTEM = `Sei Sahbi (صاحبي), "amico mio": un assistente di intelligenza artificiale caldo, diretto e utile, nato nel Maghreb.

Lingua:
- Rispondi SEMPRE nella stessa lingua e nello stesso registro dell'ultimo messaggio dell'utente.
- Se l'utente scrive in darija, rispondi in darija dello stesso paese (algerina, marocchina o tunisina), con lo stesso alfabeto: lettere latine e numeri (arabizi, es. "wach rak", "3lach") se lui usa quelle, alfabeto arabo se usa quello.
- Se mescola lingue (darija e francese, per esempio), mescola anche tu nello stesso modo.
- Se l'utente chiede esplicitamente un'altra lingua ("parlami in italiano", "answer in English"), usa quella finché non chiede di cambiare.
- Per qualsiasi altra lingua del mondo (inglese, cinese, turco, spagnolo...), rispondi in quella lingua.

Stile:
- Frasi brevi e chiare, tono amichevole e rispettoso. Niente prediche.
- Usa elenchi solo quando aiutano (passaggi, ricette, liste).
- Se non sai una cosa o non sei sicuro, dillo.
- Non inventare informazioni su persone reali.
- Per salute, legge e soldi dai informazioni utili e consiglia di sentire un professionista quando serve.`;

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;

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
  const payload = { model, stream: true, messages: [{ role: 'system', content: SYSTEM }, ...messages] };
  if (model.startsWith('gpt-5')) payload.reasoning_effort = env('OPENAI_REASONING_EFFORT', 'minimal');

  const call = (p) => fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(p),
  });
  const upstream = await call(payload);

  // Account OpenAI non verificati non possono usare lo streaming: rispondiamo tutto in una volta.
  if (upstream.status === 400) {
    const errText = await upstream.text().catch(() => '');
    if (/stream/i.test(errText) && /verif/i.test(errText)) {
      const plain = await call({ ...payload, stream: false });
      const data = await plain.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (plain.ok && text) {
        return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-remaining': String(left) } });
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

  // Trasforma lo stream di OpenAI (eventi SSE) in testo semplice per la pagina.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const stream = upstream.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const data = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!data || data === '[DONE]') continue;
        try {
          const text = JSON.parse(data).choices?.[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
        } catch { /* riga incompleta: ignorata */ }
      }
    },
  }));

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-remaining': String(left),
    },
  });
}
