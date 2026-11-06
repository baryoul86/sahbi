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

export async function generateImage(userId, rawPrompt, { limit, photo = null } = {}) {
  const prompt = String(rawPrompt || '').trim().slice(0, 1000);
  if (!prompt) return { ok: false, error: 'bad_request', status: 400, message: "Décris l'image que tu veux." };

  const left = await useCredit(userId, 'image', limit ?? limits(false).image);
  if (left < 0) return { ok: false, error: 'limit', status: 429, message: "Tu as utilisé tes images d'aujourd'hui." };

  const model = env('OPENAI_IMAGE_MODEL', 'gpt-image-1-mini');
  const size = env('OPENAI_IMAGE_SIZE', '1024x1024');
  const quality = env('OPENAI_IMAGE_QUALITY', 'medium');
  let upstream;
  if (photo) {
    // Trasforma la foto dell'utente (stile cartone, anime, ecc.).
    const form = new FormData();
    const ext = photo.mime.split('/')[1];
    form.append('image', new Blob([Buffer.from(photo.b64, 'base64')], { type: photo.mime }), `photo.${ext}`);
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('output_format', 'jpeg');
    upstream = await fetch(`${OPENAI}/images/edits`, { method: 'POST', headers: openaiHeaders(), body: form });
  } else {
    upstream = await fetch(`${OPENAI}/images/generations`, {
      method: 'POST',
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ model, prompt, size, quality, output_format: 'jpeg', n: 1 }),
    });
  }
  const data = await upstream.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!upstream.ok || !b64) {
    await refundCredit(userId, 'image').catch(() => {});
    console.error('OpenAI image error', upstream.status, data?.error?.code);
    return data?.error?.code === 'moderation_blocked'
      ? { ok: false, error: 'blocked', status: 400, message: "Je ne peux pas créer cette image. Essaie une autre description." }
      : { ok: false, error: 'upstream', status: 502, message: "Impossible de créer l'image maintenant. Réessaie dans un instant." };
  }
  const id = await saveImage(userId, b64, prompt).catch((e) => { console.error('Salvataggio immagine', e.message); return null; });
  return { ok: true, id, image: `data:image/jpeg;base64,${b64}`, remaining: left, limit };
}

// ---------- Galleria: immagini salvate in Supabase Storage (cartella privata "images") ----------

const BUCKET = 'images';
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

async function saveImage(userId, b64, prompt) {
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.jpg`;
  const up = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'image/jpeg', 'x-upsert': 'false' }),
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
