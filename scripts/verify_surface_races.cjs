'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const parentSource = fs.readFileSync(path.join(root, 'integration.js'), 'utf8');
const childSource = fs.readFileSync(path.join(root, 'terrain-app.js'), 'utf8');

// Exercise the owning functions, not a second implementation of their guards.
// Image decode and postMessage delivery are deliberately separate controlled steps.
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'runtime function markers remain available');
  return source.slice(a, b);
}
function parentFixture(useTangTiles = false) {
  const context = { console, useTangTiles };
  vm.runInNewContext(`
    const CHANNEL='jiangshan-fusion',KM_PER_DEGREE=1;
    let active=true,ready=true,applyingChild=false,lastSignature='',lastSceneKey='',sequence=0;
    let surfaceTimer,surfaceRequest=0,surfaceKey='',surfaceBaseKey='',surfaceBasePendingId=-1;
    let surfaceGeneration=0,surfaceRenderJob=null,queuedSurface=null,presented=false;
    let pendingChildCamera=null;
    let lastTileTier=null,tilesFailed=false;
    const surfaceBounds=[40,-10,165,70],out=[],timers=new Map();let timerId=0,listener;
    const setTimeout=fn=>{timers.set(++timerId,fn);return timerId},clearTimeout=id=>timers.delete(id);
    const frame={contentWindow:{}},root={location:{protocol:'http:',origin:'http://127.0.0.1:8772'},
      JiangshanMapSurface:{
        tangScreenLabels:()=>[{kind:'circuit',name:'关内道',coord:[109,34],opacity:1}],
        passScreenLabels:(app,getStyle,reveal)=>reveal?[{kind:'pass',name:app.year===741?'临渝关':'山海关',coord:[119.77,40.01],opacity:1}]:[],
      },
      performance:{now:()=>0},addEventListener:(name,fn)=>{listener=fn}};
    const app={year:1080,camera:{w:400},activePerson:null,activeCustomRoute:null,customRouteStopIdx:-1,
      lastRenderedSnap:{},locale:'zh',svg:{getBoundingClientRect:()=>({width:600,height:400}),classList:{contains:()=>false}},
      projector:{scale:1,toScreen:(x,y)=>[x,-y],toGeo:(x,y)=>[x,-y]}};
    const cameraView={center:[110,30],widthKm:20},readView=()=>cameraView;
    const identifiers=new WeakMap();let nextIdentifier=0;
    const id=value=>{
      if(!value)return '';
      if(!identifiers.has(value))identifiers.set(value,++nextIdentifier);
      return identifiers.get(value);
    };
    let corridors=true;
    const layers=()=>({polities:true,corridors}),post=value=>out.push(value);
    const tangTileTier=app=>useTangTiles&&app.year===741?'mid':null;
    const locations=()=>[],snapshot=()=>({polities:[]}),overlays=()=>({});
    const configure=()=>{},announce=()=>{},presentTerrain=show=>{presented=show};
    const renders=[];
    let pause=false,release;
    const mapSurface={render:async request=>{
      if(request.screenPasses!==true)throw Error('The live texture must remove the original gate artwork');
      renders.push(request.width);
      if(pause){pause=false;await new Promise(resolve=>{release=resolve})}
      return {url:'data:image/png;base64,AA==',bounds:request.bounds};
    }};
    ${section(parentSource, '    function detailBounds(cameraView', '    const checked = name => {')}
    ${section(parentSource, "    function sync(reason = 'controller', force = false) {", "    function schedule(reason = 'controller') {")}
    ${section(parentSource, "    root.addEventListener('message', event => {", "    if (typeof ResizeObserver === 'function')")}
    globalThis.api={
      activate(year,widthKm=20){app.year=year;cameraView.widthKm=widthKm;sync('controller')},
      selectArea(area){app.activeMapArea=area;sync('controller')},
      zoom(width){app.camera.w=width;sync('child-view')},
      toggleCorridors(on){corridors=on;sync('controller')},
      async flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn()},
      take(){return out.splice(0)},
      holdNextRender(){pause=true},releaseRender(){release()},get renders(){return renders},
      receive(message,valid=true){listener({source:valid?frame.contentWindow:{},origin:root.location.origin,data:{channel:CHANNEL,...message}})},
      get cache(){return surfaceBaseKey},get scene(){return lastSceneKey}
    };
  `, context);
  return context.api;
}
function childFixture() {
  const context = {};
  vm.runInNewContext(`
    let atlasSurface,surfaceSceneKey='',surfaceLoads=0,surfaceBaseId=-1,surfaceDetailId=-1,pendingSurfaceDetail=null;
    let fusionState=null,fusionPaintedKey=null,fusionLocations=[],fusionLayers={},fusionOverlays={},currentSnapshot=null,selectedEvent=null,historyYear=0;
    let desired={theta:0,phi:.7,distance:10,x:0,z:0},theta,phi,distance,target,fusionViewKey='',fusionStarted=true,fusionActive=true,dirty=false;
    let fusionViewTimer=null;const clearTimeout=()=>{};
    let tangTilePlanKey='',tangBaseApplied=false,tangAppliedTier='far',areaOverlay=null,areaOverlayId=0,tangLabelData=[],passLabelData=[];
    const images=[],acks=[],applied=[],elements={},$=id=>elements[id]||(elements[id]={dataset:{},querySelector:()=>({})});
    const document={body:{dataset:{}}},dataset={bounds:[40,-10,165,70]},mapFrame={toWorld:(x,z)=>({x,z})},camera={fov:40,aspect:1};
    const terrain={visible:false},renderer={capabilities:{getMaxAnisotropy:()=>1}};
    atlasSurface={clearDetail(){},base(texture){applied.push(['base',texture.image.src])},detail(texture){applied.push(['detail',texture.image.src])}};
    const THREE={Texture:class{constructor(image){this.image=image}}};
    class Image{constructor(){images.push(this)}}
    const paintHistory=()=>{},rebuildMarkers=()=>{},constrainDesired=()=>{},requestAnimationFrame=()=>{};
    const fusion={applied(){},send:(type,message)=>acks.push({type,...message})};
    ${section(childSource, '  function applyOriginalSurface(surface){', '  function rebuildFusionPlaces(){')}
    globalThis.api={
      state(state){fusionState=state;applyFusionState(state)},get lastState(){return fusionState},
      surface:applyOriginalSurface,
      decode(index){images[index].onload()},
      get count(){return images.length},
      get acks(){return acks.splice(0)},get applied(){return applied},
      get status(){return {visible:terrain.visible,scene:surfaceSceneKey,pending:pendingSurfaceDetail?.sceneKey,loading:!$('load-state').hidden}}
    };
  `, context);
  return context.api;
}
async function request(parent, child, year) {
  parent.activate(year);
  const states = parent.take();
  for (const state of states) if (state.type === 'state') child.state(state);
  await parent.flush();
  return parent.take().filter(value => value.type === 'surface');
}
function base(packets) { return packets.find(packet => packet.quality === 'base'); }

