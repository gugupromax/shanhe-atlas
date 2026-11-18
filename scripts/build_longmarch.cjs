/* Compile only the Central Red Army story from its audited, editable JSON. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
function objectEnd(text,start){
  if(text[start]!=='{')throw Error('Expected object opening');
  let depth=0,string=false,escape=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
    if(c==='"'){string=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return i+1;
  }
  throw Error('Unclosed story object');
}
function replaceObject(text,pattern,value,pretty=false){
  const matches=[...text.matchAll(new RegExp(pattern.source,'g'))];
  assert.equal(matches.length,1,'Expected one changzheng story marker');
  const marker=matches[0],open=text.indexOf('{',marker.index),end=objectEnd(text,open);
  const eol=text.includes('\r\n')?'\r\n':'\n';
  let body=JSON.stringify(value,null,pretty?2:0);
  if(pretty)body=body.split('\n').map((line,i)=>i?'    '+line:line).join(eol);
  return text.slice(0,open)+body+text.slice(end);
}
function loadLore(core,detail){
  const context={window:{}};vm.createContext(context);vm.runInContext(core,context);if(detail)vm.runInContext(detail,context);
  return JSON.parse(JSON.stringify(context.window.ATLAS_LORE_DATA));
}
function withoutStory(lore){
  const out=JSON.parse(JSON.stringify(lore));
  if(out.PERSON_PROFILES)out.PERSON_PROFILES=out.PERSON_PROFILES.filter(p=>p.key!=='changzheng');
  if(out.PERSON_DETAILS)delete out.PERSON_DETAILS.changzheng;
  return out;
}
const enLocation={
  yudu:'Representative of several Yudu River crossings, not only the East Gate ferry.',
  tongdao:'The exact meeting site is disputed. A county-level marker does not establish Gongcheng Academy as the verified venue.',
  houchang:'The modern town is Houchang; the former Caotang name changed in 2010.',
  'wujiang-north':'Representative of a group of historic crossings, not a surveyed ferry point.',
  chishui1:'Tucheng represents the crossing sector. Yuanhouchang is modern Yuanhou, not central Chishui city.',
  chishui4:'Taipingdu represents a multi-crossing sector, not a common itinerary through every ferry.',
  'wujiang-south':'A historic crossing sector; modern reservoir shores are not the 1935 river surface.',
  guiyang:'The Zhazuo approach region is marked, not a Red Army occupation of central Guiyang.',
  kunming:'The Xundian–Songming region is marked, not a captured Kunming city.',
  jinsha:'An approximate marker informed by place names and modern river-sector references, not a surveyed 1935 ferry. The old ferry was inundated; new towns and memorials are not substitutes.',
  jiajin:'A representative mountain sector near the recorded pass region, not a single route shared by all units.',
  dawei:'The meeting region is approximate; the historical bridge position still needs checking.',
  maoergai:'The Suohua temple region is marked, not Songpan town.',
  grassland:'A regional marker. The continuous historical path is unverified.',
  liupan:'The mountain region is marked, not the modern memorial park.',
  'wuqi-battle':'A multi-valley battle sector, not the exact location of modern memorial facilities.'
};
function displayDates(start,end){
  const [y,m,d]=start.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if(start===end)return {zh:`${m}月${d}日`,en:`${d} ${months[m-1]}`};
  if(y!==ey)return {zh:`${m}月${d}日—${ey}年${em}月${ed}日`,en:`${d} ${months[m-1]}–${ed} ${months[em-1]} ${ey}`};
  if(m===em)return {zh:`${m}月${d}—${ed}日`,en:`${d}–${ed} ${months[m-1]}`};
  return {zh:`${m}月${d}日—${em}月${ed}日`,en:`${d} ${months[m-1]}–${ed} ${months[em-1]}`};
}
function compile(data){
  const aliases=['长征','长征专题','红军长征','中央红军','中央红军长征','红一方面军长征','二万五千里长征','万里长征','四渡赤水','飞夺泸定桥','巧渡金沙江','血战湘江','changzheng','hongjunchangzheng','Long March','Central Red Army Long March','Red Army Long March'];
  const core={key:'changzheng',zh:'中央红军长征',en:'Central Red Army Long March',courtesyZh:'1934年10月—1935年10月 · 中央红军主线',courtesyEn:'Oct 1934–Oct 1935 · Central Red Army route',isStory:true,dynastyKey:'roc',span:[1934,1935],aliases,evCount:data.stops.length};
  const detail={tokens:[],descZh:'于都河出发至吴起镇落脚的40个节点。点选节点查看日期、战斗经过与出处；21日战斗为到达后的收尾。',descEn:'Forty nodes from the Yudu crossings to arrival at Wuqizhen. Select a node for dates, battle accounts and sources; the battle on the 21st is a post-arrival epilogue.',routeOverview:true,routeEndDate:data.routeEndDate,routeNoteZh:data.routeNoteZh,routeNoteEn:data.routeNoteEn,camps:[{key:'red',zh:'中央红军',en:'Central Red Army',color:'#b53826',calmColor:'#8c3b2b'},{key:'kmt',zh:'国民党追堵部队',en:'Nationalist pursuing and blocking forces',color:'#2b5b84',calmColor:'#3a5a78'}],stops:[]};
  let previousRoute=-1;
  data.stops.forEach((s,index)=>{
    const date=new Date(s.start+'T00:00:00Z');
    assert.ok(Number.isFinite(date.getTime()),'Invalid stop date '+s.id);
    const display=displayDates(s.start,s.end);
    const stop={id:s.id,year:date.getUTCFullYear(),month:date.getUTCMonth()+1,dynastyKey:'roc',subEraZh:display.zh,subEraEn:display.en,camp:'red',ancientZh:s.placeZh,ancientEn:s.placeEn,modernZh:s.modernZh,modernEn:s.modernEn,coord:s.coord,titleZh:s.titleZh,titleEn:s.titleEn,descZh:s.summaryZh,descEn:s.summaryEn,quoteZh:'',quoteEn:''};
    if(s.actZh){stop.actZh=s.actZh;stop.actEn=s.actEn;}
    if(previousRoute>=0){stop.fromStopIdx=previousRoute;stop.fromCoord=data.stops[previousRoute].coord;}
    if(s.via)stop.via=s.via;
    const note='按地名人工概略定位，非实测点，待校准。'+(s.locationNoteZh||'');
    stop.historyDetail={kindZh:s.kindZh,kindEn:s.kindEn,dateStart:s.start,dateEnd:s.end,dateNoteZh:s.dateNoteZh||'',dateNoteEn:s.dateNoteEn||'',resultZh:s.resultZh||'',resultEn:s.resultEn||'',battleZh:s.battleZh||'',battleEn:s.battleEn||'',terrainZh:s.terrainZh||'',terrainEn:s.terrainEn||'',terrainBasis:s.terrainBasis||(['xiangjiang','zunyi-battle','luding','wuqi-battle'].includes(s.id)?'interpretation':'source'),locationNoteZh:note,locationNoteEn:'Approximate manual locality marker; not surveyed and awaiting calibration. '+(s.locationNoteEn||enLocation[s.id]||''),routeStop:s.routeStop!==false,sources:s.sources.map(id=>{const src=data.sources[id];assert.ok(src,'Unknown source '+id);const {title,url,org,published,locator,sourceType,evidenceUse,accessBasis}=src;return {title,url,org,published,sourceType,evidenceUse,accessBasis,...(locator?{locator}:{})};})};
    detail.stops.push(stop);
    if(s.routeStop!==false)previousRoute=index;
  });
  return {core,detail};
}
function outputs(root=ROOT){
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/longmarch/central.json'),'utf8'));
  const compiled=compile(data),corePath=path.join(root,'js/lore_core.js'),detailPath=path.join(root,'js/lore_detail.js');
  const oldCore=fs.readFileSync(corePath,'utf8'),oldDetail=fs.readFileSync(detailPath,'utf8');
  const newCore=replaceObject(oldCore,/\{\s*"key"\s*:\s*"changzheng"/,compiled.core);
  const detailMarker=/"changzheng"\s*:\s*/g;
  const marker=[...oldDetail.matchAll(detailMarker)];assert.equal(marker.length,1);
  const open=oldDetail.indexOf('{',marker[0].index),end=objectEnd(oldDetail,open),eol=oldDetail.includes('\r\n')?'\r\n':'\n';
  const body=JSON.stringify(compiled.detail,null,2).split('\n').map((line,i)=>i?'    '+line:line).join(eol);
  const newDetail=oldDetail.slice(0,open)+body+oldDetail.slice(end);
  assert.deepEqual(withoutStory(loadLore(oldCore,oldDetail)),withoutStory(loadLore(newCore,newDetail)),'Unrelated lore must stay unchanged');
  const sourcePath=path.join(root,'data/sources/persons.json'),oldSources=fs.readFileSync(sourcePath,'utf8');
  const parsed=JSON.parse(oldSources);assert.ok(parsed['person:changzheng'],'Expected existing source registration');
  const registration=[{w:'bainian',loc:'1934年10月—1935年10月条',note:'中央红军主线与重点战役；节点资料逐项见data/longmarch/central.json，不含1936年其他方面军会师路线。'}];
  const key='"person:changzheng"',keyPos=oldSources.indexOf(key),arrOpen=oldSources.indexOf('[',keyPos);
  let string=false,escape=false,depth=0,arrEnd=-1;
  for(let i=arrOpen;i<oldSources.length;i++){const c=oldSources[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}if(c==='"'){string=true;continue;}if(c==='[')depth++;else if(c===']'&&--depth===0){arrEnd=i+1;break;}}
  assert.ok(arrEnd>arrOpen,'Unclosed source registration');
  const inline=JSON.stringify(registration).replace(/":/g,'": ').replace(/,"/g,', "').replace(/},{/g,'}, {').replace(/{"/g,'{ "').replace(/"}/g,'" }');
  const newSources=oldSources.slice(0,arrOpen)+inline+oldSources.slice(arrEnd);
  return [{file:corePath,before:oldCore,after:newCore},{file:detailPath,before:oldDetail,after:newDetail},{file:sourcePath,before:oldSources,after:newSources}];
}
if(require.main===module){
  const changed=outputs().filter(x=>x.before!==x.after);
  if(process.argv.includes('--check')){assert.equal(changed.length,0,'Long March data is stale; run node scripts/build_longmarch.cjs');console.log('PASS: Central Red Army story and source registration are canonical.');}
  else{for(const x of changed)fs.writeFileSync(x.file,x.after,'utf8');console.log(`Built Central Red Army story (${changed.length} files updated).`);}
}
module.exports={objectEnd,replaceObject,displayDates,compile,loadLore,withoutStory,outputs};
