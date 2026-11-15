import json, re, html
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT

ROOT = Path('/Users/shreshth/Developer/SummitTexas-landing')
WORK = ROOT / 'tmp/pdfs/innovation-tower'
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads((WORK/'manuscript.json').read_text())
FONT = Path('/Users/shreshth/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
for name, file in [('Serif','LinLibertine_R_G.ttf'), ('SerifBold','LinLibertine_RB_G.ttf'), ('SerifItalic','LinLibertine_RI_G.ttf'), ('Sans','NotoSans-Regular.ttf'), ('SansBold','NotoSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT/file)))
pdfmetrics.registerFontFamily('Serif',normal='Serif',bold='SerifBold',italic='SerifItalic',boldItalic='SerifBold')
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='SansBold',italic='Sans',boldItalic='SansBold')
W,H = 595.276,841.89
M = 50
CW = W-2*M
CREAM = '#F5F2EA'
INK = '#202C28'
ORANGE = '#BD4D28'
MUTED = '#65706A'
RULE = '#D3D3C7'
PAPER = '#ECE9DF'
pdf_path = OUT/'Silicon_Hills_Project_Innovation_Tower_Brief.pdf'
c = canvas.Canvas(str(pdf_path), pagesize=(W,H), pageCompression=1)
c.setTitle(data['title']+' '+data['subtitle'])
c.setAuthor('Silicon Hills Project')
c.setSubject('Proposed student community partnership at Innovation Tower, September 2026')
report=[]
page_num=0

def txt(text,x,top,size=10,font='Sans',color=INK):
    c.setFillColor(HexColor(color));c.setFont(font,size)
    c.drawString(x,H-top-size*.82,text)

def line(x1,top1,x2,top2,color=RULE,width=.5):
    c.setStrokeColor(HexColor(color));c.setLineWidth(width)
    c.line(x1,H-top1,x2,H-top2)

def rich(text):
    text=html.escape(text)
    return re.sub(r'\[(\d+(?:, \d+)*)\]', lambda m:'<font name="Sans" size="8" color="'+ORANGE+'">'+''.join(f'<link href="#source-{n.strip()}">[{n.strip()}]</link>' for n in m.group(1).split(','))+'</font>', text)

def para(text,top,x=M,width=CW,size=12.3,leading=17.3,font='Serif',color=INK,gap=11,markup=False):
    style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading,textColor=HexColor(color),alignment=TA_LEFT,splitLongWords=False,allowWidows=0,allowOrphans=0)
    p=Paragraph(text if markup else rich(text),style)
    ww,hh=p.wrap(width,2000)
    p.drawOn(c,x,H-top-hh)
    return top+hh+gap

def base(section):
    global page_num
    page_num+=1
    c.setFillColor(HexColor(CREAM));c.rect(0,0,W,H,fill=1,stroke=0)
    txt('SILICON HILLS PROJECT',M,29,8.1,'SansBold')
    c.setFillColor(HexColor(ORANGE));c.rect(W-M-6,H-37,6,6,fill=1,stroke=0)
    line(M,49,W-M,49)
    line(M,H-44,W-M,H-44)
    txt('INNOVATION TOWER',M,H-30,7.4,'Sans',MUTED)
    txt('SEPTEMBER 2026',W/2-40,H-30,7.4,'Sans',MUTED)
    c.setFont('Sans',8);c.setFillColor(HexColor(MUTED));c.drawRightString(W-M,22,f'{page_num:02}')
    c.bookmarkPage('page-'+str(page_num))
    c.addOutlineEntry(section,'page-'+str(page_num),0,False)

def heading(p):
    txt(p['eyebrow'],M,77,8.4,'SansBold',ORANGE)
    return para(p['title'],99,size=31.5,leading=33.5,gap=22)

def block(text,top):
    style=ParagraphStyle('call',fontName='Serif',fontSize=21,leading=25,textColor=HexColor(CREAM))
    p=Paragraph(rich(text),style);_,height=p.wrap(CW-36,1000)
    c.setFillColor(HexColor(INK));c.rect(M,H-top-height-32,CW,height+32,fill=1,stroke=0)
    p.drawOn(c,M+18,H-top-16-height)
    return top+height+48

def finish(y):
    report.append({'page':page_num,'content_bottom':round(y,1),'bottom_limit':H-64})
    if y>H-64: raise ValueError(f'Page {page_num} overflows: {y} > {H-64}')
    c.showPage()

base('The case for Silicon Hills Project')
txt('A PROPOSED STUDENT COMMUNITY PARTNERSHIP',M,82,8.2,'SansBold',ORANGE)
y=123
for t in ['UT cannot afford','unrealized','talent.']:
    txt(t,M,y,57,'Serif',ORANGE if t=='talent.' else INK);y+=59
y=para(data['subtitle'],331,size=19.3,leading=23,gap=24)
line(M,399,M+52,399,ORANGE,2)
y=426
for p in data['cover']: y=para(p,y,size=13.1,leading=18.3,gap=12)
y=para(data['cover_line'],max(y+17,710),size=18.2,leading=22.6,font='SerifItalic',color=ORANGE,gap=0)
finish(y)

for page in data['pages']:
    base(page['eyebrow'].title())
    y=heading(page)
    kind=page['type']
    if kind=='benchmark':
        y=para(page['intro'],y)
        y+=10
        y=para(page['chart_title'],y,size=10.6,leading=14,font='SansBold',gap=16)
        for label,value,rank in page['bars']:
            txt(label,M,y,11.3,'SansBold',ORANGE if label=='UT Austin' else INK)
            c.setFont('SansBold',12);c.setFillColor(HexColor(INK));c.drawRightString(W-M,H-y-10,f'{value:,}')
            txt(rank,M+108,y+1,8.2,'Sans',MUTED)
            y+=23
            c.setFillColor(HexColor(RULE));c.rect(M,H-y-6,CW,6,fill=1,stroke=0)
            c.setFillColor(HexColor(ORANGE if label=='UT Austin' else INK));c.rect(M,H-y-6,CW*value/2380,6,fill=1,stroke=0)
            y+=28
        y=para(page['chart_note'],y-3,size=9.1,leading=12.4,font='Sans',color=MUTED,gap=22)
        y=para(page['secondary_title'],y,size=16,leading=19,font='SerifBold',gap=7)
        y=para(page['secondary_text'],y)
        line(M,y+2,W-M,y+2)
        y=para(page['close'],y+18,size=13,leading=18.1,gap=0)
    elif kind in ['essay','decision']:
        for p in page['paragraphs']: y=para(p,y)
        y=block(page['callout'],max(y+8,640) if kind=='decision' else y+10)
    elif kind=='proof':
        for p in page['paragraphs']: y=para(p,y)
        y+=5
        for i,(number,label) in enumerate(page['metrics']):
            x=M+i*(CW/3)
            txt(number,x,y,37,'Serif',ORANGE)
            para(label,y+42,x=x,width=CW/3-12,size=9.1,leading=12,font='Sans',gap=0)
        y+=80
        y=para(page['metric_note'],y,size=8.8,leading=11.8,font='Sans',color=MUTED,gap=17)
        for p in page['after']: y=para(p,y,size=12.0,leading=16.7,gap=10)
    elif kind=='tower':
        y=para(page['intro'],y)
        y+=5
        for a,b in page['table']:
            line(M,y-5,W-M,y-5)
            ya=para(a,y,x=M,width=117,size=9,leading=12,font='SansBold',gap=0)
            yb=para(b,y,x=M+130,width=CW-130,size=10.3,leading=13.8,font='Sans',gap=0)
            y=max(ya,yb)+13
        y+=3
        for p in page['after']: y=para(p,y,size=11.8,leading=16.2,gap=9)
    elif kind in ['roles','implementation']:
        y=para(page['intro'],y)
        values=page['roles'] if kind=='roles' else page['stages']
        for i,(a,b) in enumerate(values):
            line(M,y+1,W-M,y+1)
            y+=12
            y=para(a,y,size=13.1,leading=16.5,font='SerifBold',color=ORANGE,gap=5)
            y=para(b,y,size=11.9,leading=16.2,gap=12)
        y+=3
        for p in page['after']: y=para(p,y,size=11.9,leading=16.2,gap=11)
    finish(y)

base('Sources and evidence notes')
txt('SOURCES & EVIDENCE NOTES',M,77,8.4,'SansBold',ORANGE)
y=para('The argument should hold up\nwhen someone checks it.'.replace('\n','<br/>'),99,size=29,leading=31,gap=10,markup=True)
y=para('Sources checked September 10, 2026. Numbers distinguish reported facts, supplied evidence and proposed outcomes.',y,size=9.1,leading=12.5,font='Sans',color=MUTED,gap=20)
colw=(CW-26)/2
bottom=[]
for group,x in [(data['sources'][:8],M),(data['sources'][8:],M+colw+26)]:
    yy=y
    for s in group:
        c.bookmarkHorizontalAbsolute('source-'+str(s['n']),H-yy)
        title=html.escape(str(s['n'])+'. '+s['title'])
        if s['url']: title=f'<link href="{html.escape(s["url"],quote=True)}" color="{ORANGE}">{title}</link>'
        yy=para(title,yy,x=x,width=colw,size=8.7,leading=11.2,font='SansBold',gap=3,markup=True)
        yy=para(s['note'],yy,x=x,width=colw,size=8.5,leading=11.0,font='Sans',gap=10)
    bottom.append(yy)
y=max(bottom)+4
line(M,y,W-M,y)
y=para(data['method_note'],y+12,size=8.6,leading=11.5,font='Sans',color=MUTED,gap=0)
finish(y)
c.save()

# Keep the complete narrative editable, with links preserved.
md=['# '+data['title'],'',data['subtitle'],'',data['date'],'']
for p in data['cover']: md += [p,'']
md += [data['cover_line'],'']
for p in data['pages']:
    md+=['## '+p['title'],'']
    if 'intro' in p: md+=[p['intro'],'']
    for v in p.get('paragraphs',[]): md+=[v,'']
    if 'bars' in p:
        md += ['### '+p['chart_title'],'','| University | Founders | Rank |','|---|---:|---:|']+[f'| {n} | {v:,} | {r} |' for n,v,r in p['bars']]+['',p['chart_note'],'','### '+p['secondary_title'],'',p['secondary_text'],'',p['close'],'']
    if 'metrics' in p: md += ['| Metric | Count |','|---|---:|']+[f'| {label} | {v} |' for v,label in p['metrics']]+['',p['metric_note'],'']
    if 'table' in p: md += ['| Proposal element | Detail |','|---|---|']+[f'| {a} | {b} |' for a,b in p['table']]+['']
    for a,b in p.get('roles',p.get('stages',[])): md += ['### '+a,'',b,'']
    for v in p.get('after',[]): md += [v,'']
    if 'callout' in p: md += ['> '+p['callout'],'']
md+=['## Sources and evidence notes','']
for s in data['sources']:
    title=f'[{s["title"]}]({s["url"]})' if s['url'] else s['title']
    md += [f'{s["n"]}. {title}. {s["note"]}','']
md += [data['method_note'],'']
(OUT/'Silicon_Hills_Project_Innovation_Tower_Brief.md').write_text('\n'.join(md))
(WORK/'layout-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'pdf':str(pdf_path),'pages':page_num,'layout':report},indent=2))
