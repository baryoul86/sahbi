import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let editUsed = false;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'create_image', arguments: '{"prompt":"disney style","edit_photo":false}' } }] } }] }) + '\n\ndata: [DONE]\n\n');
  if (url.endsWith('/images/edits')) { editUsed = true; await new Promise((r) => setTimeout(r, 17500)); throw new Error('boom'); }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Trasformami questa foto in stile Disney.' }], photo: png }) }));
const t = await r.text();
assert.ok(editUsed, 'deve usare la foto'); assert.ok((t.match(/"ping"/g) || []).length >= 2, 'heartbeat'); assert.match(t, /image_error/);
console.log('slow OK', (t.match(/"ping"/g) || []).length, 'pings');
