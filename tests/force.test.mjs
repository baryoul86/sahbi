import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test', MEMORY_ENABLED: 'false', IMAGE_DIRECTOR: 'false' });
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let first = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: '11111111-1111-4111-8111-111111111111' });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.endsWith('/chat/completions')) { first ??= JSON.parse(opt.body); return new Response('data: [DONE]\n\n'); }
  return J([]);
};
const { POST } = await import('../api/chat.js');
const png = 'data:image/jpeg;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64');
const go = async (content, photo) => { first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content }], ...(photo ? { photo: png } : {}) }) })); await r.text(); return first; };
let b = await go('Trasformami questa foto in stile Disney.', true);
assert.deepEqual(b.tool_choice, { type: 'function', function: { name: 'create_image' } }); assert.match(b.messages[0].content, /è in italiano/);
b = await go('Dessine-moi un chameau dans le désert'); assert.equal(b.tool_choice.function.name, 'create_image'); assert.match(b.messages[0].content, /è in francese/);
b = await go('Wach rak khoya, kifach nta?'); assert.equal(b.tool_choice, 'auto'); assert.doesNotMatch(b.messages[0].content, /LINGUA DI QUESTA RISPOSTA/);
b = await go('Anime ma photo en vidéo', true); assert.equal(b.tool_choice, 'auto');
b = await go('What is the capital of Morocco and how can I get there?'); assert.equal(b.tool_choice, 'auto'); assert.match(b.messages[0].content, /è in inglese/);
// Modello più potente e regole per capire bene (contesto, errori del microfono, più richieste).
assert.equal(b.model, 'gpt-5-mini'); assert.match(b.messages[0].content, /Capire bene/); assert.match(b.messages[0].content, /rispondi a TUTTE/);
b = await go('كيفك؟ شو بدك تعمل اليوم؟'); assert.equal(b.tool_choice, 'auto'); assert.match(b.messages[0].content, /levantino/); assert.match(b.messages[0].content, /iracheno/); assert.doesNotMatch(b.messages[0].content, /LINGUA DI QUESTA RISPOSTA/);
// Dopo una foto (rimandata come "photoEarlier") una NUOVA immagine si crea subito, senza domande.
{ first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: "Creami un'immagine di una persona" }], photo: png, photoEarlier: true }) })); await r.text(); assert.equal(first.tool_choice?.function?.name, 'create_image'); }
b = await go('Crea una imagen de un gato en la playa'); assert.equal(b.tool_choice?.function?.name, 'create_image');
assert.match(b.messages[0].content, /RISPOSTE CORTE/);
console.log('force OK');
// Foto per il sito ("questo come logo del sito"): niente immagine forzata, e il sistema dice dove metterla.
{
  const ask = async (content, extra) => { first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content }], photo: png, ...extra }) })); await r.text(); return first; };
  for (const [t, extra] of [['Scrivimi questo come logo del sito.', { sitePhotos: 1 }], ['Mets cette photo comme logo', { mode: 'website', sitePhotos: 2 }], ['حط هاد الصورة لوغو ف الموقع', { sitePhotos: 1 }]]) {
    const f = await ask(t, extra);
    assert.equal(f.tool_choice, 'auto', t);
    assert.match(f.messages[0].content, /FOTO PER IL SITO/, t);
  }
  // Senza sito nella chat, "transforme en cartoon" resta una trasformazione.
  const g = await ask('Transforme en cartoon', {});
  assert.equal(g.tool_choice?.function?.name, 'create_image');
}
console.log('site photo OK');
// Chat con un sito: "metti tu delle immagini… quando clicco su LG si apre un'altra pagina" = modificare il sito, mai un poster.
{
  const ask = async (content, extra) => { first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content }], ...extra }) })); await r.text(); return first; };
  const t = "Allora, deve essere le anteprime, fai delle foto tu, metti tu delle immagini là. Quando clicco su LG si apre un'altra pagina";
  for (const extra of [{ hasSite: true }, { mode: 'website' }]) {
    const f = await ask(t, extra);
    assert.equal(f.tool_choice, 'auto');
    assert.ok(!f.tools.some((x) => x.function.name === 'create_image'));
    assert.match(f.messages[0].content, /QUESTA CHAT HA UN SITO/);
    assert.match(f.messages[0].content, /hashchange/);
  }
  // Immagine esplicita in una chat con sito: resta un'immagine.
  const g = await ask("Fammi un'immagine di un gatto", { hasSite: true });
  assert.equal(g.tool_choice?.function?.name, 'create_image');
  // Immagine "per il sito": va nel sito.
  const h = await ask("Fammi un'immagine per il sito", { hasSite: true });
  assert.equal(h.tool_choice, 'auto');
  // Senza sito: "fai delle foto" resta un'immagine.
  const k = await ask('Voglio delle foto di profumi', {});
  assert.equal(k.tool_choice?.function?.name, 'create_image');
}
console.log('site edit OK');
