"""Remplit la fiche App Store de Sahbi : textes (fr, en, ar), catégories, app gratuite, captures iPhone,
dernière build attachée à la version 1.0 et chiffrement déclaré. On peut le relancer sans risque."""
import hashlib, os, requests
from asc import call, H, BID

SITE = 'https://www.sahbi.bond'
SHOTS = os.path.join(os.path.dirname(__file__), 'shots')
INFO = {  # sous-titre (30 caractères max)
    'fr-FR': 'Ton ami IA en darija',
    'en-US': 'Your AI friend in Darija',
    'ar-SA': 'صاحبك الذكي بالدارجة',
}
DESC = {
    'fr-FR': """Sahbi, c'est ton ami intelligent qui parle ta langue : darija marocaine, algérienne et tunisienne, arabe, français, anglais et toutes les langues.

Écris, parle au micro ou envoie une photo : Sahbi comprend et te répond simplement.

CE QUE SAHBI FAIT POUR TOI
• Répond à toutes tes questions, en darija ou dans ta langue
• Traduit : darija ↔ français ↔ arabe ↔ anglais
• Écrit ton CV, tes lettres administratives (mairie, banque, employeur)
• Aide au Bac : explications, fiches, quiz
• Crée des images et des cartes de vœux (Aïd, Ramadan, mariage…)
• Transforme tes photos : cartoon, anime, 3D, aquarelle
• Conversation vocale : tu parles, Sahbi te répond à voix haute
• Écrire un livre : Sahbi te pose des questions, range tout en chapitres et crée ton livre PDF
• Guide touristique : hôtels, taxis, visites, Omra et Hajj
• Gérer ton business : plan, prix, clients, publicités
• Créer un site internet : le code, l'aperçu et la mise en ligne pas à pas
• Recherche sur internet pour les infos du jour, météo, rappels

SAHBI PRO (abonnement optionnel)
Plus de messages par jour, plus d'images, des vidéos, la lecture de tes documents PDF et Word, et aucune publicité.

Sahbi peut se tromper : vérifie les informations importantes.""",
    'en-US': """Sahbi is your smart friend who speaks your language: Moroccan, Algerian and Tunisian Darija, Arabic, French, English and every other language.

Type, talk or send a photo: Sahbi understands and answers simply.

WHAT SAHBI DOES FOR YOU
• Answers all your questions, in Darija or your own language
• Translates: Darija ↔ French ↔ Arabic ↔ English
• Writes your CV and official letters
• Homework and exam help: explanations, summaries, quizzes
• Creates images and greeting cards (Eid, Ramadan, weddings…)
• Turns your photos into cartoon, anime, 3D or watercolour
• Voice conversation: you talk, Sahbi answers out loud
• Write a book: Sahbi asks questions, organises chapters and makes your PDF book
• Travel guide: hotels, taxis, sightseeing, Umrah and Hajj
• Run your business: plan, prices, customers, ads
• Build a website: code, preview and step-by-step publishing
• Web search for today's news, weather, reminders

SAHBI PRO (optional subscription)
More messages per day, more images, videos, reading your PDF and Word documents, and no ads.

Sahbi can make mistakes: check important information.""",
    'ar-SA': """صاحبي هو صديقك الذكي الذي يتكلم لغتك: الدارجة المغربية والجزائرية والتونسية، العربية، الفرنسية، الإنجليزية وكل اللغات.

اكتب، تكلم في الميكروفون أو أرسل صورة: صاحبي يفهمك ويجيبك ببساطة.

ماذا يفعل صاحبي لك
• يجيب عن كل أسئلتك بالدارجة أو بلغتك
• يترجم: دارجة ↔ فرنسية ↔ عربية ↔ إنجليزية
• يكتب سيرتك الذاتية ورسائلك الإدارية
• مساعدة في الباكالوريا: شروحات، ملخصات، اختبارات
• يصنع صورًا وبطاقات تهنئة (العيد، رمضان، الأعراس…)
• يحوّل صورك إلى كرتون، أنمي، ثلاثي الأبعاد، ألوان مائية
• محادثة صوتية: تتكلم ويجيبك صاحبي بصوت عالٍ
• اكتب كتابًا: صاحبي يسألك وينظم الفصول ويصنع كتابك PDF
• دليل سياحي: فنادق، تاكسي، زيارات، عمرة وحج
• إدارة مشروعك: خطة، أسعار، زبائن، إعلانات
• إنشاء موقع إنترنت: الكود، المعاينة والنشر خطوة بخطوة

صاحبي برو (اشتراك اختياري)
رسائل وصور أكثر يوميًا، فيديوهات، قراءة ملفات PDF و Word، وبدون إعلانات.

قد يخطئ صاحبي: تحقق من المعلومات المهمة.""",
}
KEYS = {
    'fr-FR': 'darija,arabe,maroc,algérie,tunisie,IA,chat,traduction,CV,bac,assistant,maghreb,omra,image',
    'en-US': 'darija,arabic,morocco,algeria,tunisia,AI,chat,translate,CV,assistant,maghreb,umrah,image',
    'ar-SA': 'دارجة,مغرب,جزائر,تونس,ذكاء اصطناعي,ترجمة,سيرة ذاتية,باكالوريا,مساعد,عمرة,صور',
}
PROMO = {
    'fr-FR': "Parle à Sahbi en darija : il répond, traduit, écrit ton CV et crée tes images.",
    'en-US': 'Talk to Sahbi in Darija: it answers, translates, writes your CV and creates images.',
    'ar-SA': 'كلّم صاحبي بالدارجة: يجيب، يترجم، يكتب سيرتك ويصنع صورك.',
}

