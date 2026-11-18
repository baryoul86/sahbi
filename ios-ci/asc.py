"""Petit client App Store Connect partagé par les scripts iOS de Sahbi (clé API dans les secrets GitHub)."""
import os, time, jwt, requests
KID, ISS, P8 = os.environ['ASC_KEY_ID'].strip(), os.environ['ASC_ISSUER_ID'].strip(), os.environ['ASC_KEY_P8']
# Controllo leggibile (senza mostrare i segreti): manca qualcosa o il .p8 è incollato male?
_miss = [n for n, v in (('ASC_ISSUER_ID', ISS), ('ASC_KEY_ID', KID), ('ASC_KEY_P8', P8.strip())) if not v]
if _miss: raise SystemExit(f"::error title=Segreti mancanti::Aggiungi su GitHub (sahbi → Settings → Secrets → Actions): {', '.join(_miss)}")
if '-----BEGIN PRIVATE KEY-----' not in P8 or '-----END PRIVATE KEY-----' not in P8:
    raise SystemExit('::error title=ASC_KEY_P8::Il testo del file .p8 non è completo: deve iniziare con -----BEGIN PRIVATE KEY----- e finire con -----END PRIVATE KEY-----')
BID, NAME, PNAME = 'bond.sahbi.app', 'Sahbi Maghreb AI', 'Sahbi AppStore CI'
A = 'https://api.appstoreconnect.apple.com/v1'
def H():
    t = jwt.encode({'iss': ISS, 'iat': int(time.time()), 'exp': int(time.time()) + 900, 'aud': 'appstoreconnect-v1'}, P8.strip(), algorithm='ES256', headers={'kid': KID, 'typ': 'JWT'})
    return {'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json'}
def call(m, p, **kw):
    r = requests.request(m, A + p, headers=H(), **kw)
    if r.status_code >= 400: print(m, p, r.status_code, r.text[:600]); r.raise_for_status()
    return r.json() if r.text else {}
