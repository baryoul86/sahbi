// Funzioni condivise dal server. I file che iniziano con "_" non diventano pagine su Vercel.

export const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function fail(code, status, message) {
  return json({ error: code, message }, status);
}

export function supabaseUrl() {
  const url = env('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL mancante');
  return url.replace(/\/$/, '');
}

// Verifica il token dell'utente con Supabase e restituisce { id, email }, oppure null.
export async function getUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY', ''), authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  // Solo utenti registrati con e-mail: gli account anonimi non possono usare l'app.
  if (user?.is_anonymous || typeof user?.id !== 'string') return null;
  return { id: user.id, email: user.email || '' };
}

export async function getUserId(request) {
  return (await getUser(request))?.id || null;
}

// Intestazioni con la chiave segreta del server.
// Le chiavi nuove (sb_secret_...) vanno solo in "apikey"; quelle vecchie (JWT) anche come Bearer.
export function serviceHeaders(extra = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante');
  return { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), ...extra };
}

export async function rpc(fn, args) {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase ${fn}: ${res.status}`);
  return res.json();
}

// Consuma un credito del giorno. Restituisce quanti ne restano, oppure -1 se il limite è raggiunto.
export const useCredit = (userId, kind, limit) =>
  rpc('use_credit', { p_user: userId, p_kind: kind, p_limit: limit });

// Restituisce un credito (per esempio se OpenAI ha dato errore).
export const refundCredit = (userId, kind) =>
  rpc('refund_credit', { p_user: userId, p_kind: kind });

export const remainingCredit = (userId, kind, limit) =>
  rpc('remaining_credit', { p_user: userId, p_kind: kind, p_limit: limit });

// Limiti giornalieri: diversi per Gratis e Pro (modificabili dalle variabili di Vercel).
export const limits = (pro = false) => (pro
  ? {
      chat: Number(env('PRO_CHAT_DAILY_LIMIT', '300')),
      image: Number(env('PRO_IMAGE_DAILY_LIMIT', '8')),
      voice: Number(env('PRO_VOICE_DAILY_LIMIT', '100')),
      tts: Number(env('PRO_TTS_DAILY_LIMIT', '100')),
      video: Number(env('PRO_VIDEO_MONTHLY_LIMIT', '5')), // video al MESE, non al giorno
    }
  : {
      chat: Number(env('FREE_CHAT_DAILY_LIMIT', '30')),
      image: Number(env('FREE_IMAGE_DAILY_LIMIT', '2')),
      voice: Number(env('FREE_VOICE_DAILY_LIMIT', '20')),
      tts: Number(env('FREE_TTS_DAILY_LIMIT', '0')),
      video: Number(env('FREE_VIDEO_MONTHLY_LIMIT', '0')),
    });

// Profilo dell'utente (creato se manca) con il campo "pro" già calcolato.
export async function getProfile(userId) {
  let p;
  try { p = await rpc('get_profile', { p_user: userId }); } catch (e) {
    // Database non ancora aggiornato (002_pro.sql): l'app continua a funzionare in modalità gratuita.
    console.error('Profilo non disponibile', e.message);
    p = { pro_until: null, referral_code: null, referred_by: null, referrals: 0, stripe_customer_id: null };
  }
  const pro = !!p?.pro_until && new Date(p.pro_until) > new Date();
  return { ...p, pro };
}

export async function getPlan(userId) {
  const profile = await getProfile(userId);
  return { profile, pro: profile.pro, limits: limits(profile.pro) };
}

export function openaiHeaders(extra = {}) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY mancante');
  return { authorization: `Bearer ${key}`, ...extra };
}

export const OPENAI = env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, '');

// Crea un'immagine con OpenAI, usando un credito del giorno (restituito se qualcosa va storto).
// Una foto inviata dall'utente: "data:image/jpeg;base64,..." (massimo ~4 MB).
export function parsePhoto(value) {
  if (typeof value !== 'string') return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m || m[2].length > 5_600_000) return null;
  return { mime: m[1], b64: m[2], dataUrl: value };
}

// "Regista" delle immagini: un modello più bravo (gpt-5-mini) rilegge la richiesta dell'utente e scrive
// la descrizione esatta per il disegnatore, scegliendo anche il formato (quadrato, verticale, orizzontale).
const SIZES = { square: '1024x1024', portrait: '1024x1536', landscape: '1536x1024' };
async function directImage(draft, userText, history, edit) {
  if (env('IMAGE_DIRECTOR', 'true') === 'false' || !userText) return null;
  const model = env('OPENAI_PROMPT_MODEL', 'gpt-5-mini');
  const sys = `You write prompts for an image generator. Read the user's request (it can be in Darija written in Latin letters or Arabic script, Egyptian, Gulf Arabic, standard Arabic, French or English) and produce ONE precise English prompt.
Rules:
- Keep EVERY detail the user asked for: subjects, how many, who, age, clothes, colors, actions, objects, place, time of day, weather, mood, style, camera angle. Nothing important may be lost or changed.
- Do not add subjects, people, animals, objects, text or ideas the user did not ask for. Only add neutral details needed for a good picture (composition, lighting, background coherent with the request).
- If the user wants written text in the image, copy it EXACTLY inside double quotes and say where it goes.
- Style: use the style requested; if none, choose the most natural one (photo-realistic for real scenes, illustration for cards/stickers).
- ${edit ? 'This edits the user\'s photo. Apply ONLY what the user asks (a style, removing or changing the background, adding or removing an object, changing a color, an expression...). Everything else must stay EXACTLY the same: framing and crop, camera angle, pose and body position (head tilt, arms, hands, legs), proportions, facial features, hairstyle, expression, clothing, colors, and background elements in the same places (unless the background is what must change). For a style change start with: "Redraw this exact photo in ... style, same pose, same framing".' : 'If the request changes a previous image (see "[Image créée : ...]" in the history), start from that description and change ONLY what is asked.'}
- Darija hints: tswira = picture, dar = house, khobz = bread, 9at/qat = cat, kelb = dog, bhar = sea, tomobil = car, bent = girl, weld = boy, chibani = old man, 3ers = wedding, 3id = Eid, zwin = beautiful, kbir = big, sghir = small.
- Format: "portrait" for phone wallpapers, stories, posters, full-body people; "landscape" for banners, panoramas, YouTube thumbnails, wide scenes; otherwise "square".
- Never include sexual content, explicit violence, real famous people or trademarked characters.
- "transparent": true ONLY if the user asks to remove the background, for a transparent background, a cut-out, a sticker without background or a logo/PNG without background (e.g. "togli lo sfondo", "sans fond", "fond transparent", "remove background", "بدون خلفية", "حيد الخلفية"). Then describe the subject alone, isolated, with nothing behind it.
Answer only with JSON: {"prompt": "...", "format": "square|portrait|landscape", "transparent": false}`;
  const user = `Conversation (most recent last):\n${history || '(none)'}\n\nUser's request now: ${userText}\n\nDraft prompt from the assistant (may be incomplete or wrong): ${draft}`;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${OPENAI}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user.slice(0, 6000) }], response_format: { type: 'json_object' }, ...(model.startsWith('gpt-5') ? { reasoning_effort: 'low' } : {}) }),
    });
    if (!r.ok) return null;
    const out = JSON.parse((await r.json())?.choices?.[0]?.message?.content || '{}');
    const prompt = String(out.prompt || '').trim();
    return prompt.length > 10 ? { prompt: prompt.slice(0, 3000), size: SIZES[out.format] || null, transparent: out.transparent === true } : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Proporzioni di una foto JPEG/PNG (per creare il risultato nello stesso formato verticale/orizzontale).
