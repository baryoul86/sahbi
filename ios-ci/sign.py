"""Certificat de distribution + profil App Store pour Sahbi.
Le certificat est LE MÊME que celui de Motivex (même compte Apple) : ios-ci/dist.p12.enc, chiffré avec la clé ASC_KEY_P8.
On ne révoque JAMAIS un certificat ici (ça casserait Motivex). Le profil App Store de Sahbi est recréé à chaque build."""
import os, sys, base64, subprocess
from asc import call, BID, PNAME
T = os.environ['RUNNER_TEMP']; ENC, P12, PW = 'ios-ci/dist.p12.enc', T + '/dist.p12', 'motivex'
def sh(*a, **kw): subprocess.run(a, check=True, **kw)
raw = os.environ['ASC_KEY_P8']; ok = False
for v in dict.fromkeys([raw, raw.strip(), raw.strip() + '\n', raw.replace('\r\n', '\n')]):
    r = subprocess.run(['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-salt', '-in', ENC, '-out', P12, '-pass', 'env:PW8'], env={**os.environ, 'PW8': v}, capture_output=True)
    if r.returncode == 0 and open(P12, 'rb').read(1) == b'\x30': ok = True; break  # un .p12 commence toujours par 0x30
if not ok:
    print('::error title=Clé Apple::Le certificat ne s’ouvre pas : ASC_KEY_P8 doit être EXACTEMENT le même fichier .p8 que pour Motivex.'); sys.exit(1)
cert_id = open('ios-ci/dist.cert-id').read().strip()
if cert_id not in [c['id'] for c in call('GET', '/certificates', params={'limit': 50})['data']]:
    print('::error title=Certificat::Le certificat de distribution a été révoqué chez Apple. Lance d’abord le build iPhone de Motivex (il en recrée un), puis recopie ios-ci/dist.p12.enc et dist.cert-id.'); sys.exit(1)
print('Certificat partagé avec Motivex :', cert_id)
KC = T + '/ci.keychain-db'
sh('security', 'create-keychain', '-p', 'ci', KC); sh('security', 'set-keychain-settings', '-lut', '21600', KC); sh('security', 'unlock-keychain', '-p', 'ci', KC)
sh('security', 'import', P12, '-k', KC, '-P', PW, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security')
sh('security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', 'ci', KC, stdout=subprocess.DEVNULL)
kcs = subprocess.run(['security', 'list-keychains', '-d', 'user'], capture_output=True, text=True).stdout.split()
sh('security', 'list-keychains', '-d', 'user', '-s', KC, *[k.strip('"') for k in kcs])
bid = call('GET', '/bundleIds', params={'filter[identifier]': BID})['data'][0]['id']
for p in call('GET', '/profiles', params={'filter[name]': PNAME, 'limit': 20})['data']: call('DELETE', '/profiles/' + p['id'])
pr = call('POST', '/profiles', json={'data': {'type': 'profiles', 'attributes': {'name': PNAME, 'profileType': 'IOS_APP_STORE'},
     'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}}, 'certificates': {'data': [{'type': 'certificates', 'id': cert_id}]}}}})['data']
d = os.path.expanduser('~/Library/MobileDevice/Provisioning Profiles'); os.makedirs(d, exist_ok=True)
open(f"{d}/{pr['attributes']['uuid']}.mobileprovision", 'wb').write(base64.b64decode(pr['attributes']['profileContent']))
print('Profil installé', PNAME)
