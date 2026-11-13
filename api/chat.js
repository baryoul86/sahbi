import { env, fail, getUserId, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI, generateImage, parsePhoto } from './_lib.js';
import { startVideo, videoEnabled } from './_video.js';
import { getMemory, learnFromMessage, memoryPrompt } from './_memory.js';
import { openaiAlert } from './_alert.js';

const VOICE_STYLE = `\n\nModalità conversazione a voce: l'utente ti PARLA e la tua risposta verrà letta ad alta voce. Rispondi come in una telefonata tra amici: 1-3 frasi brevi e naturali, niente elenchi, niente emoji, niente simboli o markdown, niente link. Se serve una spiegazione lunga, dai l'essenziale e chiedi se vuole continuare.`;
const MAX_DOC_CHARS = 60000;
// Lingua dell'interfaccia scelta dall'utente: serve solo quando dal messaggio non si capisce la lingua (es. "ok", un'emoji).
const UI_LANG = { fr: 'francese', ar: 'arabo', en: 'inglese' };
// Lingua dell'ultimo messaggio (solo quando è chiara): l'istruzione va in fondo, così vince su cronologia e ricordi.
const LANG_WORDS = {
  italiano: /\b(il|lo|la|gli|che|non|per|una|sono|questa|questo|voglio|fammi|trasformami|come|perché|anche|della|nella|mi|ciao|grazie|puoi|vorrei)\b/gi,
  francese: /\b(le|les|des|une|est|pas|pour|avec|je|tu|vous|qui|que|dans|sur|fais|moi|bonjour|merci|peux|veux|c'est|ça)\b/gi,
  inglese: /\b(the|and|is|are|you|what|how|can|please|make|with|this|that|my|me|for|hello|thanks|want|could)\b/gi,
  spagnolo: /\b(el|los|las|una|es|por|para|con|que|hola|gracias|quiero|puedes|esta|este|hazme|cómo)\b/gi,
  tedesco: /\b(der|die|das|und|ist|nicht|ich|du|mit|bitte|danke|kannst|mach|mein|eine)\b/gi,
};
const DARIJA = /\b(wach|wesh|rak|rah|bghit|bghina|kifach|chno|chnou|3la|dyal|dial|ntaa|nta3|bezzaf|khoya|sahbi|labas|wakha|safi|daba|kayen|ma3ndich|shlonak|ezayak|3amel|ana|enta|ntia)\b|[a-z][2379][a-z]/i;
function detectLang(text) {
  const t = String(text || '');
  if (!t.trim() || /[\u0600-\u06FF]/.test(t) || DARIJA.test(t)) return null; // arabo e darija: ci pensa il prompt
  const scores = Object.entries(LANG_WORDS).map(([k, re]) => [k, (t.match(re) || []).length]).sort((a, b) => b[1] - a[1]);
  return scores[0][1] >= 2 && scores[0][1] >= scores[1][1] * 2 ? scores[0][0] : null;
}
// Richieste chiarissime di immagine: lo strumento si chiama SUBITO, senza testo né domande.
const STYLE_ASK = /(trasform|transform|stile|style|disney|pixar|dreamworks|ghibli|cartoon|cartone|anime|manga|3d|aquarell|acquerell|watercolor|bande dessin|fumetto|comic|حوّل|حول|ستايل|كرتون)/i;
const NOT_IMAGE = /(vid[ée]o|فيديو|\banime[rz]?\s+(ma|la|cette|mon)|\banima|\bprompt\b)/i;
const IMAGE_REQ = /^(dessine|disegna|draw|ارسم|rsem|rsemli)\b|^(?!.*\bprompt\b).*(fammi|fai|crea|creami|disegna|disegnami|genera|dessine|fais[- ]moi|fait[- ]moi|crée|cree|génère|genere|draw|make me|create|generate|ارسم|اصنع|اعمل لي|سوي لي|dir ?li|dirli|sawer|rsem|3mel li).{0,40}(immagine|image|foto|photo|dessin|disegno|picture|drawing|صورة|رسم|tswira|tsawer|poster|affiche|logo|sticker|carte|biglietto)/i;
const langPrompt = (text) => { const l = detectLang(text); return l ? `\n\nLINGUA DI QUESTA RISPOSTA: l'ultimo messaggio dell'utente è in ${l}. Rispondi in ${l}, anche se la cronologia, i ricordi o l'interfaccia sono in un'altra lingua.` : ''; };
const uiLangPrompt = (l) => (UI_LANG[l] ? `\n\nL'interfaccia dell'app è in ${UI_LANG[l]}: se dall'ultimo messaggio non si capisce la lingua, rispondi in ${UI_LANG[l]}.` : '');
// Documento allegato (testo già estratto dal telefono, da PDF o Word): { name, text }.
function parseDoc(value) {
  if (!value || typeof value !== 'object') return null;
  const text = typeof value.text === 'string' ? value.text.replace(/\u0000/g, '').trim() : '';
  if (!text) return null;
  const name = (typeof value.name === 'string' ? value.name : 'document').replace(/[\r\n"«»]/g, ' ').slice(0, 120);
  return { name, text: text.slice(0, MAX_DOC_CHARS), cut: text.length > MAX_DOC_CHARS };
}

const SYSTEM = `Sei Sahbi (صاحبي), "amico mio": un assistente di intelligenza artificiale caldo, diretto e utile, nato nel Maghreb.

Lingua:
- Rispondi SEMPRE nella stessa lingua e nello stesso registro dell'ultimo messaggio dell'utente.
- Se l'utente scrive in darija, rispondi in darija dello stesso paese (algerina, marocchina o tunisina), con lo stesso alfabeto: lettere latine e numeri (arabizi, es. "wach rak", "3lach") se lui usa quelle, alfabeto arabo se usa quello.
- Se l'utente scrive in dialetto egiziano (masri, es. "ezayak", "3amel eh", "عامل ايه", "ازيك") rispondi in egiziano; se scrive in dialetto del Golfo (khaleeji: emiratino, saudita, qatariota, kuwaitiano, es. "shlonak", "wesh tabi", "شلونك", "وش تبي", "ابغى") rispondi nello stesso dialetto del Golfo; per il levantino (shami) fai lo stesso. Stesso alfabeto dell'utente.
- Se scrive in arabo standard (fusha) rispondi in arabo standard, semplice e chiaro.
- Se mescola lingue (darija e francese, per esempio), mescola anche tu nello stesso modo.
- Se l'utente chiede esplicitamente un'altra lingua ("parlami in italiano", "answer in English"), usa quella finché non chiede di cambiare.
- Per qualsiasi altra lingua del mondo, rispondi in quella lingua.

Immagini:
- Puoi creare immagini con lo strumento create_image. Usalo quando l'utente vuole VEDERE un'immagine: "fammi/crea/disegna/genera un'immagine", "dessine", "رسم", "dir lia tswira", oppure quando descrive una scena e chiaramente vuole il disegno. Usalo anche per modificare un'immagine creata prima ("falla più scura", "aggiungi un gatto"): riscrivi la descrizione completa con la modifica.
- Se l'utente chiede solo un PROMPT (il testo da usare in un altro programma), scrivilo come testo e non usare lo strumento.
- Nel prompt per lo strumento traduci in inglese FEDELMENTE la richiesta: TUTTI i dettagli dell'utente (chi o cosa, quanti, colori, vestiti, azioni, luogo, momento del giorno, stile, formato). Non cambiare il soggetto, non aggiungere persone, oggetti o idee che l'utente non ha chiesto, non "migliorare" la scena con fantasia. Poi aggiungi solo luce e inquadratura adatte.
- Se l'utente chiede un testo scritto nell'immagine (un nome, "Aïd Moubarak", "عيد مبارك"), mettilo nel prompt tra virgolette ESATTAMENTE come l'ha scritto.
- Parole in darija o dialetto: capiscile bene prima di tradurle (es. "tswira" = immagine, "dar" = casa, "khobz" = pane, "9at" = gatto, "kelb" = cane, "bhar" = mare). Se una parola è davvero ambigua, scegli il senso più normale nel contesto.
- Per modificare un'immagine già creata, riparti dalla sua descrizione "[Image créée : ...]" e cambia SOLO quello che l'utente chiede.
- NON chiedere mai conferma ("vuoi che proceda?", "ti va?"): se la richiesta è chiara, chiama SUBITO create_image nella stessa risposta, con al massimo una frase breve.
- Non creare immagini sessuali, violente in modo esplicito, di persone famose o che imitano marchi e personaggi protetti: spiega gentilmente che non puoi e proponi un'alternativa. Puoi però ispirarti a uno stile (es. "yellow-skinned 2D cartoon style" invece del nome di una serie).
- STILI DI STUDI FAMOSI (Disney, Pixar, DreamWorks, Ghibli, Simpson, Marvel, anime...): uno STILE non è un personaggio protetto. NON rifiutare mai, NON chiedere conferma, NON proporre alternative: chiama SUBITO create_image (con edit_photo = true se c'è la foto) e descrivi lo stile con parole generiche, es. "classic hand-drawn 2D animated fairy-tale film style, big expressive eyes, soft colors" per Disney, "3D animated family movie style" per Pixar, "soft hand-painted Japanese animation style" per Ghibli. Rifiuta solo se si chiede di copiare un personaggio preciso (es. Topolino, Elsa).
- Nella cronologia, "[Image créée : ...]" indica un'immagine che hai già creato con quella descrizione.

Foto dell'utente:
- L'utente può inviare una foto insieme al messaggio. Se fa una domanda sulla foto (spiegare un esercizio, tradurre un documento, leggere una bolletta, descrivere), rispondi guardando la foto.
- Se vuole TRASFORMARE la sua foto (stile cartone animato, anime, 3D, fumetto, acquerello, realistico, cambiare lo sfondo...), usa SUBITO create_image con edit_photo = true e descrivi in inglese la trasformazione, chiedendo di mantenere riconoscibili persone e composizione. Trasformare la foto che l'utente ti manda è permesso anche se ci sono persone, purché il risultato non sia sessuale, violento o umiliante (vestiti sempre coperti e decenti).
- Con edit_photo = false l'immagine viene creata da zero, senza la foto.
- Nella cronologia, "[Photo envoyée]" indica una foto mandata prima. Se il messaggio dice "(photo envoyée juste avant, jointe à nouveau)", la foto è di nuovo allegata: puoi usarla con edit_photo = true.
- Non identificare mai chi è una persona nella foto dal suo viso.

{{VIDEO}}

Biglietti di auguri e sticker:
- Se l'utente vuole un biglietto, una carta di auguri o uno sticker (Aïd, Ramadan, matrimonio, compleanno, nascita, successo al Bac, guarigione...), usa create_image subito.
- Nel prompt metti il testo da scrivere sul biglietto tra virgolette, ESATTO e corto (massimo 5-6 parole), indicando l'alfabeto (arabo o latino) e "the text must be spelled exactly". Se ha dato un nome, scrivilo così com'è.
- Stile festoso e curato, adatto alla festa (lanterne e mezzaluna per Ramadan, motivi geometrici e dorati per l'Aïd, fiori per matrimoni...). Per uno sticker: "sticker style, thick white outline, plain white background".
- Dopo, ricorda in una frase che può condividerlo su WhatsApp con il pulsante Partager.

Modalità Bac:
- Se il messaggio inizia con "Mode Bac", sei un professore paziente che segue il programma ufficiale del paese indicato (Algérie, Maroc o Tunisie) e la filiera indicata. Rispondi nella lingua del messaggio; per le materie scientifiche usa la lingua in cui si insegnano in quel paese se l'utente non chiede altro.
- Quiz: UNA domanda alla volta, con 4 scelte A, B, C, D. Aspetta la risposta, correggi in 2-3 frasi spiegando perché, poi fai la domanda successiva. Alla fine dai il punteggio (es. 4/5) e i punti da ripassare.
- Fiche de révision: definizioni, formule o date chiave, metodo, un mini esempio, errori frequenti. Breve e ordinata.
- Exercice corrigé: prima l'enunciato, poi aspetta che l'utente provi; se chiede la soluzione, correggi passo per passo.
- Se non sei sicuro che un capitolo sia nel programma di quel paese, dillo.

Documenti:
- L'utente può allegare un documento (PDF o Word): il testo arriva tra le righe [Document « nome »] e """ ... """. Rispondi alla sua domanda sul documento (riassunto, traduzione, spiegazione, risposta da scrivere). Non inventare cose che non ci sono.
- Nella cronologia, "[Document envoyé : ...]" indica un documento mandato prima: se serve di nuovo, chiedi di rimandarlo.

CV e lettere:
- Per un CV usa sezioni chiare in righe separate (Nom, Contact, Profil, Expérience, Formation, Compétences, Langues), con titoli in maiuscolo e punti elenco con "- ". Niente tabelle. Dopo, ricorda che può scaricarlo in PDF con il pulsante PDF sotto la risposta.

Meteo:
- Per il meteo (tempo, temperatura, pioggia, vento, oggi/domani/settimana) chiama SUBITO get_weather con la città e le sue coordinate approssimative. Se l'utente non dice la città, usa quella dei ricordi; se non c'è, chiedi solo la città in una frase.
- Con i dati ricevuti rispondi in modo breve e concreto: temperatura, cielo, pioggia, vento, e un consiglio pratico (ombrello, giacca...). Alla fine scrivi tra parentesi la fonte: MET Norway.

Risposte dirette:
- Rispondi SUBITO alla domanda, con la risposta vera già nella prima frase.
- Non scrivere mai frasi come "vado a cercare", "un attimo", "controllo e ti dico", "se vuoi posso…", "fammi sapere se vuoi che…" al posto della risposta. Non promettere di fare dopo: fai adesso.
- Non hai internet (tranne il meteo con get_weather). Per notizie, prezzi, risultati sportivi o fatti molto recenti, dì in UNA frase che non hai i dati in tempo reale e dai comunque l'informazione più utile che conosci.
- Fai una domanda solo se senza quella informazione è impossibile rispondere.

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
const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Meteo attuale e previsioni (fino a 7 giorni) per una città. Usalo per ogni domanda sul tempo che fa o che farà.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Nome della città, es. "Oran", "Dubai", "Le Caire"' },
        latitude: { type: 'number', description: 'Latitudine approssimativa della città' },
        longitude: { type: 'number', description: 'Longitudine approssimativa della città' },
        days: { type: 'integer', description: 'Quanti giorni di previsione servono (1 = oggi, 2 = anche domani, max 7)' },
      },
      required: ['city', 'latitude', 'longitude'],
      additionalProperties: false,
    },
  },
};
const SKY = { clearsky: 'ciel dégagé', fair: 'beau temps', partlycloudy: 'partiellement nuageux', cloudy: 'nuageux', fog: 'brouillard', lightrain: 'pluie faible', rain: 'pluie', heavyrain: 'forte pluie', lightrainshowers: 'averses faibles', rainshowers: 'averses', heavyrainshowers: 'fortes averses', thunder: 'orage', rainandthunder: 'pluie et orage', heavyrainandthunder: 'orages violents', rainshowersandthunder: 'averses orageuses', lightsleet: 'neige fondue', sleet: 'neige fondue', lightsnow: 'neige faible', snow: 'neige', heavysnow: 'forte neige', snowshowers: 'averses de neige' };
const sky = (code) => { const k = String(code || '').replace(/_(day|night|polartwilight)$/, ''); return SKY[k] || k; };
// Previsioni da MET Norway (gratuito anche per uso commerciale, con citazione della fonte).
export async function getWeather({ city, latitude, longitude, days } = {}) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: 'coordonnées inconnues' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, {
      headers: { 'user-agent': 'Sahbi/1.0 https://www.sahbi.bond', accept: 'application/json' }, signal: ctrl.signal,
    });
    if (!r.ok) return { error: `service météo indisponible (${r.status})` };
    const ts = (await r.json())?.properties?.timeseries || [];
    if (!ts.length) return { error: 'pas de données' };
    const off = Math.round(lon / 15) * 3600e3; // ora locale approssimativa
    const local = (iso) => new Date(new Date(iso).getTime() + off).toISOString();
    const now = ts[0], d0 = now.data?.instant?.details || {};
    const n = Math.min(7, Math.max(1, Number(days) || 3));
    const byDay = new Map();
    for (const x of ts) {
      const day = local(x.time).slice(0, 10), hour = Number(local(x.time).slice(11, 13));
      const det = x.data?.instant?.details || {};
      const e = byDay.get(day) || { day, min: Infinity, max: -Infinity, rain_mm: 0, wind_max_kmh: 0, sky: null, skyHour: 99 };
      e.min = Math.min(e.min, det.air_temperature); e.max = Math.max(e.max, det.air_temperature);
      e.wind_max_kmh = Math.max(e.wind_max_kmh, Math.round((det.wind_speed || 0) * 3.6));
      const next = x.data?.next_6_hours || x.data?.next_1_hours;
      if (x.data?.next_1_hours) e.rain_mm += x.data.next_1_hours.details?.precipitation_amount || 0;
      if (next?.summary?.symbol_code && Math.abs(hour - 13) < Math.abs(e.skyHour - 13)) { e.sky = sky(next.summary.symbol_code); e.skyHour = hour; }
      byDay.set(day, e);
    }
    const daily = [...byDay.values()].slice(0, n).map((e) => ({ day: e.day, min_c: Math.round(e.min), max_c: Math.round(e.max), sky: e.sky, rain_mm: Math.round(e.rain_mm * 10) / 10, wind_max_kmh: e.wind_max_kmh }));
    return {
      city, local_time_now: local(now.time).slice(0, 16).replace('T', ' '),
      now: { temp_c: Math.round(d0.air_temperature), sky: sky((now.data?.next_1_hours || now.data?.next_6_hours)?.summary?.symbol_code), wind_kmh: Math.round((d0.wind_speed || 0) * 3.6), humidity: Math.round(d0.relative_humidity || 0) },
      daily, source: 'MET Norway',
    };
  } catch (e) { return { error: e.name === 'AbortError' ? 'service météo trop lent' : 'service météo indisponible' }; }
  finally { clearTimeout(t); }
}

// Data di oggi: serve per "domani", "sabato", ecc.
const todayPrompt = () => `\n\nOggi è ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Algiers' })}.`;
// Messaggi per la seconda risposta dopo il meteo.
const weatherMessages = (base, reply, id, args, data) => [...base,
  { role: 'assistant', content: reply || null, tool_calls: [{ id, type: 'function', function: { name: 'get_weather', arguments: args } }] },
  { role: 'tool', tool_call_id: id, content: JSON.stringify(data) }];

const parseJSON = (t) => { try { return JSON.parse(t || '{}'); } catch { return {}; } };
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

// GET = sveglia il server (la conversazione vocale lo chiama appena si apre).
export function GET() { return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }); }

export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Demande invalide.'); }
  const messages = cleanMessages(body?.messages);
  if (!messages) return fail('bad_request', 400, 'Message vide.');
  const photo = body?.photo ? parsePhoto(body.photo) : null;
  if (body?.photo && !photo) return fail('bad_request', 400, 'Photo non valide ou trop grande.');

  const doc = body?.doc ? parseDoc(body.doc) : null;
  if (body?.doc && !doc) return fail('bad_request', 400, 'Document vide ou illisible.');

  const [{ limits, pro }, memory] = await Promise.all([getPlan(userId), getMemory(userId)]);
  if (doc && !pro) return fail('pro', 402, 'La lecture de documents est incluse dans Sahbi Pro.');
  const userText = messages[messages.length - 1].content;
  const left = await useCredit(userId, 'chat', limits.chat);
  if (left < 0) return fail('limit', 429, pro ? 'Limite de messages atteinte pour aujourd’hui.' : 'Limite gratuite atteinte pour aujourd’hui.');
  // Le parole esatte dell'utente vanno anche al disegnatore, così non può "inventare" un'altra scena.
  const ownWords = userText.replace(/\(photo envoyée juste avant, jointe à nouveau\)/g, '').trim();
  const recent = messages.slice(-6, -1).map((m) => `${m.role === 'user' ? 'User' : 'Sahbi'}: ${m.content.slice(0, 500)}`).join('\n');
  const imgOpts = (edit) => ({ limit: limits.image, photo: edit ? photo : null, userText: ownWords.slice(0, 1500), history: recent });
  const vidOpts = (fromPhoto) => ({ pro, limit: limits.video, photo: fromPhoto ? photo : null });
  const media = videoEnabled() ? [...TOOLS, VIDEO_TOOL] : TOOLS;
  const tools = [...media, WEATHER_TOOL];
  const NAMES = media.map((t) => t.function.name); // strumenti che creano immagini o video
  // Esegue lo strumento scelto dal modello e restituisce i messaggi di controllo per il telefono.
  const runTool = (name, prompt, edit) => (name === 'create_video'
    ? videoFrames(userId, prompt, vidOpts(edit))
    : imageFrames(userId, prompt, imgOpts(edit)));
  const startFrame = (name) => frame({ type: name === 'create_video' ? 'video_start' : 'image_start' });

  // Il documento va solo nell'ultimo messaggio dell'utente.
  if (doc) {
    const last = messages[messages.length - 1];
    last.content = `${last.content}\n\n[Document « ${doc.name} »]${doc.cut ? ' (document long : seul le début est inclus)' : ''}\n"""\n${doc.text}\n"""`;
  }
  // La foto va solo nell'ultimo messaggio dell'utente.
  if (photo) {
    const last = messages[messages.length - 1];
    last.content = [
      { type: 'text', text: body?.photoEarlier === true ? `${last.content}\n(photo envoyée juste avant, jointe à nouveau)` : last.content },
      { type: 'image_url', image_url: { url: photo.dataUrl } },
    ];
  }

  const model = env('OPENAI_CHAT_MODEL', 'gpt-5-nano');
  const payload = {
    model, stream: true, tools,
    // Foto + "trasformala in stile…", oppure "fammi un'immagine di…": si disegna subito, senza domande.
    tool_choice: !NOT_IMAGE.test(userText) && ((photo && !body?.photoEarlier && STYLE_ASK.test(userText)) || (!photo && IMAGE_REQ.test(userText.trim())))
      ? { type: 'function', function: { name: 'create_image' } } : 'auto',
    messages: [{ role: 'system', content: SYSTEM.replace('{{VIDEO}}', videoEnabled() ? VIDEO_ON : VIDEO_OFF) + memoryPrompt(memory) + uiLangPrompt(body?.lang) + todayPrompt() + langPrompt(userText) + (body?.voice === true ? VOICE_STYLE : '') }, ...messages],
  };
  if (model.startsWith('gpt-5')) payload.reasoning_effort = env('OPENAI_REASONING_EFFORT', 'minimal');

  const call = (p) => fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(p),
  });
  const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-remaining': String(left) };
  // La memoria si aggiorna in parallelo alla risposta (solo se il messaggio parla dell'utente).
  const learning = learnFromMessage(userId, userText, memory);
  const memoryFrame = async () => { const saved = await learning; return saved ? frame({ type: 'memory', count: saved.length }) : ''; };
  const upstream = await call(payload);

  // Account OpenAI non verificati non possono usare lo streaming: rispondiamo tutto in una volta.
  if (upstream.status === 400) {
    const errText = await upstream.text().catch(() => '');
    if (/stream/i.test(errText) && /verif/i.test(errText)) {
      const plain = await call({ ...payload, stream: false });
      const data = await plain.json().catch(() => null);
      const msg = data?.choices?.[0]?.message;
      const wCall = msg?.tool_calls?.find((t) => t.function?.name === 'get_weather');
      if (plain.ok && wCall) {
        const wd = await getWeather(parseJSON(wCall.function.arguments));
        const r2 = await call({ ...payload, stream: false, tool_choice: 'none', messages: weatherMessages(payload.messages, msg.content, wCall.id, wCall.function.arguments, wd) });
        const d2 = await r2.json().catch(() => null);
        return new Response((d2?.choices?.[0]?.message?.content || '') + await memoryFrame(), { headers });
      }
      const toolCall = msg?.tool_calls?.find((t) => NAMES.includes(t.function?.name));
      const { prompt, edit } = toolCall ? parseArgs(toolCall.function.arguments) : { prompt: '' };
      if (plain.ok && (msg?.content || prompt)) {
        let out = msg.content || '';
        if (prompt) out += startFrame(toolCall.function.name) + await runTool(toolCall.function.name, prompt, edit);
        out += await memoryFrame();
        return new Response(out, { headers });
      }
    }
    await refundCredit(userId, 'chat').catch(() => {});
    console.error('OpenAI chat error', 400, errText.slice(0, 300));
    return fail('upstream', 502, 'Sahbi ne peut pas répondre maintenant. Réessaie dans un instant.');
  }
  if (!upstream.ok || !upstream.body) {
    await refundCredit(userId, 'chat').catch(() => {});
    const errBody = await upstream.text().catch(() => '');
    console.error('OpenAI chat error', upstream.status, errBody.slice(0, 300));
    await openaiAlert(upstream.status, errBody);
    return fail('upstream', 502, 'Sahbi ne peut pas répondre maintenant. Réessaie dans un instant.');
  }

  // Trasforma lo stream di OpenAI in testo semplice; se il modello chiede un'immagine, la crea alla fine.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const tool = { name: '', args: '', id: '' };
  let announced = false;
  let reply = '';
  // Rete di sicurezza: a volte il modello scrive "je lance la vidéo" senza chiamare lo strumento.
  // In quel caso chiediamo al modello SOLO i dati del video e lo creiamo davvero.
  const PROMISE = /(je (te )?(la |le |l['’])?(lance|crée|cree|fais|prépare|génère|dessine|transforme)|je lance|en cours|ça prend|environ une minute|sto (creando|per|trasformando|disegnando)|in corso|lo (creo|faccio)|la (creo|trasformo|faccio)|procedo|creo (il|la|subito)|ci vuole circa|i'?m (creating|making|drawing|transforming)|about a minute|جاري|دقيقة|دابا)/i;
  const REFUSAL = /(non posso|je ne peux pas|i can'?t|i cannot|désolé|mi dispiace|sorry|ما نقدرش|لا أستطيع|لا يمكنني)/i;
  // Rete di sicurezza: a volte il modello scrive "je lance la vidéo / creazione in corso" senza chiamare lo strumento.
  // In quel caso chiediamo al modello SOLO i dati dello strumento e creiamo davvero l'immagine o il video.
  // Solo se anche l'utente l'aveva chiesto (nel suo messaggio, o confermando con "sì/oui/ok" dopo una domanda di Sahbi).
  const lastText = (typeof userText === 'string' ? userText : '').trim();
  const prevBot = [...messages].reverse().find((m) => m.role === 'assistant')?.content;
  const confirm = lastText.length < 30 && /^(s[iì]|oui|ok|okay|yes|vas-?y|vai|go|d'?accord|wakha|iyeh|ih|نعم|إيه|واخا|ايوا)\b/i.test(lastText);
  const asked = (re) => re.test(lastText) || (confirm && typeof prevBot === 'string' && re.test(prevBot));
  const VIDEO_WORDS = /(vid[ée]o|فيديو|anim)/i;
  const IMAGE_WORDS = /(image|immagine|imag|foto|photo|dessin|disegn|رسم|صورة|tswira|cartoon|cartone|anime|simpson|stile|style|carte|biglietto|sticker|transform|trasform)/i;
  const promised = () => {
    // L'utente ha mandato una foto e chiede di trasformarla: si crea l'immagine anche se il modello ha rifiutato o chiesto conferma.
    if (!tool.name && photo && !body?.photoEarlier && STYLE_ASK.test(lastText)) return 'create_image';
    if (tool.name || !PROMISE.test(reply) || REFUSAL.test(reply)) return null;
    if (videoEnabled() && VIDEO_WORDS.test(reply) && asked(VIDEO_WORDS)) return 'create_video';
    if (IMAGE_WORDS.test(reply) && asked(IMAGE_WORDS)) return 'create_image';
    return null;
  };
  async function forcedArgs(name) {
    const r = await call({
      model, stream: false, tools: tools.filter((t) => t.function.name === name),
      tool_choice: { type: 'function', function: { name } },
      ...(model.startsWith('gpt-5') ? { reasoning_effort: 'minimal' } : {}),
      messages: [...payload.messages, { role: 'assistant', content: reply }, { role: 'system', content: `Ora fai davvero quello che hai appena annunciato, chiamando ${name}.${photo && name === 'create_image' ? ' La foto è allegata: se si tratta di trasformarla usa edit_photo = true.' : ''}` }],
    });
    const d = await r.json().catch(() => null);
    const tc = d?.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === name);
    return tc ? parseArgs(tc.function.arguments) : { prompt: '' };
  }
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
        if (delta?.content) { reply += delta.content; controller.enqueue(encoder.encode(delta.content.replaceAll(SEP, ''))); }
        for (const tc of delta?.tool_calls || []) {
          if (tc.index && tc.index > 0) continue; // una sola immagine per messaggio
          if (tc.id) tool.id = tc.id;
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
      await finishTools(controller);
      controller.enqueue(encoder.encode(await memoryFrame()));
    },
  }));

  // Meteo: prende i dati veri e chiede al modello la risposta finale, che arriva in streaming.
  async function weatherFollowUp(controller) {
    let args = {}; try { args = JSON.parse(tool.args || '{}'); } catch { /* argomenti rotti */ }
    const data = await getWeather(args);
    const r = await call({ ...payload, tool_choice: 'none', messages: weatherMessages(payload.messages, reply, tool.id || 'call_weather', tool.args || '{}', data) }).catch(() => null);
    if (!r?.ok || !r.body) { controller.enqueue(encoder.encode(data.error ? `Je n'ai pas pu obtenir la météo (${data.error}).` : '')); return; }
    const rd = r.body.getReader(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const d = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!d || d === '[DONE]') continue;
        try { const c = JSON.parse(d).choices?.[0]?.delta?.content; if (c) controller.enqueue(encoder.encode(c.replaceAll(SEP, ''))); } catch { /* riga incompleta */ }
      }
    }
  }

  async function finishTools(controller) {
      if (tool.name === 'get_weather') { await weatherFollowUp(controller); return; }
      const forcedName = promised();
      if (forcedName) {
        const video = forcedName === 'create_video';
        controller.enqueue(encoder.encode(startFrame(forcedName)));
        const forced = await forcedArgs(forcedName).catch(() => ({ prompt: '' }));
        controller.enqueue(encoder.encode(forced.prompt
          ? await runTool(forcedName, forced.prompt, forced.edit)
          : frame({ type: video ? 'video_error' : 'image_error', error: 'bad_request', message: video ? "Je n'ai pas compris la vidéo à créer. Décris-la autrement." : "Je n'ai pas compris l'image à créer. Décris-la autrement." })));
        return;
      }
      if (!NAMES.includes(tool.name)) return;
      const { prompt, edit } = parseArgs(tool.args);
      if (!prompt) {
        const video = tool.name === 'create_video';
        controller.enqueue(encoder.encode(frame({ type: video ? 'video_error' : 'image_error', error: 'bad_request', message: video ? "Je n'ai pas compris la vidéo à créer. Décris-la autrement." : "Je n'ai pas compris l'image à créer. Décris-la autrement." })));
        return;
      }
      controller.enqueue(encoder.encode(await runTool(tool.name, prompt, edit)));
  }

  return new Response(stream, { headers });
}
