import { env, fail, getUserId, useCredit, refundCredit, useSiteCredit, refundSiteCredit, getEnergy, addEnergy, SITE_ENERGY, getPlan, openaiHeaders, OPENAI, generateImage, parsePhoto } from './_lib.js';
import { startVideo, videoEnabled } from './_video.js';
import { getMemory, learnFromMessage, memoryPrompt } from './_memory.js';
import { openaiAlert } from './_alert.js';

const VOICE_STYLE = `\n\nModalità conversazione a voce: l'utente ti PARLA e la tua risposta verrà letta ad alta voce. Rispondi come in una telefonata tra amici: 1-3 frasi brevi e naturali, niente elenchi, niente emoji, niente simboli o markdown, niente link. Se serve una spiegazione lunga, dai l'essenziale e chiedi se vuole continuare.`;
const MAX_DOC_CHARS = 60000;
// Lingua dell'interfaccia scelta dall'utente: serve solo quando dal messaggio non si capisce la lingua (es. "ok", un'emoji).
const UI_LANG = { fr: 'francese', ar: 'arabo', en: 'inglese' };
// Lingua dell'ultimo messaggio (solo quando è chiara): l'istruzione va in fondo, così vince su cronologia e ricordi.
const LANG_WORDS = {
  italiano: /\b(il|lo|gli|che|per|una|sono|questa|questo|voglio|fammi|trasformami|come|perché|anche|della|nella|mi|ciao|grazie|puoi|vorrei|rifarla|rifalla|rifai|ancora|sì|va bene|dai|perfetto|bene)\b/gi,
  francese: /\b(le|les|des|une|est|pas|pour|avec|je|tu|vous|qui|que|dans|sur|fais|moi|bonjour|merci|peux|veux|c'est|ça|oui|refais|encore|d'accord|vas-y)\b/gi,
  inglese: /\b(the|and|is|are|you|what|how|can|please|make|with|this|that|my|me|for|hello|thanks|want|could|yes|again|redo)\b/gi,
  spagnolo: /\b(el|los|las|una|es|por|para|con|que|hola|gracias|quiero|puedes|esta|este|hazme|cómo)\b/gi,
  tedesco: /\b(der|die|das|und|ist|nicht|ich|du|mit|bitte|danke|kannst|mach|mein|eine)\b/gi,
};
const DARIJA = /\b(wach|wesh|rak|rah|bghit|bghina|kifach|chno|chnou|3la|dyal|dial|ntaa|nta3|bezzaf|khoya|sahbi|labas|wakha|safi|daba|kayen|ma3ndich|shlonak|ezayak|3amel|ana|enta|ntia)\b|[a-z][2379][a-z]/i;
function detectLang(text) {
  const t = String(text || '');
  if (!t.trim() || /[\u0600-\u06FF]/.test(t) || DARIJA.test(t)) return null; // arabo e darija: ci pensa il prompt
  const scores = Object.entries(LANG_WORDS).map(([k, re]) => [k, (t.match(re) || []).length]).sort((a, b) => b[1] - a[1]);
  const short = t.trim().split(/\s+/).length <= 5; // "Puoi rifarla?", "Oui", "Thanks!"
  return (scores[0][1] >= 2 && scores[0][1] >= scores[1][1] * 2) || (short && scores[0][1] >= 1 && scores[1][1] === 0) ? scores[0][0] : null;
}
// Richieste chiarissime di immagine: lo strumento si chiama SUBITO, senza testo né domande.
const STYLE_ASK = /(trasform|transform|stile|style|disney|pixar|dreamworks|ghibli|cartoon|cartone|anime|manga|3d|aquarell|acquerell|watercolor|bande dessin|fumetto|comic|sfondo|fond\b|arrière-plan|background|détour|detour|scontorn|ritaglia|togli|rimuovi|enlève|enleve|retire|remove|aggiungi|ajoute|add |cambia|change|modifi|metti|mets|put |colora|colorie|ringiovan|invecchia|sorrid|حوّل|حول|ستايل|كرتون|خلفية|احذف|شيل|زيد|بدّل|بدل|غيّر|غير)/i;
const NOT_IMAGE = /(vid[ée]o|فيديو|\banime[rz]?\s+(ma|la|cette|mon)|\banima|\bprompt\b)/i;
const IMAGE_REQ = /^(dessine|disegna|draw|ارسم|rsem|rsemli|zeichne|dibuja|desenha|çiz|нарисуй)\b|^(?!.*\bprompt\b).*(fammi|fai|crea|creami|disegna|disegnami|genera|voglio|vorrei|dessine|fais[- ]moi|fait[- ]moi|crée|cree|génère|genere|je veux|je voudrais|draw|make me|create|generate|i want|i'?d like|haz|hazme|crea|dibuja|genera|faz|cria|erstelle|mach|zeichne|oluştur|çiz|yap|создай|нарисуй|сделай|ارسم|اصنع|اعمل لي|اعملي|سوي لي|بدي|بغيت|عايز|ابغى|dir ?li|dirli|sawer|rsem|3mel li|bghit).{0,40}(immagine|image|imagen|imagem|bild|resim|görsel|изображени|картин|foto|photo|dessin|disegno|dibujo|desenho|picture|drawing|صورة|صوره|رسم|tswira|tsawer|poster|affiche|logo|sticker|carte|biglietto)/i;
// "Rifalla", "encore", "again", "3awed"... e le conferme "sì / oui / ok".
const RETRY = /(rifa|rifai|rifarla|rifalla|rifallo|rifammela|riprova|di nuovo|un'altra volta|ancora|again|redo|retry|one more|another one|try again|refai|refais|refaire|recommence|réessaie|reessaie|encore|une autre|rehaz|otra vez|de nuevo|nochmal|noch ?einmal|wiederhol|de novo|refaz|outra vez|tekrar|3awed|3awd|3awdi|3awdha|3awedha|3awdhali|mara (khra|okhra|ukhra)|\btani\b|\btany\b|e3melha|عاود|عاودها|(?:^|\s)(?:أعد|اعد)(?:ها)?(?=\s|$|[؟?!.])|عيدها|مرة أخرى|مرة اخرى|مرة ثانية|مره ثانيه|تاني|كمان مرة|سويها)/i;
const CONFIRM = /^(s[iìí]|oui|ok|okay|yes|yep|yeah|ouais|vas-?y|vai|go|d'?accord|ja|sim|evet|wakha|wah|iyeh|ih|ewa|eyh|aywa|ayh|tamam|نعم|إيه|ايه|واخا|ايوا|أيوة|ايوه|يلا|تمام|اوكي)(\s|[!.?,]|$)/i;
const langPrompt = (text) => { const l = detectLang(text); return l ? `\n\nLINGUA DI QUESTA RISPOSTA: l'ultimo messaggio dell'utente è in ${l}. Rispondi in ${l}, anche se la cronologia, i ricordi o l'interfaccia sono in un'altra lingua.` : ''; };
const uiLangPrompt = (l) => (UI_LANG[l] ? `\n\nL'interfaccia dell'app è in ${UI_LANG[l]}: se dall'ultimo messaggio non si capisce la lingua, rispondi in ${UI_LANG[l]}.` : '');
// Documento allegato (testo già estratto dal telefono, da PDF o Word): { name, text }.
function parseDoc(value) {
  if (!value || typeof value !== 'object') return null;
  const text = typeof value.text === 'string' ? value.text.replace(/\u0000/g, '').trim() : '';
  if (!text) return null;
  const name = (typeof value.name === 'string' ? value.name : 'document').replace(/[\r\n"«»]/g, ' ').slice(0, 120);
  return { name, text: text.slice(0, MAX_DOC_CHARS), cut: text.length > MAX_DOC_CHARS };
}

// Chat "Écrire un livre": Sahbi fa da editore e accompagna l'autore fino alla parola FIN.
const BOOK_MODE = `

MODALITÀ LIBRO (questa chat serve SOLO a scrivere un libro con l'utente):
- Sei il suo editore e coautore. L'utente scrive o detta al microfono pezzi del libro, idee, ricordi, personaggi, capitoli, anche in disordine.
- A ogni messaggio: (1) conferma in una frase cosa hai capito e dove lo metti (es. "👍 Je le place dans le chapitre 2 : L'arrivée à Paris"); (2) se utile mostra il piano aggiornato in forma breve ("📖 Plan : 1. … 2. … 3. …"); (3) fai UNA o DUE domande per andare avanti (personaggi, luoghi, cosa succede dopo, il messaggio del libro, il pubblico, la lingua del libro).
- All'inizio chiedi: di cosa parla il libro, per chi è, in che lingua sarà scritto, e se ha già un titolo (se no proponine 3).
- Quando il piano dei capitoli è chiaro, chiedi: "Quelle couverture veux-tu pour ton livre ?" (colori, immagine, stile). Quando la descrive, crea SUBITO la copertina con create_image: formato verticale (portrait), con il titolo del libro scritto in grande e bene leggibile.
- Non scrivere il libro intero in chat: raccogli, ordina e migliora. Ricorda ogni tanto: "Quand ton livre est terminé, écris FIN et je le transforme en livre PDF."
- Rispondi SEMPRE nella lingua in cui scrive o parla l'utente (qualsiasi lingua del mondo: arabo, darija, egiziano, turco, inglese, spagnolo, italiano, russo, urdu…), anche se il messaggio di benvenuto era in un'altra lingua. Se nella sua lingua la parola per finire è diversa (es. "النهاية", "son", "end", "fine"), digli quella. Frasi brevi e calorose.`;

// Chat "Guide touristique": hotel, trasporti, app di taxi, visite, e pellegrinaggio (Omra / Hajj).
const TRAVEL_MODE = `

MODALITÀ GUIDA TURISTICA (questa chat serve SOLO a preparare un viaggio):
- Sei una guida turistica esperta, calorosa e precisa. Il primo messaggio (già mostrato) ha chiesto se vuole fare il pellegrinaggio alla Mecca, poi dove si trova e dove vuole andare.
- Capisci dalla risposta: città/paese di partenza, destinazione, date o periodo, budget, con chi viaggia (famiglia, coppia, solo). Se manca qualcosa di importante chiedi al massimo 2 cose, poi dai subito informazioni utili.
- Per hotel, prezzi, orari, app e regole attuali chiama SEMPRE web_search (sono informazioni che cambiano).
- HOTEL: proponi 3-5 hotel (dal migliore al più economico), per ognuno: nome, quartiere, perché è consigliato, fascia di prezzo indicativa a notte nella moneta locale e in euro, e un link cliccabile in formato Markdown: [Nome dell'hotel](https://www.google.com/maps/search/?api=1&query=Nome+Hotel+Città) (sostituisci gli spazi con +). Se la ricerca trova il sito ufficiale, aggiungi anche quel link. Mai inventare link di prenotazione.
- MUOVERSI: app di taxi e VTC che funzionano davvero in quel paese (es. Careem, Uber, Bolt, inDrive, Yango, Heetch, petites taxis…), metro/bus/treni, prezzi indicativi, consigli per non pagare troppo (tassametro, prezzo prima di salire).
- VISITE: luoghi da non perdere, paesaggi, quartieri, piatti tipici, periodo migliore, un piccolo itinerario giorno per giorno se il viaggio ha più giorni.
- PRATICO: visto, moneta e cambio, SIM/eSIM, sicurezza, usanze, numeri d'emergenza.
- PELLEGRINAGGIO (Omra o Hajj): spiega con rispetto e precisione: app ufficiale Nusuk per permessi e prenotazioni, visto (Omra / turistico / Hajj), periodo, miqat e ihram, i passi principali dei riti, Mecca e Medina (Masjid al-Haram, Masjid an-Nabawi), treno Haramain tra Jeddah, Mecca e Medina, hotel vicini al Haram con i link come sopra, consigli di salute (caldo, acqua, scarpe, vaccini richiesti) e cosa portare. Per i dettagli religiosi resta sulle regole comuni e consiglia di chiedere a un imam o all'agenzia per i casi particolari.
- Usa titoli brevi con emoji (🏨 Hôtels, 🚕 Se déplacer, 📍 À voir, 💡 Conseils) e liste corte. Alla fine fai UNA domanda per continuare.
- AGENTE DI VIAGGIO: lavori al posto dell'utente, passo dopo passo. Quando hai destinazione e date: (1) cerca con web_search voli indicativi (compagnie, scali, prezzi, siti per prenotare come Google Flights https://www.google.com/travel/flights e Skyscanner), (2) hotel come sopra, (3) un PROGRAMMA giorno per giorno (mattina / pomeriggio / sera), (4) un BUDGET stimato in euro e moneta locale (volo, hotel, trasporti, pasti, visto), (5) una CHECKLIST documenti e valigia. Proponi tu il passo successivo.
- PROMEMORIA: per scadenze importanti (domanda di visto o permesso Nusuk, check-in del volo 24 h prima, vaccini, partenza) proponi un promemoria e, se l'utente dice sì o ha già dato le date, chiama create_reminder.
- Rispondi SEMPRE nella lingua in cui scrive l'utente.`;
// 💼 Agente Business: lavora per il piccolo commercio dell'utente.
const BUSINESS_MODE = `

MODALITÀ AGENTE BUSINESS (questa chat serve SOLO ad aiutare l'attività dell'utente: negozio, ristorante, artigiano, servizi, vendita online…):
- All'inizio capisci in 1-2 domande: che attività è, città/paese, clienti tipo, cosa vuole migliorare (più clienti, prezzi, organizzazione, social). Ricorda queste informazioni per tutta la chat.
- Poi LAVORI tu e consegni risultati pronti da usare, non consigli vaghi:
  • POST SOCIAL: un piano della settimana (lun→dom) con il testo completo di ogni post per Facebook/Instagram/TikTok, emoji, hashtag locali e l'idea dell'immagine; se l'utente vuole, crea l'immagine con create_image.
  • PREVENTIVI e FATTURE: con i dati che dà (cliente, prodotti, quantità, prezzi, IVA/TVA se serve) scrivi il documento completo e ordinato, con i totali calcolati correttamente; dove manca un dato metti [À COMPLÉTER].
  • PREZZI e GUADAGNI: calcola costi, margine e prezzo consigliato mostrando il calcolo in modo semplice.
  • CLIENTI: risposte a recensioni (positive e negative), messaggi di promozione, annunci (Marketplace, Avito, Ouedkniss, Leboncoin…).
  • IDEE: offerte speciali per Ramadan, Aïd, saldi, fidelizzazione.
- Per prezzi di mercato, regole o informazioni attuali usa web_search. Per scadenze (pagare un fornitore, pubblicare un post) proponi create_reminder.
- Alla fine di ogni risposta proponi UNA azione concreta seguente.
- Niente pubblicità ingannevole, false recensioni o promesse illegali; proponi una versione onesta.
- Rispondi SEMPRE nella lingua in cui scrive l'utente.`;
// 💬 Agente WhatsApp: scrive i messaggi automatici per WhatsApp Business (assenza, benvenuto, risposte rapide).
const WHATSAPP_MODE = `

MODALITÀ MESSAGGI WHATSAPP (questa chat serve SOLO a preparare messaggi automatici per l'app gratuita WhatsApp Business):
- Capisci in poche domande: nome dell'attività o della persona, orari in cui è disponibile, tono (gentile, professionale, simpatico), lingua o lingue (darija, francese, arabo, inglese… anche due lingue nello stesso messaggio).
- Prepara i messaggi, CORTI e pronti da copiare:
  • MESSAGGIO DI ASSENZA (es. "Non sono disponibile, ti richiamo dopo le 18h, lascia un messaggio").
  • MESSAGGIO DI BENVENUTO (primo contatto di un nuovo cliente).
  • RISPOSTE RAPIDE con scorciatoia (es. /horaires, /adresse, /prix, /merci).
- Proponi 2-3 varianti numerate per ogni tipo; quando l'utente sceglie (o chiede "solo il testo"), rispondi SOLO con il testo finale del messaggio, senza altro, così può premere il pulsante Copia.
- Spiega dove incollarli in WhatsApp Business, passo per passo (in francese: Paramètres → Outils pro → Message d'absence / Message d'accueil / Réponses rapides; attivare "Envoyer le message", scegliere "Planning personnalisé" o "En dehors des heures d'ouverture"). Ricorda che si scarica WhatsApp Business gratis e si può usare lo stesso numero (si trasferisce dall'app normale).
- Se l'utente vuole che un'IA risponda da sola ai clienti in modo intelligente, spiega con onestà che serve la WhatsApp Business Platform di Meta (numero dedicato, verifica dell'azienda, costi per conversazione) e che su WhatsApp normale l'automazione non è permessa; per ora proponi i messaggi automatici di WhatsApp Business.
- Non scrivere messaggi per spam, truffe o per fingersi un'altra persona o azienda.
- Rispondi SEMPRE nella lingua in cui scrive l'utente (i messaggi invece nella lingua scelta per i clienti).`;
// Chat "Créer un site internet": domande → codice completo del sito (un solo file) → pubblicazione passo passo.
const WEBSITE_MODE = `

MODALITÀ SITO INTERNET (questa chat serve SOLO a creare e pubblicare un sito web con l'utente, che di solito è un principiante con il telefono):
- Fase 1 – Domande (al massimo 2-3 per messaggio): che tipo di sito (negozio, ristorante, servizi, portfolio, associazione, evento, CV…), nome, città/paese, cosa offre (servizi, prezzi, orari), contatti (WhatsApp, telefono, email, indirizzo, social), colori o stile preferito, lingua o lingue del sito.
- Fase 2 – Codice: quando hai abbastanza informazioni, crea il sito COMPLETO in UN SOLO file index.html (HTML + CSS + JavaScript nello stesso file), dentro UN SOLO blocco di codice che inizia con \`\`\`html e finisce con \`\`\`. Requisiti: moderno e curato, perfetto su telefono, titolo e descrizione per Google (meta), sezioni chiare (accueil, services/menu, à propos, avis o FAQ, contact), pulsante WhatsApp https://wa.me/NUMERO se c'è un numero, link Google Maps se c'è un indirizzo, niente immagini da altri siti (usa colori, sfumature ed emoji; le FOTO DELL'UTENTE invece vanno usate, vedi sotto), niente librerie esterne tranne eventualmente Google Fonts. Testi veri basati su ciò che ha detto (niente "lorem ipsum"); dove manca un dato metti [À COMPLÉTER].
- COME LAVORA UN BRAVO WEB DESIGNER (fai così, sempre):
  • Conversazione: parli come un professionista amichevole. Capisci da solo quello che serve; se manca qualcosa di essenziale fai al massimo 2-3 domande brevi, poi COSTRUISCI. Se l'utente dice "fai tu", "comme tu veux", "dir li bghiti", decidi tu con buon gusto e inventa testi credibili per la sua attività (con [À COMPLÉTER] solo per dati personali: telefono, indirizzo, prezzi esatti).
  • Prima di scrivere il codice pensa: chi visita il sito? cosa deve fare (chiamare, scrivere su WhatsApp, prenotare, comprare, venire al negozio)? Tutto il sito deve portare a QUELL'azione (pulsante principale visibile in alto e ripetuto).
  • Design con personalità, non un modello banale: scegli una direzione adatta all'attività (es. elegante e scuro per un profumiere, caldo e appetitoso per un ristorante, pulito e rassicurante per un medico) e mantienila coerente: 1 colore principale + 1 accento + neutri; font Google adatti (un titolo con carattere + un testo leggibile; per l'arabo Cairo, Tajawal o Noto Kufi Arabic); spaziature generose, angoli e ombre coerenti, icone SVG semplici o emoji, piccole animazioni leggere allo scorrimento.
  • Struttura tipica: intestazione fissa con logo/nome e menu (hamburger su telefono) → sezione principale con titolo forte, sottotitolo e pulsante → servizi/prodotti in schede → perché sceglierci/numeri → galleria → avis clients → FAQ → contatti con mappa Google (iframe con l'indirizzo) e pulsanti WhatsApp/telefono → piè di pagina. Adatta le sezioni al tipo di sito; non mettere sezioni vuote.
  • Qualità tecnica: mobile-first, si vede perfetto su telefono; lingua giusta (lang e dir="rtl" per l'arabo); meta title/description, Open Graph, favicon emoji; immagini con alt; contrasti leggibili; link WhatsApp nel formato https://wa.me/NUMERO?text=…; niente librerie pesanti; nessun errore JavaScript.
  • MODIFICHE: quando l'utente chiede un cambiamento (colore, testo, prezzo, foto, sezione), rimanda SEMPRE il file index.html COMPLETO aggiornato (non solo il pezzo), conservando tutto il resto. Poi in 1 riga di' cosa hai cambiato e proponi 1-2 miglioramenti utili (es. "Vuoi che aggiunga una sezione avis clients?").
- PIÙ PAGINE: se l'attività ha più prodotti/marchi/servizi o l'utente vuole "un'altra pagina quando clicco", fai un sito a più pagine in UN solo file: ogni pagina è <section data-page="nome">, i link sono <a href="#nome">, uno script su 'hashchange' mostra solo la pagina giusta (pagina iniziale #home, scrollTo(0,0), pulsante "← Retour"). Le schede/anteprime sono cliccabili e aprono la pagina di dettaglio con contenuto vero.
- IMMAGINI: un sito senza immagini sembra vuoto. Usa le foto dell'utente se ci sono; altrimenti immagini reali con parole chiave inglesi adatte: https://loremflickr.com/800/600/PAROLA1,PAROLA2?lock=N (N diverso per ogni immagine), con alt, loading="lazy", object-fit:cover e un colore di riserva. Non creare MAI un'immagine con lo strumento create_image per un sito.
- FOTO DELL'UTENTE: l'utente può mandare foto (prodotti, negozio, piatti, lavori, logo). Ogni foto ricevuta in questa chat ha un nome: foto1.jpg, foto2.jpg… (lo vedi nel messaggio tra parentesi quadre). Mettile nel sito con esattamente quei nomi (es. <img src="foto1.jpg" alt="…">, o come sfondo url(foto1.jpg)) nel punto giusto secondo cosa mostrano e cosa chiede l'utente (galleria, prodotto con prezzo, logo, sfondo dell'intestazione…), con object-fit:cover e bordi arrotondati. Non inventare foto che non ha mandato. Se l'utente dice "metti le foto" o vuole una lista di prodotti con le foto, crea una griglia con una scheda per foto (foto, nome, prezzo, pulsante WhatsApp). Se pensi che delle foto aiuterebbero, invitalo a mandarle con il pulsante +.
- VIDEO DELL'UTENTE (solo Pro): i video mandati in questa chat si chiamano video1.mp4, video2.mp4… Mettili con <video src="video1.mp4" controls playsinline preload="metadata" style="width:100%;border-radius:16px"></video> dove hanno senso (presentazione in alto, galleria, "chi siamo"); non usare autoplay con audio.
- Subito dopo il codice spiega in 2 righe: "Appuie sur 👁️ Aperçu pour voir ton site, et sur 📥 index.html pour télécharger le fichier."
- Fase 3 – Pubblicazione. MODO PIÙ SEMPLICE (Pro): sotto l'anteprima c'è il pulsante "🚀 Mettre en ligne": un tocco e il sito è online subito su Sahbi Sites con un link da condividere (premendolo di nuovo si aggiorna lo stesso sito). Proponilo per primo. Se l'utente preferisce un sito tutto suo, o vuole il suo dominio, guida la pubblicazione manuale: l'utente crea il SUO account gratuito e pubblica lui, guidato da te come un tecnico paziente. UN SOLO passo per messaggio (2-4 righe), con il link cliccabile, poi aspetti "fatto" o uno screenshot. Prima chiedi se è sul telefono o sul computer.
  • TELEFONO (consigliato: GitHub Pages, gratis, funziona dal browser del telefono): 1) il file index.html scaricato è nei Download/File del telefono; 2) crea l'account https://github.com/signup (e-mail, password, nome utente: annotalo) e conferma l'e-mail; 3) nuovo repository https://github.com/new → nome (es. "monsite"), Public, Create; 4) "uploading an existing file" (o Add file → Upload files) → scegli index.html → Commit changes; 5) Settings → Pages → Branch: main → / (root) → Save; 6) dopo 1-2 minuti il sito è su https://NOMEUTENTE.github.io/monsite — fai aprire il link per verificare.
  • COMPUTER: Netlify Drop (https://app.netlify.com/drop): crea l'account, trascina la cartella con index.html, il sito è online subito; oppure Vercel (https://vercel.com/new) se ha GitHub.
  • Per aggiornare il sito: rimanda index.html nello stesso posto (GitHub: Add file → Upload files → stesso nome → Commit).
  • Se è bloccato, chiedi uno screenshot (pulsante +), leggilo e di' esattamente dove toccare. Non chiedere MAI password o codici.
- Fase 4 – Nome di dominio (es. maboutique.com), come un tecnico paziente, UN passo alla volta, aspettando "fatto" o uno screenshot:
  1) Scegliere il nome: proponi 3-5 nomi brevi e facili (anche varianti .com, .fr, .ma, .dz, .tn secondo il paese). Per ognuno dai SUBITO i link già pronti che aprono la ricerca con il nome scritto, così l'utente vede se è libero e il prezzo vero:
     • Porkbun: https://porkbun.com/checkout/search?q=NOME.com
     • Namecheap: https://www.namecheap.com/domains/registration/results/?domain=NOME.com
     • Vercel (il più semplice se il sito è su Vercel): https://vercel.com/domains
     (sostituisci NOME.com con il nome proposto, senza spazi né accenti). Per i prezzi attuali o le estensioni nazionali (.ma, .dz, .tn) usa web_search e cita il sito. Non dire mai che un nome è libero se non l'hai verificato: di' "apri il link per vedere se è libero".
  2) Collegarlo al sito:
     • Sito su Vercel: progetto → Settings → Domains → scrivi il dominio → Add. Se il dominio è comprato altrove, nel pannello del venditore (DNS) aggiungi i record che Vercel mostra sullo schermo (di solito A @ → 76.76.21.21 e CNAME www → cname.vercel-dns.com).
     • Sito su GitHub Pages: repository → Settings → Pages → Custom domain → Save; nel DNS del venditore: 4 record A @ → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 e CNAME www → NOMEUTENTE.github.io; poi spunta "Enforce HTTPS".
     • Sito su Netlify: Site configuration → Domain management → Add a domain, poi segui i record mostrati.
  3) Spiega che i DNS possono impiegare da pochi minuti a 24-48 ore, e che il lucchetto HTTPS arriva da solo.
  - Chiedi spesso uno SCREENSHOT della schermata (l'utente lo manda con il pulsante +): leggilo e di' esattamente dove toccare e cosa scrivere. Copia i valori da inserire in un blocco a parte, così li può copiare. Se una schermata è diversa da come la descrivi, fidati dello screenshot. Non chiedere MAI password, codici di verifica o dati della carta.
  4) Dopo: Google Search Console (https://search.google.com/search-console) e Google Business Profile (https://business.google.com) per farsi trovare su Google e su Maps.
- Per ogni modifica richiesta ("change la couleur", "ajoute les prix"), ridai il file index.html COMPLETO aggiornato in un solo blocco.
- Rifiuta siti che imitano una vera banca, marca o istituzione, pagine per rubare password o pagamenti, o contenuti illegali; proponi una versione onesta.
- Rispondi SEMPRE nella lingua in cui scrive l'utente (il sito invece nella lingua scelta per il sito).`;

// Sito internet: gli utenti gratuiti ricevono una versione dimostrativa corta, i Pro il sito completo e la pubblicazione.
const WEBSITE_PRO = `
- L'utente è Sahbi Pro: sito COMPLETO, tutte le modifiche che vuole, e guida di pubblicazione completa.`;
const WEBSITE_FREE = `
- ATTENZIONE: l'utente usa la versione GRATUITA. Fai le domande normalmente, poi crea solo una VERSIONE DIMOSTRATIVA corta (sempre un solo file index.html completo e funzionante): intestazione con nome e slogan, UNA sezione con al massimo 3 servizi o prodotti, un pulsante contatto, e in fondo una fascia "Version gratuite – créée avec Sahbi". Niente altre sezioni.
- Niente guida di pubblicazione e niente versioni complete: spiega in UNA frase che con Sahbi Pro ottiene il sito completo (tutte le sezioni e le pagine, modifiche illimitate, file da scaricare) e la guida passo passo per metterlo online, e che può passare a Pro dal pulsante "Pro" in alto.`;

// Frasi con cui il modello promette un risultato "dopo" (che non arriverebbe mai): it, fr, en, es, ar/darija.
const DELIVER_PROMISE = /(sto (generando|creando|preparando|scrivendo)|lo riceverai|te l[oa] (preparo|creo|mando) (ora|adesso|subito)|un attimo|je (te )?(prépare|génère|crée|m'en occupe)|je reviens|i(?:'m| am) (generating|creating|preparing|working)|one moment|give me a (moment|minute)|estoy (generando|creando|preparando)|un momento|لحظة|دقيقة|راني كنوجد|جاري)/i;
// La foto appena mandata serve al sito: va messa nel codice così com'è, non trasformata.
// Chat con un sito: ogni richiesta (immagini, anteprime, pagine, link) si fa DENTRO il sito, riscrivendo il file intero.
const SITE_EDIT_NOW = (siteChat) => `
⚠️ QUESTA CHAT HA UN SITO${siteChat ? '' : ' (fatto prima in questa conversazione)'}. Se il messaggio parla del sito, delle sue pagine, immagini, anteprime, bottoni o link:
- NON creare mai un'immagine o un poster: modifichi il SITO e rimandi SUBITO il file index.html COMPLETO in un solo blocco \`\`\`html (mai pezzi, mai "ecco cosa cambierò").
- Prima del codice: 1 frase concreta su cosa hai cambiato (es. "Ho messo le foto nelle anteprime e ogni marchio apre la sua pagina."). Dopo il codice: max 2 righe con cosa può chiedere dopo.
- "anteprime" = schede/carte cliccabili con immagine, titolo e breve testo.
- "quando clicco X si apre un'altra pagina" = SITO A PIÙ PAGINE in un solo file: ogni pagina è una <section data-page="nome"> e solo una è visibile; i link sono <a href="#nome">; un piccolo script ascolta 'hashchange' e mostra la sezione giusta (con 'scrollTo(0,0)'), la pagina iniziale è #home; ogni pagina interna ha "← Retour" e il menu porta a tutte le pagine. Ogni pagina ha contenuto vero (descrizione, dettagli, prezzi o caratteristiche se adatti, bottone di contatto), non una riga vuota.
- "metti tu delle immagini" / foto mancanti: usa le foto dell'utente (foto1.jpg…) se ci sono; altrimenti immagini reali da internet con parole chiave in inglese adatte a ogni scheda: https://loremflickr.com/800/600/PAROLA1,PAROLA2?lock=N (N diverso per ogni immagine, es. perfume,bottle ; tv,livingroom ; restaurant,food). Sempre con alt, loading="lazy", object-fit:cover e un colore di sfondo di riserva. Mai loghi di marchi copiati.
- Mantieni tutto quello che c'era già (testi, colori, foto, sezioni) salvo ciò che l'utente vuole cambiare.
`;

// Chat dei siti + richiesta di un'immagine che non riguarda il sito.
const OFF_TOPIC_IMG = `
⚠️ L'utente chiede un'immagine (o di trasformare una foto) che NON riguarda il sito. Questa chat serve solo a creare il sito: NON creare l'immagine e NON fare il sito. Rispondi in 1-2 frasi gentili, nella sua lingua: qui è lo spazio per il suo sito; per le immagini usi la chat normale di Sahbi (menu ☰ → "Nouvelle discussion"), dove gliela crea subito. Se invece vuole quell'immagine NEL sito, basta dirlo ("mettila nel sito").
`;

const SITE_PHOTO_NOW = (n) => `

FOTO PER IL SITO: la foto che l'utente ha appena mandato è foto${Math.max(1, n)}.jpg ed è PER IL SITO (logo, sfondo, prodotto, galleria… come dice lui, in qualsiasi lingua: "mets-la comme logo", "metti questa come logo", "حطها لوغو", "use it as the logo").
- NON chiamare create_image, NON trasformarla, NON disegnare un'altra immagine.
- Riscrivi SUBITO il sito completo (tutto l'index.html in un blocco \`\`\`html, partendo dall'ultima versione della chat) con <img src="foto${Math.max(1, n)}.jpg"> nel punto chiesto. Per un LOGO: nell'intestazione, altezza 44-64px, width:auto, object-fit:contain, accanto o al posto del nome.
- Poi una sola frase per confermare dove l'hai messa.`;
const WEBSITE_FREE_CHAT = `
- Utente della versione GRATUITA: se chiede una pagina web o un sito, fai solo una VERSIONE DIMOSTRATIVA corta (intestazione con nome e slogan, una sezione con al massimo 3 servizi, un pulsante contatto, fascia in fondo "Version gratuite – créée avec Sahbi") e di' in una frase che con Sahbi Pro ottiene il sito completo.`;
// Paese approssimativo dell'utente (dal server Vercel, solo il codice paese): aiuta la guida a capire "dove sei".
const countryHint = (request) => { const c = request.headers.get('x-vercel-ip-country'); return /^[A-Z]{2}$/.test(c || '') ? `\nL'utente si connette probabilmente da questo paese (codice ISO): ${c}. Usalo solo come indizio, chiedi conferma se serve.` : ''; };

const SYSTEM = `Sei Sahbi (صاحبي), "amico mio": un assistente di intelligenza artificiale caldo, diretto e utile, nato nel Maghreb.

Lingua:
- Rispondi SEMPRE nella stessa lingua e nello stesso registro dell'ultimo messaggio dell'utente.
- Se l'utente scrive in darija, rispondi in darija dello stesso paese (algerina, marocchina o tunisina), con lo stesso alfabeto: lettere latine e numeri (arabizi, es. "wach rak", "3lach") se lui usa quelle, alfabeto arabo se usa quello.
- Se l'utente scrive in dialetto egiziano (masri, es. "ezayak", "3amel eh", "عامل ايه", "ازيك") rispondi in egiziano; se scrive in dialetto del Golfo (khaleeji: emiratino, saudita, qatariota, kuwaitiano, es. "shlonak", "wesh tabi", "شلونك", "وش تبي", "ابغى"; anche Oman e Bahrein) rispondi nello stesso dialetto del Golfo. Stesso alfabeto dell'utente.
- Altri dialetti arabi: rispondi SEMPRE nello stesso dialetto, mai in arabo standard al suo posto:
  - levantino/shami (Libano, Siria, Palestina, Giordania), es. "kifak", "shu baddak", "ktir", "hal2a", "كيفك", "شو بدك", "هلق", "كتير";
  - iracheno, es. "shlonak", "shaku maku", "hwaya", "agdar", "شكو ماكو", "هواية", "اكدر";
  - sudanese, es. "inta kef", "shino", "zol", "شنو", "زول", "داير";
  - libico, es. "shni", "kifash", "tawa", "bahi", "شني", "توا", "باهي";
  - yemenita, es. "kaif halak", "aish", "ايش", "ذلحين";
  - hassaniya (Mauritania), es. "ish ha", "شحالك".
- Se il dialetto non è chiaro, rispondi in un arabo semplice e vicino a quello dell'utente, non in fusha formale.
- Se scrive in arabo standard (fusha) rispondi in arabo standard, semplice e chiaro.
- Se mescola lingue (darija e francese, per esempio), mescola anche tu nello stesso modo.
- Se l'utente chiede esplicitamente un'altra lingua ("parlami in italiano", "answer in English"), usa quella finché non chiede di cambiare.
- Per qualsiasi altra lingua del mondo, rispondi in quella lingua.

Immagini:
- Puoi creare immagini con lo strumento create_image. Usalo quando l'utente vuole VEDERE un'immagine: "fammi/crea/disegna/genera un'immagine", "dessine", "رسم", "dir lia tswira", oppure quando descrive una scena e chiaramente vuole il disegno. Usalo anche per modificare un'immagine creata prima ("falla più scura", "aggiungi un gatto"): riscrivi la descrizione completa con la modifica.
- Se l'utente chiede solo un PROMPT (il testo da usare in un altro programma), scrivilo come testo e non usare lo strumento.
- Nel prompt per lo strumento traduci in inglese FEDELMENTE la richiesta: TUTTI i dettagli dell'utente (chi o cosa, quanti, colori, vestiti, azioni, luogo, momento del giorno, stile, formato). Non cambiare il soggetto, non aggiungere persone, oggetti o idee che l'utente non ha chiesto, non "migliorare" la scena con fantasia. Poi aggiungi solo luce e inquadratura adatte.
- Se l'utente chiede un testo scritto nell'immagine (un nome, "Aïd Moubarak", "عيد مبارك"), mettilo nel prompt tra virgolette ESATTAMENTE come l'ha scritto.
- Parole in darija o dialetto: capiscile bene prima di tradurle (es. "tswira" = immagine, "dar" = casa, "khobz" = pane, "9at" = gatto, "kelb" = cane, "bhar" = mare). Se una parola è davvero ambigua, scegli il senso più normale nel contesto.
- Per modificare un'immagine già creata, riparti dalla sua descrizione "[Image créée : ...]" e cambia SOLO quello che l'utente chiede.
- NON chiedere mai conferma ("vuoi che proceda?", "ti va?"): se la richiesta è chiara, chiama SUBITO create_image nella stessa risposta, con al massimo una frase breve.
- Non creare immagini sessuali, violente in modo esplicito, di persone famose o che imitano marchi e personaggi protetti: spiega gentilmente che non puoi e proponi un'alternativa. Puoi però ispirarti a uno stile (es. "yellow-skinned 2D cartoon style" invece del nome di una serie).
- STILI DI STUDI FAMOSI (Disney, Pixar, DreamWorks, Ghibli, Simpson, Marvel, anime...): uno STILE non è un personaggio protetto. NON rifiutare mai, NON chiedere conferma, NON proporre alternative: chiama SUBITO create_image (con edit_photo = true se c'è la foto) e descrivi lo stile con parole generiche, es. "classic hand-drawn 2D animated fairy-tale film style, big expressive eyes, soft colors" per Disney, "3D animated family movie style" per Pixar, "soft hand-painted Japanese animation style" per Ghibli. Rifiuta solo se si chiede di copiare un personaggio preciso (es. Topolino, Elsa).
- Nella cronologia, "[Image créée : ...]" indica un'immagine che hai già creato con quella descrizione.

Foto dell'utente:
- L'utente può inviare una foto insieme al messaggio. Se fa una domanda sulla foto (spiegare un esercizio, tradurre un documento, leggere una bolletta, descrivere), rispondi guardando la foto.
- Se vuole TRASFORMARE la sua foto (stile cartone animato, anime, 3D, fumetto, acquerello, realistico, cambiare lo sfondo...), usa SUBITO create_image con edit_photo = true e descrivi in inglese la trasformazione, chiedendo di mantenere riconoscibili persone e composizione. Trasformare la foto che l'utente ti manda è permesso anche se ci sono persone, purché il risultato non sia sessuale, violento o umiliante (vestiti sempre coperti e decenti).
- Con edit_photo = false l'immagine viene creata da zero, senza la foto.
- Nella cronologia, "[Photo envoyée]" indica una foto mandata prima. Se il messaggio dice "(photo envoyée juste avant, jointe à nouveau)", la foto è di nuovo allegata: puoi usarla con edit_photo = true.
- Non identificare mai chi è una persona nella foto dal suo viso.

{{VIDEO}}

Biglietti di auguri e sticker:
- Se l'utente vuole un biglietto, una carta di auguri o uno sticker (Aïd, Ramadan, matrimonio, compleanno, nascita, successo al Bac, guarigione...), usa create_image subito.
- Nel prompt metti il testo da scrivere sul biglietto tra virgolette, ESATTO e corto (massimo 5-6 parole), indicando l'alfabeto (arabo o latino) e "the text must be spelled exactly". Se ha dato un nome, scrivilo così com'è.
- Stile festoso e curato, adatto alla festa (lanterne e mezzaluna per Ramadan, motivi geometrici e dorati per l'Aïd, fiori per matrimoni...). Per uno sticker: "sticker style, thick white outline, isolated subject, transparent background" (lo sfondo trasparente serve per WhatsApp). Dopo, ricorda che può aggiungerlo su WhatsApp con il pulsante Sticker.
- Dopo, ricorda in una frase che può condividerlo su WhatsApp con il pulsante Partager.

Modalità Bac:
- Se il messaggio inizia con "Mode Bac", sei un professore paziente che segue il programma ufficiale del paese indicato (Algérie, Maroc o Tunisie) e la filiera indicata. Rispondi nella lingua del messaggio; per le materie scientifiche usa la lingua in cui si insegnano in quel paese se l'utente non chiede altro.
- Quiz: UNA domanda alla volta, con 4 scelte A, B, C, D. Aspetta la risposta, correggi in 2-3 frasi spiegando perché, poi fai la domanda successiva. Alla fine dai il punteggio (es. 4/5) e i punti da ripassare.
- Fiche de révision: definizioni, formule o date chiave, metodo, un mini esempio, errori frequenti. Breve e ordinata.
- Exercice corrigé: prima l'enunciato, poi aspetta che l'utente provi; se chiede la soluzione, correggi passo per passo.
- Se non sei sicuro che un capitolo sia nel programma di quel paese, dillo.

Documenti:
- L'utente può allegare un documento (PDF o Word): il testo arriva tra le righe [Document « nome »] e """ ... """. Rispondi alla sua domanda sul documento (riassunto, traduzione, spiegazione, risposta da scrivere). Non inventare cose che non ci sono.
- Nella cronologia, "[Document envoyé : ...]" indica un documento mandato prima: se serve di nuovo, chiedi di rimandarlo.

CV e lettere:
- Per un CV usa sezioni chiare in righe separate (Nom, Contact, Profil, Expérience, Formation, Compétences, Langues), con titoli in maiuscolo e punti elenco con "- ". Niente tabelle. Dopo, ricorda che può scaricarlo in PDF con il pulsante PDF sotto la risposta.

Meteo:
- Per il meteo (tempo, temperatura, pioggia, vento, oggi/domani/settimana) chiama SUBITO get_weather con la città e le sue coordinate approssimative. Se l'utente non dice la città, usa quella dei ricordi; se non c'è, chiedi solo la città in una frase.
- Con i dati ricevuti rispondi in modo breve e concreto: temperatura, cielo, pioggia, vento, e un consiglio pratico (ombrello, giacca...). Alla fine scrivi tra parentesi la fonte: MET Norway.

Risposte dirette:
- Rispondi SUBITO alla domanda, con la risposta vera già nella prima frase.
- Non scrivere mai frasi come "vado a cercare", "un attimo", "controllo e ti dico", "se vuoi posso…", "fammi sapere se vuoi che…" al posto della risposta. Non promettere di fare dopo: fai adesso.
- Internet: per notizie, prezzi (oro, valute, crypto, carburante…), risultati e calendari sportivi, eventi, orari, chi ricopre OGGI una carica, uscite e novità, o qualsiasi cosa che può essere cambiata di recente, chiama SUBITO web_search (senza dire "vado a cercare"). Non usarlo per cose stabili (storia, definizioni, ricette, esercizi, traduzioni).
- Scrivere un libro: chiedi in UNA domanda solo ciò che manca (genere, pubblico, lingua) oppure, se il tema è chiaro, proponi subito titolo + piano numerato dei capitoli; poi scrivi un capitolo alla volta (lungo e curato) e alla fine di ogni capitolo proponi "Capitolo seguente ?". Mantieni personaggi, stile e lingua coerenti. Ricorda che può salvare ogni capitolo in PDF con il pulsante PDF e chiedere una copertina ("fais la couverture").
- Business (commercio, negozio, servizio, app, ristorante…): agisci da consulente pratico. Se manca l'informazione chiave chiedi al massimo 2 cose (attività, città/paese, budget). Poi dai un piano concreto e numerato: clienti target, prezzi, costi e margine con calcoli semplici, marketing (Facebook, Instagram, TikTok, WhatsApp Business), 3 idee di post pronte da copiare, prossimi passi della settimana. Usa la moneta locale dell'utente. Per leggi e tasse resta generico e consiglia di verificare con un professionista.
- Memoria ("mémorise ça", "memorizza", "remember this", "احفظ هذا", "افتكر", "3qel"): Sahbi SA ricordare tra una conversazione e l'altra. Conferma in UNA frase breve cosa terrai a mente (es. "C'est noté, je m'en souviendrai 🧠"); se chiede di memorizzare la conversazione, riassumi in 2-4 punti cosa terrai a mente. Non dire mai che non puoi ricordare. In una chat temporanea invece dì che lì non si salva niente.
- Promemoria ("ricordami", "rappelle-moi", "فكرني", "remind me"): chiama SUBITO create_reminder con data e ora locali calcolate dall'ora dell'utente; se manca l'ora usa 09:00. Non chiedere conferma.
- Dopo web_search: rispondi diretto con i fatti trovati (date e cifre esatte), nella lingua dell'utente; alla fine scrivi "Sources :" con 1-3 link nel formato "Titolo – https://…" (niente markdown). Se la ricerca non trova niente, dillo in una frase.
- Fai una domanda solo se senza quella informazione è impossibile rispondere.

Capire bene (prima di rispondere):
- Rileggi l'ultimo messaggio insieme ai messaggi precedenti: capisci a cosa si riferiscono "lei", "quella", "rifallo", "e domani?", "plus court", "زيد" ecc. e continua lo stesso argomento.
- Errori di battitura, parole attaccate, niente punteggiatura, darija scritta in mille modi ("wesh/wach/ouech", "3lach/alach", "bezaf/bzaf"): capisci il senso e non farlo notare.
- I messaggi dettati al microfono possono avere parole sbagliate che suonano simili (es. "Sarb" o "Sabi" = Sahbi, "chat GTP" = ChatGPT, "pronto" = prompt): scegli il senso più logico nel contesto.
- Capisci cosa vuole DAVVERO l'utente (una risposta, un testo da copiare, un'immagine, una traduzione, una correzione) e fai esattamente quello, senza aggiungere cose non chieste.
- Se ci sono più richieste nello stesso messaggio, rispondi a TUTTE, in ordine.
- Se una richiesta può avere due sensi, scegli il più probabile, fallo, e in UNA frase breve alla fine indica l'altra possibilità.
- Numeri, date, nomi e testi da copiare: riportali esattamente come li ha scritti l'utente.

Stile:
- FALLO SUBITO: non puoi lavorare dopo aver risposto. MAI scrivere "sto generando", "un attimo", "te lo preparo adesso", "je m'en occupe" senza consegnare il risultato NELLA STESSA risposta. O fai la cosa adesso (chiami lo strumento giusto o scrivi il contenuto completo), o fai UNA domanda se manca un'informazione indispensabile. Se l'utente risponde "ok", "vas-y", "fallo", "يالاه" a una tua proposta, esegui subito.
- PAGINA WEB / SITO / LANDING PAGE chiesta nella chat normale: scrivi subito il codice completo in UN SOLO blocco \`\`\`html (un file index.html, moderno, adatto al telefono, testi veri, [À COMPLÉTER] dove manca un dato); l'app mostra il pulsante 👁️ Aperçu per vederla. NON creare un'immagine della pagina. Alla fine, in una riga, consiglia il riquadro "🌐 Créer un site internet" per la guida alla pubblicazione.
- RISPOSTE CORTE: di default 2-6 frasi o una lista breve. Vai dritto al punto: niente introduzioni ("Bonne question !", "Voici…"), niente ripetizioni, niente riassunti finali, al massimo UNA domanda alla fine e solo se serve davvero. Più lungo SOLO quando il compito lo richiede (CV, lettera, esercizio, libro, sito, guida di viaggio, piano business) o se l'utente chiede dettagli.
- Se chiede un'immagine (o un disegno, un logo, un poster…), creala SUBITO con create_image: niente domande sul tipo, lo stile o i dettagli; scegli tu quello che manca. Potrà sempre chiedere di modificarla dopo.
- Frasi brevi e chiare, tono amichevole e rispettoso. Niente prediche.
- Usa elenchi solo quando aiutano (passaggi, ricette, liste).
- Se non sai una cosa o non sei sicuro, dillo.
- Non inventare informazioni su persone reali.
- Per salute, legge e soldi dai informazioni utili e consiglia di sentire un professionista quando serve.`;

const TOOLS = [{
  type: 'function',
  function: {
    name: 'create_image',
    description: "Crea un'immagine e la mostra all'utente nella chat.",
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrizione dettagliata in inglese di cosa disegnare o di come trasformare la foto.' },
        edit_photo: { type: 'boolean', description: "true per trasformare la foto che l'utente ha appena inviato; false per creare da zero." },
      },
      required: ['prompt', 'edit_photo'],
      additionalProperties: false,
    },
  },
}];

const VIDEO_ON = `Video:
- PUOI creare video di 8 secondi con lo strumento create_video, proprio come crei immagini. Non dire mai che non puoi creare video.
- Usalo quando l'utente vuole un VIDEO o un'animazione, in qualsiasi lingua: "fammi un video", "fais une vidéo", "make a video", "anime ma photo", "dir lia video", "اعمل لي فيديو".
- Chiamalo SUBITO, nella stessa risposta: non chiedere conferme, non proporre opzioni, non mostrare il prompt all'utente. Al massimo una frase breve, per esempio "Je crée ta vidéo, ça prend environ une minute."
- Nel prompt scrivi in inglese la scena, il movimento, la camera, lo stile e i suoni. Con from_photo = true il video parte dalla foto appena inviata (per animarla).
- Il piano Pro e il limite mensile li controlla il server: tu chiama sempre lo strumento.
- Persone: va bene una persona generica (un uomo, una donna, una famiglia). Rifiuta solo contenuti sessuali, violenza esplicita, minori in situazioni non adatte, persone reali famose o riconoscibili in situazioni false o umilianti, marchi e personaggi protetti; in quel caso proponi subito un'alternativa.
- Nella cronologia, "[Vidéo créée : ...]" indica un video che hai già creato.`;
const VIDEO_OFF = `Video:
- I video non sono ancora disponibili: se l'utente ne chiede uno, di' in una frase che arriveranno presto su Sahbi e proponi un'immagine.`;

const VIDEO_TOOL = {
  type: 'function',
  function: {
    name: 'create_video',
    description: "Crea davvero un video di 8 secondi e lo mostra all'utente nella chat (circa un minuto di attesa).",
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrizione dettagliata in inglese: scena, movimento, camera, stile, suoni.' },
        from_photo: { type: 'boolean', description: "true per partire dalla foto che l'utente ha appena inviato; false altrimenti." },
      },
      required: ['prompt', 'from_photo'],
      additionalProperties: false,
    },
  },
};

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Meteo attuale e previsioni (fino a 7 giorni) per una città. Usalo per ogni domanda sul tempo che fa o che farà.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Nome della città, es. "Oran", "Dubai", "Le Caire"' },
        latitude: { type: 'number', description: 'Latitudine approssimativa della città' },
        longitude: { type: 'number', description: 'Longitudine approssimativa della città' },
        days: { type: 'integer', description: 'Quanti giorni di previsione servono (1 = oggi, 2 = anche domani, max 7)' },
      },
      required: ['city', 'latitude', 'longitude'],
      additionalProperties: false,
    },
  },
};
const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Cerca su internet informazioni aggiornate: notizie, prezzi, risultati sportivi, eventi, orari, chi ricopre oggi una carica, novità. Usalo per tutto ciò che può essere cambiato di recente.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'La ricerca, precisa e completa (es. "prix de l\'or au Maroc aujourd\'hui", "résultat Algérie Égypte football")' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
};
// Ricerca su internet con OpenAI (Responses API + strumento web_search): testo riassunto + fonti.
export async function webSearch({ query } = {}) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) return { error: 'recherche vide' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 35000);
  try {
    const r = await fetch(`${OPENAI}/responses`, {
      method: 'POST', signal: ctrl.signal,
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        model: env('OPENAI_SEARCH_MODEL', 'gpt-5-mini'),
        tools: [{ type: 'web_search' }],
        reasoning: { effort: 'low' },
        input: `Cherche sur internet et résume les faits importants et récents, avec les dates, les chiffres et les noms exacts (aujourd'hui : ${new Date().toISOString().slice(0, 10)}). Question : ${q}`,
      }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      console.error('web_search', r.status, d?.error?.code);
      if (r.status !== 400) { const { openaiAlert } = await import('./_alert.js'); await openaiAlert(r.status, JSON.stringify(d?.error || {})).catch(() => {}); }
      return { error: 'recherche indisponible' };
    }
    const parts = (d?.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text');
    const seen = new Set();
    const sources = parts.flatMap((c) => c.annotations || []).filter((a) => a.type === 'url_citation' && a.url)
      .filter((a) => { const k = a.url.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 5).map((a) => ({ title: a.title || '', url: a.url.replace(/[?&]utm_source=openai$/, '') }));
    const text = parts.map((c) => c.text).join('\n').slice(0, 6000);
    return text ? { query: q, results: text, sources } : { error: 'aucun résultat' };
  } catch (e) { return { error: e.name === 'AbortError' ? 'recherche trop lente' : 'recherche indisponible' }; }
  finally { clearTimeout(t); }
}
const runInfoTool = (name, args) => (name === 'web_search' ? webSearch(args) : getWeather(args));
const INFO_TOOLS = ['get_weather', 'web_search'];
// Promemoria: il telefono lo aggiunge al calendario (file .ics) e il calendario manda la notifica all'ora giusta.
const REMINDER_TOOL = {
  type: 'function',
  function: {
    name: 'create_reminder',
    description: 'Crea un promemoria con data e ora (l\'utente lo aggiunge al calendario del telefono, che lo avvisa). Usalo quando chiede di ricordargli qualcosa ("ricordami", "rappelle-moi", "فكرني", "remind me").',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Cosa ricordare, breve, nella lingua dell\'utente (es. "Appeler maman")' },
        start: { type: 'string', description: 'Data e ora LOCALI dell\'utente, formato YYYY-MM-DDTHH:MM (calcolala dalla sua ora attuale)' },
        notes: { type: 'string', description: 'Dettagli facoltativi' },
      },
      required: ['title', 'start'],
      additionalProperties: false,
    },
  },
};

