import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let left = 5, openaiCalls = 0, order = [];
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rest/v1/profiles')) { order.push('plan'); await new Promise((r) => setTimeout(r, 50)); return J([{ pro: false }]); }
  if (url.endsWith('/rpc/use_credit')) { order.push('credit'); return J(left); }
  if (url.endsWith('/rpc/refund_credit')) return J(null);
  if (url.endsWith('/audio/transcriptions')) {
    openaiCalls++; order.push('openai'); if (!/darija/.test(opt.body.get('prompt'))) throw new Error('prompt mancante'); if (opt.body.get('model') !== 'gpt-4o-transcribe') throw new Error('modello');
    if (opt.body.get('stream') === 'true') {
      const sse = 'data: {"type":"transcript.text.delta","delta":"Salam "}\n\ndata: {"type":"transcript.text.delta","delta":"khoya"}\n\ndata: {"type":"transcript.text.done","text":"Salam khoya"}\n\n';
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    }
    return J({ text: ' Salam khoya ' });
  }
  return J({}, 404);
};
const { POST, GET } = await import('../api/transcribe.js');
assert.equal(GET().status, 204);
const mk = (stream) => { const f = new FormData(); f.append('audio', new Blob([new Uint8Array(2000)], { type: 'audio/webm' }), 'a'); if (stream) f.append('stream', '1'); return new Request('https://w/api/transcribe', { method: 'POST', headers: { authorization: 'Bearer t' }, body: f }); };
let r = await POST(mk(true)); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/plain/); assert.equal(await r.text(), 'Salam khoya');
assert.ok(order.indexOf('openai') < order.indexOf('credit'), 'openai partito prima del credito: ' + order);
r = await POST(mk(false)); assert.deepEqual(await r.json(), { text: 'Salam khoya' });
left = -1; r = await POST(mk(true)); assert.equal(r.status, 429);
console.log('transcribe OK');
