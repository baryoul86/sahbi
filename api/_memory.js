// Memoria di Sahbi: poche cose utili sull'utente (nome, città, studi, lavoro, preferenze).
// I ricordi si vedono e si cancellano in Paramètres. Niente dati sensibili.
import { env, supabaseUrl, serviceHeaders, openaiHeaders, OPENAI } from './_lib.js';

const MAX_FACTS = 30;
const MAX_FACT = 160;
export const memoryEnabled = () => env('MEMORY_ENABLED', 'true') !== 'false';

export async function getMemory(userId) {
  if (!memoryEnabled()) return [];
  try {
    const q = new URLSearchParams({ user_id: `eq.${userId}`, select: 'facts' });
    const res = await fetch(`${supabaseUrl()}/rest/v1/memories?${q}`, { headers: serviceHeaders() });
    if (!res.ok) return []; // tabella non ancora creata (004_memory.sql)
    const facts = (await res.json())[0]?.facts;
    return Array.isArray(facts) ? facts.filter((f) => typeof f === 'string').slice(0, MAX_FACTS) : [];
  } catch { return []; }
}

export async function setMemory(userId, facts) {
  const clean = [...new Set(facts.map((f) => String(f).trim().slice(0, MAX_FACT)).filter(Boolean))].slice(-MAX_FACTS);
  const res = await fetch(`${supabaseUrl()}/rest/v1/memories?on_conflict=user_id`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, facts: clean, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`memories ${res.status}`);
  return clean;
}

// Solo i messaggi che sembrano parlare dell'utente passano dall'estrazione (costa poco, ma non serve sempre).
const CUES = /(je m['’]appelle|mon (pr[ée])?nom|my name|i['’]?m from|i live|i work|i study|je suis (en|étudiant|né|de|d['’])|j['’]ai \d+ ans|j['’]habite|je vis|je travaille|je pr[ée]pare|mi chiamo|sono (di|nato|nata)|abito|vivo a|lavoro (come|a|in)|studio|smiti|esmi|ana m(e|)n|nskon|nseken|n(9|q)ra|nekhdem|nkhdem|5edma|khedma|اسمي|أنا من|انا من|نسكن|نقرا|ندرس|أدرس|نخدم|أعمل|عمري|souviens[- ]toi|retiens|n['’]oublie pas|remember|ricorda(ti)?|bac|terminale|filière|lycée|université|fac)/i;
export const mightTalkAboutSelf = (text) => typeof text === 'string' && text.length >= 6 && CUES.test(text);

const EXTRACT = `Estrai dal MESSAGGIO DELL'UTENTE solo fatti stabili e utili su di lui da ricordare nelle prossime conversazioni: nome o soprannome, paese e città, età, classe o filiera di studio, scuola, lavoro, lingua o dialetto preferito, obiettivi (es. "prépare le Bac en juin"), gusti chiari, cose che chiede esplicitamente di ricordare.
NON estrarre: salute, religione, politica, orientamento sessuale, dati di documenti, indirizzi esatti, numeri di telefono, password, dati bancari, fatti su altre persone, cose temporanee.
Scrivi ogni fatto in francese, breve, in terza persona (es. "S'appelle Yacine", "Vit à Oran", "En terminale sciences expérimentales").
Se un fatto nuovo sostituisce uno dei FATTI GIÀ NOTI (es. ha cambiato città), mettilo in "replace" con il testo vecchio esatto.
Rispondi solo in JSON: {"add": ["..."], "replace": [{"old": "...", "new": "..."}]}. Se non c'è niente: {"add": [], "replace": []}.`;

// Aggiorna la memoria leggendo l'ultimo messaggio. Non blocca mai la chat: in caso di errore non fa niente.
export async function learnFromMessage(userId, userText, known) {
  if (!memoryEnabled() || !mightTalkAboutSelf(userText)) return null;
  try {
    const model = env('OPENAI_CHAT_MODEL', 'gpt-5-nano');
    const res = await fetch(`${OPENAI}/chat/completions`, {
      method: 'POST',
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        model,
        ...(model.startsWith('gpt-5') ? { reasoning_effort: 'minimal' } : {}),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT },
          { role: 'user', content: `FATTI GIÀ NOTI:\n${known.map((f) => `- ${f}`).join('\n') || '(nessuno)'}\n\nMESSAGGIO DELL'UTENTE:\n${userText.slice(0, 2000)}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const d = JSON.parse((await res.json())?.choices?.[0]?.message?.content || '{}');
    const add = (Array.isArray(d.add) ? d.add : []).filter((f) => typeof f === 'string' && f.trim()).slice(0, 3);
    const replace = (Array.isArray(d.replace) ? d.replace : []).filter((r) => typeof r?.old === 'string' && typeof r?.new === 'string');
    if (!add.length && !replace.length) return null;
    let facts = known.slice();
    for (const r of replace) facts = facts.map((f) => (f === r.old ? r.new : f));
    facts.push(...add);
    return await setMemory(userId, facts);
  } catch (e) {
    console.error('Memoria', e.message);
    return null;
  }
}

export const memoryPrompt = (facts) => (facts.length
  ? `\n\nCosa sai già dell'utente (ricordi salvati da conversazioni precedenti; usali con naturalezza, per esempio chiamandolo per nome, senza elencarli se non te lo chiede; se ti chiede cosa ricordi, elencali e digli che può cancellarli in Paramètres):\n${facts.map((f) => `- ${f}`).join('\n')}`
  : '');
