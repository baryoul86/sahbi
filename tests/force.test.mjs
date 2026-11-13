import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let first = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) { first ??= JSON.parse(opt.body); return new Response('data: [DONE]\n\n'); }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64');
const go = async (content, photo) => { first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content }], ...(photo ? { photo: png } : {}) }) })); await r.text(); return first; };
let b = await go('Trasformami questa foto in stile Disney.', true);
assert.deepEqual(b.tool_choice, { type: 'function', function: { name: 'create_image' } }); assert.match(b.messages[0].content, /è in italiano/);
b = await go('Dessine-moi un chameau dans le désert'); assert.equal(b.tool_choice.function.name, 'create_image'); assert.match(b.messages[0].content, /è in francese/);
b = await go('Wach rak khoya, kifach nta?'); assert.equal(b.tool_choice, 'auto'); assert.doesNotMatch(b.messages[0].content, /LINGUA DI QUESTA RISPOSTA/);
b = await go('Anime ma photo en vidéo', true); assert.equal(b.tool_choice, 'auto');
b = await go('What is the capital of Morocco and how can I get there?'); assert.equal(b.tool_choice, 'auto'); assert.match(b.messages[0].content, /è in inglese/);
console.log('force OK');
