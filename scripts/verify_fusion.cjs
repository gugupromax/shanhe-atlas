const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),protocol=require('../fusion-protocol.js'),bridge=require('../integration.js'),mapSurface=require('../map-surface.js');
const good={channel:protocol.CHANNEL,type:'state',active:true,seq:1,year:1080,center:[114.9,30.4],widthKm:1500,locations:[{name:'黄州',coord:[114.9,30.4],kind:'journey',index:2,year:1080}],selection:{personKey:'sushi',stopIndex:2},snapshot:{polities:[]},layers:{polities:true}};
assert.equal(protocol.validateState(good).selection.personKey,'sushi');
assert.equal(protocol.validateState({...good,year:2027}).year,2027);
for(const patch of [{year:0},{year:Infinity},{center:[NaN,30]},{center:[190,30]},{widthKm:Infinity},{widthKm:-1}])assert.equal(protocol.validateState({...good,...patch}),null);
assert.equal(protocol.validateState({...good,locations:[{name:'bad',coord:[NaN,0]}]}).locations.length,0);
const pass={kind:'pass',name:'临渝关',coord:[119.77,40.01],pickName:'临渝关',opacity:0.8};
const county={kind:'county',name:'祥符县',pickName:'祥符县',coord:[114.35,34.79],opacity:1,areaKey:'county/xiangfu'};
for(const year of [-250,741,742,1381,1950]){
  const state=protocol.validateState({...good,year,passLabels:[pass,{...pass,kind:'city'},{...pass,coord:[Infinity,40]}],
    adminLabels:[pass,county,{...county,areaKey:'X'.repeat(241)}]});
  assert.deepEqual(state.passLabels,[pass],'passes have a separate all-year transport');
  assert.deepEqual(state.adminLabels[0],county,'administrative seats retain their record type and ID in all years');
  assert.equal(state.adminLabels[1].areaKey,undefined);
}
const adminLayer={display:'inline',opacity:'0.8'};
const marker=(cls,name,coord,areaKey,display='inline')=>{
  const classes=cls.split(' ');
  return {textContent:name,closest:()=>adminLayer,parentElement:{
    display,classList:{contains:kind=>classes.includes(kind)},
    dataset:{ancient:name,lng:coord[0].toString(),lat:coord[1].toString(),areaKey}
  }};
};
const demoUnit=marker('is-admin-prefecture','开封府',[114.3,34.8],'prefecture/kaifeng');
const demoCounty=marker('is-county','祥符县',[114.4,34.7],'county/xiangfu','none');
const originalCity=marker('is-city','汴京',[114.32,34.81]);
const region={textContent:'京畿路',dataset:{x:'114.3',y:'34.9'},closest:()=>adminLayer,
  display:'inline',opacity:'1'};
const adminApp={year:1080,projector:{toGeo:(x,y)=>[x,y]},svg:{querySelectorAll(selector){
  if(selector.includes('grp-region-labels'))return [region];
  if(selector.includes('is-admin-prefecture'))return [demoUnit];
  if(selector.includes('is-county'))return [demoCounty];
  if(selector.includes('settlement-node:not'))return [demoUnit,demoCounty,originalCity];
  return [];
}}};
const adminStyles=node=>({display:node.display,opacity:node.opacity});
assert.deepEqual(mapSurface.adminScreenLabels(adminApp,adminStyles).map(label=>label.name),['京畿路','开封府','汴京']);
demoCounty.parentElement.display='inline';
assert.deepEqual(mapSurface.adminScreenLabels(adminApp,adminStyles).map(label=>[label.kind,label.areaKey]),
  [['circuit',undefined],['prefecture','prefecture/kaifeng'],['county','county/xiangfu'],['prefecture',undefined]]);
assert.ok(mapSurface.adminScreenLabels({...adminApp,year:741},adminStyles).some(label=>label.name==='汴京'),
  '741 retains the complete original screen overlay');
