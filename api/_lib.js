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

function supabaseUrl() {
  const url = env('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL mancante');
  return url.replace(/\/$/, '');
}

// Verifica il token dell'utente con Supabase e restituisce il suo id, oppure null.
export async function getUserId(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY', ''), authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  // Solo utenti registrati con e-mail: gli account anonimi non possono usare l'app.
  if (user?.is_anonymous) return null;
  return typeof user?.id === 'string' ? user.id : null;
}

async function rpc(fn, args) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante');
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    // Le chiavi nuove (sb_secret_...) vanno solo in "apikey"; quelle vecchie (JWT) anche come Bearer.
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' },
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

export const limits = () => ({
  chat: Number(env('CHAT_DAILY_LIMIT', '100')),
  image: Number(env('IMAGE_DAILY_LIMIT', '8')),
  voice: Number(env('VOICE_DAILY_LIMIT', '60')),
});

export function openaiHeaders(extra = {}) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY mancante');
  return { authorization: `Bearer ${key}`, ...extra };
}

export const OPENAI = env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, '');

// Crea un'immagine con OpenAI, usando un credito del giorno (restituito se qualcosa va storto).
export async function generateImage(userId, rawPrompt) {
  const prompt = String(rawPrompt || '').trim().slice(0, 1000);
  if (!prompt) return { ok: false, error: 'bad_request', status: 400, message: "Décris l'image que tu veux." };

  const limit = limits().image;
  const left = await useCredit(userId, 'image', limit);
  if (left < 0) return { ok: false, error: 'limit', status: 429, message: "Tu as utilisé tes images d'aujourd'hui." };

  const upstream = await fetch(`${OPENAI}/images/generations`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: env('OPENAI_IMAGE_MODEL', 'gpt-image-1-mini'),
      prompt,
      size: env('OPENAI_IMAGE_SIZE', '1024x1024'),
      quality: env('OPENAI_IMAGE_QUALITY', 'medium'),
      output_format: 'jpeg',
      n: 1,
    }),
  });
  const data = await upstream.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!upstream.ok || !b64) {
    await refundCredit(userId, 'image').catch(() => {});
    console.error('OpenAI image error', upstream.status, data?.error?.code);
    return data?.error?.code === 'moderation_blocked'
      ? { ok: false, error: 'blocked', status: 400, message: "Je ne peux pas créer cette image. Essaie une autre description." }
      : { ok: false, error: 'upstream', status: 502, message: "Impossible de créer l'image maintenant. Réessaie dans un instant." };
  }
  return { ok: true, image: `data:image/jpeg;base64,${b64}`, remaining: left, limit };
}