function photoSize(photo) {
  try {
    const b = Buffer.from(photo.b64, 'base64');
    let w = 0, h = 0;
    if (b[0] === 0x89 && b[1] === 0x50) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
    else for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    if (!w || !h) return null;
    const r = h / w;
    return r > 1.2 ? '1024x1536' : r < 0.83 ? '1536x1024' : '1024x1024';
  } catch { return null; }
}

export async function generateImage(userId, rawPrompt, { limit, photo = null, userText = '', history = '' } = {}) {
  const base = String(rawPrompt || '').trim().slice(0, 2000);
  if (!base) return { ok: false, error: 'bad_request', status: 400, message: "Décris l'image que tu veux." };
  const directed = await directImage(base, userText, history, !!photo);
  const words = String(userText).length >= 8 ? `\n\nThe user's original request, in their own words (it may be in Darija, Arabic or French). Follow it exactly and do not add anything it does not ask for: "${String(userText).replace(/"/g, "'")}"` : '';
  const prompt = (directed?.prompt || base) + words;
  const left = await useCredit(userId, 'image', limit ?? limits(false).image);
  if (left < 0) return { ok: false, error: 'limit', status: 429, message: "Tu as utilisé tes images d'aujourd'hui." };

  const model = env('OPENAI_IMAGE_MODEL', 'gpt-image-1-mini');
  const size = (photo && photoSize(photo)) || directed?.size || env('OPENAI_IMAGE_SIZE', '1024x1024');
  const quality = env('OPENAI_IMAGE_QUALITY', 'medium');
  // Sfondo trasparente (richiesto dall'utente): PNG invece di JPEG.
  const clear = directed?.transparent === true || /(sans fond|fond transparent|transparent background|remove (the )?background|senza sfondo|togli (lo )?sfondo|rimuovi (lo )?sfondo|sfondo trasparente|بدون خلفية|حيد الخلفية|احذف الخلفية)/i.test(String(userText));
  const fmt = clear ? 'png' : 'jpeg';
  let upstream;
  if (photo) {
    // Trasforma la foto dell'utente (stile cartone, anime, ecc.).
    const form = new FormData();
    const ext = photo.mime.split('/')[1];
    form.append('image', new Blob([Buffer.from(photo.b64, 'base64')], { type: photo.mime }), `photo.${ext}`);
    form.append('model', env('OPENAI_IMAGE_EDIT_MODEL', model));
    if (env('OPENAI_IMAGE_EDIT_FIDELITY')) form.append('input_fidelity', env('OPENAI_IMAGE_EDIT_FIDELITY'));
    form.append('prompt', `${prompt}\n\nApply ONLY the requested change. Everything the request does not ask to change must stay exactly as in the input photo: same people, face, expression, pose, hands, framing, camera angle, proportions, clothes, colors and background.`);
    form.append('size', size);
    form.append('quality', quality);
    form.append('output_format', fmt);
    if (clear) form.append('background', 'transparent');
    upstream = await fetch(`${OPENAI}/images/edits`, { method: 'POST', headers: openaiHeaders(), body: form, signal: AbortSignal.timeout(250000) }).catch((e) => ({ failed: e }));
  } else {
    upstream = await fetch(`${OPENAI}/images/generations`, {
      method: 'POST', signal: AbortSignal.timeout(250000),
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ model, prompt, size, quality, output_format: fmt, n: 1, ...(clear ? { background: 'transparent' } : {}) }),
    }).catch((e) => ({ failed: e }));
  }
  if (upstream.failed) {
    // Nessuna risposta da OpenAI: troppo lento (timeout) oppure errore di rete. Si avvisa l'amministratore con il motivo.
    await refundCredit(userId, 'image').catch(() => {});
    const slow = upstream.failed?.name === 'TimeoutError' || upstream.failed?.name === 'AbortError';
    const { alert } = await import('./_alert.js');
    await alert('image_fail', `${photo ? 'Transformation de photo' : 'Création d’image'} sans réponse d’OpenAI (${slow ? 'plus de 4 minutes' : `réseau : ${upstream.failed?.message || '?'}`}) – modèle ${photo ? env('OPENAI_IMAGE_EDIT_MODEL', model) : model}.`, 60);
    return { ok: false, error: 'upstream', status: 504, message: slow ? "La création a pris trop de temps. Réessaie : ça marche souvent au deuxième essai." : "Impossible de créer l'image maintenant. Réessaie dans un instant." };
  }
  const data = await upstream.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!upstream.ok || !b64) {
    await refundCredit(userId, 'image').catch(() => {});
    console.error('OpenAI image error', upstream.status, data?.error?.code);
    if (data?.error?.code !== 'moderation_blocked') {
      const { openaiAlert, alert } = await import('./_alert.js');
      await (openaiAlert(upstream.status, JSON.stringify(data?.error || {})) || alert('image_fail', `La création d'image a échoué (${upstream.status} ${data?.error?.code || ''}).`, 120));
    }
    return data?.error?.code === 'moderation_blocked'
      ? { ok: false, error: 'blocked', status: 400, message: "Je ne peux pas créer cette image. Essaie une autre description." }
      : { ok: false, error: 'upstream', status: 502, message: "Impossible de créer l'image maintenant. Réessaie dans un instant." };
  }
  const id = await saveImage(userId, b64, directed?.prompt || base, fmt).catch((e) => { console.error('Salvataggio immagine', e.message); return null; });
  return { ok: true, id, image: `data:image/${fmt};base64,${b64}`, remaining: left, limit };
}

