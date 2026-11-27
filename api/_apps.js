// App Android create da Sahbi (giochi, siti, mini-app): Sahbi costruisce il file AAB su GitHub e lo consegna all'utente,
// che lo pubblica lui sul SUO conto Google Play con la guida di Sahbi. Sahbi non entra mai nei conti degli utenti.
//
// Utente (Pro):  POST ?app=build {name, color, size}  → { id, uploadUrl }   (l'HTML si carica direttamente)
//                POST ?app=start&id                    → avvia la costruzione su GitHub
//                GET  ?app=status&id                   → stato; quando è pronta, link per scaricare AAB e kit
// GitHub:        GET  ?app=job&id   (token OIDC di GitHub Actions) → dati del lavoro e indirizzi di caricamento
//                POST ?app=done&id  (token OIDC)                   → fine (ok / errore)
import { createPublicKey, createVerify, randomBytes } from 'node:crypto';
import { json, fail, getPlan, supabaseUrl, serviceHeaders, env } from './_lib.js';

const BUCKET = 'apps';
const REPO = () => env('APP_BUILDER_REPO', 'baryoul86/sahbi');
const WORKFLOW = 'app-build.yml';
const MONTHLY = () => Number(env('APP_BUILDS_MONTHLY', '2'));
const H = (extra = {}) => serviceHeaders(extra);
const isId = (v) => /^[a-z0-9]{12}$/.test(String(v || ''));
const store = (path) => `${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`;

let bucketOk = false;
async function ensureBucket() {
  if (bucketOk) return;
  const r = await fetch(`${supabaseUrl()}/storage/v1/bucket/${BUCKET}`, { headers: H() });
  if (!r.ok) {
    await fetch(`${supabaseUrl()}/storage/v1/bucket`, {
      method: 'POST', headers: H({ 'content-type': 'application/json' }),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 80 * 1024 * 1024, allowed_mime_types: ['text/html', 'application/json', 'application/octet-stream', 'application/zip'] }),
    });
  }
  bucketOk = true;
}
async function readJob(id) {
  const r = await fetch(store(`jobs/${id}.json`), { headers: H() });
  return r.ok ? r.json() : null;
}
async function writeJob(job) {
  await fetch(store(`jobs/${job.id}.json`), { method: 'POST', headers: H({ 'content-type': 'application/json', 'x-upsert': 'true' }), body: JSON.stringify(job) });
}
async function signUpload(path) {
  const r = await fetch(`${supabaseUrl()}/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: 'POST', headers: H({ 'content-type': 'application/json', 'x-upsert': 'true' }), body: '{}' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(`upload sign ${r.status}`);
  return `${supabaseUrl()}/storage/v1${d.url}`;
}
async function signRead(path, seconds) {
  const r = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${BUCKET}/${path}`, { method: 'POST', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn: seconds }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.signedURL) throw new Error(`sign ${r.status}`);
  return `${supabaseUrl()}/storage/v1${d.signedURL}`;
}
async function userJobs(userId) {
  const r = await fetch(`${supabaseUrl()}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: H({ 'content-type': 'application/json' }),
    body: JSON.stringify({ prefix: `users/${userId}/`, limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  return r.ok ? (await r.json()).filter((x) => x.name?.endsWith('.json')) : [];
}

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20);
const cleanName = (s) => String(s || '').replace(/[<>"'&\\@%$`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);

// ---------- Utente ----------
export async function appUser(userId, q, request) {
  const op = q.get('app');
  if (op === 'build') {
    const { pro } = await getPlan(userId);
    if (!pro) return fail('pro', 402, 'La création d’applications Android est réservée à Sahbi Pro.');
    if (!env('GITHUB_BUILD_TOKEN')) return fail('unavailable', 503, 'La création d’applications arrive très bientôt.');
    let b = {}; try { b = await request.json(); } catch { /* vide */ }
    const name = cleanName(b.name);
    if (name.length < 2) return fail('bad_request', 400, 'Donne un nom à ton application (2 lettres minimum).');
    if (!(Number(b.size) > 0) || Number(b.size) > 25 * 1024 * 1024) return fail('too_big', 413, 'Application trop lourde (25 Mo maximum) : enlève quelques photos.');
    const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#0F2E24';
    await ensureBucket();
    const month = new Date().toISOString().slice(0, 7);
    const mine = await userJobs(userId);
    const thisMonth = mine.filter((x) => String(x.created_at || '').startsWith(month)).length;
    if (thisMonth >= MONTHLY()) return fail('app_limit', 429, `Tu as déjà créé ${MONTHLY()} applications ce mois-ci. Tu pourras en créer d’autres le 1er du mois.`);
    // Stesso nome di un'app già fatta da questo utente = aggiornamento (stesso pacchetto, versione +1, stessa chiave).
    let prev = null;
    for (const x of mine.slice(0, 30)) { const j = await readJob(x.name.replace('.json', '')); if (j && j.name.toLowerCase() === name.toLowerCase() && j.status === 'ready') { prev = j; break; } }
    const id = randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(12, '0').slice(0, 12);
    const job = {
      id, user: userId, name, color, status: 'uploading', created: new Date().toISOString(),
      packageId: prev?.packageId || `app.${slug(name) || 'monapp'}.${randomBytes(3).toString('hex')}`,
      versionCode: (prev?.versionCode || 0) + 1,
      keyPass: prev?.keyPass || randomBytes(12).toString('base64url'),
      keyFrom: prev ? prev.id : null,
    };
    await writeJob(job);
    await fetch(store(`users/${userId}/${id}.json`), { method: 'POST', headers: H({ 'content-type': 'application/json', 'x-upsert': 'true' }), body: JSON.stringify({ id }) });
    return json({ id, uploadUrl: await signUpload(`jobs/${id}/index.html`), update: !!prev, version: job.versionCode });
  }
  const id = q.get('id');
  if (!isId(id)) return fail('bad_request', 400, 'Application inconnue.');
  const job = await readJob(id);
  if (!job || job.user !== userId) return fail('not_found', 404, 'Application introuvable.');
  if (op === 'start') {
    if (job.status !== 'uploading') return json({ status: job.status });
    const r = await fetch(`https://api.github.com/repos/${REPO()}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env('GITHUB_BUILD_TOKEN')}`, accept: 'application/vnd.github+json', 'user-agent': 'Sahbi', 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { job: id } }),
    });
    if (!r.ok) { console.error('app dispatch', r.status, (await r.text()).slice(0, 200)); return fail('upstream', 502, 'La création n’a pas pu démarrer. Réessaie dans quelques minutes.'); }
    job.status = 'building'; job.started = new Date().toISOString();
    await writeJob(job);
    return json({ status: 'building' });
  }
  if (op === 'status') {
    // Più di 25 minuti senza risposta: costruzione persa.
    if (job.status === 'building' && Date.now() - Date.parse(job.started || job.created) > 25 * 60e3) { job.status = 'failed'; job.error = 'timeout'; await writeJob(job); }
    const out = { status: job.status, name: job.name, packageId: job.packageId, version: job.versionCode };
    if (job.status === 'ready') {
      out.aab = await signRead(`jobs/${id}/app-release.aab`, 7 * 86400);
      out.kit = await signRead(`jobs/${id}/kit.zip`, 7 * 86400);
      out.keyPass = job.keyPass;
    }
    if (job.status === 'failed') out.message = 'La création a échoué. Réessaie ; si ça recommence, écris à l’assistance.';
    return json(out);
  }
  return fail('bad_request', 400, 'Requête inconnue.');
}

