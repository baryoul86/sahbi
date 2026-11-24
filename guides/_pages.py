# Contenu des guides longs de Sahbi (français). Chaque entrée : slug, title, desc, date, minutes, body (HTML).
DATE = '24 novembre 2026'

DICO = [
    ('Comment ça va ?', 'Labas ? / Kidayr ?', 'Wach rak ? / Labas ?', 'Chnahwalek ? / Labes ?'),
    ('Je veux…', 'Bghit…', 'Habit… / Nheb…', 'N7eb…'),
    ('Beaucoup', 'Bzzaf', 'Bezzaf', 'Barcha'),
    ('Un peu', 'Chwiya', 'Chwiya', 'Chwaya'),
    ('Maintenant', 'Daba', 'Dorka', 'Tawa'),
    ('Quoi ? / Qu\'est-ce que… ?', 'Chno ? / Ach ?', 'Wach ?', 'Chnowa ?'),
    ('Pourquoi ?', '3lach ?', '3lach ?', '3lech ?'),
    ('Où ?', 'Fin ?', 'Win ?', 'Win ?'),
    ('Quand ?', 'Imta ?', 'Wa9tach ?', 'Wa9tech ?'),
    ('Combien ?', 'Ch7al ? / Bch7al ?', 'Ch7al ? / Bch7al ?', '9addech ?'),
    ('Il y a', 'Kayn', 'Kayen', 'Famma'),
    ('Il n\'y a pas', 'Makaynch', 'Makanch', 'Famech'),
    ('Bien, bon', 'Mzyan', 'Mlih', 'Behi'),
    ('D\'accord', 'Wakha', 'Saha / Mlih', 'Behi'),
    ('Merci', 'Chokran / Lah ykhalik', 'Saha / Chokran', 'Y3aychek'),
    ('Joli, beau', 'Zwin', 'Chbab', 'Mezyen'),
    ('Rapidement', 'Dghya', 'Fissa', 'Fissa / Bel 3jal'),
    ('Rien', 'Walou', 'Walou', 'Hatta chay'),
    ('Voiture', 'Tomobil', 'Tomobil / Loto', 'Karhba'),
    ('Argent', 'Flous', 'Drahem', 'Flous'),
    ('Travail', 'Khedma', 'Khedma', 'Khedma'),
    ('Parler', 'Hder', 'Hder', 'Tkallem'),
    ('Regarder', 'Chouf', 'Chouf', 'Chouf'),
    ('Fatigué', '3iyan', '3iyan', 'Ta3ban'),
    ('Aujourd\'hui', 'Lyoum', 'Lyoum', 'Lyoum'),
    ('Demain', 'Ghedda', 'Ghodwa', 'Ghodwa'),
    ('Hier', 'Lbare7', 'Lbare7', 'Lbara7'),
    ('Je n\'ai pas compris', 'Mafhemtch', 'Mafhemtch', 'Mafhemtech'),
    ('Maison', 'Dar', 'Dar', 'Dar'),
    ('Enfant', 'Drri', 'Dhri / Tfel', 'Sghir'),
]
dico_rows = '\n'.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in DICO)

TABLE_CSS = '<style>table{width:100%;border-collapse:collapse;margin:16px 0;font-size:15px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--panel)}.tw{overflow-x:auto}</style>'