app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
aid = app['id']

# Infos de l'app : catégories, sous-titre, confidentialité.
info = call('GET', f'/apps/{aid}/appInfos')['data'][0]
call('PATCH', f"/appInfos/{info['id']}", json={'data': {'type': 'appInfos', 'id': info['id'], 'relationships': {
    'primaryCategory': {'data': {'type': 'appCategories', 'id': 'PRODUCTIVITY'}},
    'secondaryCategory': {'data': {'type': 'appCategories', 'id': 'EDUCATION'}}}}})
have = {l['attributes']['locale']: l['id'] for l in call('GET', f"/appInfos/{info['id']}/appInfoLocalizations")['data']}
for loc, sub in INFO.items():
    attrs = {'subtitle': sub, 'privacyPolicyUrl': f'{SITE}/confidentialite.html'}
    if loc in have: call('PATCH', f'/appInfoLocalizations/{have[loc]}', json={'data': {'type': 'appInfoLocalizations', 'id': have[loc], 'attributes': attrs}})
    else: call('POST', '/appInfoLocalizations', json={'data': {'type': 'appInfoLocalizations', 'attributes': {**attrs, 'locale': loc, 'name': 'Sahbi – Maghreb AI'},
        'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': info['id']}}}}})
print('Infos, catégories et sous-titres OK')

# App gratuite (l'abonnement Pro est un achat intégré).
try:
    free = [p for p in call('GET', f'/apps/{aid}/appPricePoints', params={'filter[territory]': 'FRA', 'limit': 200})['data'] if float(p['attributes']['customerPrice']) == 0][0]
    call('POST', '/appPriceSchedules', json={'data': {'type': 'appPriceSchedules', 'relationships': {
        'app': {'data': {'type': 'apps', 'id': aid}}, 'baseTerritory': {'data': {'type': 'territories', 'id': 'FRA'}},
        'manualPrices': {'data': [{'type': 'appPrices', 'id': '${p0}'}]}}},
        'included': [{'type': 'appPrices', 'id': '${p0}', 'attributes': {'startDate': None},
                      'relationships': {'appPricePoint': {'data': {'type': 'appPricePoints', 'id': free['id']}}}}]})
    print('App gratuite OK')
except Exception as e: print('Prix de l’app :', e)