(async function () {
  // Merely exporting/posting a base must not be treated as successful GPU application.
  const p = parentFixture(), c = childFixture();
  const first = await request(p, c, 1081);
  c.surface(base(first));
  assert.equal(p.cache, '', 'base remains unacknowledged while Image decode is pending');
  await request(p, c, 1082);
  const returned = await request(p, c, 1081);
  assert.ok(base(returned), 'returning to an unacknowledged scene must resend its base');
  const stale = 0;
  c.decode(stale);
  assert.equal(c.acks.length, 0, 'decode from an invalidated scene generation is ignored');
  c.surface(returned.find(packet => packet.quality === 'detail'));
  c.surface(base(returned));c.decode(1);
  for (const ack of c.acks) p.receive(ack);
  assert.equal(p.cache, p.scene);
  assert.equal(c.status.visible, true);
  assert.equal(c.count, 3, 'a pending detail begins decoding only after the base is applied');
  c.decode(2);
  assert.equal(c.status.scene, p.scene);

  // ACK delivery itself is asynchronous: C may already replace B in the child
  // while the parent still has B's earlier acknowledgement in its cache.
  const p2 = parentFixture(), c2 = childFixture();
  const b = await request(p2, c2, 1081);
  c2.surface(base(b));c2.decode(0);
  for (const ack of c2.acks) p2.receive(ack);
  const next = await request(p2, c2, 1082);
  assert.equal(c2.status.visible, true, 'retain the previous surface during a scene update');
  assert.equal(c2.status.loading, true, 'show loading when changing to a different historical year');
  c2.surface(base(next));c2.decode(1);
  const delayedAck = c2.acks;
  const back = await request(p2, c2, 1081);
  for (const ack of delayedAck) p2.receive(ack);
  assert.notEqual(p2.cache, next[0].sceneKey, 'an ACK for a departed scene is ignored');
  assert.ok(base(back), 'a scene transition must resend B even while the C ACK is delayed');
  p2.receive({type:'surface-applied',quality:'base',sceneKey:p2.scene,renderId:base(b).renderId});
  assert.equal(p2.cache, '', 'an old B ACK must not acknowledge the fresh B generation');
  c2.surface(base(back));c2.decode(2);
  for (const ack of c2.acks) p2.receive(ack);
  assert.equal(p2.cache, p2.scene, 'only the newly applied B generation is acknowledged');
  assert.equal(c2.status.scene, p2.scene);
  assert.equal(c2.status.visible, true);

  // Late old detail decodes must not overwrite a newer texture of the same scene.
  const detail = {sceneKey:p2.scene,quality:'detail',bounds:[90,10,130,50]};
  c2.surface({...detail,renderId:100,url:'old'});
  c2.surface({...detail,renderId:102,url:'new'});
  c2.decode(4);c2.decode(3);
  assert.equal(c2.applied.at(-1)[1], 'new');
  const remembered = p2.cache;
  p2.receive({type:'surface-applied',quality:'base',sceneKey:'forged'},false);
  assert.equal(p2.cache, remembered, 'another window cannot acknowledge a surface');
  p2.receive({type:'ready'});
  assert.equal(p2.cache, '', 'reloaded child must receive a base even for the unchanged scene');
  p2.take();await p2.flush();
  assert.ok(base(p2.take()), 'ready forces a fresh base export');
  c2.state({ ...c2.lastState, sceneKey: '1081-counties', reason: 'child-view' });
  assert.equal(c2.status.loading, false, 'zoom refresh uses the visible cached map for the same year');

  // Image loads or view changes may request another capture during the first base export.
  const p3 = parentFixture();
  p3.holdNextRender();
  p3.activate(741);
  const firstCapture = p3.flush();
  p3.activate(741, 15);
  await p3.flush();
  assert.deepEqual(Array.from(p3.renders), [1024], 'one in-flight export despite an overlapping request');
  p3.releaseRender();
  await firstCapture;
  assert.deepEqual(Array.from(p3.renders), [1024, 3072], 'publish the base once, then render latest detail');
  assert.deepEqual(Array.from(p3.take().filter(packet => packet.type === 'surface'), packet => packet.quality), ['base', 'detail']);
  const tang=parentFixture(true);
  tang.activate(741);
  await tang.flush();
  const defaultState=tang.take().find(packet=>packet.type==='state');
  assert.equal(defaultState.tileTier,'mid');
  assert.equal(defaultState.tangLabels[0].name,'关内道');
  assert.equal(defaultState.passLabels[0].name,'临渝关');
  const highlight={segments:[[[109.1,33.7],[109.7,34]]]};
  tang.selectArea({highlight});
  await tang.flush();
  const selectedState=tang.take().find(packet=>packet.type==='state');
  assert.equal(selectedState.sceneKey,defaultState.sceneKey,'selecting a boundary preserves the tile scene');
  assert.equal(selectedState.tangLabels.length,0,'a highlight-only update reuses the existing labels');
  assert.deepEqual(selectedState.areaHighlight,highlight);
  tang.selectArea(null);
  assert.equal(tang.take().find(packet=>packet.type==='state').areaHighlight,undefined);
  assert.equal(tang.renders.length,0,'opening and closing a tile selection triggers no SVG capture');
  tang.activate(1381);
  await tang.flush();
  const otherYear=tang.take();
  assert.ok(base(otherYear),'other years still export live artwork');
  const historicState=otherYear.find(packet=>packet.type==='state');
  assert.equal(historicState.tangLabels.length,0);
  assert.equal(historicState.passLabels[0].name,'山海关');
  tang.zoom(501);
  const far=tang.take().find(packet=>packet.type==='state');
  assert.notEqual(far.sceneKey,historicState.sceneKey,'crossing the gate zoom threshold invalidates the child models');
  assert.equal(far.passLabels.length,0);
  tang.zoom(500);
  assert.equal(tang.take().find(packet=>packet.type==='state').passLabels[0].name,'山海关');
  tang.toggleCorridors(false);
  assert.equal(tang.take().find(packet=>packet.type==='state').passLabels.length,0);
  console.log('PASS: overlapping exports, pending base decode, scene reentry, delayed ACKs, base/detail ordering, stale detail decode, child reload and source identity guards.');
})().catch(error => { console.error(error); process.exitCode = 1; });