ALL = [
dict(slug='dictionnaire-darija-francais', minutes=9, date=DATE,
 title='Petit dictionnaire darija–français : 30 mots du quotidien au Maroc, en Algérie et en Tunisie',
 desc='Les mots et expressions de base en darija marocaine, algérienne et tunisienne, avec leur traduction en français et des conseils pour les écrire en lettres latines.',
 body=TABLE_CSS + f'''
<p>La darija, c'est l'arabe parlé au quotidien au Maghreb. Elle change d'un pays à l'autre, et parfois d'une ville à l'autre : un Marocain dit <b>daba</b> pour « maintenant », un Algérien <b>dorka</b> et un Tunisien <b>tawa</b>. Ce petit dictionnaire rassemble trente mots et expressions parmi les plus utiles, côte à côte dans les trois dialectes, pour comprendre la famille, les amis ou les collègues, et pour écrire naturellement à un assistant comme Sahbi.</p>
<div class="card"><b>Comment lire ce tableau ?</b> Les mots sont écrits en lettres latines, comme on les tape sur un téléphone (« arabizi »). Les chiffres remplacent des sons qui n'existent pas en français : <b>3</b> = ع, <b>7</b> = ح, <b>9</b> = ق. Voir notre guide <a href="/guides/ecrire-arabizi-chiffres.html">Écrire en arabizi</a>.</div>
<h2>Le tableau des 30 mots essentiels</h2>
<div class="tw"><table><thead><tr><th>Français</th><th>Maroc 🇲🇦</th><th>Algérie 🇩🇿</th><th>Tunisie 🇹🇳</th></tr></thead><tbody>
{dico_rows}
</tbody></table></div>
<p>Ces formes sont les plus répandues dans les grandes villes ; à la campagne ou dans certaines régions (l'Oriental marocain, l'Est algérien, le Sud tunisien…), on entend d'autres variantes. Il n'existe pas d'orthographe officielle en lettres latines : « bzzaf », « bezaf » et « bzaf » sont tous corrects.</p>
<h2>Ce qui rapproche les trois darijas</h2>
<p>Malgré les différences, une grande partie du vocabulaire est commune : <b>dar</b> (maison), <b>khedma</b> (travail), <b>chouf</b> (regarde), <b>lyoum</b> (aujourd'hui). La grammaire suit les mêmes principes : le futur se forme souvent avec un petit mot devant le verbe (<b>ghadi</b> au Maroc, <b>rah</b> ou <b>ra7</b> en Algérie, <b>bech</b> en Tunisie), et la négation entoure le verbe avec <b>ma… ch</b> : <i>ma fhemtch</i> = « je n'ai pas compris ».</p>
<h2>Les mots venus du français, de l'espagnol et du turc</h2>
<p>La darija a emprunté beaucoup de mots aux langues voisines. Du français : <b>tomobil</b> (automobile), <b>tabla</b> (table), <b>fichta</b> (fête, via l'espagnol en Algérie). De l'espagnol, surtout au nord du Maroc : <b>simana</b> (semaine), <b>kuzina</b> (cuisine). Du turc, en Algérie et en Tunisie : <b>bachmak</b>, <b>chorba</b> (soupe), <b>baylek</b>. C'est pour cela qu'un francophone reconnaît souvent des mots au milieu d'une conversation.</p>
<h2>Les phrases toutes faites à connaître</h2>
<ul>
<li><b>Salam 3likoum</b> / <b>3likoum salam</b> : la salutation et sa réponse, partout au Maghreb.</li>
<li><b>Lah ybarek fik</b> : « que Dieu te bénisse », pour remercier chaleureusement.</li>
<li><b>Bsa7tek</b> (Maroc, Algérie) / <b>Saha</b> : « à ta santé », pour féliciter quelqu'un d'un nouvel habit, d'un repas ou d'une coupe de cheveux.</li>
<li><b>Inchallah</b> : « si Dieu le veut », pour parler de l'avenir.</li>
<li><b>Lah yr7am waldik</b> : « que Dieu bénisse tes parents », une façon très polie de dire merci.</li>
<li><b>Ma3lich</b> : « ce n'est pas grave », pour rassurer ou s'excuser.</li>
</ul>
<h2>Apprendre plus vite avec l'intelligence artificielle</h2>
<p>Un dictionnaire donne les mots ; pour les utiliser, il faut des phrases. Avec <a href="/">Sahbi</a>, tu peux demander :</p>
<div class="ex"><b>Exemple</b>Traduis en darija tunisienne : « Je voudrais deux kilos de tomates, c'est combien ? »</div>
<div class="ex"><b>Exemple</b>Explique-moi la différence entre « bghit » et « habit » avec 3 exemples.</div>
<div class="ex"><b>Exemple</b>Fais-moi un quiz de 10 mots en darija marocaine pour débutant.</div>
<p>Sahbi répond dans le dialecte demandé, en lettres latines ou en lettres arabes. Comme toute IA, il peut se tromper sur un mot très local : demande à un proche en cas de doute.</p>
<div class="card"><b>À lire aussi :</b> <a href="/guides/parler-darija-ia.html">Parler à une IA en darija</a> · <a href="/guides/prompts-darija-exemples.html">30 exemples de demandes en darija</a></div>
'''),

dict(slug='ecrire-arabizi-chiffres', minutes=7, date=DATE,
 title='Écrire en arabizi : que veulent dire les chiffres 3, 7, 9 dans les messages ?',
 desc='Le tableau complet de l\'arabizi (arabe ou darija en lettres latines) : à quelles lettres arabes correspondent 2, 3, 5, 6, 7, 8, 9, avec des exemples.',
 body=TABLE_CSS + '''
<p>« Salam, 3andek chi 7aja ? », « ch7al had l9ahwa ? » : si tu as déjà lu des messages venant du Maghreb, d'Égypte ou du Liban, tu as vu ces chiffres au milieu des mots. C'est l'<b>arabizi</b> (de « arabe » et « inglizi »), aussi appelé « franco-arabe » en Égypte ou « chat alphabet » : une façon d'écrire l'arabe et ses dialectes avec le clavier latin d'un téléphone. Les chiffres servent à noter les sons qui n'existent pas en français ou en anglais, parce que leur forme ressemble à la lettre arabe.</p>
<h2>Le tableau des chiffres</h2>
<div class="tw"><table><thead><tr><th>Chiffre</th><th>Lettre arabe</th><th>Son</th><th>Exemple</th></tr></thead><tbody>
<tr><td><b>2</b></td><td>ء (hamza)</td><td>petit arrêt dans la gorge</td><td>so2al (question), 2ana (moi, en Égypte/Levant)</td></tr>
<tr><td><b>3</b></td><td>ع (ʿayn)</td><td>son profond de la gorge</td><td>3afak (s'il te plaît), 3la (sur)</td></tr>
<tr><td><b>3'</b> ou <b>gh</b></td><td>غ (ghayn)</td><td>r grasseyé, comme « r » parisien</td><td>ghali (cher), 3'ali</td></tr>
<tr><td><b>5</b> ou <b>kh</b> / <b>7'</b></td><td>خ (khā)</td><td>comme la « jota » espagnole</td><td>5ouya / khouya (mon frère)</td></tr>
<tr><td><b>6</b></td><td>ط (ṭā)</td><td>t emphatique (surtout dans le Golfe)</td><td>6ayyib (d'accord)</td></tr>
<tr><td><b>7</b></td><td>ح (ḥā)</td><td>h soufflé, sans voix</td><td>7aja (chose), sa7bi (mon ami)</td></tr>
<tr><td><b>9</b></td><td>ق (qāf)</td><td>k prononcé au fond de la gorge</td><td>9alb (cœur), 9ahwa (café)</td></tr>
<tr><td><b>ch</b> / <b>sh</b></td><td>ش</td><td>« ch » français</td><td>chokran, shukran</td></tr>
</tbody></table></div>
<p>Il n'y a pas de règle officielle : chaque pays et même chaque personne a ses habitudes. Au Maghreb, on écrit plutôt <b>ch</b> et <b>ou</b> (à la française) ; en Égypte et au Moyen-Orient, plutôt <b>sh</b> et <b>u</b> (à l'anglaise). Le <b>8</b> est parfois utilisé pour غ au Levant, et le <b>9</b> désigne ص (ṣād) dans certains pays du Golfe : le contexte permet presque toujours de comprendre.</p>
<h2>Pourquoi les gens écrivent ainsi</h2>
<ul>
<li><b>Le clavier :</b> pendant longtemps, les téléphones et ordinateurs n'avaient pas de clavier arabe, ou il était peu pratique.</li>
<li><b>Le mélange des langues :</b> au Maghreb, on passe du français à la darija dans la même phrase ; rester en lettres latines évite de changer de clavier.</li>
<li><b>La darija s'écrit peu :</b> l'arabe standard a une orthographe fixe, mais la darija se parle surtout. Les lettres latines semblent plus naturelles pour écrire « comme on parle ».</li>
</ul>
<h2>Lire un message en arabizi, pas à pas</h2>
<div class="ex"><b>Message</b>Salam khouya, ch7al 3andek dyal lwa9t ? Bghit n9olek chi 7aja mohimma.</div>
<p>On remplace les chiffres : ch<b>ح</b>al = « combien », <b>ع</b>andek = « tu as », lwa<b>ق</b>t = « le temps », n<b>ق</b>olek = « je te dise », <b>ح</b>aja = « chose ». Traduction : « Salut mon frère, combien de temps tu as ? Je veux te dire quelque chose d'important. »</p>
<h2>L'arabizi et l'intelligence artificielle</h2>
<p>Beaucoup d'assistants d'IA lisent mal l'arabizi parce qu'ils ont surtout appris l'arabe standard écrit en lettres arabes. <a href="/">Sahbi</a> a été pensé pour cet usage : tu peux lui écrire en arabizi, il comprend les chiffres et te répond dans la même écriture. Tu peux aussi lui demander de convertir un message :</p>
<div class="ex"><b>Exemple</b>Réécris ce message en lettres arabes : « ana f dar, ghadi nji m3a l3achra ».</div>
<div class="card"><b>À lire aussi :</b> <a href="/guides/dictionnaire-darija-francais.html">Petit dictionnaire darija–français</a> · <a href="/guides/parler-darija-ia.html">Parler à une IA en darija</a></div>
'''),

dict(slug='omra-etapes-guide', minutes=11, date=DATE,
 title='Omra : les étapes expliquées simplement, de l\'ihram à la fin',
 desc='Guide clair des étapes de la Omra (ihram, tawaf, sa\'y, rasage ou coupe), des préparatifs (visa, application Nusuk, santé) et des conseils pratiques pour un premier voyage.',
 body='''
<p>La Omra est le « petit pèlerinage » à La Mecque. Contrairement au Hajj, qui a lieu à des dates précises du mois de Dhou al-Hijja, la Omra peut se faire presque toute l'année. Ce guide explique ses étapes dans l'ordre, avec des mots simples, et rassemble les points pratiques à préparer avant le départ. Il ne remplace pas l'avis d'un savant ou d'un guide religieux : en cas de doute sur un point de pratique, renseigne-toi auprès d'une personne de confiance de ta communauté.</p>
<h2>Avant le départ : les préparatifs</h2>
<ul>
<li><b>Le visa :</b> l'Arabie saoudite délivre des visas qui permettent la Omra, notamment le visa touristique électronique pour de nombreuses nationalités, ou un visa spécifique via une agence agréée. Les conditions changent régulièrement : vérifie toujours sur le site officiel saoudien ou auprès d'une agence agréée avant de réserver.</li>
<li><b>L'application Nusuk :</b> c'est la plateforme officielle saoudienne pour les pèlerins. Elle sert notamment à réserver certains créneaux (par exemple la visite de la Rawda à la mosquée du Prophète à Médine) et à obtenir des informations à jour.</li>
<li><b>La santé :</b> certaines vaccinations peuvent être exigées ou recommandées (par exemple contre la méningite). Consulte un médecin ou un centre de vaccinations internationales plusieurs semaines avant le départ.</li>
<li><b>La période :</b> pendant le Ramadan et les vacances scolaires, les prix augmentent et il y a beaucoup de monde. En été, la chaleur est très forte en journée.</li>
</ul>
<h2>Étape 1 : l'ihram (l'état de sacralisation)</h2>
<p>L'ihram est l'état dans lequel le pèlerin entre avant d'accomplir la Omra. Il se prend au plus tard aux <b>miqat</b>, des limites fixées autour de La Mecque ; en avion, on le prend souvent avant d'atteindre le miqat, et les compagnies l'annoncent à bord.</p>
<ul>
<li>On fait ses ablutions complètes (ghusl) si possible et on se parfume avant, pas après.</li>
<li>Les hommes portent deux pièces de tissu blanc non cousues ; les femmes gardent des vêtements amples et pudiques de leur choix, le visage et les mains découverts.</li>
<li>On formule l'intention de faire la Omra, puis on récite la <b>talbiya</b> : « Labbayka Allahumma labbayk… », que l'on répète jusqu'à l'arrivée à la Kaaba.</li>
<li>En état d'ihram, certaines choses sont interdites : se couper les cheveux ou les ongles, se parfumer, chasser, se marier, et pour les hommes se couvrir la tête ou porter des vêtements cousus.</li>
</ul>
<h2>Étape 2 : le tawaf (les sept tours de la Kaaba)</h2>
<p>Arrivé à la mosquée sacrée (Al-Masjid al-Haram), on accomplit le tawaf : <b>sept tours autour de la Kaaba</b>, dans le sens inverse des aiguilles d'une montre, en commençant au niveau de la Pierre noire. Une ligne ou un repère lumineux indique souvent ce point de départ. À chaque passage devant la Pierre noire, on la salue de la main droite, de loin si l'on ne peut pas s'en approcher. On peut faire les invocations de son choix, dans sa langue.</p>
<p>Après les sept tours, on prie deux unités de prière (rak'a), si possible derrière le Maqam Ibrahim, puis on boit de l'eau de <b>Zamzam</b>, disponible gratuitement dans toute la mosquée.</p>
<h2>Étape 3 : le sa'y (entre Safa et Marwa)</h2>
<p>Le sa'y consiste à parcourir <b>sept fois</b> la distance entre les deux collines de Safa et Marwa, aujourd'hui à l'intérieur d'une longue galerie climatisée. On commence à Safa et on termine à Marwa : l'aller compte pour un trajet, le retour pour un deuxième. Une zone signalée par des lumières vertes marque l'endroit où les hommes pressent le pas. Il existe des voies et des fauteuils pour les personnes âgées ou à mobilité réduite.</p>
<h2>Étape 4 : le rasage ou la coupe des cheveux</h2>
<p>Pour terminer la Omra, les hommes se rasent la tête (halq) ou raccourcissent leurs cheveux (taqsir) ; les femmes coupent une petite mèche, de la longueur d'une phalange. De nombreux coiffeurs se trouvent autour de Marwa. Les interdits de l'ihram sont alors levés : la Omra est accomplie.</p>
<h2>Conseils pratiques pour un premier voyage</h2>
<ul>
<li><b>Les horaires :</b> le tawaf est plus calme tard le soir ou très tôt le matin, hors périodes de grande affluence.</li>
<li><b>Les chaussures :</b> on les retire dans la mosquée ; garde un petit sac pour les porter et retiens le numéro de la porte par laquelle tu es entré.</li>
<li><b>L'hydratation :</b> l'eau de Zamzam est fraîche et partout ; bois régulièrement, surtout en été.</li>
<li><b>La visite de Médine :</b> elle ne fait pas partie de la Omra, mais la plupart des pèlerins s'y rendent, souvent en train à grande vitesse (Haramain) entre La Mecque, Djeddah et Médine.</li>
<li><b>L'argent et les papiers :</b> garde une copie numérique de ton passeport et de ton visa, et note l'adresse de ton hôtel en arabe.</li>
</ul>
<h2>Préparer son voyage avec Sahbi</h2>
<p>Dans <a href="/">Sahbi</a>, la rubrique <b>« Agent voyage &amp; Omra »</b> t'aide à préparer le séjour : programme jour par jour, liste des documents et de la valise, idées d'hôtels près du Haram avec liens, rappels pour le visa et les vaccins. Tu peux aussi lui demander d'expliquer une étape dans ta langue, en darija ou en arabe. Pour toute question religieuse précise, Sahbi te conseillera de consulter un savant.</p>
<div class="card"><b>À lire aussi :</b> <a href="/guides/horaires-priere-calcul.html">Horaires de prière : comment sont-ils calculés ?</a></div>
'''),

dict(slug='cv-france-diplome-maghreb', minutes=10, date=DATE,
 title='Faire son CV en France avec un diplôme du Maghreb : méthode et modèle',
 desc='Comment présenter un diplôme marocain, algérien ou tunisien sur un CV en France : équivalence, traduction, expériences, langues, et un modèle de CV commenté.',
 body='''
<p>Tu as fait tes études au Maroc, en Algérie ou en Tunisie et tu cherches du travail en France ? Ton expérience a de la valeur, mais un recruteur français ne connaît pas forcément ton école ni le niveau exact de ton diplôme. Un bon CV doit donc <b>traduire</b> ton parcours dans des repères qu'il comprend tout de suite. Voici une méthode simple, étape par étape.</p>
<h2>1. Le format qu'attendent les recruteurs en France</h2>
<ul>
<li><b>Une page</b> si tu as moins de dix ans d'expérience, deux au maximum ensuite.</li>
<li>En haut : nom, prénom, ville, téléphone, adresse e-mail sérieuse, et le <b>titre du poste visé</b> (par exemple « Technicien de maintenance électrique »).</li>
<li>La photo n'est pas obligatoire en France. L'âge, la situation familiale ou la nationalité n'ont pas besoin d'y figurer, sauf si tu choisis de les indiquer.</li>
<li>Ordre conseillé : profil en 2-3 lignes, expériences (de la plus récente à la plus ancienne), formation, compétences, langues.</li>
</ul>
<h2>2. Présenter ton diplôme pour qu'il soit compris</h2>
<p>Écris le nom exact du diplôme dans sa langue d'origine, puis ajoute entre parenthèses un repère : durée des études et domaine. Par exemple : <i>« Licence en génie électrique (Bac+3), Université Hassan II, Casablanca »</i> ou <i>« Diplôme de technicien supérieur en informatique (Bac+2), Algérie »</i>.</p>
<p>Pour aller plus loin, tu peux demander une <b>attestation de comparabilité</b> auprès de France Éducation international (centre ENIC-NARIC France). Ce document officiel indique à quel niveau du système français correspond ton diplôme étranger ; il est souvent apprécié par les employeurs et parfois demandé pour certains concours ou formations. La démarche se fait en ligne et peut prendre plusieurs semaines : lance-la tôt.</p>
<p>Si ton diplôme est rédigé en arabe, prépare une <b>traduction par un traducteur assermenté</b> : elle sera nécessaire pour la plupart des démarches officielles.</p>
<h2>3. Mettre en valeur ton expérience au Maghreb</h2>
<p>Pour chaque poste, indique l'entreprise, la ville et le pays, les dates, puis 3 ou 4 lignes de réalisations concrètes avec des chiffres : nombre de clients, taille de l'équipe, budget, résultats. Si l'entreprise est peu connue en France, ajoute une courte précision : <i>« (distributeur de matériel électrique, 120 salariés) »</i>.</p>
<div class="ex"><b>Moins efficace</b>Responsable des ventes. Gestion des clients.</div>
<div class="ex"><b>Plus efficace</b>Responsable des ventes – 4 commerciaux, 300 clients professionnels. Hausse du chiffre d'affaires de 18 % en 2 ans grâce à un nouveau suivi des devis.</div>
<h2>4. Les langues : un vrai atout</h2>
<p>Ne sous-estime pas tes langues. Arabe, darija, français, parfois anglais, amazigh ou espagnol : c'est une force pour les postes en contact avec la clientèle, le commerce international, la logistique, la santé ou le social. Indique un niveau clair, par exemple avec l'échelle européenne (A1 à C2) : <i>« Arabe : langue maternelle · Français : C1 · Anglais : B2 »</i>.</p>
<h2>5. Le modèle commenté</h2>
<div class="card">
<b>Karim B.</b> — Lyon · 06 00 00 00 00 · karim.b@email.com<br>
<b>Technicien de maintenance électrique</b><br><br>
<b>Profil</b> — 6 ans d'expérience en maintenance industrielle au Maroc, habilitations électriques, disponible immédiatement.<br><br>
<b>Expérience</b><br>
2021–2026 · Technicien de maintenance, usine agroalimentaire (250 salariés), Kénitra, Maroc — maintenance préventive de 40 machines, réduction des pannes de 25 %, formation de 3 apprentis.<br>
2019–2021 · Électricien, entreprise de bâtiment, Rabat, Maroc — installations électriques de logements neufs.<br><br>
<b>Formation</b> — Diplôme de technicien spécialisé en électromécanique (Bac+2), OFPPT, Maroc · Attestation de comparabilité en cours.<br><br>
<b>Langues</b> — Arabe, darija : maternelles · Français : C1 · Anglais : B1
</div>
<h2>6. La lettre de motivation et les dernières vérifications</h2>
<ul>
<li>Adapte le titre et le profil du CV à chaque offre : les recruteurs lisent souvent moins d'une minute.</li>
<li>Fais relire l'orthographe : une faute sur le CV compte plus qu'on ne le croit.</li>
<li>Envoie le CV en <b>PDF</b>, nommé « CV-Prénom-Nom.pdf ».</li>
<li>Inscris-toi sur France Travail et sur les sites d'emploi de ton secteur, et active ton réseau.</li>
</ul>
<h2>Écrire ton CV avec Sahbi</h2>
<p>Dans <a href="/">Sahbi</a>, choisis « CV » ou écris simplement « Aide-moi à faire mon CV ». Raconte ton parcours dans ta langue, même en darija : Sahbi pose les bonnes questions, reformule en français professionnel et te donne un CV prêt à copier ou à imprimer en PDF. Il peut aussi écrire la lettre de motivation adaptée à une offre que tu lui colles.</p>
<div class="card"><b>À lire aussi :</b> <a href="/guides/lettres-administratives-modeles.html">Lettres administratives : modèles prêts à l'emploi</a></div>
'''),

dict(slug='lettres-administratives-modeles', minutes=9, date=DATE,
 title='Lettres administratives en France : 4 modèles prêts à l\'emploi',
 desc='Modèles de lettres simples pour demander un rendez-vous, faire une réclamation, résilier un abonnement ou demander un document, avec les règles de présentation.',
 body='''
<p>Écrire à une administration, une banque ou un fournisseur d'énergie fait peur à beaucoup de personnes, surtout quand le français n'est pas leur première langue. Pourtant, une lettre administrative suit toujours le même plan. Voici les règles de base, puis quatre modèles à adapter. Remplace tout ce qui est entre crochets.</p>
<h2>Les règles de présentation</h2>
<ul>
<li><b>En haut à gauche :</b> tes nom, prénom, adresse, téléphone, e-mail, et si besoin ton numéro de dossier, d'allocataire ou de client.</li>
<li><b>En dessous à droite :</b> le nom et l'adresse du destinataire.</li>
<li><b>Lieu et date :</b> « Lyon, le 24 novembre 2026 ».</li>
<li><b>Objet :</b> une ligne qui résume la demande. C'est la ligne la plus importante.</li>
<li><b>Le texte :</b> court, poli, une idée par paragraphe : la situation, la demande, la formule de politesse.</li>
<li><b>Signature</b> à la fin. Garde toujours une copie de la lettre.</li>
</ul>
<p>Pour une démarche importante (résiliation, contestation, délai à respecter), envoie la lettre en <b>recommandé avec accusé de réception</b> : c'est ta preuve d'envoi et de réception. Beaucoup d'organismes proposent aussi une messagerie sur leur espace en ligne, qui garde une trace de tes échanges.</p>
<h2>Modèle 1 : demander un rendez-vous</h2>
<div class="card">Objet : Demande de rendez-vous<br><br>Madame, Monsieur,<br><br>Je souhaiterais obtenir un rendez-vous afin de [faire le point sur mon dossier / déposer des documents / obtenir des informations sur …]. Mon numéro de dossier est le [numéro].<br><br>Je suis disponible [les matins / à partir de 14 h / en semaine]. Vous pouvez me joindre au [téléphone] ou par e-mail à [adresse].<br><br>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.<br><br>[Prénom Nom]</div>
<h2>Modèle 2 : faire une réclamation</h2>
<div class="card">Objet : Réclamation – [facture n° / commande n° / dossier n°]<br><br>Madame, Monsieur,<br><br>Le [date], [décris le problème en une ou deux phrases : j'ai reçu une facture de 240 € alors que mon contrat prévoit 80 € par mois].<br><br>Je vous demande de bien vouloir [corriger cette facture / me rembourser la somme de … / me livrer le produit commandé] dans les meilleurs délais. Vous trouverez ci-joint une copie de [la facture, du contrat, de la commande].<br><br>Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.<br><br>[Prénom Nom]</div>
<h2>Modèle 3 : résilier un abonnement</h2>
<div class="card">Objet : Résiliation de mon contrat n° [numéro]<br><br>Madame, Monsieur,<br><br>Par la présente, je vous informe de ma décision de résilier mon contrat [d'abonnement internet / de téléphone / de salle de sport] n° [numéro], au nom de [Prénom Nom].<br><br>Je vous remercie de prendre en compte cette résiliation dans le respect des conditions prévues au contrat, et de me confirmer par écrit la date de fin ainsi que le montant du dernier paiement.<br><br>Veuillez agréer, Madame, Monsieur, mes salutations distinguées.<br><br>[Prénom Nom]</div>
<p>Bon à savoir : pour les contrats souscrits en ligne, les entreprises doivent aussi proposer une résiliation en ligne, en quelques clics, depuis ton espace client. Vérifie ton contrat pour connaître le préavis éventuel.</p>
<h2>Modèle 4 : demander un document</h2>
<div class="card">Objet : Demande de [attestation / relevé / certificat]<br><br>Madame, Monsieur,<br><br>Je vous serais reconnaissant(e) de bien vouloir me faire parvenir [une attestation de … / un relevé de … pour la période du … au …]. Ce document m'est demandé pour [un dossier de logement / une inscription / une démarche auprès de …].<br><br>Je vous remercie par avance et vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.<br><br>[Prénom Nom]</div>
<h2>Les formules utiles</h2>
<ul>
<li>Pour commencer : « Je me permets de vous écrire au sujet de… », « Suite à notre échange téléphonique du… ».</li>
<li>Pour demander : « Je vous serais reconnaissant(e) de bien vouloir… ».</li>
<li>Pour joindre un document : « Vous trouverez ci-joint… ».</li>
<li>Pour finir : « Je reste à votre disposition pour tout renseignement complémentaire. »</li>
</ul>
<h2>Faire écrire la lettre par Sahbi</h2>
<p>Dans <a href="/">Sahbi</a>, appuie sur « Lettre » ou explique ta situation comme tu la dirais à un ami, en darija, en arabe ou en français : « kteb li lettre l CAF, bghit nbeddel l'adresse dyali ». Sahbi rédige une lettre propre en français, avec l'objet et les formules, que tu peux copier ou imprimer. Pour une démarche juridique importante, demande aussi conseil à une association ou à un professionnel.</p>
<div class="card"><b>À lire aussi :</b> <a href="/guides/cv-france-diplome-maghreb.html">Faire son CV en France avec un diplôme du Maghreb</a></div>
'''),

dict(slug='prompts-darija-exemples', minutes=8, date=DATE,
 title='30 exemples de demandes à une IA en darija, prêts à copier',
 desc='Des exemples concrets de demandes (prompts) en darija marocaine, algérienne et tunisienne pour l\'école, le travail, la cuisine, les démarches et la création d\'images.',
 body='''
<p>Tu ne sais pas quoi demander à une intelligence artificielle, ou tu obtiens des réponses trop générales ? Le secret, c'est de demander comme à un ami qui s'y connaît : dire le contexte, ce que tu veux exactement, et sous quelle forme. Voici trente exemples classés par thème, en darija (lettres latines) avec leur sens en français. Copie-les dans <a href="/">Sahbi</a> et adapte-les à ta situation.</p>
<h2>La règle des 3 C : contexte, contenu, consigne</h2>
<ul>
<li><b>Contexte :</b> qui tu es, pour qui c'est. « Ana étudiant f 2ème année droit… »</li>
<li><b>Contenu :</b> ce que tu veux. « …bghit résumé dyal chapitre 4… »</li>
<li><b>Consigne :</b> la forme. « …f 10 points, b français sahl. »</li>
</ul>
<h2>École et études (1 à 8)</h2>
<ol>
<li>« Fasserli had l'exercice dyal maths step by step, b darija. » — Explique-moi cet exercice étape par étape.</li>
<li>« 3tini quiz dyal 10 questions 3la la Révolution française. » — Fais-moi un quiz de 10 questions.</li>
<li>« Dir li fiche de révision 3la chapitre dyal SVT, f page wa7da. » — Une fiche de révision d'une page.</li>
<li>« Sa77e7 li had l'paragraphe w gouli fin ghlatt. » — Corrige ce paragraphe et explique mes fautes.</li>
<li>« Chno l far9 bin passé composé w imparfait ? 3tini amthila. » — La différence, avec des exemples.</li>
<li>« 3awenni nwejjed exposé 3la l'énergie solaire, plan w introduction. » — Un plan d'exposé.</li>
<li>« Traduis had l texte l anglais w fasserli l kalimat s3ab. » — Traduis et explique les mots difficiles.</li>
<li>« 3tini planning dyal révision l bac 3la 30 youm. » — Un planning de révision sur 30 jours.</li>
</ol>
<h2>Travail et argent (9 à 15)</h2>
<ol start="9">
<li>« Kteb li CV b français, ana chauffeur 3andi 8 snin d l'expérience. »</li>
<li>« Wajjed li lettre de motivation l had l'offre : [colle l'offre]. »</li>
<li>« Kifach nwajjed l'entretien d'embauche ? 3tini 10 questions w ajwiba. »</li>
<li>« 3andi ma7al dyal l7wayj f Tunis, 3tini 7 posts Facebook l simana. »</li>
<li>« 7seb li l marge : chrit b 40 dinar, bghit nbi3 b rb7 30 %. »</li>
<li>« Kteb li devis l client : 3 portes b 1200 dh l wa7da, TVA 20 %. »</li>
<li>« Jawb 3la had l'avis dyal client b ladab : [colle l'avis]. »</li>
</ol>
<h2>Démarches et vie quotidienne (16 à 22)</h2>
<ol start="16">
<li>« Kteb li message l mairie bach ntleb rendez-vous, b français rasmi. »</li>
<li>« Fasserli had l courrier dyal impôts b darija : [colle le texte]. »</li>
<li>« Chno l wra9 li khasni l passeport ? » (puis vérifie sur le site officiel)</li>
<li>« Wajjed li message WhatsApp d l'absence : ma kaynch 7ta l 6 d l3chiya. »</li>
<li>« Fakkarni ghedda f 9 d sba7 bach n3ayet l tbib. » — Un rappel dans le calendrier.</li>
<li>« Chno l jaw f Casablanca had l weekend ? »</li>
<li>« 3tini programme dyal Omra 10 iyam m3a l wra9 w l valise. »</li>
</ol>
<h2>Cuisine, famille et loisirs (23 à 27)</h2>
<ol start="23">
<li>« 3tini wasfa dyal harira l 6 dyal nass, b l9iyas. » — Une recette pour 6 personnes.</li>
<li>« Chno nteyyeb b had chi li 3andi f frigo : bid, batata, tomatich ? »</li>
<li>« Kteb li 9issa sghira l wlidi 3la l9tat w l fdaa, 3mro 6 snin. »</li>
<li>« 3tini afkar dyal cadeau l mama b a9al men 300 dh. »</li>
<li>« Wajjed li programme dyal sport f dar, 20 d9i9a, débutant. »</li>
</ol>
<h2>Images et créations (28 à 30)</h2>
<ol start="28">
<li>« Dir li carte « Aïd Moubarak » b smiyti Youssef, alwan khdar w dheb. »</li>
<li>« Rad had la photo cartoon style 3D. » (avec une photo)</li>
<li>« Dir li logo l ma7al dyal l9ahwa smito « Dar Atay ». »</li>
</ol>
<h2>Pour aller plus loin</h2>
<p>Si la réponse ne te convient pas, ne recommence pas de zéro : dis simplement ce qui ne va pas (« plus court », « b darija machi b fusha », « zid amthila »). L'IA garde le fil de la conversation. Et n'oublie pas : pour la santé, l'argent ou les démarches officielles, vérifie toujours les informations importantes.</p>
<div class="card"><b>À lire aussi :</b> <a href="/guides/parler-darija-ia.html">Parler à une IA en darija</a> · <a href="/guides/ecrire-arabizi-chiffres.html">Écrire en arabizi</a></div>
'''),
]
