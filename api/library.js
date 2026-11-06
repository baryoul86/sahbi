import { json, fail, getUserId, listImages, deleteImage } from './_lib.js';
import { checkVideo } from './_video.js';

// Galleria delle immagini e dei video creati dall'utente.
// GET /api/library?video=ID → a che punto è un video in creazione.
export async function GET(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const video = new URL(request.url).searchParams.get('video');
  try {
    if (video) return json(await checkVideo(userId, video));
    return json({ images: await listImages(userId) });
  } catch (e) {
    console.error('Galleria', e.message);
    if (video) return json({ status: 'pending' });
    return fail('upstream', 502, 'Impossible de charger tes images.');
  }
}

// Cancella un'immagine o un video: DELETE /api/library?id=...
export async function DELETE(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const id = new URL(request.url).searchParams.get('id');
  return (await deleteImage(userId, id)) ? json({ ok: true }) : fail('not_found', 404, 'Image introuvable.');
}
