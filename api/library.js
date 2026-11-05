import { json, fail, getUserId, listImages, deleteImage } from './_lib.js';

// Galleria delle immagini create dall'utente.
export async function GET(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  try {
    return json({ images: await listImages(userId) });
  } catch (e) {
    console.error('Galleria', e.message);
    return fail('upstream', 502, 'Impossible de charger tes images.');
  }
}

// Cancella un'immagine: DELETE /api/library?id=...
export async function DELETE(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  const id = new URL(request.url).searchParams.get('id');
  return (await deleteImage(userId, id)) ? json({ ok: true }) : fail('not_found', 404, 'Image introuvable.');
}
