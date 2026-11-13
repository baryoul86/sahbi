import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let first = null, form = null, upType = '';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) { first ??= JSON.parse(opt.body); return new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'create_image', arguments: '{"prompt":"the woman alone","edit_photo":false}' } }] } }] }) + '\n\ndata: [DONE]\n\n'); }
  if (url.endsWith('/images/edits')) { form = opt.body; return J({ data: [{ b64_json: 'eA==' }] }); }
  if (url.includes('/storage/v1/object/images/')) { upType = opt.headers['content-type']; return J({}); }
  return J([{}]);
};
const { POST } = await import('../api/chat.js');
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Togli lo sfondo da questa foto' }], photo: png }) }));
const t = await r.text();
assert.equal(first.tool_choice.function.name, 'create_image'); assert.ok(form, 'deve modificare la foto');
assert.equal(form.get('background'), 'transparent'); assert.equal(form.get('output_format'), 'png'); assert.match(t, /data:image\/png/); assert.equal(upType, 'image/png');
console.log('clear OK');
