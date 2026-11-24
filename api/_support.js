// Assistenza: l'utente collegato manda un problema (testo + screenshot facoltativo + dati tecnici automatici),
// l'amministratore lo riceve per e-mail e nel pannello, risponde, e la risposta torna nell'app.
// Un controllo automatico (ogni mattina) legge i problemi nuovi, senza dati personali, con una chiave segreta.
import { json, fail, env, supabaseUrl, serviceHeaders, rpc, signPath, BUCKET } from './_lib.js';
import { sendMail } from './_alert.js';

const REST = () => `${supabaseUrl()}/rest/v1/support_tickets`;
const H = (extra = {}) => serviceHeaders({ 'content-type': 'application/json', ...extra });
const isId = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const noTable = (r) => r.status === 404 || r.status === 400;
const NO_TABLE_MSG = 'L’assistance n’est pas encore activée (fichier 008_support.sql à exécuter dans Supabase).';

// Dati tecnici: solo campi conosciuti, testi corti.
function cleanMeta(m = {}) {
  const out = {};
  for (const k of ['platform', 'build', 'ua', 'lang', 'mode', 'screen', 'page', 'lastError', 'time']) if (m[k] != null) out[k] = clean(m[k], k === 'lastError' ? 600 : k === 'ua' ? 300 : 80);
  return out;
}

