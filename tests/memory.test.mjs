import assert from 'node:assert/strict';
// "Mémorise…": la richiesta esplicita viene salvata, anche la conversazione intera (riassunta).
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test' });
let ask = null, saved = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.endsWith('/chat/completions')) { ask = JSON.parse(opt.body); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ add: ['Projet : ouvrir un café à Oran', 'Budget : 20 000 €'], replace: [] }) } }] })); }
  if (url.includes('/rest/v1/user_memories') || url.includes('/rest/v1/')) { saved = JSON.parse(opt.body || 'null'); return new Response('[]', { status: 201 }); }
  throw new Error(url);
};
const { learnFromMessage, asksToSave } = await import('../api/_memory.js');
for (const t of ['Mémorise ça', 'memorizza questo', 'remember this', 'احفظ هذا', 'افتكر ده', '3qel 3la had lkalam']) assert.ok(asksToSave(t), t);
assert.ok(!asksToSave('Quelle heure est-il ?'));
const recent = [{ role: 'user', content: 'Je veux ouvrir un café à Oran' }, { role: 'assistant', content: 'Bonne idée ! Avec 20 000 € tu peux…' }];
const r = await learnFromMessage('u1', 'Mémorise notre discussion', [], recent);
assert.ok(ask.messages[1].content.includes('CONVERSAZIONE RECENTE'), 'contexte envoyé');
assert.match(ask.messages[1].content, /café à Oran/);
assert.equal(ask.model, 'gpt-5-mini');
assert.ok(Array.isArray(r) && r.includes('Projet : ouvrir un café à Oran'));
ask = null; await learnFromMessage('u1', 'Quelle heure est-il ?', [], recent); assert.equal(ask, null, 'pas de mémoire pour une question normale');
console.log('memory OK');
