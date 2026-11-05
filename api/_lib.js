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
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
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
