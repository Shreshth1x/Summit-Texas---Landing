from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,re
root=Path.cwd();dist=root/'dist'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[];self.images=[];self.rows=[];self.headings=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if t=='a':self.links.append(a.get('href',''))
  if t=='img':self.images.append(a)
  if t=='article' and 'person' in a.get('class','').split():self.rows.append(a)
  if t=='h1':self.headings.append(t)
pages={}
for file in dist.glob('*.html'):
 p=Page();p.feed(file.read_text());pages[file.name]=p
 assert len(p.ids)==len(set(p.ids)),file
 assert len(p.headings)==1,file
 for img in p.images:
  assert img.get('alt') and (dist/img['src']).is_file(),img
 for href in p.links:
  assert '|' not in unquote(href),href
  if href.startswith('https://'):continue
  u=urlparse(href);target=u.path or file.name
  assert (dist/target).is_file(),href
for file,p in pages.items():
 for href in p.links:
  u=urlparse(href)
  if u.scheme:continue
  if u.fragment:assert u.fragment in pages[u.path or file].ids,href
rows=pages['talent.html'].rows
assert len(rows)==202
assert len({r['id'] for r in rows})==202
assert sum(r['data-status']=='current' for r in rows)==168
assert sum(r['data-status']=='left' for r in rows)==4
assert sum(r['data-status']=='elsewhere' for r in rows)==3
assert sum(r['data-status']=='unconfirmed' for r in rows)==27
source=json.loads((root/'roster.json').read_text())
assert len(source)==197
for forbidden in ['founders.png','S-tier','Cracked Index','reached_out_by','instant S-tier','Build the student community with us','Meet the talent we have sourced']:
 assert forbidden not in ''.join(p.read_text() for p in dist.glob('*.html')),forbidden
assert not (dist/'assets/founders.png').exists()
assert not (dist/'roster.json').exists()
assert len(list((dist/'assets').iterdir()))==12
print('PASS: 202 unique profiles; all four status counts; local links/anchors; 12 photo assets; no founders photo or internal recruiting fields.')
