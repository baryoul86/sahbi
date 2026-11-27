import { json, env, limits } from './_lib.js';
import { playReady, playSku, playSigningPrints } from './_play.js';
import { appleSku } from './_apple.js';
import { lemonPriceLabel } from './_pay.js';

const adsenseClient = () => env('ADSENSE_CLIENT', 'ca-pub-4750815574904840');

// Dati pubblici per la pagina: indirizzo Supabase, chiave "anon" (pensata per stare nel browser),
// limiti dei piani, pubblicità e quali pagamenti sono attivi.
// Con ?file=ads.txt restituisce il file ads.txt di Google AdSense (servito su /ads.txt).
export async function GET(request) {
  { const u = new URL(request.url); if (u.searchParams.has('img')) return siteImage(u); }
  // /.well-known/assetlinks.json: collega l'app Android (Google Play) al sito, così si apre a schermo intero.
  // Su Vercel: ANDROID_PACKAGE (es. bond.sahbi.app) e ANDROID_SHA256 (impronte separate da virgola).
  if (new URL(request.url).searchParams.get('file') === 'assetlinks') {
    const pkg = env('ANDROID_PACKAGE', 'bond.sahbi.app');
    const prints = env('ANDROID_SHA256', '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
    // + la chiave di firma di Google Play (l'app scaricata dal Play Store è firmata da Google, non dalla nostra chiave).
    const play = await Promise.race([playSigningPrints().catch(() => []), new Promise((ok) => setTimeout(() => ok([]), 2500))]);
    for (const x of play) if (!prints.includes(x)) prints.push(x);
    const body = prints.length
      ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
      : [];
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
  }
  if (new URL(request.url).searchParams.get('file') === 'ads.txt') {
    const pub = adsenseClient().replace(/^ca-/, '');
    const body = /^pub-\d+$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# AdSense non ancora configurato\n';
    return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  return json({
    // Versione pubblicata: l'app la confronta quando torna in primo piano e si ricarica se è cambiata.
    version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12),
    supabaseUrl: env('SUPABASE_URL', ''),
    supabaseAnonKey: env('SUPABASE_ANON_KEY', ''),
    limits: { free: limits(false), pro: limits(true), trial: limits(true, true) },
    // Google AdSense per chi non è Pro (senza "slot" = solo promozioni di Sahbi).
    ads: { client: adsenseClient(), slot: env('ADSENSE_SLOT', '1479809952') },
    payments: {
      stripe: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID')),
      chargily: !!env('CHARGILY_SECRET_KEY'),
      priceEur: env('PRO_PRICE_EUR_LABEL', '7 €'),
      priceDzd: Number(env('CHARGILY_PRICE_DZD', '1000')),
      // Abbonamento annuale (facoltativo): carta con un secondo prezzo Stripe, Edahabia/CIB per 365 giorni.
      stripeYear: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID_YEAR')),
      // Lemon Squeezy (carta e PayPal, IVA gestita da loro): se è configurato, il pulsante "Carte" usa lui.
      lemonsqueezy: !!env('LEMONSQUEEZY_API_KEY'),
      // Prova gratuita sul sito (variante Lemon Squeezy con "free trial"): giorni di prova, 0 = non disponibile.
      trialDays: await Promise.race([import('./_pay.js').then((m) => m.lemonTrialVariant()).then((v) => (v ? Number(env('TRIAL_DAYS', '3')) : 0)).catch(() => 0), new Promise((ok) => setTimeout(() => ok(0), 1500))]),
      // Prezzo reale della carta (Lemon Squeezy); al massimo 1,5 secondi di attesa.
      cardPriceEur: await Promise.race([lemonPriceLabel(), new Promise((ok) => setTimeout(() => ok(''), 1500))]),
      // Moneta del paese di chi guarda (dal server Vercel) e cambio indicativo dall'euro: per mostrare « ≈ 380 EGP ».
      local: await Promise.race([localCurrency(request), new Promise((ok) => setTimeout(() => ok(null), 1200))]),
      // App Android: abbonamento con Google Play Billing.
      googleplay: playReady(), playSku: playSku(), appleSku: appleSku(),
      lemonsqueezyYear: !!(env('LEMONSQUEEZY_API_KEY') && env('LEMONSQUEEZY_VARIANT_ID_YEAR')),
      priceYearEur: env('PRO_PRICE_YEAR_LABEL', '59 €'),
      priceYearDzd: Number(env('CHARGILY_PRICE_YEAR_DZD', '10000')),
    },
  });
}

// Paese → moneta (paesi arabi, Africa del Nord e principali paesi della diaspora). Euro e paesi non elencati: niente conversione.
const CUR = { DZ: 'DZD', MA: 'MAD', TN: 'TND', EG: 'EGP', LY: 'LYD', MR: 'MRU', SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', LB: 'LBP', IQ: 'IQD', YE: 'YER', SD: 'SDG', SY: 'SYP', PS: 'ILS', IL: 'ILS', TR: 'TRY', US: 'USD', CA: 'CAD', GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', RU: 'RUB', IN: 'INR', PK: 'PKR', BD: 'BDT', ID: 'IDR', MY: 'MYR', NG: 'NGN', SN: 'XOF', CI: 'XOF', ML: 'XOF', CM: 'XAF', ZA: 'ZAR', AU: 'AUD', BR: 'BRL', MX: 'MXN', JP: 'JPY', CN: 'CNY', KR: 'KRW' };
let rates = { at: 0, eur: null };
async function localCurrency(request) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  const cur = CUR[country];
  if (!cur) return null;
  if (!rates.eur || Date.now() - rates.at > 12 * 3600 * 1000) {
    try {
      const d = await fetch('https://open.er-api.com/v6/latest/EUR').then((r) => r.json());
      if (d?.result === 'success' && d.rates) rates = { at: Date.now(), eur: d.rates };
    } catch { /* senza cambio: niente conversione */ }
  }
  const rate = rates.eur?.[cur];
  return rate ? { country, currency: cur, rate } : null;
}

