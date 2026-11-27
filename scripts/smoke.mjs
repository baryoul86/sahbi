// Controllo completo di Sahbi "come un utente vero" (gira su GitHub ogni mattina e a richiesta).
// Usa il compte de test di Apple (review@sahbi.bond): login, chat, creazione di un sito, immagini, pubblicazione.
// Il mot de passe arriva dall'ambiente (REVIEW_PASSWORD), mai scritto qui.
const BASE = process.env.SAHBI_URL || 'https://www.sahbi.bond';
const results = [];
const ok = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`); };
const ko = (name, detail = '') => { results.push({ name, ok: false, detail }); console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`); };
const step = async (name, fn) => { try { const d = await fn(); ok(name, d || ''); return true; } catch (e) { ko(name, String(e.message || e).slice(0, 300)); return false; } };
const must = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cfg = {}, token = '', html = '', slug = '';

await step('Pagina iniziale', async () => {
  const r = await fetch(BASE); const t = await r.text();
  must(r.ok && /Sahbi/.test(t), `HTTP ${r.status}`); return `${Math.round(t.length / 1024)} KB`;
});
await step('Configurazione', async () => {
  const r = await fetch(`${BASE}/api/config`); cfg = await r.json();
  must(cfg.supabaseUrl && cfg.supabaseAnonKey, 'supabaseUrl/anonKey mancanti'); return `pagamenti: ${Object.entries(cfg.payments || {}).filter(([, v]) => v === true).map(([k]) => k).join(', ')}`;
});
await step('Salute del server', async () => {
  const r = await fetch(`${BASE}/api/admin?health=1`); const h = await r.json();
  must(h.db && h.openai, `db=${h.db} openai=${h.openai} video=${h.video}`); return `db ok, OpenAI ok, video ${h.video ? 'ok' : 'non configurato'}`;
});
const logged = await step('Login (compte de test)', async () => {
  must(process.env.REVIEW_PASSWORD, 'REVIEW_PASSWORD mancante');
  const r = await fetch(`${BASE}/api/config?review=1`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ email: 'review@sahbi.bond', password: process.env.REVIEW_PASSWORD }) });
  const d = await r.json(); must(r.ok && d.tokenHash, d.message || `HTTP ${r.status}`);
  const v = await fetch(`${cfg.supabaseUrl}/auth/v1/verify`, { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: d.tokenHash }) });
  const s = await v.json(); must(v.ok && s.access_token, s.msg || s.error_description || `verify ${v.status}`); token = s.access_token;
});
const api = (path, opt = {}) => fetch(`${BASE}${path}`, { ...opt, headers: { authorization: `Bearer ${token}`, origin: BASE, ...(opt.headers || {}) } });
const chat = async (content, extra = {}) => {
  const r = await api('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content }], lang: 'fr', ...extra }) });
  const t = await r.text(); must(r.ok, `HTTP ${r.status} ${t.slice(0, 200)}`);
  return t.replace(/\u001e[^\u001e]*\u001e/g, '');
};
if (logged) {
  await step('Profilo (/api/me)', async () => {
    const r = await api('/api/me'); const d = await r.json(); must(r.ok, d.message || r.status);
    return `${d.pro ? 'Pro' : 'gratuito'}${d.trial ? ' (prova)' : ''}`;
  });
  await step('Chat normale', async () => {
    const t = await chat('Réponds juste: bonjour'); must(t.trim().length > 2, 'risposta vuota'); return `“${t.trim().slice(0, 60)}”`;
  });
  await step('Creazione di un sito (chat dei siti)', async () => {
    const t0 = Date.now();
    const t = await chat('Crée maintenant, sans me poser de questions, un site d’une seule page pour la boulangerie « Chez Amine » à Lyon : accueil, 3 produits avec photo, horaires, contact. Envoie le code complet.', { mode: 'website' });
    const m = /```html\s*([\s\S]*?)(```|$)/i.exec(t) || /(<!doctype html[\s\S]*<\/html>)/i.exec(t);
    must(m, `nessun codice HTML nella risposta (${t.length} caratteri): ${t.slice(0, 160)}`);
    html = m[1]; must(/<html[\s>]/i.test(html) && /<\/html>/i.test(html), 'HTML incompleto (manca <html> o </html>)');
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)/gi)].map((x) => x[1]);
    return `${Math.round(html.length / 1024)} KB in ${Math.round((Date.now() - t0) / 1000)} s, ${imgs.length} immagini`;
  });
  await step('Immagini dei siti (/img)', async () => {
    const r = await fetch(`${BASE}/img?w=800&h=600&q=bread,bakery&s=1`, { redirect: 'manual' });
    must(r.status === 302 && r.headers.get('location'), `HTTP ${r.status}`);
    const loc = r.headers.get('location'); const i = await fetch(loc);
    must(i.ok && /^image\//.test(i.headers.get('content-type') || ''), `immagine non caricata (${i.status} ${i.headers.get('content-type')}) da ${loc}`);
    return new URL(loc).host;
  });
  if (html) {
    await step('Pubblicazione del sito (sahbi-sites)', async () => {
      const full = html.replace(/https:\/\/loremflickr\.com/g, `${BASE}/img`);
      const r = await api('/api/library?publish=1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: full, size: full.length, title: 'test controllo' }) });
      const d = await r.json(); must(r.ok && d.uploadUrl, d.message || `HTTP ${r.status}`); slug = d.slug;
      const up = await fetch(d.uploadUrl, { method: 'PUT', headers: { 'content-type': 'text/html', 'x-upsert': 'true' }, body: full });
      must(up.ok, `upload ${up.status}`);
      await sleep(2000);
      const p = await fetch(d.url); const t = await p.text();
      must(p.ok && /Chez Amine/i.test(t), `sito pubblicato non leggibile (${p.status})`);
      return d.url;
    });
    if (slug) await step('Ritiro del sito di prova', async () => { const r = await api(`/api/library?unpublish=1&slug=${encodeURIComponent(slug)}`, { method: 'POST' }); must(r.ok, `HTTP ${r.status}`); });
  }
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? `❌ ${bad.length} problema/i su ${results.length} controlli` : `✅ Tutto funziona (${results.length} controlli)`}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Controllo Sahbi\n\n${results.map((x) => `- ${x.ok ? '✅' : '❌'} **${x.name}** ${x.detail}`).join('\n')}\n`);
}
process.exit(bad.length ? 1 : 0);
