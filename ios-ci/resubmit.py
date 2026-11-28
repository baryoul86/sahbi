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

if MODE == 'notes':
    # Nota 1 corretta: il video è registrato sul simulatore iPhone (non su un iPad fisico).
    app = [a for a in call('GET', '/apps', params={'filter[bundleId]': BID})['data'] if a['attributes']['bundleId'] == BID][0]
    ver = call('GET', f"/apps/{app['id']}/appStoreVersions", params={'filter[platform]': 'IOS'})['data'][0]
    rd = call('GET', f"/appStoreVersions/{ver['id']}/appStoreReviewDetail")['data']
    notes = rd['attributes'].get('notes') or ''
    first = ('1. SCREEN RECORDING: attached (Attachment field, sahbi-demo.mp4) - recorded on the iOS Simulator (iPhone) with this same build: '
             'launch, login with the demo account, a chat question and answer, the Sahbi Pro subscription screen (Apple In-App Purchase, auto-renewable, 6.99 EUR/month, '
             'with Terms of Use and Privacy links), and account deletion (Menu > Settings > "Supprimer mon compte"). The simulator has no App Store sandbox, so the '
             'Subscribe button is shown but not tapped; on a device it opens the standard Apple purchase sheet.')
    parts = notes.split('\n\n', 1)
    new = first + ('\n\n' + parts[1] if len(parts) > 1 and parts[0].startswith('1.') else '\n\n' + notes)
    call('PATCH', f"/appStoreReviewDetails/{rd['id']}", json={'data': {'type': 'appStoreReviewDetails', 'id': rd['id'], 'attributes': {'notes': new[:4000]}}})
    print('Note aggiornate:', len(new), 'caratteri')

if MODE == 'undraft':
    # Toglie la versione dalla bozza d'invio: così nella pagina 1.0 riappare "Achats intégrés et abonnements".
    for d in submissions(('READY_FOR_REVIEW',)):
        for it in call('GET', f"/reviewSubmissions/{d['id']}/items")['data']:
            call('DELETE', f"/reviewSubmissionItems/{it['id']}"); print('Tolto dalla bozza:', it['id'])
        try:
            call('PATCH', f"/reviewSubmissions/{d['id']}", json={'data': {'type': 'reviewSubmissions', 'id': d['id'], 'attributes': {'canceled': True}}})
            print('Bozza annullata:', d['id'])
        except Exception as e: print('Bozza:', str(e)[:200])

if MODE == 'check':
    import runpy; runpy.run_path('subcheck.py')

if MODE == 'legal':
    # 3.1.2: link funzionanti a Condizioni d'uso (EULA) e Privacy nella descrizione di ogni lingua.
    EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
    PRIV = 'https://www.sahbi.bond/confidentialite.html'
    TERMS = 'https://www.sahbi.bond/conditions-utilisation'
    LINES = {
        'fr': f"\n\nSahbi Pro mensuel : abonnement d'un mois renouvelé automatiquement, annulable à tout moment dans les réglages de l'App Store.\nConditions d'utilisation (EULA) : {EULA}\nConditions de Sahbi : {TERMS}\nPolitique de confidentialité : {PRIV}",
        'en': f"\n\nSahbi Pro monthly: 1-month auto-renewable subscription, cancel anytime in App Store settings.\nTerms of Use (EULA): {EULA}\nSahbi terms: {TERMS}\nPrivacy Policy: {PRIV}",
        'ar': f"\n\nصاحبي برو الشهري: اشتراك لمدة شهر يتجدد تلقائياً، يمكن إلغاؤه في أي وقت من إعدادات App Store.\nشروط الاستخدام (EULA): {EULA}\nشروط صاحبي: {TERMS}\nسياسة الخصوصية: {PRIV}",
    }
    ver = call('GET', f'/apps/{aid}/appStoreVersions', params={'filter[platform]': 'IOS'})['data'][0]
    vid = ver['id']; print('Versione', ver['attributes']['versionString'], ver['attributes']['appStoreState'])
    for l in call('GET', f'/appStoreVersions/{vid}/appStoreVersionLocalizations')['data']:
        loc = l['attributes']['locale']; d = l['attributes'].get('description') or ''
        if 'stdeula' in d: print(loc, ': link già presenti'); continue
        add = LINES.get(loc.split('-')[0], LINES['en'])
        nd = (d.rstrip()[: 4000 - len(add)]) + add
        call('PATCH', f"/appStoreVersionLocalizations/{l['id']}", json={'data': {'type': 'appStoreVersionLocalizations', 'id': l['id'], 'attributes': {'description': nd}}})
        print(loc, ': link aggiunti alla descrizione', len(nd), 'caratteri')
    info = [i for i in call('GET', f'/apps/{aid}/appInfos')['data']][0]
    for l in call('GET', f"/appInfos/{info['id']}/appInfoLocalizations")['data']:
        print(l['attributes']['locale'], 'privacy URL :', l['attributes'].get('privacyPolicyUrl'))
        if not l['attributes'].get('privacyPolicyUrl'):
            call('PATCH', f"/appInfoLocalizations/{l['id']}", json={'data': {'type': 'appInfoLocalizations', 'id': l['id'], 'attributes': {'privacyPolicyUrl': PRIV}}})
            print('  → aggiunto')
