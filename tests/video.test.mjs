// Prova il flusso video con fetch finto: Supabase, Pruna e OpenAI.
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.OPENAI_API_KEY = 'sk-test';
process.env.PRUNA_API_KEY = 'pk-test';

const U = '11111111-1111-1111-1111-111111111111';
let imgLiar = false, editCalls = 0, liar = false, chatty = false, forcedCalls = 0, pro = true, used = 0, rows = [], prunaStatus = 'processing', uploads = [], prunaBody = null, refunded = 0, files = 0, block = false;
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  const body = opt.body && typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
  if (url.endsWith('/auth/v1/user')) return J({ id: U, email: 'a@b.c' });
  if (url.includes('/rpc/get_profile')) return J({ pro_until: pro ? '2099-01-01' : null, referral_code: 'X', referrals: 0 });
  if (url.includes('/rpc/use_credit')) return J(5);
  if (url.includes('/rpc/use_video_credit')) { if (used >= body.p_limit) return J(-1); used++; return J(body.p_limit - used); }
  if (url.includes('/rpc/refund_video_credit')) { refunded++; used--; return J(null); }
  if (url.includes('/rpc/remaining_video_credit')) return J(Math.max(body.p_limit - used, 0));
  if (url.includes('/rpc/remaining_credit')) return J(3);
  if (url.includes('/rpc/sahbi_month')) return J('2026-11-01');
  if (url.startsWith('https://sb.test/rest/v1/images')) {
    if (opt.method === 'POST') { rows.push(body); return new Response(null, { status: 201 }); }
    if (opt.method === 'PATCH') { const id = new URL(url).searchParams.get('id').slice(3); Object.assign(rows.find((r) => r.id === id), body); return new Response(null, { status: 204 }); }
    const id = new URL(url).searchParams.get('id')?.slice(3);
    return J(rows.filter((r) => !id || r.id === id));
  }
  if (url.includes('/storage/v1/object/sign/')) return J({ signedURL: '/object/sign/images/x.mp4?token=t' });
  if (url.includes('/storage/v1/object/images/')) { uploads.push({ url, type: opt.headers['content-type'] }); return J({}); }
  if (url.endsWith('/images/edits')) { editCalls++; return J({ data: [{ b64_json: Buffer.from('jpegdata').toString('base64') }] }); }
  if (url === 'https://api.pruna.ai/v1/files') { files++; return J({ id: 'file-1', urls: { get: 'https://api.pruna.ai/v1/files/file-1' } }); }
  if (url === 'https://api.pruna.ai/v1/predictions') {
    assert.equal(opt.headers.apikey, 'pk-test'); assert.equal(opt.headers.Model, 'p-video-2');
    prunaBody = body;
    if (block) return J({ moderation: { can_disable: false } }, 422);
    return J({ id: 'p1', get_url: 'https://api.pruna.ai/v1/predictions/status/p1' }, 201);
  }
  if (url === 'https://api.pruna.ai/v1/predictions/status/p1') return J({ status: prunaStatus, generation_url: 'https://api.pruna.ai/v1/predictions/delivery/p1/output.mp4' });
  if (url.endsWith('/output.mp4')) return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { status: 200 });
  if (url.endsWith('/chat/completions')) {
    if (body.stream === false && body.tool_choice.function.name === 'create_image') { forcedCalls++; return J({ choices: [{ message: { tool_calls: [{ function: { name: 'create_image', arguments: '{"prompt":"yellow cartoon portrait","edit_photo":true}' } }] } }] }); }
    if (imgLiar) return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Perfetto, sto per trasformarla in stile Simpson ora. Creazione in corso...' } }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
    if (body.stream === false) { forcedCalls++; assert.equal(body.tool_choice.function.name, 'create_video'); return J({ choices: [{ message: { tool_calls: [{ function: { name: 'create_video', arguments: '{"prompt":"cartoon man running","from_photo":false}' } }] } }] }); }
    if (liar) return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Génial. Je lance la création du vidéo cartoon. Ça prend environ une minute.' } }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
    if (chatty) return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Une vidéo de 8 secondes, c’est court mais sympa !' } }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
    const sse = [
      { choices: [{ delta: { content: 'Ok, je crée ta vidéo !' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'create_video', arguments: '' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"prompt":"a camel walking in the Sahara at sunset","from_photo":false}' } }] } }] },
    ].map((d) => `data: ${JSON.stringify(d)}\n\n`).join('') + 'data: [DONE]\n\n';
    assert.ok(body.tools.some((t) => t.function.name === 'create_video'), 'tool video offerto');
    return new Response(sse, { status: 200 });
  }
  throw new Error('fetch inatteso ' + url);
};

const req = (path, init = {}) => new Request(`https://sahbi.bond${path}`, { ...init, headers: { authorization: 'Bearer tok', 'content-type': 'application/json', ...(init.headers || {}) } });
const chat = (await import('../api/chat.js')).POST;
const lib = (await import('../api/library.js')).GET;
const me = (await import('../api/me.js')).GET;

// 1) Chat che crea un video
let r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'fais-moi une vidéo' }] }) }));
let txt = await r.text();
const frames = txt.split('\u001e').filter((_, i) => i % 2).map((s) => JSON.parse(s));
assert.deepEqual(frames.map((f) => f.type), ['video_start', 'video']);
const vid = frames[1];
assert.equal(vid.remaining, 4); assert.equal(vid.limit, 5);
assert.equal(prunaBody.input.duration, 8); assert.equal(prunaBody.input.disable_safety_filter, false); assert.equal(prunaBody.input.aspect_ratio, '9:16');
assert.equal(rows[0].status, 'pending'); assert.equal(rows[0].kind, 'video');

