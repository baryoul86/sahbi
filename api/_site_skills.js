// 🧠 Competenze dei siti (come le "skill" di un professionista): Sahbi riconosce che tipo di sito chiede l'utente
// e riceve la ricetta di un esperto di quel settore (sezioni, funzioni, stile, testi).
// Solo testo per il modello: nessun dato dell'utente, nessuna chiave.

const COMMON = `
PROCESSO DA PROFESSIONISTA (sempre, in silenzio, prima di scrivere il codice):
1. Capisci chi è il cliente del sito e cosa deve fare il visitatore (chiamare, prenotare, comprare, scrivere su WhatsApp).
2. Scegli uno stile coerente col settore: 2 colori + 1 colore d'accento, 1 font per i titoli e 1 per i testi (Google Fonts con <link>), spazi generosi, angoli e ombre morbide.
3. Scrivi testi VERI e specifici (nome, città, prodotti, prezzi realistici se l'utente non li dà, segnati come esempio da modificare): MAI "Lorem ipsum", MAI "Votre texte ici", MAI "Titre 1".
4. Mobile prima di tutto: si legge bene a 360 px di larghezza, niente scorrimento orizzontale (max-width:100%, img{max-width:100%;height:auto}, flex-wrap, grid con minmax), pulsanti alti almeno 44 px, menu a hamburger che funziona.
5. Ogni pulsante e ogni link fa qualcosa di vero: tel:, https://wa.me/NUMERO?text=..., mailto:, #sezione, oppure apre un pannello. Nessun href="#" vuoto.
6. Prima di consegnare ricontrolla: HTML completo fino a </html>, nessun errore JavaScript, nessun testo "undefined"/"NaN", tutte le immagini con https://www.sahbi.bond/img?..., alt sulle immagini, <meta name="viewport">, <title> e <meta name="description">.`;

