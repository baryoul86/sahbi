import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const sse = (objs) => new Response(objs.map((o) => `data: ${JSON.stringify(o)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
const base = Date.parse('2026-11-09T10:00:00Z');
const ts = Array.from({ length: 60 }, (_, i) => ({ time: new Date(base + i * 3600e3).toISOString(), data: { instant: { details: { air_temperature: 15 + (i % 24) / 3, wind_speed: 4, relative_humidity: 60 } }, next_1_hours: { summary: { symbol_code: i > 30 ? 'rain' : 'clearsky_day' }, details: { precipitation_amount: i > 30 ? 0.5 : 0 } } } }));
let calls = [], metUA = '';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(10);
  if (url.includes('/rpc/get_profile') || url.includes('/rest/v1/profiles')) return J([{ pro: false }]);
  if (url.includes('api.met.no')) { metUA = opt.headers['user-agent']; assert.match(url, /lat=35\.697&lon=-0\.633/); return J({ properties: { timeseries: ts } }); }
  if (url.endsWith('/chat/completions')) {
    const b = JSON.parse(opt.body); calls.push(b);
    if (calls.length === 1) {
      assert.ok(b.tools.some((t) => t.function.name === 'get_weather')); assert.match(b.messages[0].content, /Oggi è/);
      return sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get_weather', arguments: '' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":"Oran","latitude":35.697,"longitude":-0.633,"days":2}' } }] } }] }]);
    }
    const tm = b.messages.at(-1); assert.equal(tm.role, 'tool'); const d = JSON.parse(tm.content);
    assert.equal(d.city, 'Oran'); assert.equal(d.daily.length, 2); assert.equal(d.source, 'MET Norway'); assert.equal(b.tool_choice, 'none');
    return sse([{ choices: [{ delta: { content: `À Oran : ${d.now.temp_c}°C, ${d.now.sky}. ` } }] }, { choices: [{ delta: { content: '(MET Norway)' } }] }]);
  }
  return J([], 200);
};
const { POST } = await import('../api/chat.js');
const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Quel temps fait-il à Oran ?' }] }) }));
const text = await r.text();
assert.match(text, /^À Oran : \d+°C, ciel dégagé\. \(MET Norway\)$/, text); assert.match(metUA, /Sahbi/);
assert.equal(calls.length, 2);
console.log('weather OK:', text);