// 2) Ancora in corso
r = await lib(req(`/api/library?video=${vid.id}`)); assert.deepEqual(await r.json(), { status: 'pending' });
// 3) Finito: salvato nella cartella e link restituito
prunaStatus = 'succeeded';
r = await lib(req(`/api/library?video=${vid.id}`)); let d = await r.json();
assert.equal(d.status, 'done'); assert.match(d.url, /storage\/v1\/object\/sign/);
assert.equal(uploads.length, 1); assert.equal(uploads[0].type, 'video/mp4'); assert.equal(rows[0].status, 'done');
r = await lib(req(`/api/library?video=${vid.id}`)); d = await r.json(); assert.equal(d.status, 'done'); assert.equal(uploads.length, 1, 'non ricarica due volte');

// 4) Fallito: credito restituito
rows = []; prunaStatus = 'failed';
const { startVideo, checkVideo } = await import('../api/_video.js');
let s = await startVideo(U, 'test', { pro: true, limit: 5 });
assert.ok(s.ok); const before = used;
d = await checkVideo(U, s.id); assert.equal(d.status, 'failed'); assert.equal(refunded, 1); assert.equal(used, before - 1);

// 5) Non Pro → rifiutato, nessun costo
s = await startVideo(U, 'test', { pro: false, limit: 0 }); assert.equal(s.error, 'pro');
// 6) Limite del mese
used = 5; s = await startVideo(U, 'test', { pro: true, limit: 5 }); assert.equal(s.error, 'limit');
// 7) Bloccato dalla moderazione → credito restituito
used = 0; refunded = 0; block = true;
s = await startVideo(U, 'x', { pro: true, limit: 5 }); assert.equal(s.error, 'blocked'); assert.equal(refunded, 1); assert.equal(used, 0);
block = false;
// 8) Da foto: caricata su Pruna, niente aspect_ratio
s = await startVideo(U, 'animate', { pro: true, limit: 5, photo: { mime: 'image/jpeg', b64: Buffer.from('abc').toString('base64') } });
assert.ok(s.ok); assert.equal(files, 1); assert.equal(prunaBody.input.image, 'https://api.pruna.ai/v1/files/file-1'); assert.equal(prunaBody.input.aspect_ratio, undefined);

// 9) /api/me
r = await me(req('/api/me')); d = await r.json();
assert.equal(d.limits.video, 5); assert.equal(typeof d.remaining.video, 'number'); assert.equal(d.videoEnabled, true);

// 9b) Il modello promette il video senza chiamare lo strumento → lo creiamo lo stesso
liar = true; used = 0;
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'fais une vidéo' }, { role: 'assistant', content: 'Une vidéo de quoi ? Je la lance dès que tu me dis.' }, { role: 'user', content: 'ok' }] }) }));
txt = await r.text();
let fr = txt.split('\u001e').filter((_, i) => i % 2).map((s) => JSON.parse(s));
assert.deepEqual(fr.map((f) => f.type), ['video_start', 'video']); assert.equal(forcedCalls, 1); assert.equal(fr[1].prompt, 'cartoon man running');
// 9c) Parla di video senza promettere → nessun video
liar = false; chatty = true;
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'ok' }] }) }));
txt = await r.text(); assert.ok(!txt.includes('\u001e')); assert.equal(forcedCalls, 1);
chatty = false;
// 9d) Immagine promessa ("creazione in corso") dopo "Si", con la foto riallegata → trasformazione vera
imgLiar = true; const fc = forcedCalls;
const pic = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ photo: pic, photoEarlier: true, messages: [{ role: 'user', content: 'Trasformami questa foto in stile Simpson.' }, { role: 'assistant', content: 'Ti va che trasformi la foto in stile Simpson ora?' }, { role: 'user', content: 'Si' }] }) }));
txt = await r.text(); fr = txt.split('\u001e').filter((_, i) => i % 2).map((s) => JSON.parse(s));
assert.deepEqual(fr.map((f) => f.type), ['image_start', 'image'], JSON.stringify(fr)); assert.equal(forcedCalls, fc + 1); assert.equal(editCalls, 1, 'usa la foto');
// 9e) Spiegazione di una foto (niente richiesta di immagine) → nessuna immagine
r = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ photo: pic, messages: [{ role: 'user', content: 'Explique cet exercice' }] }) }));
await r.text(); assert.equal(forcedCalls, fc + 1);
imgLiar = false;
// 10) Senza chiave Pruna lo strumento video non viene offerto
delete process.env.PRUNA_API_KEY;
const { videoEnabled } = await import('../api/_video.js');
assert.equal(videoEnabled(), false);
console.log('Tutti i test video OK');
