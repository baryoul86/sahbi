# Sahbi – Maghreb AI

Assistente di intelligenza artificiale che risponde nella lingua dell'utente (darija, arabo, francese, inglese e tutte le altre).

- Chat che risponde nella lingua in cui si scrive o si parla
- Microfono: la voce diventa testo
- Generazione di immagini: 8 al giorno, ricaricate a mezzanotte (ora del Maghreb)
- Abbonamento Sahbi Plus: 6,50 € al mese (pagamento in arrivo)

## Come è fatta

- `index.html`: l'app (una sola pagina, installabile sul telefono)
- `api/`: il server su Vercel. Custodisce la chiave di OpenAI, che non arriva mai al telefono
  - `chat.js` risposte di Sahbi · `image.js` immagini e limite giornaliero · `transcribe.js` microfono · `config.js` dati pubblici
- `supabase/schema.sql`: il database dei limiti giornalieri

Nessuna libreria da installare.

## Messa online (una volta sola)

1. **Supabase**: nuovo progetto `sahbi`. Poi:
   - *SQL Editor › New query*: incolla `supabase/schema.sql` e premi *Run*
   - *Authentication › Sign In / Providers*: attiva **Allow anonymous sign-ins**
   - *Project Settings › API*: copia Project URL, chiave `anon` e chiave `service_role`
2. **OpenAI**: crea una chiave API e imposta un limite di spesa mensile.
3. **Vercel**: *Add New › Project* › importa `sahbi` da GitHub. In *Environment Variables* aggiungi i nomi di `.env.example` con i valori veri, poi *Deploy*.

Le chiavi vanno solo nelle impostazioni di Vercel, mai nel codice o in chat.