// ---------- Utente ----------
export async function userSupport(request, user, pro) {
  if (request.method === 'GET') {
    const r = await fetch(`${REST()}?user_id=eq.${user.id}&select=id,message,status,reply,replied_at,user_seen,created_at&order=created_at.desc&limit=20`, { headers: H() });
    if (!r.ok) return noTable(r) ? json({ tickets: [], unseen: 0, off: true }) : fail('support', 502, 'Erreur, réessaie.');
    const tickets = await r.json();
    const unseen = tickets.filter((t) => t.user_seen === false).length;
    // Aprire la lista = risposte viste.
    if (unseen && new URL(request.url).searchParams.get('seen') === '1') {
      await fetch(`${REST()}?user_id=eq.${user.id}&user_seen=eq.false`, { method: 'PATCH', headers: H(), body: JSON.stringify({ user_seen: true }) }).catch(() => {});
    }
    return json({ tickets, unseen });
  }
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const message = clean(b.message, 4000);
  if (message.length < 3) return fail('support', 400, 'Décris ton problème en quelques mots.');
  // Al massimo un messaggio ogni 2 minuti per persona.
  const due = await rpc('admin_alert', { p_kind: `probe_support_${user.id}`, p_message: 'support', p_every_minutes: 2 }).catch(() => true);
  if (!due) return fail('support', 429, 'Tu viens d’envoyer un message. Réessaie dans 2 minutes.');
  const meta = { ...cleanMeta(b.meta), pro: !!pro };
  const ins = await fetch(REST(), { method: 'POST', headers: H({ prefer: 'return=representation' }), body: JSON.stringify({ user_id: user.id, email: user.email || null, message, meta }) });
  if (!ins.ok) return fail('support', noTable(ins) ? 503 : 502, noTable(ins) ? NO_TABLE_MSG : 'Envoi impossible pour le moment. Réessaie plus tard.');
  const [row] = await ins.json();
  // Screenshot (già ridotto dal telefono): cartella privata, si vede solo dal pannello.
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(typeof b.shot === 'string' ? b.shot : '');
  if (m && m[2].length < 3_000_000) {
    const path = `support/${row.id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    const up = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: serviceHeaders({ 'content-type': `image/${m[1]}`, 'x-upsert': 'true' }), body: Buffer.from(m[2], 'base64') }).catch(() => null);
    if (up?.ok) await fetch(`${REST()}?id=eq.${row.id}`, { method: 'PATCH', headers: H(), body: JSON.stringify({ shot: path }) }).catch(() => {});
  }
  const lines = [
    `De : ${user.email || '(sans e-mail)'}${pro ? ' · Pro' : ''}`,
    `App : ${meta.platform || '?'}${meta.build ? ` (build ${meta.build})` : ''} · langue ${meta.lang || '?'}${meta.mode ? ` · chat ${meta.mode}` : ''}`,
    meta.lastError ? `Dernière erreur : ${meta.lastError}` : '',
    m ? 'Capture d’écran jointe (voir le panneau).' : '',
    '', message, '',
    'Répondre depuis le panneau : https://www.sahbi.bond/admin.html#support',
  ];
  await sendMail(`🛟 Sahbi – assistance : ${message.slice(0, 60)}`, lines.filter((l, i) => l !== '' || i > 3).join('\n'), user.email || '');
  return json({ ok: true, id: row.id });
}

// ---------- Amministratore ----------
export async function adminSupportList(status = 'open') {
  const filter = status === 'all' ? '' : status === 'open' ? '&status=eq.open' : `&status=eq.${status === 'closed' ? 'closed' : 'answered'}`;
  const r = await fetch(`${REST()}?select=*&order=created_at.desc&limit=100${filter}`, { headers: H() });
  if (!r.ok) return noTable(r) ? json({ tickets: [], off: true, message: NO_TABLE_MSG }) : fail('support', 502, `Erreur ${r.status}`);
  const rows = await r.json();
  await Promise.all(rows.map(async (t) => { if (t.shot) t.shotUrl = await signPath(t.shot, 3600).catch(() => null); }));
  const c = await fetch(`${REST()}?select=id&status=eq.open`, { headers: H({ prefer: 'count=exact', range: '0-0' }) }).catch(() => null);
  const open = Number(c?.headers.get('content-range')?.split('/')[1]) || 0;
  return json({ tickets: rows, open });
}

export async function adminSupportUpdate(request) {
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  if (!isId(b.id)) return fail('support', 400, 'Identifiant manquant.');
  const reply = clean(b.reply, 4000);
  const status = ['open', 'answered', 'closed'].includes(b.status) ? b.status : (reply ? 'answered' : 'closed');
  const patch = { status, ...(reply ? { reply, replied_at: new Date().toISOString(), user_seen: false } : {}) };
  const r = await fetch(`${REST()}?id=eq.${b.id}`, { method: 'PATCH', headers: H(), body: JSON.stringify(patch) });
  return r.ok ? json({ ok: true }) : fail('support', 502, `Erreur ${r.status}`);
}

// ---------- Controllo automatico (Claude, ogni mattina) ----------
// Chiave segreta: qui c'è solo la sua impronta (SHA-256). Si cambia con SUPPORT_AGENT_KEY_SHA256 su Vercel.
const AGENT_HASH = 'b190d54cf42db3cb1182a9eece1f9410620e768ef3cbe0df7f6e060564bca5de';
const redact = (s) => String(s || '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
  .replace(/\+?\d[\d\s.-]{7,}\d/g, '[téléphone]');

export async function agentFeed(request) {
  const { createHash, timingSafeEqual } = await import('node:crypto');
  const q = new URL(request.url).searchParams;
  const due = await rpc('admin_alert', { p_kind: 'probe_support_agent', p_message: 'agent', p_every_minutes: 1 }).catch(() => true);
  if (!due) return new Response('Trop de requêtes.', { status: 429 });
  const h = createHash('sha256').update(String(q.get('key') || '')).digest();
  if (!timingSafeEqual(h, Buffer.from(env('SUPPORT_AGENT_KEY_SHA256', AGENT_HASH), 'hex'))) return new Response('Accès refusé.', { status: 401 });
  const hours = Math.min(24 * 14, Math.max(1, Number(q.get('hours')) || 30));
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const r = await fetch(`${REST()}?select=id,message,shot,meta,status,reply,created_at&created_at=gte.${since}&order=created_at.asc&limit=50`, { headers: H() });
  if (!r.ok) return new Response(noTable(r) ? NO_TABLE_MSG : `Erreur ${r.status}`, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const rows = await r.json();
  const out = [`# Sahbi – demandes d'assistance des ${hours} dernières heures (${rows.length})`, ''];
  for (const t of rows) {
    const m = t.meta || {};
    const shot = t.shot ? await signPath(t.shot, 6 * 3600).catch(() => '') : '';
    out.push(`## ${t.id.slice(0, 8)} · ${t.created_at.slice(0, 16).replace('T', ' ')} UTC · ${t.status}`,
      `- App : ${m.platform || '?'} · build ${m.build || '?'} · langue ${m.lang || '?'} · Pro ${m.pro ? 'oui' : 'non'} · chat ${m.mode || 'normale'} · écran ${m.screen || '?'}`,
      `- Navigateur : ${m.ua || '?'}`,
      `- Dernière erreur : ${redact(m.lastError) || 'aucune'}`,
      shot ? `- Capture : ${shot}` : '- Capture : aucune',
      `- Message : ${redact(t.message).replace(/\n+/g, ' / ')}`,
      t.reply ? `- Réponse déjà envoyée : ${redact(t.reply).replace(/\n+/g, ' / ')}` : '', '');
  }
  return new Response(out.filter((l) => l !== null).join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