// POST /api/config?visit=1 → conta una visita (solo numeri per giorno, nessun dato personale).
export async function POST(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin') || '';
  if (origin && new URL(origin).host !== url.host) return json({ ok: false }, 403);
  if (url.searchParams.get('contact') === '1') return contact(request);
  if (url.searchParams.get('report') === '1') return report(request);
  if (url.searchParams.get('review') === '1') return review(request);
  if (url.searchParams.get('login') === '1') return emailLogin(request);
  if (url.searchParams.get('err') === '1') return clientError(request);
  if (url.searchParams.get('visit') !== '1') return json({ ok: false }, 404);
  let b = {};
  try { b = await request.json(); } catch { /* corpo vuoto */ }
  try {
    const { rpc } = await import('./_lib.js');
    await rpc('track_visit', { p_new: b?.new === true, p_app: b?.app === true, p_landing: b?.landing === true });
  } catch { /* tabella non ancora creata: si ignora */ }
  return new Response(null, { status: 204 });
}

// POST /api/config?contact=1 → messaggio dalla pagina Contact, inviato per e-mail all'amministratore.
// POST /api/config?report=1 → segnalazione di un contenuto creato dall'IA (pulsante "Signaler" nell'app).
// Arriva per e-mail all'amministratore, con il testo o il link dell'immagine segnalata.
async function report(request) {
  const { getUserId, rpc } = await import('./_lib.js');
  const userId = await getUserId(request);
  if (!userId) return json({ ok: false, message: 'Session expirée. Recharge la page.' }, 401);
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const kind = ['text', 'image', 'video'].includes(b.kind) ? b.kind : 'text';
  const reason = String(b.reason || 'Autre').slice(0, 60), note = String(b.note || '').trim().slice(0, 500);
  const content = String(b.content || '').slice(0, 2000), link = /^https:\/\//.test(String(b.url || '')) ? String(b.url).slice(0, 500) : '';
  // Massimo una e-mail al minuto per utente (contro gli abusi); la segnalazione è comunque accettata.
  const due = await rpc('admin_alert', { p_kind: `probe_report_${userId}`, p_message: reason, p_every_minutes: 1 }).catch(() => true);
  if (due) {
    const { sendMail } = await import('./_alert.js');
    await sendMail(`🚩 Sahbi – contenu signalé (${kind}) : ${reason}`,
      `Utilisateur : ${userId}\nType : ${kind}\nMotif : ${reason}\nDétails : ${note || '—'}\n${link ? `Lien : ${link}\n` : ''}\nContenu :\n${content || '—'}`);
  }
  return json({ ok: true });
}

