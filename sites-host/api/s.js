// Sahbi Sites: mostra i siti pubblicati dagli utenti Pro (progetto Vercel SEPARATO da sahbi.bond).
// I file sono nella cartella pubblica "sites" di Supabase: sites/<nome>/index.html.
export const config = { runtime: 'edge' };

let sb = process.env.SUPABASE_URL || '';
async function supabase() {
  if (sb) return sb;
  const r = await fetch('https://www.sahbi.bond/api/config');
  sb = ((await r.json()).supabaseUrl || '').replace(/\/$/, '');
  return sb;
}
const page = (title, text, status) => new Response(
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f1f19;color:#eaf5ef;text-align:center;padding:20px}a{color:#2FAE74}</style></head>
<body><div><h1>${title}</h1><p>${text}</p><p><a href="https://www.sahbi.bond/?ref=sites">Crée ton site avec Sahbi</a></p></div></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

export default async function handler(req) {
  const slug = (new URL(req.url).searchParams.get('slug') || '').toLowerCase().replace(/\/+$/, '');
  if (!slug) return Response.redirect('https://www.sahbi.bond/?ref=sites', 302);
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return page('Site introuvable', 'Cette adresse n’existe pas.', 404);
  let r;
  try { r = await fetch(`${await supabase()}/storage/v1/object/public/sites/${slug}/index.html?t=${Math.floor(Date.now() / 60000)}`); } catch { r = null; }
  if (!r?.ok) return page('Site introuvable', 'Ce site n’existe pas ou a été retiré.', 404);
  let html = await r.text();
  const badge = `<div style="position:fixed;bottom:8px;inset-inline-end:8px;z-index:2147483647;font:12px system-ui,sans-serif;background:rgba(15,31,25,.85);color:#fff;padding:5px 10px;border-radius:999px">`
    + `<a href="https://www.sahbi.bond/?ref=site" style="color:#fff;text-decoration:none">Créé avec Sahbi</a> · `
    + `<a href="https://www.sahbi.bond/contact.html?signaler=${slug}" style="color:#9fe3c2;text-decoration:none">Signaler</a></div>`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${badge}</body>`) : html + badge;
  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=60, s-maxage=60',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  } });
}
