import assert from 'node:assert/strict';
// Ricerca su internet: il modello chiama web_search, il server chiede a OpenAI (Responses + web_search), poi risponde con le fonti.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const sse = (objs) => new Response(objs.map((o) => `data: ${JSON.stringify(o)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
let calls = [], resp = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(10);
  if (url.includes('/rpc/get_profile') || url.includes('/rest/v1/profiles')) return J([{ pro: false }]);
  if (url.endsWith('/responses')) {
    resp = JSON.parse(opt.body);
    return J({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: "L'once d'or vaut 2 650 $ le 20 novembre 2026.", annotations: [{ type: 'url_citation', url: 'https://example.com/or?utm_source=openai', title: 'Cours de l’or' }, { type: 'url_citation', url: 'https://example.com/or', title: 'doublon' }] }] }] });
  }
  if (url.endsWith('/chat/completions')) {
    const b = JSON.parse(opt.body); calls.push(b);
    if (calls.length === 1) {
      assert.ok(b.tools.some((t) => t.function.name === 'web_search')); assert.match(b.messages[0].content, /web_search/);
      return sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_s', function: { name: 'web_search', arguments: '' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":"prix de l\'or aujourd\'hui"}' } }] } }] }]);
    }
    const tm = b.messages.at(-1); assert.equal(tm.role, 'tool'); const d = JSON.parse(tm.content);
    assert.match(d.results, /2 650/); assert.equal(d.sources.length, 1); assert.equal(d.sources[0].url, 'https://example.com/or');
    assert.equal(b.messages.at(-2).tool_calls[0].function.name, 'web_search'); assert.equal(b.tool_choice, 'none');
    return sse([{ choices: [{ delta: { content: "L'or est à 2 650 $. Sources : Cours de l’or – https://example.com/or" } }] }]);
  }
  return J([], 200);
};
const { POST } = await import('../api/chat.js');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: "C'est combien l'or aujourd'hui ?" }] }) }));
const text = await r.text();
assert.match(text, /2 650 \$/); assert.match(text, /https:\/\/example\.com\/or/);
assert.deepEqual(resp.tools, [{ type: 'web_search' }]); assert.match(resp.input, /prix de l'or/);
assert.equal(calls.length, 2);
console.log('search OK');
