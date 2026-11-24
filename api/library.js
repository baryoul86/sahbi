import { json, fail, getUserId, listImages, deleteImage, getPlan, supabaseUrl, serviceHeaders, signPath, BUCKET } from './_lib.js';
import { checkVideo } from './_video.js';

// Galleria delle immagini e dei video creati dall'utente.
// GET /api/library?video=ID → a che punto è un video in creazione.
export async function GET(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');
  const video = new URL(request.url).searchParams.get('video');
  try {
    if (video) return json(await checkVideo(userId, video));
    return json({ images: await listImages(userId) });
  } catch (e) {
    console.error('Galleria', e.message);
    if (video) return json({ status: 'pending' });
    return fail('upstream', 502, 'Impossible de charger tes images.');
  }
}

// Cancella un'immagine o un video: DELETE /api/library?id=...
export async function DELETE(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');
  const id = new URL(request.url).searchParams.get('id');
  return (await deleteImage(userId, id)) ? json({ ok: true }) : fail('not_found', 404, 'Image introuvable.');
}

// 🎬 Video dell'utente per i siti (solo Sahbi Pro). Il file va DIRETTAMENTE dal telefono a Supabase Storage
// (Vercel non accetta file grandi): POST /api/library?upload=video → { uploadUrl, path }; poi
// POST /api/library?upload=done&path=… → { url } (link di lettura lungo, da mettere nel sito).
export const SITE_VIDEO_MAX = 50 * 1024 * 1024; // limite del piano Supabase per un file
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
let bucketReady = false;
async function ensureVideoTypes() {
  if (bucketReady) return;
  const r = await fetch(`${supabaseUrl()}/storage/v1/bucket/${BUCKET}`, { headers: serviceHeaders() });
  const b = r.ok ? await r.json() : {};
  const types = new Set([...(b.allowed_mime_types || []), ...Object.keys(VIDEO_TYPES)]);
  if (Object.keys(VIDEO_TYPES).some((t) => !(b.allowed_mime_types || []).includes(t)) || Number(b.file_size_limit || 0) < SITE_VIDEO_MAX) {
    await fetch(`${supabaseUrl()}/storage/v1/bucket/${BUCKET}`, {
      method: 'PUT', headers: serviceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ public: false, file_size_limit: Math.max(SITE_VIDEO_MAX, Number(b.file_size_limit || 0)), allowed_mime_types: [...types] }),
    });
  }
  bucketReady = true;
}
export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');
  const q = new URL(request.url).searchParams;
  if (q.get('upload') === 'video') {
    const { pro } = await getPlan(userId);
    if (!pro) return fail('pro', 402, 'Les vidéos dans le site sont réservées à Sahbi Pro.');
    let b = {}; try { b = await request.json(); } catch { /* vide */ }
    const ext = VIDEO_TYPES[String(b.type || '').toLowerCase()];
    if (!ext) return fail('bad_request', 400, 'Format vidéo non accepté (MP4, MOV ou WEBM).');
    if (!(Number(b.size) > 0) || Number(b.size) > SITE_VIDEO_MAX) return fail('too_big', 413, 'Vidéo trop lourde : 50 Mo maximum (environ 1 minute en HD).');
    await ensureVideoTypes().catch(() => {});
    const path = `${userId}/site-videos/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r = await fetch(`${supabaseUrl()}/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: 'POST', headers: serviceHeaders({ 'content-type': 'application/json' }), body: '{}' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) return fail('upstream', 502, 'Envoi de la vidéo impossible pour le moment.');
    return json({ path, uploadUrl: `${supabaseUrl()}/storage/v1${d.url}` });
  }
  if (q.get('upload') === 'done') {
    const path = String(q.get('path') || '');
    if (!path.startsWith(`${userId}/site-videos/`) || path.includes('..')) return fail('bad_request', 400, 'Vidéo inconnue.');
    try { return json({ url: await signPath(path, 60 * 60 * 24 * 365 * 5) }); }
    catch { return fail('not_found', 404, 'Vidéo introuvable : renvoie-la.'); }
  }
  return fail('bad_request', 400, 'Requête inconnue.');
}