const SKY = { clearsky: 'ciel dégagé', fair: 'beau temps', partlycloudy: 'partiellement nuageux', cloudy: 'nuageux', fog: 'brouillard', lightrain: 'pluie faible', rain: 'pluie', heavyrain: 'forte pluie', lightrainshowers: 'averses faibles', rainshowers: 'averses', heavyrainshowers: 'fortes averses', thunder: 'orage', rainandthunder: 'pluie et orage', heavyrainandthunder: 'orages violents', rainshowersandthunder: 'averses orageuses', lightsleet: 'neige fondue', sleet: 'neige fondue', lightsnow: 'neige faible', snow: 'neige', heavysnow: 'forte neige', snowshowers: 'averses de neige' };
const sky = (code) => { const k = String(code || '').replace(/_(day|night|polartwilight)$/, ''); return SKY[k] || k; };
// Previsioni da MET Norway (gratuito anche per uso commerciale, con citazione della fonte).
export async function getWeather({ city, latitude, longitude, days } = {}) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: 'coordonnées inconnues' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, {
      headers: { 'user-agent': 'Sahbi/1.0 https://www.sahbi.bond', accept: 'application/json' }, signal: ctrl.signal,
    });
    if (!r.ok) return { error: `service météo indisponible (${r.status})` };
    const ts = (await r.json())?.properties?.timeseries || [];
    if (!ts.length) return { error: 'pas de données' };
    const off = Math.round(lon / 15) * 3600e3; // ora locale approssimativa
    const local = (iso) => new Date(new Date(iso).getTime() + off).toISOString();
    const now = ts[0], d0 = now.data?.instant?.details || {};
    const n = Math.min(7, Math.max(1, Number(days) || 3));
    const byDay = new Map();
    for (const x of ts) {
      const day = local(x.time).slice(0, 10), hour = Number(local(x.time).slice(11, 13));
      const det = x.data?.instant?.details || {};
      const e = byDay.get(day) || { day, min: Infinity, max: -Infinity, rain_mm: 0, wind_max_kmh: 0, sky: null, skyHour: 99 };
      e.min = Math.min(e.min, det.air_temperature); e.max = Math.max(e.max, det.air_temperature);
      e.wind_max_kmh = Math.max(e.wind_max_kmh, Math.round((det.wind_speed || 0) * 3.6));
      const next = x.data?.next_6_hours || x.data?.next_1_hours;
      if (x.data?.next_1_hours) e.rain_mm += x.data.next_1_hours.details?.precipitation_amount || 0;
      if (next?.summary?.symbol_code && Math.abs(hour - 13) < Math.abs(e.skyHour - 13)) { e.sky = sky(next.summary.symbol_code); e.skyHour = hour; }
      byDay.set(day, e);
    }
    const daily = [...byDay.values()].slice(0, n).map((e) => ({ day: e.day, min_c: Math.round(e.min), max_c: Math.round(e.max), sky: e.sky, rain_mm: Math.round(e.rain_mm * 10) / 10, wind_max_kmh: e.wind_max_kmh }));
    return {
      city, local_time_now: local(now.time).slice(0, 16).replace('T', ' '),
      now: { temp_c: Math.round(d0.air_temperature), sky: sky((now.data?.next_1_hours || now.data?.next_6_hours)?.summary?.symbol_code), wind_kmh: Math.round((d0.wind_speed || 0) * 3.6), humidity: Math.round(d0.relative_humidity || 0) },
      daily, source: 'MET Norway',
    };
  } catch (e) { return { error: e.name === 'AbortError' ? 'service météo trop lent' : 'service météo indisponible' }; }
  finally { clearTimeout(t); }
}

