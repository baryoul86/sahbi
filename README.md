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
- `conditions-utilisation.html`, `confidentialite.html`: pagine legali (da completare dove c'è scritto `[...]`)
- `api/`: il server su Vercel, che custodisce tutte le chiavi
  - `chat.js` risposte, foto e immagini · `me.js` piano e limiti · `speak.js` voce · `transcribe.js` microfono
  - `library.js` galleria · `referral.js` inviti · `account.js` cancellazione account · `config.js` dati pubblici
  - `checkout.js` (pagamento e gestione abbonamento), `stripe-webhook.js`, `chargily-webhook.js`: pagamenti
  - Limite del piano gratuito di Vercel: massimo 12 file in `api/` (quelli che iniziano con `_` non contano)
- `supabase/schema.sql`, `002_pro.sql`, `003_video.sql`, `004_memory.sql`: il database (da eseguire in quest'ordine)
- Memoria di Sahbi (`api/_memory.js`): ricordi visibili e cancellabili in Paramètres
- Mode Bac, biglietti di auguri, orari di preghiera (AlAdhan.com, dal telefono), conversazione a voce (Pro),
  documenti PDF/Word letti sul telefono (Pro), PDF di CV e lettere con la stampa del telefono, abbonamento annuale
- Video di 8 secondi (solo Pro, 5 al mese) con Pruna P-Video: `api/_video.js`, attivi solo con `PRUNA_API_KEY` su Vercel

Nessuna libreria da installare. Variabili: vedi `.env.example`. Guida al lancio: `LANCIO.md`.
