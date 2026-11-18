"""Affiche l'identifiant d'équipe Apple (Team ID)."""
from asc import call, BID
print(call('GET', '/bundleIds', params={'filter[identifier]': BID})['data'][0]['attributes']['seedId'])
