import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let first = null, edits = 0, gens = 0, imgPrompt = '';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) { first ??= JSON.parse(opt.body); return new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'create_image', arguments: '{"prompt":"disney style woman","edit_photo":false}' } }] } }] }) + '\n\ndata: [DONE]\n\n'); }
  if (url.endsWith('/images/edits')) { edits++; imgPrompt = opt.body.get('prompt'); return J({ data: [{ b64_json: 'eA==' }] }); }
  if (url.endsWith('/images/generations')) { gens++; return J({ data: [{ b64_json: 'eA==' }] }); }
  return J([{ id: '22222222-2222-4222-8222-222222222222' }]);
};
const { POST } = await import('../api/chat.js');
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64');
const hist = [{ role: 'user', content: 'Trasformami questa foto in stile Disney.\n[Photo envoyée]' }, { role: 'assistant', content: 'La création a pris trop de temps.' }];
const go = async (content, extra) => { first = null; edits = 0; gens = 0; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [...hist, { role: 'user', content }], ...extra }) })); await r.text(); return first; };
let b = await go('Puoi rifarla?', { photo: png, photoEarlier: true });
assert.equal(b.tool_choice.function.name, 'create_image'); assert.equal(edits, 1, 'deve usare la foto'); assert.equal(gens, 0); assert.match(b.messages[0].content, /è in italiano/); assert.match(imgPrompt, /stile Disney/);
b = await go('Oui', { photo: png, photoEarlier: true }); assert.equal(b.tool_choice.function.name, 'create_image'); assert.equal(edits, 1);
b = await go('Dimmi una barzelletta sui gatti e poi raccontami la storia di Roma antica'); assert.equal(b.tool_choice, 'auto');
console.log('redo OK');
