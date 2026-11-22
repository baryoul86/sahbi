import assert from 'node:assert/strict';
// Chat "Écrire un livre": "FIN" → il server riscrive tutta la conversazione come libro (streaming).
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
let sent = null, chatSystem = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(10);
  if (url.includes('/rest/v1/')) return J([{ pro: false }]);
  if (url.endsWith('/chat/completions')) {
    const b = JSON.parse(opt.body);
    if (b.messages[0].content.includes('LIVRE FINAL')) { sent = b; return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'TITRE: Test\n## Chapitre\nTexte.' } }] })}\n\ndata: [DONE]\n\n`); }
    chatSystem = b.messages[0].content;
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Ok' } }] })}\n\ndata: [DONE]\n\n`);
  }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const req = (body) => new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
let r = await POST(req({ book: { action: 'compile', messages: [{ role: 'user', content: 'Un jeune part d’Oran' }, { role: 'assistant', content: 'Chapitre 1 : le départ' }] } }));
assert.equal(r.status, 200); assert.match(await r.text(), /TITRE: Test/);
assert.match(sent.messages[1].content, /AUTEUR : Un jeune part d’Oran/); assert.equal(sent.stream, true);
r = await POST(req({ messages: [{ role: 'user', content: 'Mon livre parle de ma vie' }], mode: 'book' }));
await r.text(); assert.match(chatSystem, /MODALITÀ LIBRO/); assert.match(chatSystem, /FIN/);
console.log('book OK');