// Ora locale del telefono (per i promemoria: "tra 2 ore", "domani alle 8").
const clientNowPrompt = (now) => (typeof now === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(now) ? `\nOra locale dell'utente: ${now.slice(0, 16).replace('T', ' ')} (${new Date(now.slice(0, 10)).toLocaleDateString('fr-FR', { weekday: 'long' })}).` : '');
// Data di oggi: serve per "domani", "sabato", ecc.
const todayPrompt = () => `\n\nOggi è ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Algiers' })}.`;
// Messaggi per la seconda risposta dopo il meteo.
const weatherMessages = (base, reply, id, args, data, name = 'get_weather') => [...base,
  { role: 'assistant', content: reply || null, tool_calls: [{ id, type: 'function', function: { name, arguments: args } }] },
  { role: 'tool', tool_call_id: id, content: JSON.stringify(data) }];

const parseJSON = (t) => { try { return JSON.parse(t || '{}'); } catch { return {}; } };
// Vercel: "aspetta che finisca" anche se la risposta al telefono si è chiusa (come waitUntil di @vercel/functions).
function keepAlive(promise) {
  try { globalThis[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil?.(promise); } catch { /* fuori da Vercel */ }
}
const SEP = '\u001e'; // separa i messaggi di controllo (immagini) dal testo

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const m of input.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (content) out.push({ role: m.role, content });
  }
  return out.length && out[out.length - 1].role === 'user' ? out : null;
}

