import assert from 'node:assert/strict';
// Se il modello annuncia soltanto ("sto generando…") senza consegnare, il server lo fa continuare subito.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
const S = (t) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\ndata: [DONE]\n\n`);
let calls = 0, nudged = null, first = 'Sto generando il file index.html completo: lo riceverai subito.';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(10);
  if (url.includes('/rest/v1/')) return J([{ pro: true }]);
  if (url.endsWith('/chat/completions')) {
    calls++; const b = JSON.parse(opt.body);
    if (calls === 1) return S(first);
    nudged = b.messages.at(-1).content; return S('```html\n<!doctype html><html><body>Boutique</body></html>\n```');
  }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const req = (c) => new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: c }] }) });
let out = await (await POST(req('Crée le site de ma boutique'))).text();
assert.equal(calls, 2); assert.match(nudged, /ADESSO/); assert.match(out, /lo riceverai subito[\s\S]*```html/);
// Risposta normale: nessuna seconda chiamata.
calls = 0; first = 'Voici la réponse.';
out = await (await POST(req('Bonjour'))).text();
assert.equal(calls, 1);
console.log('deliver OK');
