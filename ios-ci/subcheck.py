from asc import call, BID
app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
for g in call('GET', f"/apps/{app['id']}/subscriptionGroups")['data']:
    print('GROUP', g['attributes'])
    for s in call('GET', f"/subscriptionGroups/{g['id']}/subscriptions")['data']:
        print('SUB', s['id'], s['attributes'])
        for rel in ('subscriptionLocalizations', 'appStoreReviewScreenshot', 'prices', 'subscriptionAvailability'):
            try: d = call('GET', f"/subscriptions/{s['id']}/{rel}")['data']; print(rel, len(d) if isinstance(d, list) else ('ok' if d else 'NONE'))
            except Exception as e: print(rel, 'ERR', str(e)[:120])
    try:
        for l in call('GET', f"/subscriptionGroups/{g['id']}/subscriptionGroupLocalizations")['data']: print('GROUPLOC', l['attributes'])
    except Exception as e: print('GROUPLOC ERR', str(e)[:120])
for d in call('GET', '/reviewSubmissions', params={'filter[app]': app['id'], 'limit': 5})['data']: print('SUBMISSION', d['id'], d['attributes'])
