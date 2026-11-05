# Sahbi – Maghreb AI

Assistente di intelligenza artificiale che risponde nella lingua dell'utente (darija, arabo, francese, inglese e tutte le altre).

- Chat in una sola casella: Sahbi capisce da solo se rispondere a parole o creare un'immagine
- Foto: domande sulle foto (compiti, documenti, traduzioni) e trasformazione in stili (cartoon, anime, 3D…)
- Microfono (voce → testo) e Sahbi che legge le risposte ad alta voce (Pro)
- Galleria Images, condivisione su WhatsApp, scorciatoie (Bac, CV, lettere, traduzioni)
- Registrazione con e-mail, Paramètres, cancellazione account
- Piani Gratis e Pro: pagamento con Stripe (carte, abbonamento) e Chargily (Edahabia / CIB, 30 giorni)
- Invita un amico: 7 giorni di Pro a entrambi
- Tema chiaro e scuro, installabile sul telefono

## Come è fatta

- `index.html`: l'app (una sola pagina) · `sw.js`, `manifest.webmanifest`, `icons/`: installazione sul telefono
- `conditions.html`, `confidentialite.html`: pagine legali (da completare dove c'è scritto `[...]`)
- `api/`: il server su Vercel, che custodisce tutte le chiavi
  - `chat.js` risposte, foto e immagini · `me.js` piano e limiti · `speak.js` voce · `transcribe.js` microfono
  - `library.js` galleria · `referral.js` inviti · `account.js` cancellazione account · `config.js` dati pubblici
  - `checkout.js`, `portal.js`, `stripe-webhook.js`, `chargily-webhook.js`: pagamenti
- `supabase/schema.sql` e `supabase/002_pro.sql`: il database (da eseguire in quest'ordine)

Nessuna libreria da installare. Variabili: vedi `.env.example`. Guida al lancio: `LANCIO.md`.
