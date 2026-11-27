'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const parentSource = fs.readFileSync(path.join(root, 'integration.js'), 'utf8');
const childSource = fs.readFileSync(path.join(root, 'terrain-app.js'), 'utf8');
const {isCurrentMapPick}=require('../integration.js');

// Exercise the owning functions, not a second implementation of their guards.
// Image decode and postMessage delivery are deliberately separate controlled steps.
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'runtime function markers remain available');
  return source.slice(a, b);
}
function parentFixture(useTangTiles = false, tilesPackaged = true) {
  const context = { console, useTangTiles, tilesPackaged, isCurrentMapPick };
  vm.runInNewContext(`
    const CHANNEL='jiangshan-fusion',KM_PER_DEGREE=1,parentBattle=false;
    let active=true,ready=true,surfaceBitmaps=false,baseDrawAck=false,detailTextureLimit=3072,applyingChild=false,lastSignature='',lastSceneKey='',sequence=0;
    let startupTimer,surfaceTimer,surfaceRequest=0,surfaceKey='',surfaceBaseKey='',surfaceBasePendingId=-1;
    let surfaceGeneration=0,surfaceRenderJob=null,queuedSurface=null,presented=false,detailAcknowledged=false;
    let pendingChildCamera=null;
    let lastTileTier=null,tilesFailed=false;
    const surfaceBounds=[40,-10,165,70],out=[],timers=new Map();let timerId=0,listener;
    const setTimeout=fn=>{timers.set(++timerId,fn);return timerId},clearTimeout=id=>timers.delete(id);
    let failTransfer=false;const bitmaps=[];
    const frame={src:'terrain.html',dataset:{},removeAttribute(k){delete this[k]},contentWindow:{postMessage(packet,origin,transfer) {
      if(packet.bitmap && transfer[0]!==packet.bitmap)throw Error('bitmap was copied');
      if(packet.bitmap && failTransfer){failTransfer=false;const error=Error('transfer unavailable');error.name='DataCloneError';throw error;}
      out.push(packet);
    }}},root={createImageBitmap(){},location:{protocol:'http:',origin:'http://127.0.0.1:8772'},
      JiangshanMapSurface:{
        adminScreenLabels:app=>[{kind:'circuit',name:app.year===741?'关内道':'河南路',coord:[109,34],opacity:1}],
        passScreenLabels:(app,getStyle,reveal)=>reveal?[{kind:'pass',name:app.year===741?'临渝关':'山海关',coord:[119.77,40.01],opacity:1}]:[],
      },
      performance:{now:()=>0},addEventListener:(name,fn)=>{listener=fn}};
    let counties=false;const picks=[];
    const app={year:1080,camera:{w:400},activePerson:null,activeCustomRoute:null,customRouteStopIdx:-1,
      openMapSettlementAt(...args){picks.push(args);},
      lastRenderedSnap:{},locale:'zh',svg:{getBoundingClientRect:()=>({width:600,height:400}),classList:{contains:name=>counties&&name==='is-admin-counties'}},
      projector:{scale:1,toScreen:(x,y)=>[x,-y],toGeo:(x,y)=>[x,-y]}};
    const cameraView={center:[110,30],widthKm:20},readView=()=>cameraView;
    const identifiers=new WeakMap();let nextIdentifier=0;
    const id=value=>{
      if(!value)return '';
      if(!identifiers.has(value))identifiers.set(value,++nextIdentifier);
      return identifiers.get(value);
    };
    let corridors=true;
    const layers=()=>({polities:true,corridors});
    const tangTileTier=app=>useTangTiles&&app.year===741?'mid':null;
    const locations=()=>[];
    const configure=()=>{},announce=()=>{},presentTerrain=show=>{presented=show};
    const startupStages=[];const armTerrainStartup=stage=>startupStages.push(stage);
    const renders=[];
    let pause=false,release;
    const mapSurface={render:async request=>{
      if(request.screenPasses!==true)throw Error('The live texture must remove the original gate artwork');
      if(request.screenAdmin!==true)throw Error('The live texture must remove screen administrative captions');
      renders.push(request.width);
      if(pause){pause=false;await new Promise(resolve=>{release=resolve})}
      if(request.bitmap){
        const bitmap={closed:false,close(){this.closed=true;}};
        bitmaps.push(bitmap);return {bitmap,bounds:request.bounds};
      }
      return {url:'data:image/png;base64,AA==',bounds:request.bounds};
    }};
    const setMode=value=>{active=value};
    ${section(parentSource, '    function failTerrain(message)', '    const checked = name => {')}
    ${section(parentSource, "    function sync(reason = 'controller', force = false) {", "    function schedule(reason = 'controller') {")}
    ${section(parentSource, "    root.addEventListener('message', event => {", "    if (typeof ResizeObserver === 'function')")}
    globalThis.api={
      activate(year,widthKm=20){active=true;app.year=year;cameraView.widthKm=widthKm;sync('controller')},
      suspend(){active=false;suspendSurface();sync('activate',true)},
      changeFlatYear(year){app.year=year;sync('controller')},
      selectArea(area){app.activeMapArea=area;sync('controller')},
      zoom(width){app.camera.w=width;sync('child-view')},
      showCounties(){counties=true;sync('child-view')},
      get picks(){return picks},get bitmaps(){return bitmaps},failNextTransfer(){failTransfer=true;},
      toggleCorridors(on){corridors=on;sync('controller')},
      async flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn()},
      take(){return out.splice(0)},
      holdNextRender(){pause=true},releaseRender(){release()},get renders(){return renders},
      receive(message,valid=true){listener({source:valid?frame.contentWindow:{},origin:root.location.origin,data:{channel:CHANNEL,...message}})},
      get ready(){return ready},get frameSrc(){return frame.src},get cache(){return surfaceBaseKey},get scene(){return lastSceneKey},get startupStages(){return startupStages}
    };
  `, context);
  return context.api;
}
// Exercise the actual watchdog with simulated job completions. A missing paint ACK
// must recover even if the base was decoded and the iframe is already visible.
function checkStartupDeadline() {
  const context={};
  vm.runInNewContext(`
    const failures=[],timers=new Map();let n=0,startupTimer,presented=false,active=true,ready=false,now=0,completed=0;
    const root={performance:{now:()=>now}};
    const frame={contentDocument:{readyState:'loading',scripts:[]},contentWindow:{
      performance:{getEntriesByType:()=>Array(completed).fill({initiatorType:'script'})}
    }};
    let lastSceneKey='A',surfaceBasePendingId=12;
    const setTimeout=(fn,ms)=>{timers.set(++n,{fn,ms});return n},clearTimeout=id=>timers.delete(id);
    const announce=()=>{},failTerrain=message=>failures.push(message);
    ${section(parentSource,'    function terrainLoadProgress()', '    function presentTerrain(show)')}
    function expire(){const timer=timers.get(startupTimer);timers.delete(startupTimer);now+=timer.ms;timer.fn();}
    armTerrainStartup('terrain');const terrainMS=timers.get(startupTimer).ms;
    completed++;expire();if(failures.length)throw Error('slow download should keep the flat map usable');
    completed++;expire();if(failures.length)throw Error('genuine loading progress must extend startup');
    expire();if(failures.length!==1)throw Error('a stalled download must fall back');
    failures.length=0;
    armTerrainStartup('terrain');
    for(let i=0;i<4;i++){completed++;expire();}
    if(failures.length!==1)throw Error('ongoing progress must still respect the hard deadline');
    failures.length=0;
    armTerrainStartup('terrain');ready=true;expire();
    if(failures.length||timers.size)throw Error('a ready renderer must stop the download watchdog');
    ready=false;armTerrainStartup('terrain');active=false;expire();
    if(failures.length||timers.size)throw Error('switching to flat must cancel download monitoring');
    active=true;armTerrainStartup('terrain');expire();
    if(failures.length||timers.size!==1)throw Error('a new activation must receive its own startup window');
    armTerrainStartup('map');const mapMS=timers.get(startupTimer).ms;
    armTerrainStartup('apply');presented=true;
    const priorDeadline=timers.get(startupTimer).fn;
    lastSceneKey='B';surfaceBasePendingId=18;priorDeadline();
    armTerrainStartup('apply');const remaining=timers.size;
    timers.get(startupTimer).fn();
    globalThis.result={terrainMS,mapMS,remaining,failures};
  `,context);
  assert.equal(context.result.terrainMS,60000);
  assert.equal(context.result.mapMS,45000);
  assert.equal(context.result.remaining,1,'only the current stage has an active deadline');
  assert.equal(context.result.failures.length,1,'a stale expiry is ignored and a missing draw ACK returns to flat');
}
function childFixture() {
  const context = {};
  vm.runInNewContext(`
    const changsheAtlas=false;
    let atlasSurface,surfaceSceneKey='',surfaceLoads=0,surfaceBaseId=-1,surfaceDetailId=-1,pendingSurfaceDetail=null,pendingBaseDraw=null;
    let fusionState=null,fusionPaintedKey=null,fusionLocations=[],fusionLayers={},fusionOverlays={},currentSnapshot=null,selectedEvent=null,historyYear=0;
    let desired={theta:0,phi:.7,distance:10,x:0,z:0},theta,phi,distance,target,fusionViewKey='',fusionStarted=true,fusionActive=true,dirty=false;
    let fusionViewTimer=null;const clearTimeout=()=>{};
    let tangTilePlanKey='',tangBaseApplied=false,tangAppliedTier='far',areaOverlay=null,areaOverlayId=0,adminLabelData=[],passLabelData=[];
    const images=[],acks=[],applied=[],elements={},$=id=>elements[id]||(elements[id]={dataset:{},querySelector:()=>({})});
    const document={body:{dataset:{}}},dataset={bounds:[40,-10,165,70]},mapFrame={toWorld:(x,z)=>({x,z})},camera={fov:40,aspect:1};
    const terrain={visible:false},renderer={capabilities:{getMaxAnisotropy:()=>1}};
    let heldBase;
    atlasSurface={clearDetail(){},base(texture){heldBase?.dispose?.();heldBase=texture;applied.push(['base',texture.image.src])},detail(texture){applied.push(['detail',texture.image.src])}};
    const THREE={Texture:class{constructor(image){this.image=image}addEventListener(type,fn){if(type==='dispose')this.dispose=fn}}};
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
  checkStartupDeadline();
  // Merely exporting/posting a base must not be treated as successful GPU application.
  const waiting = parentFixture();
  waiting.receive({type:'ready'});
  assert.deepEqual(Array.from(waiting.startupStages), ['map'], 'a ready terrain receives a separate map deadline');
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
  const bitmaps=childFixture();
  bitmaps.state(c2.lastState);
  const fakeBitmap=()=>({closed:false,close(){this.closed=true;}});
  const earlyDetail=fakeBitmap(),dropped=fakeBitmap(),oldBase=fakeBitmap(),replacement=fakeBitmap();
  const bitmapPacket=(quality,renderId,bitmap)=>({...detail,quality,renderId,bitmap});
  bitmaps.surface(bitmapPacket('detail',8,earlyDetail));
  bitmaps.surface(bitmapPacket('detail',7,dropped));
  assert.ok(dropped.closed,'an older out-of-order detail is discarded');
  bitmaps.state({...c2.lastState,sceneKey:'new'});
  assert.ok(earlyDetail.closed,'a buffered bitmap for a departed scene is released');
  bitmaps.surface(bitmapPacket('base',9,oldBase));
  assert.ok(oldBase.closed,'a transferred bitmap delivered to the wrong scene is released');
  bitmaps.surface({...bitmapPacket('base',10,replacement),sceneKey:'new'});
  assert.equal(bitmaps.count,0,'bitmap transport does not create a PNG decoder');
  assert.equal(replacement.closed,false,'an active texture retains its image for context restoration');
  bitmaps.surface({...bitmapPacket('base',11,fakeBitmap()),sceneKey:'new'});
  assert.ok(replacement.closed,'a replaced GPU texture also releases its bitmap');
  const remembered = p2.cache;
  p2.receive({type:'surface-applied',quality:'base',sceneKey:'forged'},false);
  assert.equal(p2.cache, remembered, 'another window cannot acknowledge a surface');
  p2.receive({type:'ready'});
  assert.equal(p2.startupStages.length, 0, 'an already presented view has no startup deadline');
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
  const toggle=parentFixture();
  toggle.activate(960);await toggle.flush();
  const unacknowledged=toggle.take();
  toggle.suspend();toggle.activate(960);await toggle.flush();
  const retry=toggle.take();
  assert.ok(base(retry),'resume must re-export a base the inactive child might have dropped');
  for(const packet of retry.filter(p=>p.type==='surface'))toggle.receive({...packet,type:'surface-applied'});
  const draws=toggle.renders.length;
  toggle.suspend();toggle.activate(960);await toggle.flush();
  assert.equal(toggle.renders.length,draws,'reopening the same acknowledged live view skips redundant texture uploads');
  toggle.activate(960,30);await toggle.flush();
  assert.equal(toggle.renders.length,draws+1,'resizing the view requests fresh detail');
  toggle.receive({...unacknowledged.find(p=>p.quality==='detail'),type:'surface-applied'});
  toggle.suspend();toggle.activate(960,30);await toggle.flush();
  assert.equal(toggle.renders.length,draws+2,'old detail ACK cannot suppress a new camera refresh');
  for(const packet of toggle.take().filter(p=>p.type==='surface'))toggle.receive({...packet,type:'surface-applied'});
  toggle.suspend();toggle.changeFlatYear(961);toggle.changeFlatYear(960);toggle.activate(960,30);
  await toggle.flush();
  assert.ok(base(toggle.take()),'returning to the original year after a flat-mode scene change must not hang waiting for a base');
  const limited=parentFixture();
  limited.receive({type:'ready',maxTextureSize:1024});
  await limited.flush();
  assert.deepEqual(Array.from(limited.renders),[1024,1024],'do not rasterize more pixels than the renderer can upload');
  limited.suspend();
  limited.receive({type:'terrain-error'});
  assert.equal(limited.ready,false,'context loss invalidates a hidden renderer');
  assert.equal(limited.frameSrc,undefined,'next activation must recreate the frame');
  const progress=parentFixture();
  progress.receive({type:'ready',baseDrawAck:true});
  progress.activate(741);
  assert.deepEqual(Array.from(progress.startupStages),['map','map'],'a changed first-load target gets its own preparation stage');
  await progress.flush();
  const queuedBase=base(progress.take());
  assert.deepEqual(Array.from(progress.renders),[1024],'first frame is not competing with an in-flight detail export');
  progress.receive({...queuedBase,type:'surface-applied'});
  progress.receive({type:'surface-drawn',sceneKey:queuedBase.sceneKey,renderId:queuedBase.renderId+10});
  await progress.flush();
  assert.equal(progress.renders.length,1,'an old draw ACK cannot release a detail capture');
  progress.receive({type:'surface-drawn',sceneKey:queuedBase.sceneKey,renderId:queuedBase.renderId});
  await progress.flush();
  assert.deepEqual(Array.from(progress.renders),[1024,3072]);
  assert.deepEqual(Array.from(progress.startupStages),['map','map','apply','apply']);
  const transfer=parentFixture();
  transfer.failNextTransfer();
  transfer.receive({type:'ready',surfaceBitmaps:true});
  await transfer.flush();
  assert.equal(transfer.bitmaps[0].closed,true,'a refused transfer releases the sender bitmap');
  await transfer.flush();
  const fallbackPackets=transfer.take().filter(packet=>packet.type==='surface');
  assert.deepEqual(Array.from(fallbackPackets,packet=>packet.quality),['base','detail']);
  assert.ok(fallbackPackets.every(packet=>packet.url&&!packet.bitmap),'an unsupported transfer retries as PNG');
  const cancelled=parentFixture();
  cancelled.holdNextRender();
  cancelled.receive({type:'ready',surfaceBitmaps:true});
  const oldFrame=cancelled.flush();
  cancelled.activate(960);
  cancelled.releaseRender();
  await oldFrame;
  assert.ok(cancelled.bitmaps[0].closed,'a stale export releases the unsent bitmap');
  const published=parentFixture(true,false);
  published.activate(741);
  await published.flush();
  const publishedPackets=published.take();
  assert.equal(publishedPackets.find(packet=>packet.type==='state').tileTier,null);
  assert.ok(base(publishedPackets),'a deployment without tiled assets immediately exports the live surface');
  const tang=parentFixture(true);
  tang.activate(741);
  await tang.flush();
  const defaultState=tang.take().find(packet=>packet.type==='state');
  assert.equal(defaultState.tileTier,'mid');
  assert.equal(defaultState.adminLabels[0].name,'关内道');
  assert.equal(defaultState.passLabels[0].name,'临渝关');
  const highlight={segments:[[[109.1,33.7],[109.7,34]]]};
  tang.selectArea({highlight});
  await tang.flush();
  const selectedState=tang.take().find(packet=>packet.type==='state');
  assert.equal(selectedState.sceneKey,defaultState.sceneKey,'selecting a boundary preserves the tile scene');
  assert.equal(selectedState.adminLabels.length,0,'a highlight-only update reuses the existing labels');
  assert.deepEqual(selectedState.areaHighlight,highlight);
  tang.selectArea(null);
  assert.equal(tang.take().find(packet=>packet.type==='state').areaHighlight,undefined);
  assert.equal(tang.renders.length,0,'opening and closing a tile selection triggers no SVG capture');
  tang.receive({type:'tiles-error',sceneKey:defaultState.sceneKey});
  await tang.flush();
  const fallback=tang.take().find(packet=>packet.type==='state');
  assert.equal(fallback.tileTier,null);
  assert.ok(!('snapshot' in fallback) && !('overlays' in fallback), 'the live SVG is the sole full-scene artwork');
  const rendersBeforeBoundary=tang.renders.length;
  tang.selectArea({highlight});
  const boundary=tang.take().find(packet=>packet.type==='state');
  assert.equal(boundary.sceneKey,fallback.sceneKey,'a live 741 boundary preserves the scene');
  assert.deepEqual(boundary.areaHighlight,highlight);
  assert.equal(boundary.adminLabels.length,0);
  tang.selectArea(null);
  assert.equal(tang.take().find(packet=>packet.type==='state').areaHighlightId,0);
  await tang.flush();
  assert.equal(tang.renders.length,rendersBeforeBoundary,'live boundary selection and dismissal reuse both textures');
  tang.activate(1381);
  await tang.flush();
  const otherYear=tang.take();
  assert.ok(base(otherYear),'other years still export live artwork');
  const historicState=otherYear.find(packet=>packet.type==='state');
  assert.equal(historicState.adminLabels[0].name,'河南路');
  assert.equal(historicState.passLabels[0].name,'山海关');
  const rendersBeforeFocus=tang.renders.length;
  const focus={point:[113.28,33.5]};
  tang.selectArea({highlight:focus});
  const focused=tang.take().find(packet=>packet.type==='state');
  assert.equal(focused.sceneKey,historicState.sceneKey);
  assert.deepEqual(focused.areaHighlight,focus);
  assert.ok(focused.areaHighlightId>0);
  assert.equal(focused.adminLabels.length,0);
  tang.selectArea(null);
  const closed=tang.take().find(packet=>packet.type==='state');
  assert.equal(closed.areaHighlightId,0);
  assert.equal(closed.sceneKey,historicState.sceneKey);
  await tang.flush();
  assert.equal(tang.renders.length,rendersBeforeFocus,'point selection and dismissal reuse the existing live texture');
  tang.receive({type:'place-pick',sceneKey:historicState.sceneKey,year:1381,coord:[114.3,34.8],label:'开封府',areaKey:'prefecture/kaifeng'});
  assert.deepEqual(Array.from(tang.picks[0]),[114.3,34.8,'开封府','prefecture/kaifeng']);
  tang.receive({type:'place-pick',sceneKey:historicState.sceneKey,year:741,coord:[114.3,34.8],label:'开封府'});
  assert.equal(tang.picks.length,1,'stale-year clicks remain rejected');
  tang.showCounties();
  const detailed=tang.take().find(packet=>packet.type==='state');
  assert.notEqual(detailed.sceneKey,historicState.sceneKey,'a county-level zoom transition invalidates non-741 screen state');
  tang.zoom(501);
  const far=tang.take().find(packet=>packet.type==='state');
  assert.notEqual(far.sceneKey,detailed.sceneKey,'crossing the gate zoom threshold invalidates the child models');
  assert.equal(far.passLabels.length,0);
  tang.zoom(500);
  assert.equal(tang.take().find(packet=>packet.type==='state').passLabels[0].name,'山海关');
  tang.toggleCorridors(false);
  assert.equal(tang.take().find(packet=>packet.type==='state').passLabels.length,0);
  console.log('PASS: overlapping exports, pending base decode, scene reentry, delayed ACKs, base/detail ordering, stale detail decode, child reload and source identity guards.');
})().catch(error => { console.error(error); process.exitCode = 1; });
