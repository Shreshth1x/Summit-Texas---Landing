import fs from 'node:fs/promises';
import path from 'node:path';
import {Presentation,PresentationFile} from '@oai/artifact-tool';

const ROOT='/Users/shreshth/Developer/SummitTexas-landing';
const TMP=path.join(ROOT,'tmp/info-session-deck');
const A=path.join(TMP,'assets');
const OUT=path.join(ROOT,'outputs');
const p=Presentation.create({slideSize:{width:1600,height:900}});
const s=p.slides.add();s.background.fill='#FFFFFF';
const records=[];
function txt(name,copy,x,y,w,h,size=26,opt={}){
 const q=s.shapes.add({name,geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=copy;q.text.style={typeface:'Helvetica Neue',fontSize:size,color:'#151515',alignment:'left',verticalAlignment:'top',wrap:'square',autoFit:'none',insets:{top:0,right:0,bottom:0,left:0},...opt};
 records.push({name,type:'text',x,y,w,h});return q;
}
function shp(name,x,y,w,h,fill='none',stroke='none',width=0,geometry='rect'){
 return s.shapes.add({name,geometry,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width}});
}
async function image(name,file,x,y,w,h){
 const b=await fs.readFile(path.join(A,file));
 s.images.add({blob:b,contentType:'image/png',alt:name,fit:'contain',position:{left:x,top:y,width:w,height:h}});
 records.push({name,type:'image',x,y,w,h});
}

txt('title','Austin’s builder ecosystem',62,34,1476,69,52);
txt('subtitle','Where Summit House fits',65,106,1420,40,28,{color:'#666666'});

// A literal central cross: four quadrants, with no frame masquerading as axes.
shp('audience-axis',195,469,1220,0,'none','#151515',2,'line');
shp('format-axis',803,204,0,552,'none','#151515',2,'line');
txt('format-top','ONGOING SHARED WORKSPACE',506,166,594,34,24,{alignment:'center',bold:true});
txt('format-bottom','PROGRAMS & FUNDING',506,771,594,35,24,{alignment:'center',bold:true});
txt('audience-left','Broader\nfounder\ncommunity',36,424,147,94,23,{alignment:'right'});
txt('audience-right','Student-\nfocused',1435,440,140,64,23);

// Upper-left: community spaces and full-time residencies.
await image('STATION Austin official logo','station-austin-wordmark.png',282,226,215,105);
txt('station-label','STATION Austin',270,346,249,37,28,{alignment:'center'});
await image('Antler official logo','antler-logo.png',552,331,169,45);
txt('antler-caption','Full-time residency',508,397,263,34,24,{alignment:'center',color:'#666666'});

// Upper-right: show the closest overlaps, not a fictitiously empty quadrant.
shp('TIC-logo-backing',848,246,238,58,'#151515');
await image('Texas Innovation Center official logo','texas-innovation-center-logo.png',859,255,215,36);
txt('tic-caption','UT research +\ncommercialization',848,319,234,68,24,{alignment:'center',color:'#666666'});
await image('UT Austin mark identifying LEA Co-Lab','ut-austin-shield.png',1112,355,39,49);
txt('colab-caption','LEA Co-Lab*',1057,418,169,34,25,{alignment:'center'});
shp('summit-highlight',1174,209,240,139,'#DDF0FA','none',0,'ellipse');
await image('Silicon Hills Project mark identifying Summit House','silicon-hills-mark.png',1262,217,64,54);
txt('summit-name','Summit House',1191,280,207,36,29,{bold:true,alignment:'center'});
txt('summit-planned','PLANNED',1231,321,126,24,15,{alignment:'center',bold:true,color:'#15506F'});

// Lower-left: a current venture fund, distinct from coworking/community organizations.
const funding=JSON.parse(await fs.readFile(path.join(A,'quadrant-funding-player.json'),'utf8'));
if(funding.darkBacking)shp('funding-logo-backing',318,550,366,95,'#151515');
await image(funding.organization+' official logo',funding.filename,334,560,334,78);
txt('funding-caption',funding.caption,283,659,437,76,26,{alignment:'center',color:'#666666'});

// Lower-right: current student courses, building programs and capital.
await image('UT Austin mark identifying Longhorn Startup','ut-austin-shield.png',890,527,43,54);
txt('longhorn-caption','Longhorn Startup',824,594,232,38,25,{alignment:'center'});
await image('Texas Convergent official logo','texas-convergent-logo-trimmed.png',1264,518,67,59);
txt('convergent-caption','Texas Convergent',1175,594,252,37,25,{alignment:'center'});
await image('Genesis official logo','genesis-logo-light-background.png',1085,651,52,55);
txt('genesis-caption','Genesis',1024,719,180,34,26,{alignment:'center'});

txt('scope','Selected offerings; qualitative placement by primary audience and format. Spacing aids legibility; offerings overlap.',62,830,1476,26,18,{color:'#666666'});
txt('caveat','*Co-Lab access not verified. University marks identify UT programs. Logos do not imply partnership or endorsement.',62,860,1476,23,17,{color:'#666666'});

const prov=await fs.readFile(path.join(A,'logos-provenance.json'),'utf8');
const sources=[
 'https://news.capitalfactory.com/release/56d81ac2-2bce-4ff3-855f-daee4c37fc56',
 'https://sites.google.com/capitalfactory.com/newmembersite/physical-space/coworking',
 'https://www.antler.co/location/us',
 'https://discoverytoimpact.utexas.edu/texasinnovationcenter/',
 'https://undergraduates.utexas.edu/launchpad/ut-opportunities/student-orgs',
 'https://exl.cns.utexas.edu/build-skills/entrepreneurship',
 'https://txconvergent.org/',
 'https://www.genesisut.com/faq',
 'https://www.siliconhillsproject.com/mission',
 funding.source,
 path.join(A,'logos-provenance.json')
];
s.speakerNotes.textFrame.setText('Four-quadrant map requested by the presenter. Axes intersect in the center. Positions are qualitative groupings by primary audience and engagement format, not measured rankings, exact scores, quality, or exclusivity. Summit is a planned offering. Co-Lab is deliberately nearby: UT lists it as student startup coworking but current access and hours were not verified. TIC provides workspace and commercialization support primarily for UT faculty/STEM graduate research. Antler is a full-time in-person residency and is shown above the horizontal axis. STATION is the current broader community organization; it carries forward Capital Factory community and programming, while Capital Factory still exists. '+funding.description+' Do not claim Summit owns an empty quadrant. The contribution proposed is the particular combination of student peers, West Campus, 24/7 space and an ongoing community. Logos are identification, not endorsements. Two UT parent marks are used because no current individual Co-Lab/Longhorn Startup logos were found.\n\n[Sources]\n'+sources.map(x=>'- '+x).join('\n')+'\n[/Sources]\n\nLogo provenance\n'+prov+'\n'+JSON.stringify(funding,null,2));

await fs.mkdir(OUT,{recursive:true});
const deck=await PresentationFile.exportPptx(p);await deck.save(path.join(OUT,'Austin_Ecosystem_Four_Quadrants.pptx'));
const png=await p.export({slide:s,format:'png',scale:2});
await fs.writeFile(path.join(OUT,'Austin_Ecosystem_Four_Quadrants.png'),new Uint8Array(await png.arrayBuffer()));
const layout=await s.export({format:'layout'});await fs.writeFile(path.join(TMP,'quadrant.layout.json'),await layout.text());
await fs.writeFile(path.join(TMP,'quadrant-objects.json'),JSON.stringify(records,null,2));
console.log('Created standalone 3200×1800 PNG and editable one-slide PPTX.');
