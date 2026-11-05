# Guida al lancio di Sahbi

Le chiavi vanno sempre e solo in **Vercel › sahbi › Settings › Environment Variables**, poi **Redeploy**. Mai in chat o nel codice.

## 1. Database (una volta)
Supabase › SQL Editor › New query: incolla `supabase/002_pro.sql` › Run.

## 2. Pagamento con carta: Stripe
1. Crea l'account su stripe.com (serve un'attività o partita IVA in un paese supportato).
2. Product catalog › Add product: "Sahbi Pro", prezzo ricorrente mensile 6,50 €. Copia l'ID del prezzo (`price_...`) → `STRIPE_PRICE_ID`.
3. Developers › API keys: chiave segreta (`sk_live_...`) → `STRIPE_SECRET_KEY`.
4. Developers › Webhooks › Add endpoint: `https://IL-TUO-DOMINIO/api/stripe-webhook`, eventi `checkout.session.completed` e `invoice.paid`. Copia il "Signing secret" (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.
5. Settings › Billing › Customer portal: attivalo (serve per "Gérer" in Paramètres).
6. `PUBLIC_URL` = indirizzo dell'app (es. `https://sahbi.app`).

Prova prima in modalità test (chiavi `sk_test_...`, carta 4242 4242 4242 4242).

## 3. Edahabia / CIB: Chargily Pay
1. Crea l'account su chargily.com (richiede un'attività registrata in Algeria).
2. Copia la chiave segreta → `CHARGILY_SECRET_KEY`.
3. Per le prove: `CHARGILY_API_URL=https://pay.chargily.net/test/api/v2` e la chiave di test.
4. Prezzo: `CHARGILY_PRICE_DZD` (predefinito 1000 DA per 30 giorni).
Il webhook è impostato automaticamente a ogni pagamento (`/api/chargily-webhook`).

## 4. Dominio
Compra il dominio (Cloudflare, Namecheap…). Vercel › sahbi › Settings › Domains › Add, e segui le istruzioni DNS.
Poi aggiorna: `PUBLIC_URL` su Vercel e **Site URL** in Supabase › Authentication › URL Configuration.

## 5. E-mail vere: Resend
1. resend.com › aggiungi il dominio e i record DNS indicati.
2. Crea una chiave API.
3. Supabase › Authentication › Emails › SMTP Settings: host `smtp.resend.com`, porta `465`, utente `resend`, password = chiave API, mittente `ciao@il-tuo-dominio`.
4. Ora puoi modificare i modelli **Magic link** e **Confirm signup** e aggiungere il codice `{{ .Token }}`.

## 6. Google Play
1. Account sviluppatore Google Play (25 $ una volta).
2. Vai su pwabuilder.com, inserisci l'indirizzo dell'app › Package for stores › Android. Scarica il pacchetto.
3. Metti il file `assetlinks.json` del pacchetto in `.well-known/assetlinks.json` di questo progetto (lo aggiungo io).
4. Carica il file `.aab` su Google Play Console, con le pagine `/conditions.html` e `/confidentialite.html` come link legali.

## 7. Pubblicità: Google AdSense
1. Serve il dominio proprio (Google non accetta indirizzi `.vercel.app`) e le pagine legali complete.
2. adsense.google.com › aggiungi il sito e attendi l'approvazione (da qualche giorno a qualche settimana).
3. Annunci › Per unità pubblicitaria › Display, formato orizzontale. Copia `ca-pub-...` → `ADSENSE_CLIENT` e il numero `data-ad-slot` → `ADSENSE_SLOT`.
4. Il file `/ads.txt` si crea da solo con il tuo codice.
5. Per gli utenti in Europa Google richiede un banner di consenso cookie certificato: in AdSense › Privacy e messaggi › Europa, attiva il messaggio di consenso di Google.
6. Regola importante: la pubblicità di Google non va ricaricata da sola. Sahbi carica un annuncio per apertura dell'app; le promozioni di Sahbi invece girano ogni minuto.

## 8. Prima del lancio
- Completa i campi `[...]` nelle pagine legali (meglio con un consulente).
- Su OpenAI: limite di spesa mensile e, se le immagini danno errore, verifica dell'organizzazione.