const defaultLayers={polities:true,settlements:true,prefectures:true,corridors:true,hydro:true,modernProvinces:true,milestones:true,modernProvinceNames:false};
const stateApp={year:741,locale:'zh',svg:{classList:{contains:(name)=>name==='is-zoomed-cities'}}};
const tileState={...good,year:741,tileTier:'mid',tileBounds:[100,30,120,40],areaHighlightId:4,areaHighlight:{segments:[[[109,33],[109.4,33.65]]]}};
assert.equal(bridge.tangTileTier(stateApp,defaultLayers,'http:'),'mid');
assert.equal(bridge.tangTileTier({...stateApp,year:742},defaultLayers,'http:'),null);
assert.equal(bridge.tangTileTier(stateApp,{...defaultLayers,settlements:false},'http:'),null);
assert.equal(bridge.tangTileTier(stateApp,defaultLayers,'file:'),null);
assert.deepEqual(protocol.validateState(tileState).tileBounds,[100,30,120,40]);
assert.equal(protocol.validateState({...tileState,year:742}).tileTier,null);
assert.equal(protocol.validateState({...tileState,tileBounds:[10,30,120,40]}).tileBounds,null);
assert.deepEqual(protocol.validateState(tileState).areaHighlight,tileState.areaHighlight);
const countyFocus={...tileState,year:1102,areaHighlight:{point:[113.28,33.5]}};
assert.deepEqual(protocol.validateState(countyFocus).areaHighlight,countyFocus.areaHighlight);
assert.equal(protocol.validateState(countyFocus).areaHighlightId,4);
assert.equal(protocol.validateState({...countyFocus,areaHighlight:{point:[NaN,33.5]}}).areaHighlightId,0);
assert.equal(protocol.validateState({...tileState,year:1102}).areaHighlight,null);
assert.equal(protocol.validateState({...tileState,areaHighlight:{segments:[[[190,10],[109,30]]]}}).areaHighlight,null);
const pick={sceneKey:'741-regions',year:741,coord:[108.94,34.26]};
assert.ok(bridge.isCurrentMapPick(pick,'741-regions',741));
assert.ok(!bridge.isCurrentMapPick(pick,'741-prefectures',741),'reject a click from a stale zoom layer');
assert.ok(!bridge.isCurrentMapPick(pick,'741-regions',742),'reject a click after moving the year');
assert.ok(!bridge.isCurrentMapPick({...pick,coord:[Infinity,34.26]},'741-regions',741));
const output = bridge.renderedSettlementLocations({
  querySelectorAll: () => [
    {dataset:{ancient:'长安',lng:'108.94',lat:'34.26'},display:'inline'},
    {dataset:{ancient:'高陵县',lng:'109.09',lat:'34.53'},display:'none'},
    {dataset:{ancient:'不合法',lng:'999',lat:''},display:'inline'},
    {dataset:{ancient:'不合法',lng:'120?',lat:'30'},display:'inline'},
  ],
}, node => ({display:node.display,visibility:'hidden'}));
assert.deepEqual(output,[{name:'长安',coord:[108.94,34.26],kind:'city'}],'parent SVG is hidden in 3D, but current display tiers are authoritative');
const sent=[],parent={postMessage:m=>sent.push(m)},handlers={};let received=0;
const fake={parent,addEventListener:(k,v)=>handlers[k]=v};
const child=protocol.createChild(fake,{onState:()=>received++,onConfig:()=>{}});child.ready();child.ready();assert.equal(sent.length,1);
handlers.message({source:{},data:good});assert.equal(received,0);
handlers.message({source:parent,data:good});assert.equal(received,1);
handlers.message({source:parent,data:{...good,seq:0}});assert.equal(received,1);
const context={window:{addEventListener:()=>{}},setTimeout,clearTimeout,URLSearchParams};vm.runInNewContext(fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context);
const projector=new context.window.MercatorProjector(1000,650,{west:66,east:142,south:14,north:55});
vm.runInNewContext(fs.readFileSync(path.join(root,'js/lore_core.js'),'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(root,'js/atlas_trace.js'),'utf8'),context);
// Drive the production 2D pass renderer, then read those same nodes for 3D.
function gatesIn(year, key='tang', locale='zh', revealed=true) {
  const layer={children:[]};
  const app=Object.create(context.window.HistoricalAtlasController.prototype);
  Object.assign(app,{year,locale,projector,grpSettlements:layer,_zh:text=>text,_mapText:text=>text,
    _rescaleSvgTypography(){},
    _svgNode(tag,attrs,parent){
      const node={tag,dataset:{},children:[],textContent:'',parentElement:parent,
        classList:{contains:name=>(attrs.class||'').split(' ').includes(name)},
        querySelectorAll:()=>[],closest:()=>layer};
      parent.children.push(node);
      return node;
    },
    svg:{querySelectorAll(){
      return layer.children[0].children.flatMap(gate=>gate.children.filter(child=>child.tag==='text'));
    }},
  });
  app._renderSettlements({key,settlements:[],milestones:[]});
  const getStyle=node=>({display:node===layer?'inline':'none',opacity:0.6,visibility:'hidden'});
  return mapSurface.passScreenLabels(app,getStyle,revealed);
}
const gateNames=(...args)=>gatesIn(...args).map(gate=>gate.name);
assert.ok(gateNames(195).includes('函谷关'));
assert.ok(!gateNames(195).includes('潼关'));
assert.ok(gateNames(196).includes('潼关'));
assert.ok(gateNames(199).includes('函谷关'));
assert.ok(!gateNames(200).includes('函谷关'));
assert.ok(gateNames(617).includes('井陉关') && gateNames(618).includes('娘子关'));
assert.ok(gateNames(1371).includes('临渝关') && !gateNames(1371).includes('嘉峪关'));
assert.ok(gateNames(1372).includes('嘉峪关'));
assert.ok(gateNames(1381,'ming','en').includes('Shanhai Pass'));
assert.deepEqual(gatesIn(1950,'prc'),[]);
assert.deepEqual(gatesIn(741,'tang','zh',false),[]);
assert.deepEqual(gatesIn(742).find(gate=>gate.name==='潼关'),
  {kind:'pass',name:'潼关',coord:[110.25,34.54],pickName:'潼关',opacity:0.6});
for(const rect of [{width:1280,height:666},{width:390,height:790},{width:1000,height:650}])for(const c of [{x:0,y:0,w:1000,h:650,zoom:1},{x:200,y:150,w:250,h:162.5,zoom:4}]){
  const app={projector,camera:c},view=bridge.readView(app,rect),round=bridge.cameraForView(app,rect,view.center,view.widthKm);
  for(const key of ['x','y','w','h'])assert.ok(Math.abs(round[key]-c[key])<1e-7,key);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('integration.js'));assert.ok(!/<script[^>]+src=["']https?:/i.test(html));assert.ok(!html.includes('src="js/atlas_track.js'));
for(const file of ['terrain.html','fusion-layers.js','fusion-protocol.js','integration.css'])assert.ok(fs.existsSync(path.join(root,file)),file);
const source=fs.readFileSync(path.join(root,'terrain-app.js'),'utf8');
const clickSource=source.slice(source.indexOf('  function handleClick(e)'),source.indexOf('  let mobileLayout='));
const areaMessages=[];
const clickContext={
  terrain:{visible:true},hitAt:()=>({point:pick.coord}),lonlat:point=>point,elevation:()=>50,
  $:()=>({textContent:''}),measuring:false,embedded:true,fusionActive:true,passGates:null,
  fusionState:{sceneKey:pick.sceneKey,year:pick.year},surfaceSceneKey:pick.sceneKey,
  setTimeout:callback=>{clickContext.pending=callback;return 1;},areaClickTimer:null,
  fusion:{send:(type,data)=>areaMessages.push([type,data.sceneKey,data.year,...data.coord])},
};
vm.runInNewContext(clickSource,clickContext);
clickContext.handleClick({shiftKey:false});
assert.equal(areaMessages.length,0,'single click is deferred for the existing double-click gesture');
clickContext.pending();
assert.deepEqual(areaMessages,[['area-pick',pick.sceneKey,pick.year,...pick.coord]]);
clickContext.handleClick({shiftKey:false});
clickContext.fusionState={...clickContext.fusionState,sceneKey:'742'};
clickContext.pending();
assert.equal(areaMessages.length,1,'do not dispatch pending clicks after changing scene');
const inputEvents={};
const inputSurface={addEventListener:(type,fn)=>{inputEvents[type]=fn;},focus(){},setPointerCapture(){},clientHeight:500};
Object.assign(clickContext,{
  fusionState:{sceneKey:pick.sceneKey,year:pick.year},$:()=>inputSurface,
  renderer:{domElement:inputSurface},clearTimeout:()=>{clickContext.pending=null;},emitFusionView(){},
  constrainDesired(){},sendFusionView(){},
  distance:1,theta:0,phi:0,desired:{x:0,z:0,theta:0,phi:0},camera:{fov:40},dirty:false,performance,
});
const inputStart=source.indexOf('    let drag=null;');
vm.runInNewContext(source.slice(inputStart,source.indexOf("    $('stage').addEventListener('keydown'",inputStart)),clickContext);
const mouse={pointerId:1,button:0,clientX:50,clientY:50,shiftKey:false,target:{closest:()=>null}};
const pointerClick=event=>{inputEvents.pointerdown(event);inputEvents.pointerup(event);};
pointerClick(mouse);
assert.equal(typeof clickContext.pending,'function');
inputEvents.dblclick(mouse);
assert.equal(clickContext.pending,null,'double-click cancels the area pick');
assert.equal(areaMessages.at(-1)[0],'trace');
inputEvents.pointerdown(mouse);
inputEvents.pointermove({...mouse,clientX:80});
inputEvents.pointerup({...mouse,clientX:80});
assert.equal(clickContext.pending,null,'dragging must not select an area');
let markerClicks=0;
const markerEvent={...mouse,target:{closest:()=>({click:()=>markerClicks++})}};
pointerClick(markerEvent);
assert.equal(markerClicks,1);
const messageCount=areaMessages.length;
inputEvents.dblclick(mouse);
assert.equal(areaMessages.length,messageCount,'a marker hit stays a marker hit after pointer capture');
const start=source.indexOf("$('stage').addEventListener('keydown',e=>{");
const end=source.indexOf("$('exaggeration').addEventListener",start);
for(const embedded of [true,false]){
  let handler;const sent=[],shown=[];let emitted=0;
  vm.runInNewContext(source.slice(start,end),{$:()=>({addEventListener:(type,fn)=>{handler=fn;}}),embedded,fusion:{send:type=>sent.push(type)},show:key=>shown.push(key),emitFusionView:()=>emitted++,dirty:false,clearTimeout(){},fusionViewTimer:null});
  for(const key of ['h','H'])handler({key,preventDefault(){}});
  assert.deepEqual(sent,embedded?['reset-view','reset-view']:[]);
  assert.deepEqual(shown,embedded?[]:['national','national']);
  assert.equal(emitted,0,'H must not send a view update while resetting');
}
const wheelUpdates=[],wheelTimers=new Map();let wheelSequence=0;
const wheelContext={
  embedded:true,fusionActive:true,mapFrame:{toGeo:(x,z)=>[x,z]},
  desired:{x:110,z:34,distance:600},camera:{fov:40,aspect:1},
  fusion:{send:(type,value)=>wheelUpdates.push({type,...value})},
  constrainDesired(){},fusionViewTimer:null,
  setTimeout:fn=>{wheelTimers.set(++wheelSequence,fn);return wheelSequence;},
  clearTimeout:id=>wheelTimers.delete(id),
};
vm.runInNewContext(source.slice(source.indexOf('  function sendFusionView(type)'),source.indexOf('  function animate()')),wheelContext);
for(const distance of [600,500,400]){wheelContext.desired.distance=distance;wheelContext.emitFusionView();}
assert.deepEqual(wheelUpdates.map(x=>x.type),['view-preview','view-preview','view-preview']);
assert.equal(wheelTimers.size,1,'only one settled view update remains after a wheel burst');
[...wheelTimers.values()][0]();
assert.equal(wheelUpdates.at(-1).type,'view');
assert.equal(wheelUpdates.at(-1).widthKm,wheelUpdates.at(-2).widthKm);
console.log('PASS: projector/shared-view roundtrips, guarded 3D area picks, rendered point tiers, local assets and embedded H reset.');
