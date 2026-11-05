import { json, fail, getUserId, deleteAccount } from './_lib.js';

// Cancella l'account dell'utente collegato, con tutte le sue immagini.
export async function DELETE(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Sessione scaduta. Ricarica la pagina.');
  try {
    await deleteAccount(userId);
    return json({ ok: true });
  } catch (e) {
    console.error('Cancellazione account', e.message);
    return fail('upstream', 502, 'Impossible de supprimer le compte maintenant.');
  }
}
