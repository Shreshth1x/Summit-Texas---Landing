from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
import json

ROOT=Path('/Users/shreshth/Developer/SummitTexas-landing/outputs/innovation-tower-story')
DIST=ROOT/'dist'
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[];self.ids=[];self.images=0;self.h1=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='h1': self.h1+=1
        if 'id' in a:self.ids.append(a['id'])
        if tag=='img':
            assert a.get('alt'),'Image has no alternative text'
            self.images+=1
        self.refs += [a[k] for k in ['src','href'] if k in a]
pages={}
for f in DIST.glob('*.html'):
    p=Page();p.feed(f.read_text());pages[f.name]=p
    assert p.h1==1 and len(p.ids)==len(set(p.ids)),f.name
for name,p in pages.items():
    for ref in p.refs:
        u=urlparse(ref)
        if u.scheme: assert u.scheme=='https';continue
        target=u.path or name
        assert (DIST/target).is_file(),(name,ref)
        if u.fragment: assert u.fragment in pages[target].ids,(name,ref)
people=json.loads((ROOT/'people.json').read_text())
for p in people:
    im=Image.open(ROOT/'assets'/p['image']);im.verify()
    if p.get('crop'):
        im=Image.open(ROOT/'assets'/p['image']);w,x,y,size=p['crop']
        assert w==im.width and x+size<=im.width and y+size<=im.height,p['name']
assert len(people)==12
assert not any(p['id'] in (DIST/'index.html').read_text().split('id="talent-drain"')[1].split('<section id="bay-area"')[0] for p in people)
print(json.dumps({'pages':list(pages),'profiles':len(people),'images':sum(p.images for p in pages.values()),'local_links_and_fragments':'pass','source_images_and_crop_bounds':'pass','departure_names':'empty'},indent=2))
