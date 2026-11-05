import { json, env, limits } from './_lib.js';

// Dati pubblici per la pagina: indirizzo Supabase e chiave "anon" (pensata per stare nel browser).
export function GET() {
  return json({
    supabaseUrl: env('SUPABASE_URL', ''),
    supabaseAnonKey: env('SUPABASE_ANON_KEY', ''),
    limits: limits(),
  });
}
