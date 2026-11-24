import { json, fail, getUserId, listImages, deleteImage, getPlan, supabaseUrl, serviceHeaders, signPath, BUCKET, env, rpc } from './_lib.js';
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
    const { pro, limits } = await getPlan(userId);
    if (!pro) return fail('pro', 402, 'Les vidéos dans le site sont réservées à Sahbi Pro.');
    let b = {}; try { b = await request.json(); } catch { /* vide */ }
    const ext = VIDEO_TYPES[String(b.type || '').toLowerCase()];
    if (!ext) return fail('bad_request', 400, 'Format vidéo non accepté (MP4, MOV ou WEBM).');
    if (!(Number(b.size) > 0) || Number(b.size) > SITE_VIDEO_MAX) return fail('too_big', 413, 'Vidéo trop lourde : 50 Mo maximum (environ 1 minute en HD).');
    // Stesso contatore dei video creati con l'IA: limits.video video al mese in tutto.
    const left = await rpc('use_video_credit', { p_user: userId, p_limit: limits.video }).catch(() => 0);
    if (Number(left) < 0) return fail('video_limit', 429, `Tu as utilisé tes ${limits.video} vidéos de ce mois. Le compteur repart à zéro le 1er du mois.`);
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
  if (q.get('publish') === '1') return publishSite(userId, request);
  if (q.get('unpublish') === '1') return unpublishSite(userId, String(q.get('slug') || ''));
  return fail('bad_request', 400, 'Requête inconnue.');
}

// 🚀 Pubblicazione in un clic (Pro): il sito va nella cartella pubblica "sites" e si vede su un progetto Vercel
// SEPARATO (SITES_HOST), così un sito segnalato non tocca mai sahbi.bond. Il file va direttamente dal telefono
// a Supabase (può contenere foto pesanti); qui si controllano il piano, il nome e il contenuto.
export const SITES_HOST = () => env('SITES_HOST', 'https://sahbi-sites.vercel.app').replace(/\/$/, '');
const RESERVED = new Set(['api', 'admin', 'sahbi', 'www', 'login', 'signin', 'paypal', 'bank', 'banque', 'support', 'help', 'contact', 'apple', 'google', 'facebook', 'instagram', 'whatsapp', 'secure', 'account', 'compte', 'verify', 'verification']);
const slugify = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
// Pagine fatte per rubare dati (phishing): niente password, carte o codici, niente imitazioni di banche e servizi noti.
export function unsafeSite(text) {
  const t = String(text || '');
  if (/type\s*=\s*["']?password/i.test(t)) return 'Un site publié ne peut pas demander de mot de passe.';
  if (/(autocomplete\s*=\s*["']?cc-|name\s*=\s*["']?(card|cardnumber|cc|ccnum|cvv|cvc|iban|pin|otp)\b)/i.test(t)) return 'Un site publié ne peut pas demander de carte bancaire ou de code.';
  if (/<form/i.test(t) && /(paypal|attijari|cih\b|bmce|bank of africa|banque populaire|barid|alg[eé]rie poste|baridimob|\bccp\b|la banque postale|ameli|caf\.fr|impots\.gouv|netflix|apple id|icloud|microsoft|outlook|gmail|facebook|instagram|whatsapp|binance|western union)/i.test(t)) return 'Un site publié ne peut pas imiter une banque ou un service connu.';
  return null;
}
let sitesBucket = false;
async function ensureSitesBucket() {
  if (sitesBucket) return;
  const r = await fetch(`${supabaseUrl()}/storage/v1/bucket/sites`, { headers: serviceHeaders() });
  if (!r.ok) {
    await fetch(`${supabaseUrl()}/storage/v1/bucket`, { method: 'POST', headers: serviceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ id: 'sites', name: 'sites', public: true, file_size_limit: 20 * 1024 * 1024, allowed_mime_types: ['text/html'] }) });
  }
  sitesBucket = true;
}
async function siteOwner(slug) {
  const r = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/site-meta/${slug}.json`, { headers: serviceHeaders() });
  if (!r.ok) return null;
  return (await r.json().catch(() => ({}))).owner || null;
}
async function publishSite(userId, request) {
  const { pro } = await getPlan(userId);
  if (!pro) return fail('pro', 402, 'La mise en ligne en un clic est réservée à Sahbi Pro.');
  let b = {}; try { b = await request.json(); } catch { /* vide */ }
  const bad = unsafeSite(b.text);
  if (bad) return fail('unsafe', 422, bad);
  if (!(Number(b.size) > 0) || Number(b.size) > 20 * 1024 * 1024) return fail('too_big', 413, 'Site trop lourd (20 Mo maximum) : enlève quelques photos.');
  let slug = slugify(b.slug);
  if (slug && (await siteOwner(slug)) !== userId) slug = '';
  if (!slug) {
    const base = slugify(b.title) || 'mon-site';
    for (let i = 0; i < 6 && !slug; i++) {
      const s = `${base}-${Math.random().toString(36).slice(2, 6)}`.replace(/^-/, '');
      if (!RESERVED.has(base) && !(await siteOwner(s))) slug = s;
    }
    if (!slug) return fail('upstream', 502, 'Choisis un autre nom pour ton site.');
  }
  await ensureSitesBucket().catch(() => {});
  await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/site-meta/${slug}.json`, {
    method: 'POST', headers: serviceHeaders({ 'content-type': 'application/json', 'x-upsert': 'true' }),
    body: JSON.stringify({ owner: userId, at: new Date().toISOString(), title: String(b.title || '').slice(0, 120) }),
  });
  const r = await fetch(`${supabaseUrl()}/storage/v1/object/upload/sign/sites/${slug}/index.html`, {
    method: 'POST', headers: serviceHeaders({ 'content-type': 'application/json', 'x-upsert': 'true' }), body: '{}' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) return fail('upstream', 502, 'Mise en ligne impossible pour le moment.');
  return json({ slug, uploadUrl: `${supabaseUrl()}/storage/v1${d.url}`, url: `${SITES_HOST()}/${slug}` });
}
async function unpublishSite(userId, slug) {
  slug = slugify(slug);
  if (!slug || (await siteOwner(slug)) !== userId) return fail('not_found', 404, 'Site introuvable.');
  await fetch(`${supabaseUrl()}/storage/v1/object/sites`, { method: 'DELETE', headers: serviceHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ prefixes: [`${slug}/index.html`] }) });
  return json({ ok: true });
}
