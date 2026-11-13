import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const sse = (objs) => new Response(objs.map((o) => `data: ${JSON.stringify(o)}\n\n`).join('') + 'data: [DONE]\n\n');
let imgPrompt = '', imgSize = '', directorSaw = '';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/images/generations')) { imgPrompt = JSON.parse(opt.body).prompt; imgSize = JSON.parse(opt.body).size; return J({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }); }
  if (url.includes('/storage/v1/object/')) return J({ Key: 'k' });
  if (url.includes('/rest/v1/images')) return J([{ id: '22222222-2222-4222-8222-222222222222' }], 201);
  if (url.includes('/object/sign/')) return J({ signedURL: '/s' });
  if (url.endsWith('/chat/completions') && JSON.parse(opt.body).response_format) { const b = JSON.parse(opt.body); directorSaw = b.messages[1].content; assert.equal(b.model, 'gpt-5-mini'); return J({ choices: [{ message: { content: JSON.stringify({ prompt: 'Two black cats sitting on a sandy beach by the sea, with the word "Sahbi" written in the sand', format: 'landscape' }) } }] }); }
  if (url.endsWith('/chat/completions')) return sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'create_image', arguments: '{"prompt":"a cat on a beach","edit_photo":false}' } }] } }] }]);
  return J([]);
};
const { POST } = await import('../api/chat.js');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Dir lia tswira dyal 2 9tat kahlin f l bhar m3a ktiba "Sahbi"' }] }) }));
await r.text();
assert.match(imgPrompt, /^Two black cats/); assert.equal(imgSize, '1536x1024'); assert.match(directorSaw, /2 9tat kahlin/); assert.match(directorSaw, /a cat on a beach/); assert.match(imgPrompt, /2 9tat kahlin/); assert.match(imgPrompt, /'Sahbi'/);
console.log('img prompt OK');
