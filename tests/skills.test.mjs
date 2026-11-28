import assert from 'node:assert/strict';
// Competenze dei siti: il tipo di sito giusto riceve la ricetta giusta.
const { siteSkill } = await import('../api/_site_skills.js');
const u = (c) => [{ role: 'user', content: c }];
assert.equal(siteSkill(u('Crée un site pour ma pizzeria à Oran')).id, 'ristorazione');
assert.equal(siteSkill(u('Fammi un sito per il mio negozio di vestiti con carrello')).id, 'negozio');
assert.equal(siteSkill(u('Site pour mon salon de coiffure, prise de rendez-vous')).id, 'bellezza');
assert.equal(siteSkill(u('Je suis plombier à Lyon, fais-moi un site')).id, 'artigiano');
assert.equal(siteSkill(u('Un site pour notre riad à Marrakech')).id, 'turismo');
assert.equal(siteSkill(u('Site pour notre mariage le 12 juin')).id, 'evento');
assert.equal(siteSkill(u('Creami un gioco come tetris')).id, 'gioco');
assert.equal(siteSkill(u('Bonjour')).id, null);
assert.match(siteSkill(u('Bonjour')).prompt, /PROCESSO DA PROFESSIONISTA/);
// Il tipo detto all'inizio resta anche quando l'ultima richiesta è "cambia il colore".
assert.equal(siteSkill([...u('Site pour mon garage automobile'), { role: 'assistant', content: 'ok' }, ...u('mets le bleu plus foncé')]).id, 'artigiano');
// Nel prompt del sito (modalità website) c'è la competenza.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'k', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false' });
const J = (b) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
let sys = '';
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/')) return J(10);
  if (url.includes('/rest/v1/')) return J([{ pro: true }]);
  if (url.endsWith('/chat/completions')) { sys = JSON.parse(opt.body).messages[0].content; return new Response('data: [DONE]\n\n'); }
  return J([]);
};
const { POST } = await import('../api/chat.js');
await (await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: u('Site pour ma boulangerie'), mode: 'website' }) }))).text();
assert.match(sys, /COMPETENZA ATTIVA – RISTORANTE/);
await (await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: u('Site pour ma boulangerie') }) }))).text();
assert.doesNotMatch(sys, /COMPETENZA ATTIVA/);
console.log('skills OK');