const SKILLS = [
  {
    id: 'ristorazione',
    re: /restau|resto\b|pizz|caf[eéè]|coffee|boulang|bakery|panett|patiss|pasticc|snack|fast.?food|burger|tacos|kebab|traiteur|catering|sushi|cuisine|cucina|ristor|bar\b|brasserie|food.?truck|مطعم|مقهى|حلويات|مخبزة/i,
    text: `COMPETENZA ATTIVA – RISTORANTE / CAFFÈ / PANETTERIA:
- Sezioni: hero con foto grande del piatto/locale + pulsanti "Réserver" e "Commander sur WhatsApp"; menu a categorie (antipasti/piatti/dolci/bevande) con nome, breve descrizione e PREZZO allineato; piatti del giorno o specialità; galleria foto; orari con indicazione "Ouvert maintenant / Fermé" calcolata in JavaScript; indirizzo con mappa (iframe https://www.openstreetmap.org/export/embed.html?bbox=...&layer=mapnik oppure link Google Maps); recensioni (3, segnate come esempio); contatti.
- Funzioni: filtro del menu per categoria, pulsante WhatsApp fisso in basso a destra, modulo di prenotazione (nome, persone, data, ora) che apre WhatsApp con il messaggio già scritto.
- Stile: colori caldi e appetitosi, font elegante per i titoli (Playfair Display, DM Serif) e leggibile per il testo; foto con query in inglese (es. q=couscous,food).`,
  },
  {
    id: 'negozio',
    re: /boutique|shop|negozio|magasin|vente|vendre|e-?commerce|catalog|prodott|produit|vêtement|vestit|abbigliam|cosm[eé]ti|parfum|profum|bijou|gioiell|chaussure|scarpe|متجر|محل|بيع/i,
    text: `COMPETENZA ATTIVA – NEGOZIO / CATALOGO:
- Sezioni: hero con l'offerta principale; categorie; griglia prodotti (foto, nome, prezzo, eventuale prezzo barrato, etichetta "Nouveau"/"Promo"); vantaggi (consegna, pagamento alla consegna, reso); recensioni; FAQ (consegna, pagamento, taglie); contatti.
- Funzioni in JavaScript: filtro per categoria + ricerca; scheda prodotto in un pannello; CARRELLO vero (aggiungi/togli/quantità, totale calcolato, salvato in localStorage dentro try/catch) con pulsante "Commander sur WhatsApp" che manda la lista dei prodotti e il totale; contatore del carrello nell'intestazione.
- MAI moduli che chiedono numeri di carta o password: l'ordine passa da WhatsApp o dal telefono.
- Stile: pulito e moderno, molto spazio bianco, foto prodotto con lo stesso formato (aspect-ratio).`,
  },
  {
    id: 'bellezza',
    re: /coiff|parrucch|barb|salon|beaut|bellezz|esth[eé]ti|estetist|nail|ongl|unghie|spa\b|massag|hammam|maquill|trucco|lash|ciglia|حلاق|تجميل|حمام/i,
    text: `COMPETENZA ATTIVA – SALONE / BELLEZZA / BENESSERE:
- Sezioni: hero raffinato; servizi con durata e prezzo (tabella o carte); prima/dopo o galleria; il team; orari; recensioni; contatti con mappa.
- Funzioni: PRENOTAZIONE in 3 passi (servizio → giorno → orario tra fasce proposte) che apre WhatsApp con il riepilogo; pulsante chiamata; lista prezzi filtrabile.
- Stile: elegante e morbido (beige, rosa antico, oro o nero/oro per i barbieri), font Cormorant/Playfair per i titoli, animazioni leggere all'apparire.`,
  },
  {
    id: 'artigiano',
    re: /plomb|idraul|électric|elettric|garage|m[eé]cani|carross|ma[cç]on|murator|b[aâ]timent|edil|construct|r[eé]novat|ristruttur|peintre|pittor|menuis|falegn|nettoyage|pulizi|jardin|giardin|d[eé]m[eé]nag|trasloc|serrur|fabbro|climatis|artisan|artigian|بناء|ميكانيك|سباك/i,
    text: `COMPETENZA ATTIVA – ARTIGIANO / SERVIZI:
- Sezioni: hero con promessa chiara ("Intervention rapide à Lyon") + pulsante CHIAMA grande; servizi con icone (SVG semplici o emoji); perché sceglierci (anni di esperienza, garanzia, preventivo gratuito); realizzazioni (galleria prima/dopo); zona servita; recensioni; modulo di PREVENTIVO (tipo di lavoro, città, descrizione) che apre WhatsApp o mailto.
- Funzioni: barra fissa in basso su mobile con "Appeler" e "WhatsApp"; contatori animati (clienti, anni); FAQ a fisarmonica.
- Stile: serio e affidabile (blu, grigio antracite, giallo/arancio d'accento), font robusto (Montserrat, Poppins).`,
  },
  {
    id: 'portfolio',
    re: /portfolio|cv\b|curriculum|photograph|fotograf|vid[eé]ast|designer|graphiste|grafic|freelance|artiste|artista|musici|chanteur|cantant|influenc|site perso|sito personale|personal (?:site|website|page)|سيرة|مصور/i,
    text: `COMPETENZA ATTIVA – PORTFOLIO / PERSONALE:
- Sezioni: presentazione d'impatto (nome grande, ruolo, foto); lavori in griglia con filtri per categoria e LIGHTBOX (clic → immagine grande, frecce, chiudi con ✕ e con Esc); competenze o servizi; percorso (timeline); testimonianze; contatto.
- Funzioni: lightbox funzionante su touch (swipe), animazioni all'apparire con IntersectionObserver, pulsante "Télécharger mon CV" se è un CV (link a #contact se non c'è il file).
- Stile: minimalista e audace, molto spazio, tipografia grande (Inter/Space Grotesk/Syne), tema chiaro o scuro coerente.`,
  },
  {
    id: 'turismo',
    re: /h[oô]tel|riad|g[iî]te|maison d.h[oô]te|b&b|airbnb|location de vacances|agenzia viagg|voyage|\btours?\b|excursion|escursion|camping|desert|désert|safari|فندق|رياض|سياحة/i,
    text: `COMPETENZA ATTIVA – HOTEL / RIAD / TURISMO:
- Sezioni: hero a tutto schermo con foto evocativa; camere o tour (foto, capienza, servizi, prezzo "à partir de"); servizi (colazione, piscina, wifi, transfer); galleria; attività nei dintorni; recensioni; posizione con mappa; prenotazione.
- Funzioni: modulo di prenotazione (arrivo, partenza, persone, camera) con calcolo delle notti e prezzo indicativo, invio su WhatsApp; galleria con lightbox; selettore lingua FR/EN/AR se l'utente lo chiede.
- Stile: lusso caldo (terracotta, sabbia, verde oliva, oro), font Cormorant Garamond + Lato.`,
  },
  {
    id: 'salute',
    re: /m[eé]dec|medic|dentist|clinique|clinica|cabinet|kin[eé]|fisioterap|psy|pharmac|farmac|infirm|infermier|nutrition|dietist|v[eé]t[eé]rin|طبيب|عيادة|صيدلية/i,
    text: `COMPETENZA ATTIVA – SALUTE / STUDIO MEDICO:
- Sezioni: hero rassicurante; specialità e cure; il professionista (titoli, esperienza); orari e urgenze; come arrivare (mappa); domande frequenti; presa di appuntamento.
- Funzioni: modulo di richiesta appuntamento (motivo, giorno preferito) che apre WhatsApp/telefono; pulsante chiamata ben visibile. Niente promesse mediche, niente dati sanitari salvati.
- Stile: pulito e calmo (bianco, azzurro, verde acqua), font leggibile (Nunito, Source Sans), contrasto alto.`,
  },
  {
    id: 'sport',
    re: /sport|salle de sport|palestra|gym|fitness|coach|yoga|pilates|boxe|box\b|karat|judo|football|calcio|club|danse|danza|piscine|piscina|رياضة|نادي/i,
    text: `COMPETENZA ATTIVA – SPORT / PALESTRA / COACH:
- Sezioni: hero energico; discipline/corsi; PLANNING settimanale (tabella giorni × orari, filtrabile per disciplina); coach; abbonamenti e prezzi (3 formule, quella consigliata evidenziata); trasformazioni/testimonianze; prova gratuita; contatti.
- Funzioni: filtro del planning, calcolatore semplice (es. IMC) se pertinente, modulo "Séance d'essai" su WhatsApp.
- Stile: dinamico (nero + colore acceso), font Bebas Neue/Oswald per i titoli, foto d'azione.`,
  },
  {
    id: 'evento',
    re: /mariage|matrimon|wedding|fian[cç]|anniversaire|complean|f[eê]te|festa|événement|evento|soirée|serata|conf[eé]rence|festival|invitation|invito|عرس|زفاف|حفلة/i,
    text: `COMPETENZA ATTIVA – EVENTO / MATRIMONIO / INVITO:
- Sezioni: hero con nomi/titolo e data; CONTO ALLA ROVESCIA vero in JavaScript; programma (orari); luogo con mappa e indicazioni; galleria; RSVP (nome, numero di persone, presenza sì/no, messaggio) inviato su WhatsApp; dress code, alloggi, FAQ.
- Stile: emozionale e curato (avorio, oro, verde salvia o i colori scelti), font calligrafico solo per i nomi (Great Vibes) + font leggibile.`,
  },
  {
    id: 'immobiliare',
    re: /immobil|agence immo|real estate|appartament|appartement|maison à vendre|casa in vendita|location appart|affitt|terrain|terreno|villa|عقار|شقة/i,
    text: `COMPETENZA ATTIVA – IMMOBILIARE:
- Sezioni: ricerca in evidenza; annunci (foto, prezzo, città, superficie, camere, bagni) con etichetta Vendita/Affitto; scheda annuncio in un pannello con galleria; servizi dell'agenzia; stima gratuita; contatti.
- Funzioni: FILTRI veri (tipo, città, prezzo max, camere) che aggiornano la lista in JavaScript; calcolatore di mutuo semplice; pulsante "Visiter" che apre WhatsApp con il riferimento dell'annuncio.
- Stile: professionale (blu notte, bianco, oro), font Montserrat.`,
  },
  {
    id: 'scuola',
    re: /[eé]cole|scuola|school|cours\b|corsi|formation|formazion|universit|soutien scolaire|ripetizion|auto-?[eé]cole|association|associazion|ong\b|mosqu[eé]e|moschea|église|chiesa|مدرسة|جمعية|تكوين|مسجد/i,
    text: `COMPETENZA ATTIVA – SCUOLA / FORMAZIONE / ASSOCIAZIONE:
- Sezioni: missione; corsi o attività (livello, durata, prezzo o "gratuit"); calendario/prossimi eventi; team; numeri chiave; testimonianze; iscrizione o "Faire un don"/"Devenir bénévole"; contatti.
- Funzioni: modulo d'iscrizione (corso, nome, telefono) su WhatsApp/mailto; FAQ a fisarmonica; contatori animati.
- Stile: accogliente e chiaro, colori vivaci ma sobri, font Nunito/Poppins.`,
  },
  {
    id: 'startup',
    re: /startup|start-up|landing|application mobile|app mobile|saas|logiciel|software|lancement|lancio|produit digital|prodotto digitale|agence web|agenzia|marketing|تطبيق|شركة ناشئة/i,
    text: `COMPETENZA ATTIVA – LANDING PAGE / APP / STARTUP:
- Sezioni: hero con titolo-beneficio + sottotitolo + 2 pulsanti (principale e secondario) + mockup del prodotto disegnato in HTML/CSS; loghi o numeri di fiducia; 3-6 funzioni con icone; come funziona in 3 passi; prezzi (2-3 formule, mensile/annuale con interruttore che cambia i prezzi); testimonianze; FAQ; invito finale; footer completo.
- Funzioni: interruttore prezzi, FAQ a fisarmonica, animazioni all'apparire, modulo d'iscrizione alla lista d'attesa (solo e-mail, messaggio di conferma sullo schermo).
- Stile: moderno (sfumature, vetro smerigliato, tema scuro o chiaro), font Inter/Plus Jakarta Sans.`,
  },
];

// Testo delle ultime richieste dell'utente → competenza adatta (al massimo una) + processo comune.
export function siteSkill(messages = []) {
  const text = messages.filter((m) => m?.role === 'user' && typeof m.content === 'string').slice(-6).map((m) => m.content).join('\n').slice(-3000);
  // Si guarda prima l'ultima richiesta, poi tutta la conversazione (il tipo di sito si dice spesso all'inizio).
  const last = messages.filter((m) => m?.role === 'user' && typeof m.content === 'string').at(-1)?.content || '';
  // Giochi: ci sono già le regole dei giochi, niente ricetta di settore.
  if (/\b(jeu|jeux|gioco|giochi|game|games|juego)\b|لعبة/i.test(last)) return { id: 'gioco', prompt: '' };
  const hit = SKILLS.find((s) => s.re.test(last)) || SKILLS.find((s) => s.re.test(text));
  return { id: hit?.id || null, prompt: `\n${COMMON}\n${hit ? `\n${hit.text}\n` : ''}` };
}

export const SKILL_IDS = SKILLS.map((s) => s.id);
