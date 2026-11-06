// Video brevi (8 secondi) con Pruna P-Video: solo per i Pro, 5 al mese.
// La creazione dura da qualche secondo a 1-2 minuti: il server avvia il lavoro, il telefono chiede a che punto è.
import { env, rpc, supabaseUrl, serviceHeaders, signPath, BUCKET, isUuid } from './_lib.js';

const PRUNA = () => env('PRUNA_API_URL', 'https://api.pruna.ai/v1').replace(/\/$/, '');
const key = () => env('PRUNA_API_KEY');
export const videoEnabled = () => !!key();

const prunaHeaders = (extra = {}) => ({ apikey: key(), ...extra });

const useVideoCredit = (userId, limit) => rpc('use_video_credit', { p_user: userId, p_limit: limit });
const refundVideoCredit = (userId, month) => rpc('refund_video_credit', { p_user: userId, p_month: month });
export const remainingVideo = (userId, limit) => rpc('remaining_video_credit', { p_user: userId, p_limit: limit });

const MSG = {
  pro: 'Les vidéos sont réservées à Sahbi Pro.',
  limit: 'Tu as utilisé tes vidéos de ce mois. Elles reviennent le 1er du mois.',
  blocked: 'Je ne peux pas créer cette vidéo. Essaie une autre description.',
  upstream: 'Impossible de créer la vidéo maintenant. Réessaie dans un instant.',
};

// Carica la foto dell'utente su Pruna e restituisce il suo indirizzo.
async function uploadPhoto(photo) {
  const form = new FormData();
  form.append('content', new Blob([Buffer.from(photo.b64, 'base64')], { type: photo.mime }), `photo.${photo.mime.split('/')[1]}`);
  const res = await fetch(`${PRUNA()}/files`, { method: 'POST', headers: prunaHeaders(), body: form });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d?.urls?.get) throw new Error(`pruna files ${res.status}`);
  return d.urls.get;
}

async function updateRow(userId, id, fields) {
  const q = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}` });
  await fetch(`${supabaseUrl()}/rest/v1/images?${q}`, {
    method: 'PATCH',
    headers: serviceHeaders({ 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify(fields),
  });
}

// Avvia un video. Restituisce { ok, id, remaining, limit } oppure { ok:false, error, message }.
export async function startVideo(userId, rawPrompt, { pro, limit, photo = null }) {
  const prompt = String(rawPrompt || '').trim().slice(0, 1500);
  if (!prompt) return { ok: false, error: 'bad_request', message: 'Décris la vidéo que tu veux.' };
  if (!pro) return { ok: false, error: 'pro', message: MSG.pro };
  if (!videoEnabled()) return { ok: false, error: 'upstream', message: MSG.upstream };

  const left = await useVideoCredit(userId, limit).catch(() => -2);
  if (left === -2) return { ok: false, error: 'upstream', message: MSG.upstream };
  if (left < 0) return { ok: false, error: 'limit', message: MSG.limit };
  const month = await rpc('sahbi_month', {}).catch(() => null);
  const refund = () => (month ? refundVideoCredit(userId, month).catch(() => {}) : null);

  try {
    const input = {
      prompt,
      duration: Number(env('VIDEO_SECONDS', '8')),
      resolution: env('VIDEO_RESOLUTION', '720p'),
      save_audio: true,
      draft: false,
      disable_safety_filter: false, // il filtro di sicurezza resta SEMPRE attivo
    };
    if (photo) input.image = await uploadPhoto(photo);
    else input.aspect_ratio = env('VIDEO_ASPECT', '9:16'); // verticale, come sul telefono

    const res = await fetch(`${PRUNA()}/predictions`, {
      method: 'POST',
      headers: prunaHeaders({ 'content-type': 'application/json', Model: env('PRUNA_VIDEO_MODEL', 'p-video-2') }),
      body: JSON.stringify({ input }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !(d?.get_url || d?.id)) {
      await refund();
      const blocked = res.status === 422 || !!d?.moderation;
      console.error('Pruna video', res.status, blocked ? 'moderation' : JSON.stringify(d)?.slice(0, 300));
      return { ok: false, error: blocked ? 'blocked' : 'upstream', message: blocked ? MSG.blocked : MSG.upstream };
    }

    const id = crypto.randomUUID();
    const row = await fetch(`${supabaseUrl()}/rest/v1/images`, {
      method: 'POST',
      headers: serviceHeaders({ 'content-type': 'application/json', prefer: 'return=minimal' }),
      body: JSON.stringify({
        id, user_id: userId, prompt: prompt.slice(0, 1000), path: `${userId}/${id}.mp4`,
        kind: 'video', status: 'pending', job: d.get_url || `${PRUNA()}/predictions/status/${d.id}`, month,
      }),
    });
    if (!row.ok) throw new Error(`images ${row.status}`);
    return { ok: true, id, remaining: left, limit };
  } catch (e) {
    console.error('Video', e.message);
    await refund();
    return { ok: false, error: 'upstream', message: MSG.upstream };
  }
}

// A che punto è il video? Se Pruna ha finito, lo salva nella galleria e restituisce il link.
export async function checkVideo(userId, id) {
  if (!isUuid(id)) return { status: 'failed', message: 'Vidéo introuvable.' };
  const q = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}`, kind: 'eq.video', select: 'path,status,job,month,prompt' });
  const res = await fetch(`${supabaseUrl()}/rest/v1/images?${q}`, { headers: serviceHeaders() });
  const row = res.ok ? (await res.json())[0] : null;
  if (!row) return { status: 'failed', message: 'Vidéo introuvable.' };
  if (row.status === 'done') return { status: 'done', url: await signPath(row.path), prompt: row.prompt };
  if (row.status === 'failed') return { status: 'failed', message: MSG.upstream };

  const fail = async (message) => {
    await updateRow(userId, id, { status: 'failed' });
    if (row.month) await refundVideoCredit(userId, row.month).catch(() => {});
    return { status: 'failed', message };
  };
  let st;
  try {
    const r = await fetch(row.job, { headers: prunaHeaders() });
    st = await r.json().catch(() => null);
    if (!r.ok && !st?.status) return { status: 'pending' };
  } catch { return { status: 'pending' }; }

  if (st?.status === 'failed' || st?.status === 'canceled') return fail(st?.moderation ? MSG.blocked : MSG.upstream);
  if (st?.status !== 'succeeded') return { status: 'pending' };
  const src = st.generation_url || (Array.isArray(st.output) ? st.output[0] : st.output);
  if (typeof src !== 'string') return fail(MSG.upstream);

  // Copia il video nella cartella privata di Sahbi (i link di Pruna non durano per sempre).
  const file = await fetch(src, { headers: prunaHeaders() });
  if (!file.ok) return { status: 'pending' };
  const body = Buffer.from(await file.arrayBuffer());
  const up = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${row.path}`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'video/mp4', 'x-upsert': 'true' }),
    body,
  });
  if (!up.ok) { console.error('Video storage', up.status); return { status: 'pending' }; }
  await updateRow(userId, id, { status: 'done' });
  return { status: 'done', url: await signPath(row.path), prompt: row.prompt };
}
