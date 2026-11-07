# App Android di Sahbi (Google Play)

L'app è una Trusted Web Activity: apre https://sahbi.bond a schermo intero, con l'icona di Sahbi.
GitHub la costruisce da solo (`.github/workflows/android.yml`) a ogni modifica di questa cartella,
oppure da Actions → "App Android (Google Play)" → "Run workflow".

- `twa-manifest.json`: nome, colori, icone, indirizzo di partenza (`/?source=android`).
- Chiave di caricamento: cifrata nel ramo `android-key`, si apre solo con il segreto `SAHBI_KEY_PASSWORD`.
- Risultato: Actions → ultima esecuzione → "Artifacts" → `sahbi-android-N` (file `.aab` per Google Play, `.apk` per provare).
- Impronta della chiave: ramo `android-build`, file `sha256.txt` (va su Vercel in `ANDROID_SHA256`,
  insieme all'impronta "App signing key" che Google Play mostra in Configurazione → Integrità dell'app).
