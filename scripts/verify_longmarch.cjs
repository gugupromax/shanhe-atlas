'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compile,displayDates,loadLore,objectEnd,replaceObject,outputs}=require('./build_longmarch.cjs');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/longmarch/central.json'),'utf8'));
const compiled=compile(data),lore=loadLore(fs.readFileSync(path.join(root,'js/lore_core.js'),'utf8'),fs.readFileSync(path.join(root,'js/lore_detail.js'),'utf8'));
const story=lore.PERSON_PROFILES.find(p=>p.key==='changzheng'),stops=story.stops;
const trustedHosts=new Set(['cpc.people.com.cn','www.ccphistory.org.cn','www.dswxyjy.org.cn','www.12371.cn','dangshi.people.com.cn','www.81.mil.cn','szb.eyesnews.cn','www.mct.gov.cn','www.sdcs1935.com','yn.yunnan.cn','www.ynxc.gov.cn','www.cnr.cn','www.hlhjczjng.cn','www.sctyzx.gov.cn','www.scwmw.cn','news.cnr.cn','www.yadsfz.org.cn','www.mod.gov.cn','wcm1.cnr.cn','xiaojin.gov.cn','www.songpan.gov.cn','www.81.cn','gansu.gscn.com.cn','www.hunan.gov.cn','fuwu.12371.cn','jlakes.alljournals.cn','www.qinfeng.gov.cn']);
assert.deepEqual(displayDates('1934-10-17','1934-10-21'),{zh:'10月17—21日',en:'17–21 Oct'});
assert.deepEqual(displayDates('1934-11-27','1934-12-01'),{zh:'11月27日—12月1日',en:'27 Nov–1 Dec'});
assert.deepEqual(displayDates('1934-12-31','1935-01-01'),{zh:'12月31日—1935年1月1日',en:'31 Dec–1 Jan 1935'});
assert.deepEqual(displayDates('1935-05-29','1935-05-29'),{zh:'5月29日',en:'29 May'});
for(const [id,src] of Object.entries(data.sources)){assert.ok(trustedHosts.has(new URL(src.url).hostname),id+' unreviewed host');assert.ok(src.org&&src.sourceType&&src.evidenceUse,id+' source identity and purpose');}
assert.equal(stops.length,40);assert.equal(story.evCount,40);assert.deepEqual(story.span,[1934,1935]);
assert.equal(story.zh,'中央红军长征');assert.equal(story.routeOverview,true);
assert.ok(!story.aliases.some(s=>/三军会师|会宁会师/.test(s)));
assert.equal(new Set(stops.map(s=>s.id)).size,40);
let last='';
for(const [i,s] of stops.entries()){
  const h=s.historyDetail;assert.ok(h&&h.sources.length>=1,s.id+' needs a visible source');
  assert.match(h.dateStart,/^\d{4}-\d{2}-\d{2}$/);assert.ok(h.dateStart<=h.dateEnd&&h.dateStart>=last,s.id+' chronology');last=h.dateStart;
  assert.equal(s.year,Number(h.dateStart.slice(0,4)));assert.equal(s.month,Number(h.dateStart.slice(5,7)));assert.equal(s.dynastyKey,'roc');
  assert.ok(s.coord.length===2&&s.coord.every(Number.isFinite));assert.ok(s.coord[0]>=100&&s.coord[0]<=116&&s.coord[1]>=25&&s.coord[1]<=38,s.id+' plausible route region');
  assert.match(h.locationNoteZh,/概略定位.*待校准/);assert.ok(['source','interpretation'].includes(h.terrainBasis));
  assert.ok(s.titleZh&&s.titleEn&&s.descZh&&s.descEn&&s.subEraZh&&s.subEraEn);
  for(const src of h.sources){const url=new URL(src.url);assert.ok(['http:','https:'].includes(url.protocol));assert.ok(trustedHosts.has(url.hostname));assert.ok(src.title&&src.org&&src.sourceType&&src.evidenceUse&&src.accessBasis);}
  if(i===0)assert.equal(s.fromStopIdx,undefined);else{assert.ok(Number.isInteger(s.fromStopIdx)&&s.fromStopIdx<i);assert.deepEqual(s.fromCoord,stops[s.fromStopIdx].coord);}
}
const by=id=>{const s=stops.find(s=>s.id===id);assert.ok(s,id);return s;};
assert.equal(by('yudu').historyDetail.dateStart,'1934-10-17');
assert.equal(by('houchang').year,1934);assert.equal(by('houchang').historyDetail.dateEnd,'1935-01-01');
assert.deepEqual(['chishui1','chishui2','chishui3','chishui4'].map(id=>by(id).historyDetail.dateStart),['1935-01-29','1935-02-18','1935-03-16','1935-03-21']);
assert.match(by('anshun').historyDetail.battleZh,/25日17勇士/);assert.match(by('luding').historyDetail.battleZh,/22名/);
assert.notEqual(by('anshun').historyDetail.dateStart,by('luding').historyDetail.dateStart);
assert.match(by('tongdao').historyDetail.locationNoteZh,/争议|说法|会址/);
assert.match(by('jinsha').historyDetail.locationNoteZh,/淹没/);assert.deepEqual(by('jinsha').coord,[102.38,26.29]);
assert.match(by('guiyang').historyDetail.resultZh,/没有攻克贵阳/);assert.match(by('kunming').historyDetail.resultZh,/没有攻克昆明/);
assert.ok(!stops.some(s=>['songpan-plan','baozuo'].includes(s.id)));
assert.match(by('grassland').historyDetail.battleZh,/红四方面军/);
assert.equal(by('maoergai').historyDetail.terrainEn,'The plan to capture Songpan was not realized; the schematic route bypasses the town.');
assert.ok(by('maoergai').historyDetail.sources.some(s=>new URL(s.url).hostname==='www.qinfeng.gov.cn'));
assert.match(by('zunyi-battle').historyDetail.dateNoteZh,/3月1日/);assert.equal(by('zunyi-battle').historyDetail.dateEnd,'1935-02-28');
assert.equal(by('wuqi').historyDetail.dateStart,'1935-10-19');assert.equal(by('wuqi-battle').historyDetail.routeStop,false);
assert.equal(stops.filter(s=>s.historyDetail.routeStop).at(-1).id,'wuqi');assert.equal(story.routeEndDate,'1935-10-19');
assert.ok(stops.every(s=>s.year<1936));assert.ok(!stops.some(s=>/直罗镇|会宁终局|三路会合/.test(s.titleZh)));
const braceFixture='{"x":"}\\\"{","v":{"a":1}}tail';
const braceEnd=objectEnd(braceFixture,0);assert.equal(braceFixture.slice(braceEnd),'tail');assert.equal(JSON.parse(braceFixture.slice(0,braceEnd)).v.a,1);
const fixture='prefix {"key":"changzheng","x":{"brace":"}"}} suffix {"key":"other","x":1}';
const edited=replaceObject(fixture,/\{\s*"key"\s*:\s*"changzheng"/,{key:'changzheng',x:2});
assert.ok(edited.startsWith('prefix '));assert.ok(edited.endsWith(' suffix {"key":"other","x":1}'));
assert.equal(outputs().filter(x=>x.before!==x.after).length,0);
assert.deepEqual(story.stops,compiled.detail.stops);
console.log('PASS: 40 sourced Central Red Army nodes, chronology and crossing dates, battle attribution, locality warnings, canonical compilation and unrelated-object boundaries.');
