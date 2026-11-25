"""Mette il video di dimostrazione nelle informazioni per la verifica di Apple (sostituisce i video vecchi)."""
import hashlib, os, sys, requests
from asc import call, BID
path = sys.argv[1]
data = open(path, 'rb').read()
app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
ver = call('GET', f"/apps/{app['id']}/appStoreVersions", params={'filter[platform]': 'IOS'})['data'][0]
rd = call('GET', f"/appStoreVersions/{ver['id']}/appStoreReviewDetail")['data']
for old in call('GET', f"/appStoreReviewDetails/{rd['id']}/appStoreReviewAttachments")['data']:
    call('DELETE', f"/appStoreReviewAttachments/{old['id']}"); print('Vecchio allegato tolto:', old['attributes'].get('fileName'))
att = call('POST', '/appStoreReviewAttachments', json={'data': {'type': 'appStoreReviewAttachments',
    'attributes': {'fileName': os.path.basename(path), 'fileSize': len(data)},
    'relationships': {'appStoreReviewDetail': {'data': {'type': 'appStoreReviewDetails', 'id': rd['id']}}}}})['data']
for op in att['attributes']['uploadOperations']:
    part = data[op['offset']:op['offset'] + op['length']]
    r = requests.request(op['method'], op['url'], headers={h['name']: h['value'] for h in op.get('requestHeaders', [])}, data=part)
    r.raise_for_status()
call('PATCH', f"/appStoreReviewAttachments/{att['id']}", json={'data': {'type': 'appStoreReviewAttachments', 'id': att['id'],
    'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
print(f"Video caricato per Apple: {os.path.basename(path)} ({len(data) // 1024} KB)")
