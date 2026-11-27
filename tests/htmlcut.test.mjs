import assert from 'node:assert/strict';
// Sito/gioco scritto a mano e tagliato a metà: il server lo continua da solo, l'utente vede un file completo.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
const S = (...parts) => new Response(parts.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join('') + 'data: [DONE]\n\n');
let calls = 0, nudge = null, second = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/')) return J(10);
  if (url.includes('/rest/v1/')) return J([{ pro: true }]);
  if (url.endsWith('/chat/completions')) {
    calls++; const b = JSON.parse(opt.body);
    if (calls === 1) return S('Ecco il gioco:\n\n```html\n<!doctype html>\n<html><head><style>body{margin:0}</style></head><body><canvas id="c"></canvas><script>\nvar a=1;\nfunction loop(){requestAnimationFrame(loop)}\n');
    nudge = b.messages.at(-1).content; return S(second);
  }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const req = (c) => new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: c }], mode: 'website' }) });
// 1) Continuazione che ripete l'ultima riga e rimette ```html: tutto pulito.
second = '```html\nfunction loop(){requestAnimationFrame(loop)}\nloop();\n</script></body></html>\n```';
let out = (await (await POST(req('Crée-moi un jeu de casse-briques'))).text()).replace(/\u001e[^\u001e]*\u001e/g, '');
assert.equal(calls, 2); assert.match(nudge, /interrotto/);
assert.equal((out.match(/function loop/g) || []).length, 1, out);
assert.equal((out.match(/```html/g) || []).length, 1, out);
assert.match(out, /loop\(\);\n<\/script><\/body><\/html>\n```$/);
// 2) Risposta completa: nessuna seconda chiamata.
calls = 0; second = null;
globalThis.fetch = (orig => async (url, opt) => (url.endsWith('/chat/completions') ? (calls++, S('```html\n<!doctype html><html><body>ok</body></html>\n```')) : orig(url, opt)))(globalThis.fetch);
await (await POST(req('Crée un site'))).text();
assert.equal(calls, 1);
// Motori pronti per Tetris e Snake.
const { moreGame } = await import('../api/_game_more.js');
for (const kind of ['blocks', 'snake']) {
  const h = moreGame({ kind, title: 'T<x>', lang: 'it', intro: 'x' });
  assert.match(h, /^<!doctype html>[\s\S]*<\/html>$/); assert.doesNotMatch(h, /<x>|>undefined<|:undefined/); assert.match(h, new RegExp(`${kind}-best-`));
}
console.log('htmlcut OK');
