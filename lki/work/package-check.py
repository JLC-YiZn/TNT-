from pathlib import Path
from html.parser import HTMLParser
import re

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id'])

root=Path('outputs')
html=(root/'index.html').read_text(encoding='utf-8')
single=(root/'tnt.html').read_text(encoding='utf-8')
code=(root/'game.js').read_text(encoding='utf-8')
css=(root/'style.css').read_text(encoding='utf-8')
page=Page();page.feed(html)
assert len(page.ids)==len(set(page.ids))
for referenced in re.findall(r"\$\('([^']+)'\)",code):
    assert referenced in page.ids,referenced
expected=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
for name in ['world','physics','game']:
    expected=expected.replace('<script src="'+name+'.js"></script>','<script>'+(root/(name+'.js')).read_text(encoding='utf-8')+'</script>')
assert single==expected
assert (root/'tnt-v0.3.html').read_text(encoding='utf-8')==single
assert (root/'tnt-v0.4.html').read_text(encoding='utf-8')==single
assert 'src="game.js"' not in single and 'href="style.css"' not in single
assert all(item in html for item in ['id="mapType"','id="mapSeed"','id="mapPreview"','id="actualAngle"','id="slopeValue"','v0.5'])
print('PASS: unique UI identifiers, all script references resolve, offline bundles match sources, v0.5 controls present')

assert (root/'tnt-v0.5.html').read_text(encoding='utf-8')==single