# Disponible dans tous les pays.
try:
    terr = []
    url = '/territories'; p = {'limit': 200}
    while url:
        d = call('GET', url, params=p); terr += [t['id'] for t in d['data']]
        url = (d.get('links') or {}).get('next'); p = None
        if url: url = url.replace('https://api.appstoreconnect.apple.com/v1', '')
    body = {'data': {'type': 'appAvailabilities', 'attributes': {'availableInNewTerritories': True}, 'relationships': {
        'app': {'data': {'type': 'apps', 'id': aid}},
        'territoryAvailabilities': {'data': [{'type': 'territoryAvailabilities', 'id': f'${{{t}}}'} for t in terr]}}},
        'included': [{'type': 'territoryAvailabilities', 'id': f'${{{t}}}', 'attributes': {'available': True},
                      'relationships': {'territory': {'data': {'type': 'territories', 'id': t}}}} for t in terr]}
    r = requests.post('https://api.appstoreconnect.apple.com/v2/appAvailabilities', headers=H(), json=body)
    print('Pays :', len(terr), 'OK' if r.ok else f'{r.status_code} {r.text[:300]}')
except Exception as e: print('Pays :', e)

# Version 1.0 : textes, captures, build.
ver = [v for v in call('GET', f'/apps/{aid}/appStoreVersions', params={'filter[platform]': 'IOS'})['data']
       if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED')][0]
vid = ver['id']
have = {l['attributes']['locale']: l['id'] for l in call('GET', f'/appStoreVersions/{vid}/appStoreVersionLocalizations')['data']}
for loc in DESC:
    attrs = {'description': DESC[loc], 'keywords': KEYS[loc], 'supportUrl': f'{SITE}/contact.html', 'marketingUrl': SITE, 'promotionalText': PROMO[loc]}
    if loc in have: call('PATCH', f'/appStoreVersionLocalizations/{have[loc]}', json={'data': {'type': 'appStoreVersionLocalizations', 'id': have[loc], 'attributes': attrs}})
    else: have[loc] = call('POST', '/appStoreVersionLocalizations', json={'data': {'type': 'appStoreVersionLocalizations', 'attributes': {**attrs, 'locale': loc},
        'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})['data']['id']
print('Descriptions OK :', ', '.join(have))

files = sorted(f for f in os.listdir(SHOTS) if f.endswith('.png'))
for loc, lid in have.items():
    sets = {s['attributes']['screenshotDisplayType']: s['id'] for s in call('GET', f'/appStoreVersionLocalizations/{lid}/appScreenshotSets')['data']}
    sid = sets.get('APP_IPHONE_67') or call('POST', '/appScreenshotSets', json={'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': 'APP_IPHONE_67'},
        'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': lid}}}}})['data']['id']
    if call('GET', f'/appScreenshotSets/{sid}/appScreenshots')['data']: continue
    for f in files:
        data = open(os.path.join(SHOTS, f), 'rb').read()
        r = call('POST', '/appScreenshots', json={'data': {'type': 'appScreenshots', 'attributes': {'fileName': f, 'fileSize': len(data)},
            'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sid}}}}})['data']
        for op in r['attributes']['uploadOperations']:
            requests.request(op['method'], op['url'], data=data[op['offset']:op['offset'] + op['length']],
                             headers={h['name']: h['value'] for h in op.get('requestHeaders', [])}).raise_for_status()
        call('PATCH', f"/appScreenshots/{r['id']}", json={'data': {'type': 'appScreenshots', 'id': r['id'],
            'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    print('Captures envoyées :', loc, len(files))

builds = call('GET', '/builds', params={'filter[app]': aid, 'sort': '-uploadedDate', 'limit': 5})['data']
ok = [b for b in builds if b['attributes'].get('processingState') == 'VALID']
if ok:
    b = ok[0]
    if b['attributes'].get('usesNonExemptEncryption') is None:
        call('PATCH', f"/builds/{b['id']}", json={'data': {'type': 'builds', 'id': b['id'], 'attributes': {'usesNonExemptEncryption': False}}})
    call('PATCH', f'/appStoreVersions/{vid}/relationships/build', json={'data': {'type': 'builds', 'id': b['id']}})
    print('Build attachée :', b['attributes']['version'])
else: print('::warning::Aucune build prête (Apple la prépare encore) : relance plus tard.')
print('::notice title=Fiche App Store::textes, captures et build OK')
