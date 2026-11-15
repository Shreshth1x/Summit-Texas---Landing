import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT='/Users/shreshth/Developer/SummitTexas-landing';
const TMP=path.join(ROOT,'tmp/info-session-deck');
const OUT=path.join(ROOT,'outputs/Silicon_Hills_Project_Info_Session.pptx');
const AS=path.join(TMP,'assets');
const P=Presentation.create({slideSize:{width:1280,height:720}});
const C={ink:'#101010',muted:'#666666',rule:'#CDCDCD',pale:'#F1F1F1',blue:'#DCF0FA',blueInk:'#15506F',white:'#FFFFFF'};
const registry=[];
const allSources=[];

function text(s,name,str,x,y,w,h,size=28,opts={}){
 const a=s.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=str;
 a.text.style={typeface:'Helvetica Neue',fontSize:size,color:C.ink,alignment:'left',verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{top:0,right:0,bottom:0,left:0},...opts};
 registry.push({slide:P.slides.items.indexOf(s)+1,name,x,y,w,h,type:'text',text:str});return a;
}
function shape(s,name,x,y,w,h,fill='none',lineFill='none',lineWidth=0,geometry='rect',extra={}){
 const a=s.shapes.add({geometry,name,position:{left:x,top:y,width:w,height:h},fill,line:{fill:lineFill,width:lineWidth,style:'solid',...extra}});
 registry.push({slide:P.slides.items.indexOf(s)+1,name,x,y,w,h,type:'shape'});return a;
}
function rule(s,name,x,y,w,color=C.rule,width=1){return shape(s,name,x,y,w,0,'none',color,width,'line');}
async function img(s,name,file,x,y,w,h,fit='contain'){
 const b=await fs.readFile(file);const ext=path.extname(file).toLowerCase();
 const a=s.images.add({blob:b,contentType:ext==='.svg'?'image/svg+xml':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':'image/png',alt:name,fit,position:{left:x,top:y,width:w,height:h}});
 registry.push({slide:P.slides.items.indexOf(s)+1,name,x,y,w,h,type:'image',file});return a;
}
function slide(label,title,footer=''){
 const s=P.slides.add();s.background.fill=C.white;
 text(s,'section-label',label.toUpperCase(),52,30,1000,24,16,{bold:true,color:C.muted});
 if(title)text(s,'slide-title',title,52,84,1176,65,48);
 rule(s,'footer-rule',52,662,1176);
 text(s,'footer-brand','SILICON HILLS PROJECT',52,680,260,20,13,{color:C.muted});
 if(footer)text(s,'footer-scope',footer,340,679,820,30,13,{color:C.muted,alignment:'right'});
 text(s,'page',String(P.slides.items.length).padStart(2,'0'),1188,679,40,22,14,{alignment:'right',color:C.muted});
 return s;
}
function notes(s,body,src=[]){
 allSources.push({slide:P.slides.items.indexOf(s)+1,body,sources:src});
 s.speakerNotes.textFrame.setText(body+'\n\n[Sources]\n'+src.map(x=>'- '+x).join('\n')+'\n[/Sources]');
}
async function findAsset(names){
 for(const n of names){const f=path.join(AS,n);try{await fs.access(f);return f;}catch{}}
 throw new Error('Missing asset; checked '+names.join(', '));
}

// 1. Sparse cover, following the Codex Grid title-stack hierarchy.
{
 const s=slide('Information session',null,'Independent initiative • not affiliated with UT Austin');
 text(s,'cover-title','Summit House',52,225,960,120,96);
 text(s,'cover-subtitle','A place to build.\nPeople to build with.',56,380,840,130,44);
 text(s,'cover-location','WEST CAMPUS  /  AUSTIN, TEXAS',56,563,900,32,21,{color:C.muted});
 await img(s,'Silicon Hills Project mark',await findAsset(['silicon-hills-mark.png','summit-mark.png']),1060,200,160,160);
 notes(s,'Open with the audience: students who spend their free time building things and want a consistent community around the work. Summit House is the first house proposed by Silicon Hills Project. Do not present the house as already open unless the presenter has confirmed that status.',[
  'https://www.siliconhillsproject.com/mission',ROOT+'/assets/silicon-hills-mark.svg (project brand asset)']);
}
// 2. Three historical milestones; all text editable.
{
 const s=slide('A brief history','Silicon Hills was built deliberately.');
 text(s,'nickname','Chips, computers, and the hills around Austin.',52,167,1150,42,28,{color:C.muted});
 rule(s,'timeline',74,340,1120,C.ink,1.5);
 const events=[
  {x:74,year:'1983',title:'MCC chooses Austin.',body:'UT, government, and business\nbring a major computing\nresearch consortium here.'},
  {x:480,year:'1984',title:'Dell starts at UT.',body:'Michael Dell starts\nPC’s Limited with $1,000\nwhile attending UT.'},
  {x:886,year:'1988',title:'SEMATECH arrives.',body:'Austin becomes home to a\nnational effort to advance\nsemiconductor manufacturing.'}
 ];
 for(const e of events){
  shape(s,'timeline-dot-'+e.year,e.x-5,335,10,10,C.ink,'none',0,'ellipse');
  text(s,'year-'+e.year,e.year,e.x,257,330,74,60);
  text(s,'event-'+e.year,e.title,e.x,381,338,42,28,{bold:true});
  text(s,'detail-'+e.year,e.body,e.x,441,338,132,24,{color:C.muted});
 }
 notes(s,'Austin did not become a technology center by accident: leaders connected a research university, industry, government and entrepreneurs. The nickname refers to semiconductor activity and the area’s hills; do not give an unsupported precise coinage date. MCC selected Austin in 1983. Dell’s official company founding date is 1984, although his early dorm activity began before then. SEMATECH formed in August 1987 but selected Austin in January 1988 and occupied its Austin site in April 1988.',[
 'https://www.austintechnologycouncil.org/history-of-austin-tech/',
 'https://ic2.utexas.edu/wp-content/uploads/echeverri-2017-austin-entrepreneurial-genesis-report.pdf',
 'https://www.dell.com/en-us/lp/dt/timeline',
 'https://www.gao.gov/assets/rced-90-37.pdf (printed pp. 10–11)']);
}
// 3. One documented result, with investor-specific scope.
{
 const s=slide('Austin Ventures IV • 1994','Austin could produce exceptional returns.','WSIB performance as of December 31, 2025');
 text(s,'return-multiple','8.4×',50,220,660,240,204);
 text(s,'investor-result','$15M invested\n$126.3M distributed',746,262,480,136,40);
 rule(s,'return-right-rule',746,418,440);
 text(s,'return-scope','One public investor’s result\nin Austin Ventures IV.',746,451,460,90,28,{color:C.muted});
 text(s,'cash-scope','Cash distributions, including the original investment.',57,567,1110,36,24,{color:C.muted});
 notes(s,'The entity is Austin Ventures; the result is for Fund IV, not the whole firm. Washington State Investment Board reports $15,000,000 paid in, $126,322,781 distributions, no remaining market value, an 8.4x total value multiple and 73.23% net IRR for its Fund IV stake. Say: one public investor received about $8.40 back for every dollar contributed. The multiple includes principal. Optional short historical bridge: Austin lost 17,000 technology jobs during the dot-com crash. By 2015, Austin Ventures had failed to raise a successor fund. These setbacks do not establish that today’s ecosystem is failing.',[
 'https://www.sib.wa.gov/docs/reports/quarterly/ir123125.pdf (PDF p. 7; report as of December 31, 2025)',
 'https://services.austintexas.gov/edims/document.cfm?id=227523 (17,000 local technology jobs eliminated)',
 'https://fortune.com/2015/02/20/the-death-of-austin-ventures/ (successor-fund point only)']);
}
// 4. Different measures, explicitly scoped rather than blended.
{
 const s=slide('Austin today','The capital is here.');
 text(s,'preseed-number','#3',57,204,430,168,142);
 text(s,'preseed-caption','U.S. metro for pre-seed\ninvestment in Carta’s\nQ2 2026 dataset.',60,388,495,125,30);
 shape(s,'metric-divider',624,218,0,298,'none',C.rule,1,'line');
 text(s,'large-round-number','79%',709,204,500,168,142);
 text(s,'large-round-caption','of Austin venture dollars went\ninto rounds of $100M+ in\nDealroom’s trailing four quarters.*',713,388,500,125,28);
 text(s,'current-takeaway','A funding headline does not tell a student where to start.',60,551,1160,44,32,{bold:true});
 text(s,'period-definition','*Through Q2 2026. Round size, not a funding-stage or founder-access measure.',60,613,1160,25,17,{color:C.muted});
 notes(s,'Avoid claiming Austin has no seed money or that funding is collapsing. Carta ranks Austin third by dollars for US pre-seed financings in Q2 2026, behind the Bay Area and New York City; its dataset covers companies on Carta and pre-seed SAFEs/convertible notes. Dealroom’s 79% measures venture dollars in rounds of $100M+, not a count of founders or a formal stage. Its chart’s trailing-four-quarter endpoint is Q2 2026 (the implied calendar window is Q3 2025–Q2 2026). These statistics describe funding markets. They do not prove that students struggle to find peers; that diagnosis is the project’s thesis and should be illustrated with the presenter’s real experience.',[
 'https://carta.com/data/state-of-pre-seed-q2-2026/ (August 13, 2026)',
 'https://dealroom.co/guides/austin (stage-by-round-size section; updated July 24, 2026)',
 'https://dealroom.co/charts/austin-stage-scaleup?embed=triple']);
}

// 5. User-requested two-axis diagram. Native lines/text + individually editable logos.
{
 const s=slide('The ecosystem','Where Summit House fits.');
 text(s,'map-format-label','PRIMARY FORMAT',52,161,165,24,14,{bold:true,color:C.muted});
 text(s,'map-y-top','Ongoing\nshared\nworkspace',52,194,136,98,22);
 text(s,'map-y-bottom','Programs\n& funding',52,508,140,65,22);
 // Axes and reference lines precede the logo nodes in drawing order.
 shape(s,'vertical-axis',197,183,0,398,'none',C.ink,1.5,'line');
 rule(s,'horizontal-axis',197,581,1009,C.ink,1.5);
 // Highlight is an intended background behind Summit House, not a measured region.
 shape(s,'summit-highlight',986,180,222,137,C.blue,'none',0,'ellipse');
 const A={
  station:await findAsset(['station-austin-wordmark.png','station-austin.png','station.png']),
  antler:await findAsset(['antler-logo.png','antler.png']),
  tic:await findAsset(['texas-innovation-center-logo.png','texas-innovation-center.png','tic.png']),
  ut:await findAsset(['ut-austin-shield.png','ut-austin.png','ut.png']),
  convergent:await findAsset(['texas-convergent-logo-trimmed.png','texas-convergent.png','convergent.png']),
  genesis:await findAsset(['genesis-logo-light-background.png','genesis.png']),
  summit:await findAsset(['silicon-hills-mark.png','summit-mark.png'])
 };
 await img(s,'STATION Austin official logo',A.station,253,221,180,58);
 text(s,'station-label','STATION Austin',252,292,211,32,22);
 await img(s,'Antler official logo',A.antler,314,350,153,50);
 text(s,'antler-label','Full-time residency',278,413,255,28,21,{color:C.muted});
 shape(s,'TIC-logo-dark-backing',548,291,190,49,C.ink,'none',0);
 await img(s,'Texas Innovation Center official logo',A.tic,558,296,170,37);
 text(s,'tic-label','Texas Innovation\nCenter',555,355,203,56,21);
 await img(s,'UT Austin mark identifying LEA Co-Lab',A.ut,790,209,59,50);
 text(s,'colab-label','LEA Co-Lab*',764,275,180,32,22);
 await img(s,'Silicon Hills Project mark identifying planned Summit House',A.summit,1064,195,66,58);
 text(s,'summit-label','Summit House',1001,263,190,33,25,{bold:true,alignment:'center'});
 text(s,'summit-planned','PLANNED',1048,300,100,20,13,{color:C.blueInk,bold:true,alignment:'center'});
 await img(s,'UT Austin mark identifying Longhorn Startup',A.ut,850,377,52,45);
 text(s,'longhorn-label','Longhorn Startup',790,431,240,28,22);
 await img(s,'Texas Convergent official logo',A.convergent,1033,442,80,53);
 text(s,'convergent-label','Texas Convergent',971,509,240,28,22,{alignment:'center'});
 await img(s,'Genesis official logo',A.genesis,851,494,78,47);
 text(s,'genesis-label','Genesis',835,549,150,28,22);
 text(s,'map-x-left','Broader founder community',208,593,450,29,22);
 text(s,'map-x-right','Student-focused',938,593,270,29,22,{alignment:'right'});
 text(s,'map-caveat','Qualitative placement; spacing within audience groups aids legibility. Offerings overlap.',52,625,1170,21,15,{color:C.muted});
 text(s,'map-brand-caveat','*Co-Lab access not verified. University marks identify UT programs; logos do not imply partnership.',52,644,1170,18,13,{color:C.muted});
 const prov=await fs.readFile(path.join(AS,'logos-provenance.json'),'utf8').catch(()=> 'Provenance manifest unavailable');
 notes(s,'This is an editorial positioning diagram, not a statistical scatterplot. Horizontal axis: primary audience, broader founder community to student-focused. Vertical: primary engagement format, programs and funding to ongoing shared workspace. Positions do not represent measured scores, rankings, exclusivity or absence of other services. Offerings overlap. Summit is a planned offering. Co-Lab intentionally appears close to Summit: UT lists it as coworking for student startups, but current access arrangements/hours were not verified. Texas Innovation Center provides coworking and commercialization support, primarily for UT faculty and STEM graduate students; public hours are 9 AM–4 PM weekdays. STATION Austin launched in March 2026 carrying forward Capital Factory’s community/programming; Capital Factory still exists separately. Antler is an in-person full-time residency open to solo, pre-company founders. Longhorn Startup has historically included coworking benefits; this is primary-format placement, not a claim that it has no workspace. Do not claim the upper-right is empty. The opening we see is a particular combination: student peers, West Campus, 24/7 space and an ongoing curated community. Logos identify organizations only; no partnership or endorsement is implied. UT parent mark identifies Co-Lab and Longhorn Startup; it is not a fabricated program logo.\n\nLogo provenance:\n'+prov,[
 'https://news.capitalfactory.com/release/56d81ac2-2bce-4ff3-855f-daee4c37fc56',
 'https://sites.google.com/capitalfactory.com/newmembersite/physical-space/coworking',
 'https://www.antler.co/location/us',
 'https://discoverytoimpact.utexas.edu/texasinnovationcenter/',
 'https://undergraduates.utexas.edu/launchpad/ut-opportunities/student-orgs',
 'https://exl.cns.utexas.edu/build-skills/entrepreneurship',
 'https://utdirect.utexas.edu/apps/student/coursedocs/nlogon/download/11079027/ (historical 2021 syllabus; not proof of current benefits)',
 'https://txconvergent.org/',
 'https://www.genesisut.com/',
 'https://www.genesisut.com/faq',
 'https://www.siliconhillsproject.com/mission',ROOT+'/EF_SPONSORSHIP_BRIEF.md',path.join(AS,'logos-provenance.json')]);
}
// 6. The interpretation of the map, not an asserted monopoly.
{
 const s=slide('Why we exist',null);
 text(s,'mission-big','A daily home\nfor student builders.',52,159,1168,213,80);
 text(s,'mission-body','Bring ambitious people together.\nHelp projects become companies built here.',57,426,1090,105,36);
 rule(s,'mission-rule',56,566,1168);
 text(s,'mission-combination','STUDENT PEERS   /   WEST CAMPUS   /   24/7   /   CONTINUITY',57,590,1170,35,22,{color:C.muted});
 notes(s,'This is the project’s mission and proposed contribution, not an empirically established claim that no other program serves student builders. Add the presenter’s actual story about why Silicon Hills Project was restarted here; no organizational restart history has been invented. The map shows overlap. The thesis is that this particular combination deserves to exist and can make it easier to build and stay in Austin.',[
 'https://www.siliconhillsproject.com/mission',ROOT+'/EF_SPONSORSHIP_BRIEF.md (house, pre-accelerator focus and curated community)']);
}
// 7. Audience.
{
 const s=slide('Who this is for','People who already make things.');
 const groups=[
  {x:57,n:'01',title:'You build.',body:'Software. Hardware. Research.\nSomething you keep working on\nafter the assignment ends.'},
  {x:460,n:'02',title:'You want peers.',body:'People to trade ideas with,\nget honest feedback from,\nand build alongside.'},
  {x:865,n:'03',title:'You want to go further.',body:'A project, a team, a company.\nYou’re ready to take\nthe work seriously.'}
 ];
 for(const g of groups){text(s,'audience-number-'+g.n,g.n,g.x,246,300,57,44,{color:'#B8B8B8'});rule(s,'audience-rule-'+g.n,g.x,326,347);text(s,'audience-title-'+g.n,g.title,g.x,362,350,76,29,{bold:true});text(s,'audience-body-'+g.n,g.body,g.x,461,350,128,24,{color:C.muted});}
 notes(s,'This describes the intended audience rather than final eligibility or selection rules. The existing brief explicitly includes people who may not yet think of themselves as founders. Do not announce cohort size, fees, selection stages, equity terms or eligibility rules here unless the presenter supplies their final version.',[ROOT+'/EF_SPONSORSHIP_BRIEF.md:13-15,37-41','https://www.siliconhillsproject.com/mission']);
}
// 8. House detail, preserving a dominant image region and left text field.
{
 const s=slide('The house',null,'Illustrative concept • not a site photo');
 text(s,'house-title','One house.\nBuilt for work.',52,134,559,132,54);
 text(s,'house-spec','A nine-bedroom house\nin West Campus, planned as\n24/7 office and project space.',56,312,540,135,30);
 text(s,'house-rooms','Offices. Collaborative rooms.\nLight hardware workspaces.',56,483,542,89,27,{color:C.muted});
 text(s,'nonresidential','Nobody lives here.',56,602,543,32,25,{bold:true});
 await img(s,'Illustrative concept of a founder house exterior; not Summit House site photography',path.join(TMP,'source-images/image2.png'),642,81,586,563,'cover');
 notes(s,'This is a concept illustration from the earlier user-owned alumni deck, not a site photo, construction plan, promise of fit-out, or image of the actual address. The existing sponsorship brief describes a nine-bedroom West Campus house converted to office, collaborative and light hardware project rooms. Nobody lives in the first house. Public site wording is future tense; keep launch date/access status unannounced unless confirmed. Do not infer a wet lab, heavy machine shop, licensed lab, or residential program.',[
 ROOT+'/EF_SPONSORSHIP_BRIEF.md:11-15',
 'https://www.siliconhillsproject.com/mission',
 ROOT+'/outputs/Silicon_Hills_Project_UT_Alumni_Deck.pptx, slide 2, concept image (extracted media image2.png; prior notes label illustrative)']);
}
// 9. Community expectations; no invented application or investment commitments.
{
 const s=slide('The people inside it',null,'Illustrative concept • not a site photo');
 await img(s,'Illustrative concept of students building together; not an actual participant photo',path.join(TMP,'source-images/image3.png'),52,90,610,548,'cover');
 text(s,'culture-title','Show up.\nShare the work.\nHelp each other.',714,177,510,238,55);
 text(s,'culture-body','The house works when people\nkeep coming back—and\nmake each other better.',718,461,485,130,28,{color:C.muted});
 notes(s,'Present this as the culture we want to create. It is not a formal attendance rule or promise of specific mentoring/programming. The existing brief proposes small groups, recurring accountability and targeted help, but dates and commitments remain for the team to confirm. The image is a concept illustration from the prior alumni deck, not real participants or the actual property.',[
 'https://www.siliconhillsproject.com/mission',ROOT+'/EF_SPONSORSHIP_BRIEF.md:43-55',
 ROOT+'/outputs/Silicon_Hills_Project_UT_Alumni_Deck.pptx, slide 3, concept image (extracted media image3.png; prior notes label illustrative)']);
}
// 10. Deliberate presenter handoff; no guessed process.
{
 const s=slide('Joining Summit House',null);
 text(s,'applications-title','Applications',52,225,1150,128,96);
 text(s,'applications-topics','Who we’re looking for.\nHow to apply.\nWhat happens next.',57,402,1000,169,38);
 notes(s,'APPLICATION STRUCTURE HANDOFF: The presenter has not supplied the final application structure. This is an intentional section divider, not a completed process slide. Add the confirmed eligibility, stages, deadlines, interviews, selection criteria, capacity, costs and timing in your spoken remarks or replace this slide with your own process slides. Do not infer those terms from older internal briefs. Current public join links are available via get-involved, but the form may not represent the final selection process.',[
 'User instructions in this conversation: application structure not supplied.',
 'https://www.siliconhillsproject.com/get-involved']);
}
// 11. Conditional future.
{
 const s=slide('What comes next','Start with one house. Grow what works.');
 const items=[
  ['FIRST','Make this a place worth returning to.'],
  ['THEN','Help projects become teams and companies.'],
  ['IF IT WORKS','Build more places for Austin’s talent to stay.']
 ];
 items.forEach((r,i)=>{const y=229+i*122;text(s,'future-label-'+i,r[0],57,y,212,34,21,{bold:true,color:C.muted});text(s,'future-copy-'+i,r[1],315,y-5,900,62,33);rule(s,'future-rule-'+i,57,y+80,1169);});
 text(s,'future-qualifier','An ambition, not a promised expansion schedule.',57,615,1166,28,21,{color:C.muted});
 notes(s,'The public mission is conditional: if the first house works, grow more houses and later founder houses where teams may live and build together. Those future residential houses are different from the nonresidential Summit House pilot. No expansion dates, fundraising outcomes, jobs, investment allocations or company counts are promised here.',[
 'https://www.siliconhillsproject.com/mission']);
}
// 12. Resolve opening with an audience-centered Q&A.
{
 const s=slide('Q&A',null,'Independent initiative • not affiliated with UT Austin');
 text(s,'closing-title','What are you\nworking on?',52,175,1150,245,96);
 text(s,'closing-invitation','Let’s talk about what you want to build.',57,476,1150,60,36);
 const url=text(s,'closing-url','siliconhillsproject.com/get-involved',57,577,1140,46,28,{color:C.muted});
 url.text.get('siliconhillsproject.com/get-involved').link={uri:'https://www.siliconhillsproject.com/get-involved',isExternal:true};
 notes(s,'Invite questions and conversation about what the audience is building. The get-involved route links to student interest, partnerships and operator roles. It is not represented here as the final cohort application deadline or selection process.',[
 'https://www.siliconhillsproject.com/get-involved']);
}

await fs.mkdir(path.join(TMP,'renders'),{recursive:true});
await fs.writeFile(path.join(TMP,'source-notes.txt'),allSources.map(x=>'SLIDE '+x.slide+'\n'+x.body+'\n[Sources]\n'+x.sources.join('\n')+'\n[/Sources]').join('\n\n'));
await fs.writeFile(path.join(TMP,'object-registry.json'),JSON.stringify(registry,null,2));
await fs.writeFile(path.join(TMP,'presentation.json'),JSON.stringify(P.toProto()));
console.log('Authored '+P.slides.items.length+' slides; exporting PPTX.');
const deck=await PresentationFile.exportPptx(P);await deck.save(OUT);console.log('PPTX: '+OUT);
for(const [i,s]of P.slides.items.entries()){
 const stem='slide-'+String(i+1).padStart(2,'0');
 const png=await P.export({slide:s,format:'png',scale:1.5});
 await fs.writeFile(path.join(TMP,'renders',stem+'.png'),new Uint8Array(await png.arrayBuffer()));
 const layout=await s.export({format:'layout'});await fs.writeFile(path.join(TMP,'renders',stem+'.layout.json'),await layout.text());
 console.log('Rendered '+stem);
}
const montage=await P.export({format:'webp',montage:true,scale:0.5});
await fs.writeFile(path.join(TMP,'montage.webp'),new Uint8Array(await montage.arrayBuffer()));
console.log('Build complete.');