// ---------- Galleria: immagini salvate in Supabase Storage (cartella privata "images") ----------

const BUCKET = 'images';
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

async function saveImage(userId, b64, prompt, fmt = 'jpeg') {
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${fmt === 'png' ? 'png' : 'jpg'}`;
  const up = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': `image/${fmt}`, 'x-upsert': 'false' }),
    body: Buffer.from(b64, 'base64'),
  });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  const row = await fetch(`${supabaseUrl()}/rest/v1/images`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify({ id, user_id: userId, prompt: prompt.slice(0, 1000), path }),
  });
  if (!row.ok) throw new Error(`images ${row.status}`);
  return id;
}

// Le ultime immagini dell'utente, con un link temporaneo (1 ora) per vederle.
export async function listImages(userId, limit = 60) {
  const query = (select, extra = {}) => new URLSearchParams({ user_id: `eq.${userId}`, select, order: 'created_at.desc', limit: String(limit), ...extra });
  // Con 003_video.sql ci sono anche i video (solo quelli finiti); senza, solo le immagini.
  let res = await fetch(`${supabaseUrl()}/rest/v1/images?${query('id,prompt,path,created_at,kind', { status: 'eq.done' })}`, { headers: serviceHeaders() });
  if (res.status === 400) res = await fetch(`${supabaseUrl()}/rest/v1/images?${query('id,prompt,path,created_at')}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`images ${res.status}`);
  const rows = await res.json();
  if (!rows.length) return [];
  const sign = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${BUCKET}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 3600, paths: rows.map((r) => r.path) }),
  });
  if (!sign.ok) throw new Error(`sign ${sign.status}`);
  const urls = new Map((await sign.json()).filter((x) => x.signedURL).map((x) => [x.path, `${supabaseUrl()}/storage/v1${x.signedURL}`]));
  return rows.filter((r) => urls.has(r.path)).map((r) => ({ id: r.id, prompt: r.prompt, created: r.created_at, kind: r.kind || 'image', url: urls.get(r.path) }));
}

