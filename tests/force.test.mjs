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
  // Chat dei siti: immagine che non c'entra → niente immagine, si consiglia la chat normale.
  const w = await ask("Fammi un'immagine di un gatto", { mode: 'website' });
  assert.equal(w.tool_choice, 'auto');
  assert.ok(!w.tools.some((x) => x.function.name === 'create_image'));
  assert.match(w.messages[0].content, /chat normale/);
  assert.doesNotMatch(w.messages[0].content, /QUESTA CHAT HA UN SITO/);
  // Tutte le chat speciali: niente immagini/video, si manda alla chat normale.
  for (const [t, mode, photo] of [["Fammi un'immagine di un gatto", 'business'], ['Dessine-moi la Kaaba', 'travel'], ['Crée la couverture du livre en image', 'book'], ['Fais-moi une vidéo de promo', 'whatsapp'], ['Transforme cette photo en cartoon', 'business', true]]) {
    first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: t }], mode, ...(photo ? { photo: png } : {}) }) })); await r.text();
    assert.equal(first.tool_choice, 'auto', t);
    assert.ok(!first.tools.some((x) => /create_(image|video)/.test(x.function.name)), t);
    assert.match(first.messages[0].content, /chat normale di Sahbi/, t);
  }
  // Domanda normale in modalità business: nessun avviso.
  const n = await ask('Aide-moi à écrire un devis', { mode: 'business' });
  assert.doesNotMatch(n.messages[0].content, /non si possono creare immagini/);
}
console.log('site edit OK');
// Gioco di moto in modalità siti: lo strumento create_game è disponibile (e solo lì).
{
  first = null; const r = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Fais-moi un jeu de moto' }], mode: 'website' }) })); await r.text();
  assert.ok(first.tools.some((x) => x.function.name === 'create_game'));
  first = null; const r2 = await POST(new Request('https://w/api/chat', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Salut' }] }) })); await r2.text();
  assert.ok(!first.tools.some((x) => x.function.name === 'create_game'));
  const { motoGame } = await import('../api/_game_moto.js');
  const h = motoGame({ title: 'Rush <b>Moto</b>', theme: 'night', lang: 'it', color1: 'red' });
  assert.match(h, /<title>Rush bMoto\/b<\/title>/); assert.match(h, /"theme":"night"/); assert.match(h, /"color1":"#ff6b35"/); assert.doesNotMatch(h, /__CFG__/);
}
console.log('game OK');
