"""Offline checks of provenance, grid integrity, non-flat relief and local asset closure."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import base64, hashlib, json, re, struct
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/manifest.json').read_text(encoding='utf-8'))
assert len(manifest['datasets'])==9
keys=set()
for record in manifest['datasets']:
    key=record['key'];keys.add(key)
    s=(ROOT/'data'/f'{key}.js').read_text(encoding='utf-8')
    data=json.loads(s.split(']=',1)[1].rstrip(';\n'))
    raw=base64.b64decode(data['data'],validate=True)
    assert len(raw)==record['width']*record['height']*2,key
    assert hashlib.sha256(raw).hexdigest()==record['sha256'],key
    values=struct.unpack('<'+'h'*(len(raw)//2),raw)
    assert min(values)==record['min'] and max(values)==record['max'],key
    assert max(values)-min(values)>500,key
    assert all(-200<=v<4000 for v in values),key
    print(f'{key}: {len(values):,} measured/interpolated samples; {min(values)} .. {max(values)} m')
for key,name,lon,lat,*_ in manifest['passes']:
    assert key in keys
    d=next(x for x in manifest['datasets'] if x['key']==key)
    w,s,e,n=d['bounds'];assert w<lon<e and s<lat<n
class Assets(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls=[]
    def handle_starttag(self, tag, attrs):
        self.urls.extend(v for k,v in attrs if k in {'src','href','data-href','poster'} and v)

checked=set()
def local_asset(parent, url):
    parsed=urlsplit(url)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    path=(ROOT/ unquote(parsed.path).lstrip('/') if parsed.path.startswith('/') else parent.parent/unquote(parsed.path)).resolve()
    assert path.is_relative_to(ROOT), (parent,url)
    if path.is_dir():path=path/'index.html'
    assert path.is_file(), (str(parent.relative_to(ROOT)),url)
    if path in checked:return
    checked.add(path)
    if path.suffix=='.css':
        css=path.read_text(encoding='utf-8')
        for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)",css):
            local_asset(path,match.group(2))
        for match in re.finditer(r"@import\s+['\"]([^'\"]+)['\"]",css):
            local_asset(path,match.group(1))
    elif path.suffix=='.webmanifest':
        for icon in json.loads(path.read_text(encoding='utf-8')).get('icons',[]):
            local_asset(path,icon['src'])

for entry in ('index.html','terrain.html'):
    page=ROOT/entry
    parser=Assets();parser.feed(page.read_text(encoding='utf-8'))
    for url in parser.urls:local_asset(page,url)
assert "frame.src = 'terrain.html?" in (ROOT/'integration.js').read_text(encoding='utf-8')
print(f'PASS: {len(checked)} local static assets from both entry pages (URL queries/fragments removed).')
assert 'fetch(' not in (ROOT/'terrain-app.js').read_text(encoding='utf-8')
print('PASS: all 9 grids, 8 representative locations, hashes and local entry assets.')
