"""Où en est l'app iPhone : builds (TestFlight), version App Store, abonnement."""
from asc import call, BID
app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
for b in call('GET', '/builds', params={'filter[app]': app['id'], 'sort': '-uploadedDate', 'limit': 5, 'include': 'buildBetaDetail'})['data']:
    a = b['attributes']; print('BUILD', a['version'], a.get('processingState'), 'expiré' if a.get('expired') else '', a.get('uploadedDate'))
for d in call('GET', '/buildBetaDetails', params={'filter[build]': ','.join(x['id'] for x in call('GET', '/builds', params={'filter[app]': app['id'], 'limit': 5})['data'])})['data']:
    print('TESTFLIGHT', d['attributes'].get('internalBuildState'), d['attributes'].get('externalBuildState'))
for v in call('GET', f"/apps/{app['id']}/appStoreVersions")['data']:
    print('VERSION', v['attributes']['versionString'], v['attributes']['appStoreState'])
for g in call('GET', f"/apps/{app['id']}/subscriptionGroups")['data']:
    for s in call('GET', f"/subscriptionGroups/{g['id']}/subscriptions")['data']:
        print('ABONNEMENT', s['attributes']['productId'], s['attributes']['state'])
