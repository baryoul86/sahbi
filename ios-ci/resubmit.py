"""Rimanda l'app ad Apple con l'ultima build.
MODE=prepare : ritira l'invio in attesa, collega l'ultima build valida alla versione, crea la bozza d'invio
               (versione + abbonamento Sahbi Pro). Non invia.
MODE=submit  : invia la bozza ad Apple (dopo aver messo il video nelle informazioni per la verifica)."""
import os, time
from asc import call, BID

MODE = os.environ.get('MODE', 'prepare')
app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
aid = app['id']

def submissions(states):
    d = call('GET', '/reviewSubmissions', params={'filter[app]': aid, 'filter[platform]': 'IOS', 'limit': 20})['data']
    return [s for s in d if s['attributes'].get('state') in states]

if MODE == 'prepare':
    for s in submissions(('WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES')):
        try:
            call('PATCH', f"/reviewSubmissions/{s['id']}", json={'data': {'type': 'reviewSubmissions', 'id': s['id'], 'attributes': {'canceled': True}}})
            print('Invio ritirato :', s['id'], s['attributes']['state'])
        except Exception as e: print('Ritiro :', e)
    for _ in range(12):  # Apple impiega qualche secondo a liberare la versione
        if not submissions(('CANCELING',)): break
        time.sleep(5)
    ver = call('GET', f'/apps/{aid}/appStoreVersions', params={'filter[platform]': 'IOS'})['data'][0]
    vid = ver['id']; print('Versione', ver['attributes']['versionString'], ver['attributes']['appStoreState'])
    b = [x for x in call('GET', '/builds', params={'filter[app]': aid, 'sort': '-uploadedDate', 'limit': 5})['data'] if x['attributes'].get('processingState') == 'VALID'][0]
    if b['attributes'].get('usesNonExemptEncryption') is None:
        call('PATCH', f"/builds/{b['id']}", json={'data': {'type': 'builds', 'id': b['id'], 'attributes': {'usesNonExemptEncryption': False}}})
    call('PATCH', f'/appStoreVersions/{vid}/relationships/build', json={'data': {'type': 'builds', 'id': b['id']}})
    print('Build collegata :', b['attributes']['version'])
    drafts = submissions(('READY_FOR_REVIEW',))
    sid = drafts[0]['id'] if drafts else call('POST', '/reviewSubmissions', json={'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
        'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})['data']['id']
    try:
        call('POST', '/reviewSubmissionItems', json={'data': {'type': 'reviewSubmissionItems', 'relationships': {
            'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sid}}, 'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})
        print('Versione nella bozza')
    except Exception as e: print('Versione nella bozza :', e)
    for g in call('GET', f'/apps/{aid}/subscriptionGroups')['data']:
        for s in call('GET', f"/subscriptionGroups/{g['id']}/subscriptions")['data']:
            try:
                call('POST', '/subscriptionSubmissions', json={'data': {'type': 'subscriptionSubmissions', 'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': s['id']}}}}})
                print('Abbonamento nella bozza :', s['attributes']['productId'])
            except Exception as e: print('Abbonamento :', str(e)[:300])
    print(f'::notice title=Bozza pronta::{sid}')

if MODE == 'submit':
    d = submissions(('READY_FOR_REVIEW',))
    if not d: raise SystemExit('Nessuna bozza pronta')
    call('PATCH', f"/reviewSubmissions/{d[0]['id']}", json={'data': {'type': 'reviewSubmissions', 'id': d[0]['id'], 'attributes': {'submitted': True}}})
    print('::notice title=Inviata ad Apple::', d[0]['id'])
