import { json, env, limits } from './_lib.js';

const adsenseClient = () => env('ADSENSE_CLIENT', 'ca-pub-4750815574904840');

// Dati pubblici per la pagina: indirizzo Supabase, chiave "anon" (pensata per stare nel browser),
// limiti dei piani, pubblicità e quali pagamenti sono attivi.
// Con ?file=ads.txt restituisce il file ads.txt di Google AdSense (servito su /ads.txt).
export function GET(request) {
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
    supabaseUrl: env('SUPABASE_URL', ''),
    supabaseAnonKey: env('SUPABASE_ANON_KEY', ''),
    limits: { free: limits(false), pro: limits(true) },
    // Google AdSense per chi non è Pro (senza "slot" = solo promozioni di Sahbi).
    ads: { client: adsenseClient(), slot: env('ADSENSE_SLOT', '1479809952') },
    payments: {
      stripe: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID')),
      chargily: !!env('CHARGILY_SECRET_KEY'),
      priceEur: env('PRO_PRICE_EUR_LABEL', '6,50 €'),
      priceDzd: Number(env('CHARGILY_PRICE_DZD', '1000')),
      // Abbonamento annuale (facoltativo): carta con un secondo prezzo Stripe, Edahabia/CIB per 365 giorni.
      stripeYear: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID_YEAR')),
      priceYearEur: env('PRO_PRICE_YEAR_LABEL', '59 €'),
      priceYearDzd: Number(env('CHARGILY_PRICE_YEAR_DZD', '10000')),
    },
  });
}
