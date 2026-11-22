import { json, env, limits } from './_lib.js';
import { playReady, playSku } from './_play.js';
import { appleSku } from './_apple.js';
import { lemonPriceLabel } from './_pay.js';

const adsenseClient = () => env('ADSENSE_CLIENT', 'ca-pub-4750815574904840');

// Dati pubblici per la pagina: indirizzo Supabase, chiave "anon" (pensata per stare nel browser),
// limiti dei piani, pubblicità e quali pagamenti sono attivi.
// Con ?file=ads.txt restituisce il file ads.txt di Google AdSense (servito su /ads.txt).
export async function GET(request) {
  // /.well-known/assetlinks.json: collega l'app Android (Google Play) al sito, così si apre a schermo intero.
  // Su Vercel: ANDROID_PACKAGE (es. bond.sahbi.app) e ANDROID_SHA256 (impronte separate da virgola).
  if (new URL(request.url).searchParams.get('file') === 'assetlinks') {
    const pkg = env('ANDROID_PACKAGE', 'bond.sahbi.app');
    const prints = env('ANDROID_SHA256', '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
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
    limits: { free: limits(false), pro: limits(true) },
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
