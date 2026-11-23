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
for v in call('GET', f"/apps/{app['id']}/appStoreVersions")['data']:
    try:
        d = call('GET', f"/appStoreVersions/{v['id']}/appStoreReviewDetail")['data']['attributes']
        print('REVIEW user:', d.get('demoAccountName'), '| mdp:', 'oui' if d.get('demoAccountPassword') else 'NON', '| tel:', 'oui' if d.get('contactPhone') else 'NON', '| notes:', len(d.get('notes') or ''), 'car.,', (d.get('notes') or '')[:40].replace('\n', ' '))
    except Exception as e: print('REVIEW', e)
    try:
        att = call('GET', f"/appStoreVersions/{v['id']}/appStoreReviewDetail")['data']['id']
        a = call('GET', f'/appStoreReviewDetails/{att}/appStoreReviewAttachments')['data']
        print('PIECES JOINTES:', [(x['attributes'].get('fileName'), x['attributes'].get('assetDeliveryState', {}).get('state')) for x in a])
    except Exception as e: print('PJ', e)
