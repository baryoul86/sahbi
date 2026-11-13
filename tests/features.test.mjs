// Prova: documenti, memoria, voce, abbonamento annuale (fetch finto).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
Object.assign(process.env, {
  SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'sk-test',
  STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID: 'price_month', STRIPE_PRICE_ID_YEAR: 'price_year', CHARGILY_SECRET_KEY: 'chg', PUBLIC_URL: 'https://sahbi.bond',
});
const U = '11111111-1111-1111-1111-111111111111';
let pro = true, credits = 0, memory = ['S’appelle Yacine'], lastChat = null, extractCalls = 0, stripeBody = null, chargilyBody = null, addDays = null;
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  const body = typeof opt.body === 'string' ? (() => { try { return JSON.parse(opt.body); } catch { return opt.body; } })() : null;
  if (url.endsWith('/auth/v1/user')) return J({ id: U, email: 'a@b.c' });
  if (url.includes('/rpc/get_profile')) return J({ pro_until: pro ? '2099-01-01' : null, referral_code: 'X', referrals: 0, stripe_customer_id: null });
  if (url.includes('/rpc/use_credit')) { credits++; return J(10); }
  if (url.includes('/rpc/remaining')) return J(3);
  if (url.includes('/rpc/record_payment')) return J(true);
  if (url.includes('/rpc/add_pro_days')) { addDays = body.p_days; return J('2027-01-01'); }
  if (url.startsWith('https://sb.test/rest/v1/memories')) {
    if (opt.method === 'POST') { memory = body.facts; return new Response(null, { status: 201 }); }
    return J([{ facts: memory }]);
  }
  if (url.endsWith('/chat/completions')) {
    if (body.response_format?.type === 'json_object') { extractCalls++; return J({ choices: [{ message: { content: JSON.stringify({ add: ['Vit à Oran', 'En terminale sciences expérimentales'], replace: [] }) } }] }); }
    lastChat = body;
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Wakha Yacine !' } }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
  }
  if (url.startsWith('https://api.stripe.com/v1/checkout/sessions')) { stripeBody = new URLSearchParams(opt.body); return J({ url: 'https://checkout.stripe.test/x' }); }
  if (url.startsWith('https://pay.chargily.net/api/v2/checkouts')) { chargilyBody = body; return J({ checkout_url: 'https://pay.chargily.test/x' }); }
  throw new Error('fetch inatteso ' + url);
};
const req = (path, init = {}) => new Request(`https://sahbi.bond${path}`, { ...init, headers: { authorization: 'Bearer tok', 'content-type': 'application/json', ...(init.headers || {}) } });
const chat = (await import('../api/chat.js')).POST;
const meMod = await import('../api/me.js');
const checkout = (await import('../api/checkout.js')).POST;
const chargilyHook = (await import('../api/chargily-webhook.js')).POST;
const frames = (t) => t.split('\u001e').filter((_, i) => i % 2).map((s) => JSON.parse(s));

// 1) Documento da utente gratis → 402, nessun credito usato
pro = false; credits = 0;
let r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Résume' }], doc: { name: 'cours.pdf', text: 'Le théorème de Pythagore dit que...' } }) }));
assert.equal(r.status, 402); assert.equal((await r.json()).error, 'pro'); assert.equal(credits, 0);

// 2) Documento Pro → testo nel messaggio, memoria nel prompt di sistema, stile voce
pro = true;
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Résume' }], doc: { name: 'cours.pdf', text: 'Le théorème de Pythagore dit que a²+b²=c².' }, voice: true }) }));
let txt = await r.text();
const last = lastChat.messages.at(-1).content;
assert.match(last, /\[Document « cours\.pdf »\]/); assert.match(last, /Pythagore/);
assert.match(lastChat.messages[0].content, /S’appelle Yacine/); assert.match(lastChat.messages[0].content, /conversazione a voce/);
assert.match(lastChat.messages[0].content, /Mode Bac/); assert.match(lastChat.messages[0].content, /Biglietti di auguri/);
assert.equal(extractCalls, 0, 'nessuna estrazione se il messaggio non parla di sé');
assert.equal(txt, 'Wakha Yacine !');

// 3) Documento troppo lungo → tagliato
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Résume' }], doc: { name: 'x.pdf', text: 'a'.repeat(70000) } }) }));
await r.text(); assert.match(lastChat.messages.at(-1).content, /seul le début/); assert.ok(lastChat.messages.at(-1).content.length < 61000);

// 4) Messaggio su di sé → memoria aggiornata + frame "memory"
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: "J'habite à Oran et je prépare le bac sciences" }] }) }));
txt = await r.text();
assert.equal(extractCalls, 1); assert.deepEqual(frames(txt).map((f) => f.type), ['memory']);
assert.deepEqual(memory, ['S’appelle Yacine', 'Vit à Oran', 'En terminale sciences expérimentales']);
assert.ok(!lastChat.messages[0].content.includes('conversazione a voce'), 'stile voce solo se richiesto');

// 5) /api/me mostra i ricordi; DELETE uno e tutti
r = await meMod.GET(req('/api/me')); let d = await r.json(); assert.equal(d.memory.length, 3);
r = await meMod.DELETE(req('/api/me?memory=1', { method: 'DELETE' })); d = await r.json(); assert.deepEqual(d.memory, ['S’appelle Yacine', 'En terminale sciences expérimentales']);
r = await meMod.DELETE(req('/api/me?memory=all', { method: 'DELETE' })); d = await r.json(); assert.deepEqual(d.memory, []);

// 6) Abbonamento annuale con carta e con Edahabia
r = await checkout(req('/api/checkout', { method: 'POST', body: JSON.stringify({ provider: 'stripe', plan: 'year' }) }));
assert.equal(r.status, 200); assert.equal(stripeBody.get('line_items[0][price]'), 'price_year');
r = await checkout(req('/api/checkout', { method: 'POST', body: JSON.stringify({ provider: 'stripe' }) }));
assert.equal(stripeBody.get('line_items[0][price]'), 'price_month');
r = await checkout(req('/api/checkout', { method: 'POST', body: JSON.stringify({ provider: 'chargily', plan: 'year' }) }));
assert.equal(chargilyBody.amount, 10000); assert.equal(chargilyBody.metadata.plan, 'year');

// 7) Webhook Chargily: 365 giorni solo se l'importo annuale è stato pagato davvero
const hook = async (data) => {
  const raw = JSON.stringify({ type: 'checkout.paid', data });
  const sig = crypto.createHmac('sha256', 'chg').update(raw).digest('hex');
  return chargilyHook(new Request('https://sahbi.bond/api/chargily-webhook', { method: 'POST', body: raw, headers: { signature: sig } }));
};
await hook({ id: 'c1', amount: 10000, currency: 'dzd', metadata: { user_id: U, plan: 'year' } }); assert.equal(addDays, 365);
await hook({ id: 'c2', amount: 1000, currency: 'dzd', metadata: { user_id: U, plan: 'year' } }); assert.equal(addDays, 30, 'importo mensile con metadata annuale → 30 giorni');
await hook({ id: 'c3', amount: 1000, currency: 'dzd', metadata: { user_id: U } }); assert.equal(addDays, 30);

console.log('Tutti i test delle nuove funzioni OK');
