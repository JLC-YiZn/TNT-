from pathlib import Path
root=Path('outputs')
html=(root/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(root/'style.css').read_text(encoding='utf-8')+'</style>')
for name in ['world','physics','game']:
    html=html.replace('<script src="'+name+'.js"></script>','<script>'+(root/(name+'.js')).read_text(encoding='utf-8')+'</script>')
for name in ['tnt.html','tnt-v0.3.html','tnt-v0.4.html','tnt-v0.5.html']:
    (root/name).write_text(html,encoding='utf-8')
print('Built offline v0.5 game (map generator + materials + contact physics).')
