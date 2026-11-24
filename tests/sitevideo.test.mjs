import assert from 'node:assert/strict';
// Video per i siti: solo Pro, formati e peso controllati, percorso nella cartella dell'utente.
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' });
const U = '11111111-1111-4111-8111-111111111111';
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
let pro = true, bucketPut = null;
globalThis.fetch = async (url, opt = {}) => {
  if (url.startsWith('https://sb.test/auth/v1/user')) return J({ id: U });
  if (url.includes('/rpc/get_profile')) return J({ pro_until: pro ? '2099-01-01T00:00:00Z' : null });
  if (url.includes('/rpc/')) return J(true);
  if (url.endsWith('/storage/v1/bucket/images')) { if (opt.method === 'PUT') { bucketPut = JSON.parse(opt.body); return J({}); } return J({ allowed_mime_types: ['image/jpeg', 'video/mp4'], file_size_limit: 52428800 }); }
  if (url.includes('/object/upload/sign/images/')) return J({ url: '/object/upload/sign/images/x?token=t' });
  if (url.includes('/object/sign/images/')) return J({ signedURL: '/object/sign/images/x?token=r' });
  return J([]);
};
const { POST } = await import('../api/library.js');
const req = (q, b) => new Request(`https://w/api/library?${q}`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: b ? JSON.stringify(b) : undefined });
let r = await POST(req('upload=video', { type: 'video/quicktime', size: 20e6 }));
const d = await r.json();
if (r.status !== 200) throw new Error('upload ' + r.status + JSON.stringify(d));
else {
  assert.match(d.path, new RegExp(`^${U}/site-videos/.+\\.mov$`)); assert.match(d.uploadUrl, /upload\/sign/);
  assert.ok(bucketPut.allowed_mime_types.includes('video/quicktime'));
  assert.equal((await POST(req('upload=video', { type: 'video/mp4', size: 60e6 }))).status, 413);
  assert.equal((await POST(req('upload=video', { type: 'application/x-sh', size: 10 }))).status, 400);
  r = await POST(req(`upload=done&path=${encodeURIComponent(d.path)}`)); assert.match((await r.json()).url, /token=r/);
  assert.equal((await POST(req(`upload=done&path=${encodeURIComponent('22222222-2222-4222-8222-222222222222/site-videos/a.mp4')}`))).status, 400);
}
console.log('sitevideo OK');
pro = false;
assert.equal((await POST(req('upload=video', { type: 'video/mp4', size: 1e6 }))).status, 402);