// ---------- GitHub Actions (token OIDC firmato da GitHub, nessun segreto condiviso) ----------
let jwks = { at: 0, keys: [] };
async function verifyOidc(request) {
  const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [h, p, sig] = tok.split('.');
  if (!h || !p || !sig) return null;
  const head = JSON.parse(Buffer.from(h, 'base64url').toString());
  const body = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (Date.now() - jwks.at > 3600e3 || !jwks.keys.some((k) => k.kid === head.kid)) {
    const r = await fetch('https://token.actions.githubusercontent.com/.well-known/jwks');
    jwks = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = jwks.keys.find((k) => k.kid === head.kid);
  if (!jwk || head.alg !== 'RS256') return null;
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${p}`);
  if (!v.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sig, 'base64url'))) return null;
  const now = Date.now() / 1000;
  if (body.iss !== 'https://token.actions.githubusercontent.com' || body.aud !== 'sahbi-apps' || body.exp < now || body.nbf > now + 60) return null;
  if (body.repository !== REPO() || !String(body.workflow_ref || '').startsWith(`${REPO()}/.github/workflows/${WORKFLOW}@`)) return null;
  return body;
}

export async function appCi(q, request) {
  const claims = await verifyOidc(request).catch(() => null);
  if (!claims) return fail('forbidden', 403, 'Accès refusé.');
  const id = q.get('id');
  if (!isId(id)) return fail('bad_request', 400, 'job');
  const job = await readJob(id);
  if (!job) return fail('not_found', 404, 'job');
  if (q.get('app') === 'job') {
    return json({
      name: job.name, color: job.color, packageId: job.packageId, versionCode: job.versionCode, keyPass: job.keyPass,
      html: await signRead(`jobs/${id}/index.html`, 3600),
      oldKey: job.keyFrom ? await signRead(`jobs/${job.keyFrom}/upload.jks`, 3600).catch(() => null) : null,
      aabUpload: await signUpload(`jobs/${id}/app-release.aab`),
      kitUpload: await signUpload(`jobs/${id}/kit.zip`),
      keyUpload: await signUpload(`jobs/${id}/upload.jks`),
    });
  }
  if (q.get('app') === 'done') {
    let b = {}; try { b = await request.json(); } catch { /* vide */ }
    job.status = b.ok ? 'ready' : 'failed';
    job.error = b.ok ? null : String(b.error || 'build').slice(0, 300);
    job.finished = new Date().toISOString(); job.run = claims.run_id;
    await writeJob(job);
    return json({ ok: true });
  }
  return fail('bad_request', 400, 'op');
}
