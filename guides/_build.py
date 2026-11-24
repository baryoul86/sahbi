"""Genera le guide lunghe di Sahbi (stessa grafica delle altre). Uso: python3 guides/_build.py
Il file inizia con _ ed è escluso dal sito (.vercelignore)."""
import html, os, re
D = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(D, 'parler-darija-ia.html'), encoding='utf-8').read()
HEAD, FOOT = tpl.split('<main>')[0], '</main>' + tpl.split('</main>')[1]

def page(slug, title, desc, date, minutes, body):
    h = HEAD
    h = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)} – Sahbi</title>', h)
    h = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + html.escape(desc), h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + f'https://www.sahbi.bond/guides/{slug}.html', h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + html.escape(title) + ' – Sahbi', h)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + html.escape(desc), h)
    h += ('<main>\n\n<p class="meta"><a href="/guides/">← Tous les guides</a></p>\n'
          f'<h1>{title}</h1>\n<p class="meta">Guide Sahbi · {date} · {minutes} min de lecture · Rédigé par l\'équipe Sahbi</p>\n'
          + body.strip() + '\n')
    open(os.path.join(D, f'{slug}.html'), 'w', encoding='utf-8').write(h + FOOT)
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    print(f'{slug}: {words} mots')
    return slug, title, desc

PAGES = []
from _pages import ALL  # contenu des guides
for p in ALL: PAGES.append(page(**p))
