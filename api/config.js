import { json, env, limits } from './_lib.js';

// Dati pubblici per la pagina: indirizzo Supabase, chiave "anon" (pensata per stare nel browser),
// limiti dei piani e quali pagamenti sono attivi.
export function GET() {
  return json({
    supabaseUrl: env('SUPABASE_URL', ''),
    supabaseAnonKey: env('SUPABASE_ANON_KEY', ''),
    limits: { free: limits(false), pro: limits(true) },
    // Google AdSense per chi non è Pro (vuoto = solo promozioni di Sahbi).
    ads: { client: env('ADSENSE_CLIENT', 'ca-pub-4750815574904840'), slot: env('ADSENSE_SLOT', '') },
    payments: {
      stripe: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID')),
      chargily: !!env('CHARGILY_SECRET_KEY'),
      priceEur: env('PRO_PRICE_EUR_LABEL', '6,50 €'),
      priceDzd: Number(env('CHARGILY_PRICE_DZD', '1000')),
    },
  });
}
