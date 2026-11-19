"""Petit client App Store Connect partagé par les scripts iOS de Sahbi (clé API dans les secrets GitHub)."""
import os, time, jwt, requests
KID, ISS, P8 = os.environ['ASC_KEY_ID'].strip(), os.environ['ASC_ISSUER_ID'].strip(), os.environ['ASC_KEY_P8']
# Controllo leggibile (senza mostrare i segreti): manca qualcosa o il .p8 è incollato male?
_miss = [n for n, v in (('ASC_ISSUER_ID', ISS), ('ASC_KEY_ID', KID), ('ASC_KEY_P8', P8.strip())) if not v]
if _miss: raise SystemExit(f"::error title=Segreti mancanti::Aggiungi su GitHub (sahbi → Settings → Secrets → Actions): {', '.join(_miss)}")
# Il .p8 incollato dal telefono può avere spazi, trattini "intelligenti" o mancare delle righe BEGIN/END:
# teniamo solo la parte base64 e ricostruiamo la chiave nel formato giusto.
import re as _re
_body = _re.sub(r'[^A-Za-z0-9+/=]', '', _re.sub(r'(?i)[-—–\s]*(BEGIN|END)\s+PRIVATE\s+KEY[-—–\s]*', ' ', P8))
if len(_body) < 150:
    raise SystemExit(f"::error title=ASC_KEY_P8::Il testo del file .p8 è troppo corto ({len(_body)} caratteri utili): copia TUTTO il testo del file .p8 e rimettilo in ASC_KEY_P8.")
print(f'Chiave .p8: {len(P8)} caratteri, {len(P8.strip().splitlines())} righe, parte utile {len(_body)} caratteri (giusto: 184), BEGIN={"BEGIN" in P8}, END={"END" in P8}')
P8_PEM = '-----BEGIN PRIVATE KEY-----\n' + '\n'.join(_body[i:i + 64] for i in range(0, len(_body), 64)) + '\n-----END PRIVATE KEY-----'
BID, NAME, PNAME = 'bond.sahbi.app', 'Sahbi Maghreb AI', 'Sahbi AppStore CI'
A = 'https://api.appstoreconnect.apple.com/v1'
def H():
    t = jwt.encode({'iss': ISS, 'iat': int(time.time()), 'exp': int(time.time()) + 900, 'aud': 'appstoreconnect-v1'}, P8_PEM, algorithm='ES256', headers={'kid': KID, 'typ': 'JWT'})
    return {'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json'}
def call(m, p, **kw):
    r = requests.request(m, A + p, headers=H(), **kw)
    if r.status_code >= 400: print(m, p, r.status_code, r.text[:600]); r.raise_for_status()
    return r.json() if r.text else {}