// POST /api/config?review=1 → accesso per chi controlla l'app per Apple (non può ricevere e-mail).
// Solo per l'indirizzo review@sahbi.bond; nel codice c'è solo l'impronta della password, mai la password.
export const REVIEW_EMAIL = 'review@sahbi.bond';
const REVIEW_HASH = 'da969865febba3293368c39af2b11f28d9ac51fd9e0ffc33ffdeb90d84be7502';
async function review(request) {
  const { createHash, timingSafeEqual } = await import('node:crypto');
  const { supabaseUrl, serviceHeaders, rpc } = await import('./_lib.js');
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const due = await rpc('admin_alert', { p_kind: 'probe_review_login', p_message: 'review', p_every_minutes: 1 }).catch(() => true);
  if (!due) return json({ ok: false, message: 'Trop de tentatives. Réessaie dans une minute.' }, 429);
  const h = createHash('sha256').update(String(b.password || '').trim()).digest();
  if (String(b.email || '').trim().toLowerCase().replace(/[.,;]+$/, '') !== REVIEW_EMAIL || !timingSafeEqual(h, Buffer.from(env('REVIEW_PASSWORD_SHA256', REVIEW_HASH), 'hex'))) {
    return json({ ok: false, message: 'Mot de passe incorrect.' }, 401);
  }
  const H = serviceHeaders({ 'content-type': 'application/json' });
  await fetch(`${supabaseUrl()}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email: REVIEW_EMAIL, email_confirm: true }) }).catch(() => {});
  const r = await fetch(`${supabaseUrl()}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: REVIEW_EMAIL }) });
  const d = await r.json().catch(() => ({}));
  const tokenHash = d.hashed_token || d.properties?.hashed_token;
  if (!r.ok || !tokenHash) return json({ ok: false, message: 'Connexion impossible pour le moment.' }, 502);
  return json({ ok: true, tokenHash });
}

// POST /api/config?login=1 { email, ios, lang } → e-mail di connessione mandata da Sahbi stesso (Resend),
// con un link su sahbi.bond. Non dipende dall'SMTP di Supabase né dal dominio supabase.co (bloccato in alcuni paesi).
const LOGIN_TXT = {
  fr: { s: 'Ton lien de connexion à Sahbi', h: 'Connexion à Sahbi', p: 'Appuie sur le bouton pour te connecter. Le lien marche une seule fois, pendant 1 heure.', b: 'Me connecter', n: 'Si tu n’as rien demandé, ignore cet e-mail.' },
  en: { s: 'Your Sahbi sign-in link', h: 'Sign in to Sahbi', p: 'Tap the button to sign in. The link works once, for 1 hour.', b: 'Sign me in', n: 'If you didn’t ask for this, just ignore this email.' },
  ar: { s: 'رابط الدخول إلى صاحبي', h: 'الدخول إلى صاحبي', p: 'اضغط على الزر للدخول. الرابط يعمل مرة واحدة لمدة ساعة.', b: 'الدخول', n: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة.' },
};
async function emailLogin(request) {
  const { createHash } = await import('node:crypto');
  const { supabaseUrl, serviceHeaders, rpc } = await import('./_lib.js');
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const email = String(b.email || '').trim().toLowerCase().replace(/[.,;]+$/, '');
  if (!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return json({ ok: false, message: 'Écris une adresse e-mail valide.' }, 400);
  const key = env('RESEND_API_KEY', '');
  if (!key) return json({ ok: false, fallback: true }, 503);
  const id = createHash('sha256').update(email).digest('hex').slice(0, 16);
  const due = await rpc('admin_alert', { p_kind: `probe_login_${id}`, p_message: 'login', p_every_minutes: 1 }).catch(() => true);
  if (!due) return json({ ok: false, message: 'Attends une minute avant de redemander un lien.' }, 429);
  const H = serviceHeaders({ 'content-type': 'application/json' });
  const gen = () => fetch(`${supabaseUrl()}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email }) });
  let r = await gen();
  if (!r.ok) { // nuovo utente: si crea il conto (e-mail confermata dal link stesso) e si riprova
    await fetch(`${supabaseUrl()}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, email_confirm: true }) }).catch(() => {});
    r = await gen();
  }
  const d = await r.json().catch(() => ({}));
  const th = d.hashed_token || d.properties?.hashed_token;
  if (!r.ok || !th) { const why = `link ${r.status} ${d?.error_code || d?.code || ''} ${String(d?.msg || d?.message || '').slice(0, 120)}`; console.error('login', why); return json({ ok: false, fallback: true, why }, 502); }
  const t = LOGIN_TXT[b.lang] || LOGIN_TXT.fr;
  const link = `https://www.sahbi.bond/${b.ios === true ? 'app-login.html' : ''}?th=${encodeURIComponent(th)}`;
  const dir = b.lang === 'ar' ? 'rtl' : 'ltr';
  const html = `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0F2E24"><h2 style="margin:0 0 12px">${t.h}</h2><p style="font-size:16px;line-height:1.5">${t.p}</p><p style="margin:24px 0"><a href="${link}" style="background:#2FAE74;color:#0F2E24;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px;display:inline-block">${t.b}</a></p><p style="font-size:13px;color:#5b6b64">${t.n}</p></div>`;
  const m = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env('LOGIN_FROM', 'Sahbi <connexion@sahbi.bond>'), to: [email], subject: t.s, html, text: `${t.h}\n\n${t.p}\n\n${link}\n\n${t.n}` }),
  }).catch(() => null);
  if (!m?.ok) { const t = await m?.text().catch(() => '') || ''; const why = `mail ${m?.status ?? 'réseau'} ${t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]').slice(0, 160)}`; console.error('login', why); return json({ ok: false, fallback: true, why }, 502); }
  return json({ ok: true });
}

