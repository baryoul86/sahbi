"""Crée (ou complète) l'abonnement « Sahbi Pro » dans App Store Connect : groupe, produit mensuel,
textes fr/en/ar, tous les pays, prix 6,99 € (Apple calcule les autres monnaies), capture pour l'examen.
On peut le relancer sans risque : ce qui existe déjà n'est pas recréé."""
import hashlib, os, requests
from asc import call, BID

PID, GROUP = 'sahbi_pro_monthly', 'Sahbi Pro'
EUR = os.environ.get('PRICE_EUR', '6.99')
TEXT = {
    'fr-FR': ('Sahbi Pro', 'Plus de messages, images, vidéos, sans pub'),
    'en-US': ('Sahbi Pro', 'More messages, images, videos, no ads'),
    'ar-SA': ('صاحبي برو', 'رسائل وصور وفيديوهات أكثر، بدون إعلانات'),
}

def all_pages(path, params=None):
    out, url, p = [], path, dict(params or {}, limit=200)
    while url:
        d = call('GET', url, params=p)
        out += d.get('data', []); url = (d.get('links') or {}).get('next'); p = None
        if url: url = url.replace('https://api.appstoreconnect.apple.com/v1', '')
    return out

app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
print('App :', app['attributes']['name'], app['id'])

groups = [g for g in call('GET', f"/apps/{app['id']}/subscriptionGroups")['data'] if g['attributes']['referenceName'] == GROUP]
if groups: gid = groups[0]['id']
else:
    gid = call('POST', '/subscriptionGroups', json={'data': {'type': 'subscriptionGroups', 'attributes': {'referenceName': GROUP},
        'relationships': {'app': {'data': {'type': 'apps', 'id': app['id']}}}}})['data']['id']
    print('Groupe créé')
have = {l['attributes']['locale'] for l in call('GET', f'/subscriptionGroups/{gid}/subscriptionGroupLocalizations')['data']}
for loc, (name, _) in TEXT.items():
    if loc not in have:
        call('POST', '/subscriptionGroupLocalizations', json={'data': {'type': 'subscriptionGroupLocalizations', 'attributes': {'name': name, 'locale': loc},
            'relationships': {'subscriptionGroup': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}})

subs = [s for s in call('GET', f'/subscriptionGroups/{gid}/subscriptions')['data'] if s['attributes']['productId'] == PID]
if subs: sid = subs[0]['id']
else:
    sid = call('POST', '/subscriptions', json={'data': {'type': 'subscriptions', 'attributes': {
        'name': 'Sahbi Pro mensuel', 'productId': PID, 'subscriptionPeriod': 'ONE_MONTH', 'familySharable': False, 'groupLevel': 1,
        'reviewNote': "Sahbi Pro débloque plus de messages par jour, plus d'images, les vidéos, la voix et supprime la publicité. Bouton « Pro » en haut de l'écran."},
        'relationships': {'group': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}})['data']['id']
    print('Abonnement créé :', PID)
have = {l['attributes']['locale'] for l in call('GET', f'/subscriptions/{sid}/subscriptionLocalizations')['data']}
for loc, (name, desc) in TEXT.items():
    if loc not in have:
        call('POST', '/subscriptionLocalizations', json={'data': {'type': 'subscriptionLocalizations', 'attributes': {'name': name, 'locale': loc, 'description': desc},
            'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}}}})

# Tous les pays.
terr = [t['id'] for t in all_pages('/territories')]
try:
    call('POST', '/subscriptionAvailabilities', json={'data': {'type': 'subscriptionAvailabilities', 'attributes': {'availableInNewTerritories': True},
        'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}},
                          'availableTerritories': {'data': [{'type': 'territories', 'id': t} for t in terr]}}}})
    print('Disponible dans', len(terr), 'pays')
except Exception as e: print('Disponibilité déjà réglée ?', e)

# Prix : 6,99 € en France, puis le même niveau dans tous les autres pays (équivalences d'Apple).
priced = set()
for p in all_pages(f'/subscriptions/{sid}/prices', {'include': 'territory'}):
    t = ((p.get('relationships') or {}).get('territory') or {}).get('data')
    if t: priced.add(t['id'])
fra = [pp for pp in all_pages(f'/subscriptions/{sid}/pricePoints', {'filter[territory]': 'FRA'}) if pp['attributes']['customerPrice'] == EUR]
if not fra: raise SystemExit(f'Prix {EUR} € introuvable pour la France')
def set_price(ppid, t):
    call('POST', '/subscriptionPrices', json={'data': {'type': 'subscriptionPrices', 'attributes': {'preserveCurrentPrice': False},
        'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}},
                          'subscriptionPricePoint': {'data': {'type': 'subscriptionPricePoints', 'id': ppid}},
                          'territory': {'data': {'type': 'territories', 'id': t}}}}})
if 'FRA' not in priced: set_price(fra[0]['id'], 'FRA'); priced.add('FRA')
eq = all_pages(f"/subscriptionPricePoints/{fra[0]['id']}/equalizations", {'include': 'territory'})
n = 0
for pp in eq:
    t = ((pp.get('relationships') or {}).get('territory') or {}).get('data')
    if t and t['id'] not in priced:
        try: set_price(pp['id'], t['id']); n += 1
        except Exception: pass
print(f'Prix {EUR} € réglé (+{n} pays)')

# Capture d'écran pour l'examen d'Apple (écran Sahbi Pro).
shot = os.path.join(os.path.dirname(__file__), 'review-pro.png')
try: cur = call('GET', f'/subscriptions/{sid}/appStoreReviewScreenshot').get('data')
except Exception: cur = None
if not cur and os.path.exists(shot):
    data = open(shot, 'rb').read()
    r = call('POST', '/subscriptionAppStoreReviewScreenshots', json={'data': {'type': 'subscriptionAppStoreReviewScreenshots',
        'attributes': {'fileName': 'sahbi-pro.png', 'fileSize': len(data)}, 'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}}}})['data']
    for op in r['attributes']['uploadOperations']:
        part = data[op['offset']:op['offset'] + op['length']]
        requests.request(op['method'], op['url'], data=part, headers={h['name']: h['value'] for h in op.get('requestHeaders', [])}).raise_for_status()
    call('PATCH', f"/subscriptionAppStoreReviewScreenshots/{r['id']}", json={'data': {'type': 'subscriptionAppStoreReviewScreenshots', 'id': r['id'],
        'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    print('Capture pour l’examen envoyée')
state = call('GET', f'/subscriptions/{sid}')['data']['attributes'].get('state')
print(f'::notice title=Abonnement Apple::{PID} – état : {state}')