// Link temporaneo (1 ora) per un solo file della cartella privata.
export async function signPath(path, expiresIn = 3600) {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`sign ${res.status}`);
  const d = await res.json();
  return `${supabaseUrl()}/storage/v1${d.signedURL || d.signedUrl}`;
}

export { BUCKET, isUuid };

// Cancella un'immagine dell'utente (file e riga).
export async function deleteImage(userId, id) {
  if (!isUuid(id)) return false;
  const q = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}` });
  const res = await fetch(`${supabaseUrl()}/rest/v1/images?${q}`, {
    method: 'DELETE',
    headers: serviceHeaders({ prefer: 'return=representation' }),
  });
  const rows = res.ok ? await res.json() : [];
  if (!rows.length) return false;
  await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: serviceHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ prefixes: [rows[0].path] }),
  }).catch(() => {});
  return true;
}

// Cancella per sempre l'account: file delle immagini, poi l'utente (le righe del database si cancellano a catena).
export async function deleteAccount(userId) {
  if (!isUuid(userId)) throw new Error('id non valido');
  for (let round = 0; round < 20; round++) {
    const list = await fetch(`${supabaseUrl()}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: serviceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset: 0 }),
    });
    if (!list.ok) throw new Error(`list ${list.status}`);
    const files = (await list.json()).filter((f) => f.name).map((f) => `${userId}/${f.name}`);
    if (!files.length) break;
    const del = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: serviceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ prefixes: files }),
    });
    if (!del.ok) throw new Error(`delete files ${del.status}`);
  }
  const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: serviceHeaders() });
  if (!res.ok) throw new Error(`delete user ${res.status}`);
}
