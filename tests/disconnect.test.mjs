// L'utente esce dall'app mentre l'immagine si crea: il server deve finirla e salvarla nella galleria.
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let saved = false, kept = null;
globalThis[Symbol.for('@vercel/request-context')] = { get: () => ({ waitUntil: (p) => { kept = p; } }) };
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'create_image', arguments: '{"prompt":"a cat","edit_photo":false}' } }] } }] }) + '\n\ndata: [DONE]\n\n');
  if (url.endsWith('/images/generations')) { await new Promise((r) => setTimeout(r, 1500)); return J({ data: [{ b64_json: 'eA==' }] }); }
  if (url.includes('/storage/v1/object/images/')) { saved = true; return J({}); }
  return J([{}]);
};
const { POST } = await import('../api/chat.js');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Fais-moi une image de chat' }] }) }));
const rd = r.body.getReader();
const first = new TextDecoder().decode((await rd.read()).value);
assert.match(first, /image_start/);
await rd.cancel(); // il telefono si stacca
assert.ok(kept, 'il lavoro deve essere affidato a waitUntil');
await kept;
assert.ok(saved, "l'immagine deve essere salvata anche dopo la disconnessione");
console.log('disconnect OK');
