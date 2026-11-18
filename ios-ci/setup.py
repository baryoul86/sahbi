"""Vérifie la clé Apple, enregistre l'identifiant de l'app (bond.sahbi.app) et dit si la fiche App Store Connect existe."""
from asc import call, BID, NAME
apps = call('GET', '/apps', params={'limit': 50})['data']
print('CLÉ APPLE OK. Apps du compte :', [(a['attributes']['name'], a['attributes']['bundleId']) for a in apps])
ex = [x for x in call('GET', '/bundleIds', params={'filter[identifier]': BID})['data'] if x['attributes']['identifier'] == BID]
if ex: bid = ex[0]['id']; print('Identifiant déjà enregistré :', BID)
else:
    bid = call('POST', '/bundleIds', json={'data': {'type': 'bundleIds', 'attributes': {'identifier': BID, 'name': NAME, 'platform': 'IOS'}}})['data']['id']
    print('Identifiant ENREGISTRÉ :', BID)
have = {c['attributes']['capabilityType'] for c in call('GET', f'/bundleIds/{bid}/bundleIdCapabilities')['data']}
if 'IN_APP_PURCHASE' not in have:
    call('POST', '/bundleIdCapabilities', json={'data': {'type': 'bundleIdCapabilities', 'attributes': {'capabilityType': 'IN_APP_PURCHASE'}, 'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}}}}})
    print('Achats intégrés activés')
mine = [a for a in apps if a['attributes']['bundleId'] == BID]
if mine: print('::notice title=App Store Connect::Fiche Sahbi OK (id', mine[0]['id'], ') : on peut construire l’app.')
else: print('::warning title=À faire::Crée la fiche de l’app dans App Store Connect (Mes apps → + → Nouvelle app, identifiant bond.sahbi.app).')