// POST /api/config?err=1 { kind, message, meta } → errore visto da un utente (login, chat, pagina).
// Niente dati personali: e-mail e numeri tolti, solo app/lingua/paese. Uguali nello stesso minuto = uno solo.
const ERR_KINDS = ['login', 'chat', 'js', 'image', 'voice', 'pay', 'site', 'other'];
async function clientError(request) {
  const { createHash } = await import('node:crypto');
  const { supabaseUrl, serviceHeaders, rpc } = await import('./_lib.js');
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const kind = ERR_KINDS.includes(b.kind) ? b.kind : 'other';
  const message = String(b.message || '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]').replace(/\+?\d[\d\s.-]{7,}\d/g, '[tél]').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500);
  if (!message) return json({ ok: true });
  const m = b.meta || {};
  const meta = { app: String(m.app || '').slice(0, 30), lang: String(m.lang || '').slice(0, 5), build: String(m.build || '').slice(0, 12), ua: String(m.ua || '').slice(0, 160), country: request.headers.get('x-vercel-ip-country') || '' };
  const id = createHash('sha256').update(`${kind}|${message}|${meta.country}`).digest('hex').slice(0, 16);
  const due = await rpc('admin_alert', { p_kind: `probe_err_${id}`, p_message: 'err', p_every_minutes: 1 }).catch(() => false);
  if (due) await fetch(`${supabaseUrl()}/rest/v1/client_errors`, { method: 'POST', headers: serviceHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ kind, message, meta }) }).catch(() => {});
  return json({ ok: true });
}

// GET /img/800/600/perfume,bottle?s=3 → foto vera per i siti creati da Sahbi (Openverse, licenze libere),
// sempre la stessa per la stessa richiesta; se Openverse non risponde, una foto generica (picsum). In cache 7 giorni.
async function siteImage(url) {
  const q = url.searchParams;
  const w = Math.min(1600, Math.max(64, Number(q.get('w')) || 800)), h = Math.min(1600, Math.max(64, Number(q.get('h')) || 600));
  const words = String(q.get('q') || 'abstract').toLowerCase().replace(/[^\p{L}\p{N}, -]/gu, '').split(/[, ]+/).filter(Boolean).slice(0, 4);
  const n = Math.abs(Number(q.get('s')) || 0) % 40;
  const seed = encodeURIComponent(`${words.join('-')}-${n}`);
  let target = `https://picsum.photos/seed/${seed}/${w}/${h}`;
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(words.join(' '))}&page_size=20&mature=false&aspect_ratio=${w >= h ? 'wide' : 'tall'}`,
      { headers: { 'user-agent': 'Sahbi/1.0 (https://www.sahbi.bond)' }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const list = ((await r.json()).results || []).filter((x) => x.thumbnail || x.url);
      if (list.length) { const x = list[n % list.length]; target = x.thumbnail || x.url; }
    }
  } catch { /* riserva: picsum */ }
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'public, max-age=86400, s-maxage=604800', 'access-control-allow-origin': '*' } });
}

async function contact(request) {
  let b = {};
  try { b = await request.json(); } catch { /* vuoto */ }
  const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().slice(0, 120), message = String(b.message || '').trim().slice(0, 4000);
  if (b.website) return json({ ok: true }); // trappola per i robot
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 10) return json({ ok: false, message: 'Indique une adresse e-mail valide et un message.' }, 400);
  const { rpc } = await import('./_lib.js');
  const { sendMail } = await import('./_alert.js');
  const due = await rpc('admin_alert', { p_kind: 'probe_contact', p_message: 'contact', p_every_minutes: 1 }).catch(() => true);
  if (!due) return json({ ok: false, message: 'Trop de messages en ce moment. Réessaie dans une minute.' }, 429);
  const ok = await sendMail(`✉️ Sahbi – message de ${name || email}`, `De : ${name || '(sans nom)'} <${email}>\n\n${message}`, email);
  return ok ? json({ ok: true }) : json({ ok: false, message: 'Envoi impossible pour le moment. Réessaie plus tard.' }, 502);
}
