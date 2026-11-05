import { env } from './_lib.js';

// File ads.txt richiesto da Google AdSense (servito su /ads.txt).
export function GET() {
  const client = env('ADSENSE_CLIENT', 'ca-pub-4750815574904840');
  const pub = client.replace(/^ca-/, '');
  const body = /^pub-\d+$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# AdSense non ancora configurato\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