const frame = (obj) => `${SEP}${JSON.stringify(obj)}${SEP}`;

async function imageFrames(userId, prompt, opts) {
  const r = await generateImage(userId, prompt, opts);
  return r.ok
    ? frame({ type: 'image', id: r.id, image: r.image, prompt, remaining: r.remaining, limit: r.limit })
    : frame({ type: 'image_error', error: r.error, message: r.message });
}

const parseArgs = (args) => {
  try {
    const a = JSON.parse(args || '{}');
    return { prompt: String(a.prompt || '').trim(), edit: a.edit_photo === true || a.from_photo === true };
  } catch { return { prompt: '', edit: false }; }
};

async function videoFrames(userId, prompt, opts) {
  const r = await startVideo(userId, prompt, opts);
  return r.ok
    ? frame({ type: 'video', id: r.id, prompt, remaining: r.remaining, limit: r.limit })
    : frame({ type: 'video_error', error: r.error, message: r.message });
}

// GET = sveglia il server (la conversazione vocale lo chiama appena si apre).
export function GET() { return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }); }

export async function POST(request) {
  const userId = await getUserId(request);
  if (!userId) return fail('auth', 401, 'Session expirée. Recharge la page.');

  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400, 'Demande invalide.'); }
  // Studio "Écrire un livre" (struttura e capitoli).
  if (body?.book) { const { bookHandler } = await import('./_book.js'); return bookHandler(userId, body.book); }
  const messages = cleanMessages(body?.messages);
  if (!messages) return fail('bad_request', 400, 'Message vide.');
  const photo = body?.photo ? parsePhoto(body.photo) : null;
  if (body?.photo && !photo) return fail('bad_request', 400, 'Photo non valide ou trop grande.');

  const doc = body?.doc ? parseDoc(body.doc) : null;
  if (body?.doc && !doc) return fail('bad_request', 400, 'Document vide ou illisible.');

  // Chat temporanea: niente memoria (né letta né salvata).
  const temp = body?.temp === true;
  const [{ limits, pro }, memory] = await Promise.all([getPlan(userId), temp ? [] : getMemory(userId)]);
  if (doc && !pro) return fail('pro', 402, 'La lecture de documents est incluse dans Sahbi Pro.');
  const userText = messages[messages.length - 1].content;
  // Chat dei siti: usa gli stessi messaggi della chat (15 gratis / 150 Pro). In più, per i Pro, l'energia dei siti.
  const siteMode = body?.mode === 'website';
  const siteFree = false;
  if (siteMode && pro && (await getEnergy(userId)) >= SITE_ENERGY()) {
    return fail('energy', 429, '⚡ Ton énergie pour créer des sites est épuisée pour aujourd’hui. Elle se recharge demain à 8 h. Ton site est bien enregistré.');
  }
  const left = await useCredit(userId, 'chat', limits.chat);
  if (left < 0) return fail('limit', 429, pro ? 'Limite de messages atteinte pour aujourd’hui.' : 'Limite gratuite atteinte pour aujourd’hui.');
  // Le parole esatte dell'utente vanno anche al disegnatore, così non può "inventare" un'altra scena.
  const clean = (t) => String(t || '').replace(/\(photo envoyée juste avant, jointe à nouveau\)/g, '').trim();
  const nowText = clean(userText);
  const prevUserText = clean([...messages].slice(0, -1).reverse().find((m) => m.role === 'user')?.content);
  const prevBotText = [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';
  // "Rifalla" / "sì" dopo una richiesta di immagine: si rifà subito la stessa immagine, senza domande.
  const again = !NOT_IMAGE.test(nowText) && ((RETRY.test(nowText) && nowText.split(/\s+/).length <= 8) || (nowText.length < 30 && CONFIRM.test(nowText)))
    && (STYLE_ASK.test(prevUserText) || IMAGE_REQ.test(prevUserText) || /\[Image créée|image|immagine|photo|foto|صورة|tswira/i.test(prevBotText));
  const ownWords = again && prevUserText ? `${prevUserText} — ${nowText}` : nowText;
  const recent = messages.slice(-6, -1).map((m) => `${m.role === 'user' ? 'User' : 'Sahbi'}: ${m.content.slice(0, 500)}`).join('\n');
  const imgOpts = (edit) => ({ limit: limits.image, photo: edit ? photo : null, userText: ownWords.slice(0, 1500), history: recent });
  const vidOpts = (fromPhoto) => ({ pro, limit: limits.video, photo: fromPhoto ? photo : null });
  const media = videoEnabled() ? [...TOOLS, VIDEO_TOOL] : TOOLS;
  const tools = [...media, WEATHER_TOOL, SEARCH_TOOL, REMINDER_TOOL];
  const NAMES = media.map((t) => t.function.name); // strumenti che creano immagini o video
  // Esegue lo strumento scelto dal modello e restituisce i messaggi di controllo per il telefono.
  // Foto + "trasformala": si parte SEMPRE dalla foto dell'utente, anche se il modello dimentica edit_photo.
  const mustEdit = !!photo && !NOT_IMAGE.test(nowText) && ((!body?.photoEarlier && STYLE_ASK.test(nowText)) || (again && STYLE_ASK.test(`${prevUserText} ${prevBotText}`)));
  const runTool = (name, prompt, edit) => (name === 'create_video'
    ? videoFrames(userId, prompt, vidOpts(edit))
    : imageFrames(userId, prompt, imgOpts(edit || mustEdit)));
  const startFrame = (name) => frame({ type: name === 'create_video' ? 'video_start' : 'image_start' });

  // Il documento va solo nell'ultimo messaggio dell'utente.
  if (doc) {
    const last = messages[messages.length - 1];
    last.content = `${last.content}\n\n[Document « ${doc.name} »]${doc.cut ? ' (document long : seul le début est inclus)' : ''}\n"""\n${doc.text}\n"""`;
  }
  // La foto va solo nell'ultimo messaggio dell'utente.
  if (photo) {
    const last = messages[messages.length - 1];
    last.content = [
      { type: 'text', text: body?.photoEarlier === true ? `${last.content}\n(photo envoyée juste avant, jointe à nouveau)` : last.content },
      { type: 'image_url', image_url: { url: photo.dataUrl } },
    ];
  }

  // Modello della chat: gpt-5-mini capisce molto meglio di gpt-5-nano (dialetti, contesto, richieste lunghe).
  // Si può cambiare su Vercel: OPENAI_CHAT_MODEL (gratis) e OPENAI_CHAT_MODEL_PRO (abbonati).
  // 📷 Foto per un sito ("mets-la comme logo", "metti questa foto nel sito", "حط هاد الصورة ف الموقع"): NON è una richiesta
  // di trasformare la foto o di disegnare un'immagine. Vale nella chat dei siti e in ogni chat che ha già un sito.
  const SITE_USE = /(logo|لوغو|شعار|sito|site|web|p[aá]gina|موقع|header|en-?t[eê]te|banni[eè]re|banner|sfondo|arri[eè]re-plan|fond d|galerie|galleria|gallery|catalogu?e|catalogo|menu|كتالوج|خلفية)/i;
  const sitePhoto = !!photo && (body?.mode === 'website' || Number(body?.sitePhotos) > 0) && (body?.mode === 'website' || SITE_USE.test(nowText)) && !/(dessine|disegna|draw|crée une image|crea un'immagine|create an image|transforme|trasforma|cartoon|anime|style|stile|ارسم|حوّل)/i.test(nowText);
  // 🌐 Chat con un sito (chat dei siti, o una chat dove Sahbi ha già fatto un sito): "metti delle immagini", "fai le anteprime",
  // "quando clicco su LG si apre un'altra pagina" parlano del SITO. Non si disegna mai un'immagine: si riscrive il sito.
  const siteCtx = body?.mode === 'website' || body?.hasSite === true;
  const EXPLICIT_IMG = /(^(dessine|disegna|draw|ارسم|rsem)\b|crée[- ]?moi une image|crée une image|génère une image|fais[- ]moi une image|crea(mi)? un'?immagine|genera(mi)? un'?immagine|fammi un'?immagine|disegnami|create an image|generate an image|make me an image|un poster|une affiche|اعمل لي صورة|ارسم لي)/i;
  const IN_SITE = /(nel sito|sul sito|per il sito|dans le site|sur le site|pour le site|du site|in the site|on the site|for the site|في الموقع|للموقع|f site|f l'?site)/i;
  const siteEdit = siteCtx && !photo && (!EXPLICIT_IMG.test(nowText) || IN_SITE.test(nowText));
  // Nella chat dei siti un'immagine che non c'entra col sito ("fammi un'immagine di un gatto", "trasforma questa foto in cartoon")
  // non si fa: Sahbi dice gentilmente di usare la chat normale.
  const offTopicImg = body?.mode === 'website' && !sitePhoto && !IN_SITE.test(nowText) && (photo ? STYLE_ASK.test(nowText) || EXPLICIT_IMG.test(nowText) : EXPLICIT_IMG.test(nowText));
  const noImage = siteEdit || offTopicImg;
  const model = pro ? env('OPENAI_CHAT_MODEL_PRO', env('OPENAI_CHAT_MODEL', 'gpt-5-mini')) : env('OPENAI_CHAT_MODEL', 'gpt-5-mini');
  const payload = {
    model, stream: true, tools: noImage ? tools.filter((t) => t.function.name !== 'create_image' && t.function.name !== 'create_video') : tools,
    // Foto + "trasformala in stile…", oppure "fammi un'immagine di…": si disegna subito, senza domande.
    tool_choice: !sitePhoto && !noImage && (again || (!NOT_IMAGE.test(nowText) && ((photo && !body?.photoEarlier && STYLE_ASK.test(nowText)) || ((!photo || body?.photoEarlier) && IMAGE_REQ.test(nowText)))))
      ? { type: 'function', function: { name: 'create_image' } } : 'auto',
    messages: [{ role: 'system', content: SYSTEM.replace('{{VIDEO}}', videoEnabled() ? VIDEO_ON : VIDEO_OFF) + memoryPrompt(memory) + uiLangPrompt(body?.lang) + todayPrompt() + clientNowPrompt(body?.now) + langPrompt(detectLang(nowText) ? nowText : (again ? prevUserText : nowText)) + (body?.voice === true ? VOICE_STYLE : '') + (body?.mode === 'book' ? BOOK_MODE : body?.mode === 'travel' ? TRAVEL_MODE + countryHint(request) : body?.mode === 'website' ? WEBSITE_MODE + (pro ? WEBSITE_PRO : WEBSITE_FREE) + (Number(body?.sitePhotos) > 0 ? `\n- In questa chat l'utente ha già mandato ${Math.min(12, Number(body.sitePhotos) | 0)} foto: foto1.jpg … foto${Math.min(12, Number(body.sitePhotos) | 0)}.jpg. Usale tutte nel sito.` : '') + (Number(body?.siteVideos) > 0 ? `\n- L'utente ha mandato anche ${Math.min(5, Number(body.siteVideos) | 0)} video: video1.mp4 … video${Math.min(5, Number(body.siteVideos) | 0)}.mp4. Mettili nel sito.` : '') : body?.mode === 'business' ? BUSINESS_MODE + countryHint(request) : body?.mode === 'whatsapp' ? WHATSAPP_MODE : (pro ? '' : WEBSITE_FREE_CHAT)) + (sitePhoto ? SITE_PHOTO_NOW(Number(body?.sitePhotos) | 0) : '') + (offTopicImg ? OFF_TOPIC_IMG : siteEdit ? SITE_EDIT_NOW(body?.mode === 'website') : '') }, ...messages],
  };
  if (model.startsWith('gpt-5')) payload.reasoning_effort = env('OPENAI_REASONING_EFFORT', 'minimal');
  // Siti: un po' più di riflessione = struttura e design molto migliori (costo un po' più alto, coperto dall'energia).
  if (model.startsWith('gpt-5') && body?.mode === 'website') payload.reasoning_effort = env('OPENAI_SITE_REASONING', 'low');

  const call = (p) => fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(p),
  });
  const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-remaining': String(left) };
  // La memoria si aggiorna in parallelo alla risposta (solo se il messaggio parla dell'utente).
  const learning = temp ? Promise.resolve(null) : learnFromMessage(userId, userText, memory, messages.slice(0, -1));
  const memoryFrame = async () => { const saved = await learning; return saved ? frame({ type: 'memory', count: saved.length }) : ''; };
  const upstream = await call(payload);

  // Account OpenAI non verificati non possono usare lo streaming: rispondiamo tutto in una volta.
  if (upstream.status === 400) {
    const errText = await upstream.text().catch(() => '');
    if (/stream/i.test(errText) && /verif/i.test(errText)) {
      const plain = await call({ ...payload, stream: false });
      const data = await plain.json().catch(() => null);
      const msg = data?.choices?.[0]?.message;
      const wCall = msg?.tool_calls?.find((t) => INFO_TOOLS.includes(t.function?.name));
      if (plain.ok && wCall) {
        const wd = await runInfoTool(wCall.function.name, parseJSON(wCall.function.arguments));
        const r2 = await call({ ...payload, stream: false, tool_choice: 'none', messages: weatherMessages(payload.messages, msg.content, wCall.id, wCall.function.arguments, wd, wCall.function.name) });
        const d2 = await r2.json().catch(() => null);
        return new Response((d2?.choices?.[0]?.message?.content || '') + await memoryFrame(), { headers });
      }
      const toolCall = msg?.tool_calls?.find((t) => NAMES.includes(t.function?.name));
      const { prompt, edit } = toolCall ? parseArgs(toolCall.function.arguments) : { prompt: '' };
      if (plain.ok && (msg?.content || prompt)) {
        let out = msg.content || '';
        if (prompt) out += startFrame(toolCall.function.name) + await runTool(toolCall.function.name, prompt, edit);
        out += await memoryFrame();
        return new Response(out, { headers });
      }
    }
    await (siteFree ? refundSiteCredit(userId) : refundCredit(userId, 'chat')).catch(() => {});
    console.error('OpenAI chat error', 400, errText.slice(0, 300));
    return fail('upstream', 502, 'Sahbi ne peut pas répondre maintenant. Réessaie dans un instant.');
  }
  if (!upstream.ok || !upstream.body) {
    await (siteFree ? refundSiteCredit(userId) : refundCredit(userId, 'chat')).catch(() => {});
    const errBody = await upstream.text().catch(() => '');
    console.error('OpenAI chat error', upstream.status, errBody.slice(0, 300));
    await openaiAlert(upstream.status, errBody);
    return fail('upstream', 502, 'Sahbi ne peut pas répondre maintenant. Réessaie dans un instant.');
  }

  // Trasforma lo stream di OpenAI in testo semplice; se il modello chiede un'immagine, la crea alla fine.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const tool = { name: '', args: '', id: '' };
  let announced = false;
  let reply = '';
  // Rete di sicurezza: a volte il modello scrive "je lance la vidéo" senza chiamare lo strumento.
  // In quel caso chiediamo al modello SOLO i dati del video e lo creiamo davvero.
  const PROMISE = /(je (te )?(la |le |l['’])?(lance|crée|cree|fais|prépare|génère|dessine|transforme)|je lance|en cours|ça prend|environ une minute|sto (creando|per|trasformando|disegnando)|in corso|lo (creo|faccio)|la (creo|trasformo|faccio)|procedo|creo (il|la|subito)|ci vuole circa|i'?m (creating|making|drawing|transforming)|about a minute|جاري|دقيقة|دابا)/i;
  const REFUSAL = /(non posso|je ne peux pas|i can'?t|i cannot|désolé|mi dispiace|sorry|ما نقدرش|لا أستطيع|لا يمكنني)/i;
  // Rete di sicurezza: a volte il modello scrive "je lance la vidéo / creazione in corso" senza chiamare lo strumento.
  // In quel caso chiediamo al modello SOLO i dati dello strumento e creiamo davvero l'immagine o il video.
  // Solo se anche l'utente l'aveva chiesto (nel suo messaggio, o confermando con "sì/oui/ok" dopo una domanda di Sahbi).
  const lastText = (typeof userText === 'string' ? userText : '').trim();
  const prevBot = [...messages].reverse().find((m) => m.role === 'assistant')?.content;
  const confirm = lastText.length < 30 && /^(s[iì]|oui|ok|okay|yes|vas-?y|vai|go|d'?accord|wakha|iyeh|ih|نعم|إيه|واخا|ايوا)\b/i.test(lastText);
  const asked = (re) => re.test(lastText) || (confirm && typeof prevBot === 'string' && re.test(prevBot));
  const VIDEO_WORDS = /(vid[ée]o|فيديو|anim)/i;
  const IMAGE_WORDS = /(image|immagine|imag|foto|photo|dessin|disegn|رسم|صورة|tswira|cartoon|cartone|anime|simpson|stile|style|carte|biglietto|sticker|transform|trasform)/i;
  const promised = () => {
    // L'utente ha mandato una foto e chiede di trasformarla: si crea l'immagine anche se il modello ha rifiutato o chiesto conferma.
    if (!tool.name && photo && !sitePhoto && !body?.photoEarlier && STYLE_ASK.test(lastText)) return 'create_image';
    if (tool.name || !PROMISE.test(reply) || REFUSAL.test(reply)) return null;
    // Un sito o una pagina web non è un'immagine: in quel caso si fa scrivere il codice (deliverNow).
    if (/(sito|site|pagina|page web|landing|html|codice|موقع)/i.test(reply + ' ' + lastText) && !/(image|immagine|photo|foto|صورة)/i.test(lastText)) return null;
    if (videoEnabled() && VIDEO_WORDS.test(reply) && asked(VIDEO_WORDS)) return 'create_video';
    if (!sitePhoto && !noImage && IMAGE_WORDS.test(reply) && asked(IMAGE_WORDS)) return 'create_image';
    return null;
  };
  async function forcedArgs(name) {
    const r = await call({
      model, stream: false, tools: tools.filter((t) => t.function.name === name),
      tool_choice: { type: 'function', function: { name } },
      ...(model.startsWith('gpt-5') ? { reasoning_effort: 'minimal' } : {}),
      messages: [...payload.messages, { role: 'assistant', content: reply }, { role: 'system', content: `Ora fai davvero quello che hai appena annunciato, chiamando ${name}.${photo && name === 'create_image' ? ' La foto è allegata: se si tratta di trasformarla usa edit_photo = true.' : ''}` }],
    });
    const d = await r.json().catch(() => null);
    const tc = d?.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === name);
    return tc ? parseArgs(tc.function.arguments) : { prompt: '' };
  }
  // Il lavoro (risposta, immagine, video) continua anche se l'utente esce dall'app o perde la rete:
  // il telefono può staccarsi, il server finisce comunque e salva l'immagine nella galleria.
  const T = {
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const data = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!data || data === '[DONE]') continue;
        let delta;
        try { delta = JSON.parse(data).choices?.[0]?.delta; } catch { continue; }
        if (delta?.content) { reply += delta.content; controller.enqueue(encoder.encode(delta.content.replaceAll(SEP, ''))); }
        for (const tc of delta?.tool_calls || []) {
          if (tc.index && tc.index > 0) continue; // una sola immagine per messaggio
          if (tc.id) tool.id = tc.id;
          if (tc.function?.name) tool.name += tc.function.name;
          if (tc.function?.arguments) tool.args += tc.function.arguments;
          if (!announced && NAMES.includes(tool.name)) {
            announced = true;
            controller.enqueue(encoder.encode(startFrame(tool.name)));
          }
        }
      }
    },
    async flush(controller) {
      // Mentre si crea l'immagine (fino a 1-2 minuti) si manda un piccolo segnale ogni 8 secondi:
      // così il telefono e la rete non chiudono la connessione credendola ferma.
      const hb = setInterval(() => { try { controller.enqueue(encoder.encode(frame({ type: 'ping' }))); } catch { /* chiuso */ } }, 8000);
      try { await finishTools(controller); if (!tool.name && !promised() && (DELIVER_PROMISE.test(reply) || PROMISE.test(reply)) && !reply.includes('```')) await deliverNow(controller); }
      catch (e) {
        console.error('Strumento', e?.message);
        const video = tool.name === 'create_video';
        controller.enqueue(encoder.encode(frame({ type: video ? 'video_error' : 'image_error', error: 'upstream', message: video ? 'Impossible de créer la vidéo maintenant. Réessaie dans un instant.' : "Impossible de créer l'image maintenant. Réessaie dans un instant." })));
      } finally { clearInterval(hb); }
      if (siteMode && pro) {
        const used = await addEnergy(userId, reply.length / 1000);
        if (used !== null) controller.enqueue(encoder.encode(frame({ type: 'energy', pct: Math.min(100, Math.round(used / SITE_ENERGY() * 100)) })));
      }
      controller.enqueue(encoder.encode(await memoryFrame()));
    },
  };
  let gone = false;
  const stream = new ReadableStream({
    start(ctrl) {
      const out = { enqueue: (x) => { if (gone) return; try { ctrl.enqueue(x); } catch { gone = true; } } };
      const work = (async () => {
        const rd = upstream.body.getReader();
        try {
          for (;;) { const { value, done } = await rd.read(); if (done) break; T.transform(value, out); }
          await T.flush(out);
        } catch (e) { console.error('Stream chat', e?.message); }
        if (!gone) { try { ctrl.close(); } catch { /* già chiuso */ } }
      })();
      keepAlive(work);
    },
    cancel() { gone = true; },
  });

  // Meteo o ricerca su internet: prende i dati veri e chiede al modello la risposta finale, che arriva in streaming.
  async function weatherFollowUp(controller) {
    let args = {}; try { args = JSON.parse(tool.args || '{}'); } catch { /* argomenti rotti */ }
    const search = tool.name === 'web_search';
    const data = await runInfoTool(tool.name, args);
    const r = await call({ ...payload, tool_choice: 'none', messages: weatherMessages(payload.messages, reply, tool.id || (search ? 'call_search' : 'call_weather'), tool.args || '{}', data, tool.name) }).catch(() => null);
    if (!r?.ok || !r.body) { controller.enqueue(encoder.encode(data.error ? (search ? `Je n'ai pas pu chercher sur internet (${data.error}).` : `Je n'ai pas pu obtenir la météo (${data.error}).`) : '')); return; }
    const rd = r.body.getReader(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const d = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!d || d === '[DONE]') continue;
        try { const c = JSON.parse(d).choices?.[0]?.delta?.content; if (c) controller.enqueue(encoder.encode(c.replaceAll(SEP, ''))); } catch { /* riga incompleta */ }
      }
    }
  }

  // Il modello ha solo annunciato ("sto generando…", "un attimo") senza consegnare: lo si fa continuare subito.
  async function deliverNow(controller) {
    controller.enqueue(encoder.encode(frame({ type: 'working' })));
    const nudge = "Consegna ADESSO, in questa risposta, il risultato completo che hai appena annunciato (per un sito o una pagina: tutto il file index.html in un unico blocco ```html). Nessuna frase di attesa, nessuna domanda prima del risultato.";
    const r = await call({ ...payload, tool_choice: 'none', messages: [...payload.messages, { role: 'assistant', content: reply }, { role: 'user', content: nudge }] }).catch(() => null);
    if (!r?.ok || !r.body) return;
    controller.enqueue(encoder.encode('\n\n'));
    const rd = r.body.getReader(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const d = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!d || d === '[DONE]') continue;
        try { const c = JSON.parse(d).choices?.[0]?.delta?.content; if (c) { reply += c; controller.enqueue(encoder.encode(c.replaceAll(SEP, ''))); } } catch { /* riga incompleta */ }
      }
    }
  }

  async function finishTools(controller) {
      if (INFO_TOOLS.includes(tool.name)) { await weatherFollowUp(controller); return; }
      if (tool.name === 'create_reminder') {
        const a = parseJSON(tool.args);
        const title = String(a.title || '').slice(0, 120), start = String(a.start || '').slice(0, 16), notes = String(a.notes || '').slice(0, 300);
        controller.enqueue(encoder.encode(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) && title
          ? frame({ type: 'reminder', title, start, notes })
          : "Je n'ai pas compris la date du rappel. Dis-moi le jour et l'heure."));
        return;
      }
      const forcedName = promised();
      if (forcedName) {
        const video = forcedName === 'create_video';
        controller.enqueue(encoder.encode(startFrame(forcedName)));
        const forced = await forcedArgs(forcedName).catch(() => ({ prompt: '' }));
        controller.enqueue(encoder.encode(forced.prompt
          ? await runTool(forcedName, forced.prompt, forced.edit)
          : frame({ type: video ? 'video_error' : 'image_error', error: 'bad_request', message: video ? "Je n'ai pas compris la vidéo à créer. Décris-la autrement." : "Je n'ai pas compris l'image à créer. Décris-la autrement." })));
        return;
      }
      if (!NAMES.includes(tool.name)) return;
      const { prompt, edit } = parseArgs(tool.args);
      if (!prompt) {
        const video = tool.name === 'create_video';
        controller.enqueue(encoder.encode(frame({ type: video ? 'video_error' : 'image_error', error: 'bad_request', message: video ? "Je n'ai pas compris la vidéo à créer. Décris-la autrement." : "Je n'ai pas compris l'image à créer. Décris-la autrement." })));
        return;
      }
      controller.enqueue(encoder.encode(await runTool(tool.name, prompt, edit)));
  }

  return new Response(stream, { headers });
}
