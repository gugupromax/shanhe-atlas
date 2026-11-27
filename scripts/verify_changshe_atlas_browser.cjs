'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadPlaywright} = require('./load_playwright.cjs');
const {clickControl,terrainTestUrl} = require('./tests/terrain_browser_controls.cjs');

const selector = mode => `#views [data-atlas-view="${mode}"]`;
const legacyTerrain = /\/changshe-terrain(?:-data)?\.js$/;

async function openBattle(browser, base, viewport) {
  const page = await browser.newPage({viewport,reducedMotion:'reduce'});
  const errors = [], oldRequests = [], adminRequests = [], firstMaps = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    const pathname=new URL(r.url()).pathname;
    if(legacyTerrain.test(pathname))oldRequests.push(r.url());
    if(pathname.endsWith('/period-admin.js'))adminRequests.push(r.url());
  });
  page.on('response',r=>{
    if(new URL(r.url()).pathname.endsWith('/assets/changshe-1128-base.webp'))firstMaps.push(r.status());
  });
  await page.addInitScript(()=>{
    if (!location.pathname.endsWith('/terrain.html')) return;
    // Three.js notifies its developer tools when the production scene is created.
    // Observe it without creating another renderer or changing the draw call.
    window.addEventListener('message',event=>{
      const m=event.data;
      if(m?.type==='surface' && m.quality==='detail') window.testDetailBounds=m.bounds;
      if(m?.type==='state')window.testView={seq:m.seq,reason:m.reason,center:m.center,widthKm:m.widthKm,locations:m.locations?.length};
      if(event.source===parent && m?.channel==='jiangshan-fusion' && m.type==='battle-cast')
        (window.testCastStages??=[]).push(m.stage);
    });
    const events = window.__THREE_DEVTOOLS__ = new EventTarget();
    events.addEventListener('observe', e => {
      if(!e.detail.isScene)return;
      const scene=window.testTerrainScene=e.detail;
      const onAfterRender=scene.onAfterRender;
      scene.onAfterRender=function(renderer,world,camera,...rest){
        window.testTerrainCamera=camera;
        onAfterRender.call(this,renderer,world,camera,...rest);
      };
    });
  });
  await page.goto(new URL('battles/changshe.html',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('#intro-close').waitFor();
  assert.equal(await page.locator('#terrain-canvas,svg#map').count(),0);
  return {page,errors,oldRequests,adminRequests,firstMaps};
}

async function capture(page,name) {
  const dir = process.env.CHANGSHE_SCREENSHOTS;
  if (!dir) return;
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,name+'.png'),timeout:45000});
}

async function openTerrain(page) {
  const atlas = page.frameLocator('#national-atlas');
  const surface = atlas.frameLocator('#fusion-terrain');
  await surface.locator('body[data-surface-year="1128"][data-surface-quality="detail"]')
    .waitFor({state:'attached',timeout:270000});
  const geographic = await (await page.locator('#national-atlas').elementHandle()).contentFrame();
  const terrain = await (await geographic.locator('#fusion-terrain').elementHandle()).contentFrame();
  const canvas = terrain.locator('#canvas-host canvas');
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(c=>{
    const gl=c.getContext('webgl2') || c.getContext('webgl');
    return gl && !gl.isContextLost() && gl.drawingBufferWidth>0 && gl.getParameter(gl.CURRENT_PROGRAM)!==null;
  }));
  return {geographic,terrain,canvas};
}

async function waitForCity(terrain,city,visible) {
  await terrain.waitForFunction(({city,visible}) => {
    const root=window.testTerrainScene?.getObjectByName('ChangsheCity:'+city);
    if (!root) return !visible && Boolean(window.testTerrainScene);
    let walls=false,figures=false;
    window.testTerrainScene.traverseVisible(node=>{
      if (node===root) node.traverseVisible(part=>{
        if (!part.isMesh || !part.geometry?.attributes.position?.count) return;
        if (part.name==='city-walls') walls=true;
        if (part.name==='garrison-figures') figures=true;
      });
    });
    return visible ? walls && figures : !walls && !figures;
  },{city,visible},{timeout:45000}).catch(async error=>{
    const status=await terrain.evaluate(city=>({
      activeView:window.testView,detail:window.testDetailBounds,year:document.body.dataset.surfaceYear,
      selected:top.document.querySelector('#views [aria-pressed=true]')?.textContent,camera:parent.atlasApp?.camera,
      foundScene:Boolean(window.testTerrainScene),
      cityVisible:window.testTerrainScene?.getObjectByName('ChangsheCity:'+city)?.visible,
      labels:Array.from(document.querySelectorAll('.fusion-place.battle')).filter(el=>getComputedStyle(el).visibility==='visible').map(el=>el.textContent),
    }),city);
    throw new Error(city+' city visibility check timed out: '+JSON.stringify(status),{cause:error});
  });
}

async function checkCast(terrain,expected) {
  for(const [id,name,visible] of expected){
    const caption=terrain.locator('.battle-cast-caption[data-cast="'+id+'"]');
    if(visible)await caption.filter({hasText:name}).waitFor({state:'visible',timeout:30000});
    else await caption.waitFor({state:'hidden',timeout:30000});
    const result=await terrain.evaluate(id=>{
      const group=window.testTerrainScene.getObjectByName('ChangsheCast:'+id);
      if(!group)return {visible:false};
      for(let node=group;node;node=node.parent)if(!node.visible)return {visible:false};
      const heads=group.getObjectByName('cast-heads');
      if(!heads?.isInstancedMesh || heads.count===0)return {visible:false};
      const stage=document.querySelector('#canvas-host canvas').getBoundingClientRect();
      const labels=Array.from(document.querySelectorAll('#labels button,.battle-cast-caption'))
        .filter(el=>getComputedStyle(el).visibility==='visible' && el.getClientRects().length)
        .map(el=>el.getBoundingClientRect());
      const transform=new THREE.Matrix4(),p=new THREE.Vector3();
      let clear=0;
      for(let i=0;i<heads.count;i++){
        heads.getMatrixAt(i,transform);
        p.setFromMatrixPosition(transform).applyMatrix4(heads.matrixWorld).project(window.testTerrainCamera);
        if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)continue;
        const x=stage.x+(p.x+1)*stage.width/2,y=stage.y+(1-p.y)*stage.height/2;
        if(!labels.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))clear++;
      }
      return {visible:true,clear,total:heads.count};
    },id);
    assert.equal(result.visible,visible,id+' geometry visibility');
    if(visible)assert.ok(result.clear>=result.total/2,id+' heads visible and clear of labels: '+JSON.stringify(result));
  }
  if(expected.every(([, ,visible])=>visible)){
    const [a,b]=await Promise.all(expected.map(([id])=>terrain.locator('[data-cast="'+id+'"]').evaluate(el=>el.getBoundingClientRect().toJSON())));
    assert.ok(a&&b&&(a.bottom<=b.top||b.bottom<=a.top||a.right<=b.left||b.right<=a.left),'Both factions need readable, separate labels');
  }
}

const changsheCast=besieged=>[['song-changshe',besieged?'韩世忠':'长社解围',true],['jin-changshe','挞懒',besieged]];
const westCast=[['li','李彦仙',true],['jin-west','西路军',true]];
async function setCastStage(page,terrain,stage) {
  await page.evaluate(stage=>document.getElementById('national-atlas').contentWindow
    .postMessage({type:'atlas-changshe-cast',stage},location.origin),stage);
  await terrain.waitForFunction(stage=>window.testCastStages.at(-1)===stage,stage);
}

async function checkScale(geographic,near) {
  const {label,km}=await geographic.evaluate(()=>{
    const app=window.atlasApp,c=app.camera,r=app.svg.getBoundingClientRect();
    const span=document.getElementById('scale-ruler-bar').getBoundingClientRect().width;
    const units=span/Math.min(r.width/c.w,r.height/c.h);
    const [lon,lat]=app.projector.toGeo(c.x+c.w/2,c.y+c.h/2);
    const [end]=app.projector.toGeo(c.x+c.w/2+units,c.y+c.h/2);
    const halfArc=Math.cos(lat*Math.PI/180)*Math.sin((end-lon)*Math.PI/360);
    return {label:parseFloat(document.getElementById('scale-label-text').textContent),
      km:12742*Math.asin(Math.abs(halfArc))};
  });
  assert.ok(Math.abs(label-km)<Math.max(.05,km*.06),'Scale label '+label+' km for '+km.toFixed(1)+' km on map');
  assert.ok(near ? label<20 : label>=50,'Expected '+(near?'local':'national')+' scale; got '+label+' km');
}
async function waitDetail(terrain,lon) {
  await terrain.waitForFunction(lon=>{
    const b=window.testDetailBounds;
    return b && (lon===null ? b[2]-b[0]>10 : Math.abs((b[0]+b[2])/2-lon)<.5 && b[2]-b[0]<4);
  },lon,{timeout:120000});
}

async function checkCloserDetail(page,terrain,canvas) {
  const span=await terrain.evaluate(()=>window.testDetailBounds[2]-window.testDetailBounds[0]);
  const r=await canvas.boundingBox();
  await page.mouse.move(r.x+r.width*.5,r.y+r.height*.58);
  for(let step=0;step<3;step++)await page.mouse.wheel(0,-200);
  await terrain.waitForFunction(oldWidth=>{
    const b=window.testDetailBounds;
    return b && Math.abs((b[0]+b[2])/2-113.82)<.5 && (b[2]-b[0])<oldWidth*.75;
  },span,{timeout:90000});
  await page.locator(selector('changshe')).click();
  await terrain.waitForFunction(width=>window.testDetailBounds[2]-window.testDetailBounds[0]>=width*.95,span);
}

async function clickTown(page,terrain,name,card) {
  const town = terrain.locator('button.fusion-place.battle').filter({hasText:name});
  await town.click();
  await page.locator('#situation-front-'+card).waitFor();
  if(card===2)assert.match(await page.locator('#situation-front-2').innerText(),/李彦仙/);
  await page.locator('#situation-close').click();
  await page.locator('#situation-intro').waitFor({state:'hidden'});
}

async function desktop(browser,base) {
  const {page,errors,oldRequests,adminRequests,firstMaps} = await openBattle(browser,base,{width:1440,height:900});
  try {
    await page.locator('#intro-close').click();
    const {geographic,terrain,canvas}=await openTerrain(page);
    await waitForCity(terrain,'长社',true);
    await waitDetail(terrain,113.82);
    await checkScale(geographic,true);
    await terrain.waitForFunction(()=>window.testCastStages?.includes('siege'));
    await checkCast(terrain,changsheCast(true));
    await capture(page,'长社城');
    await checkCloserDetail(page,terrain,canvas);
    // Replay the story's two boundary messages through the real parent bridge without
    // advancing the gameplay clock or changing the camera.
    for(const stage of ['relieved','siege']){
      await setCastStage(page,terrain,stage);
      await checkCast(terrain,changsheCast(stage==='siege'));
    }
    await clickTown(page,terrain,'长社',1);
    assert.ok(await page.locator('#play').isEnabled(),'Playback enabled after closing the town card');
    await clickControl(page,'#play');
    await page.waitForFunction(()=>document.getElementById('clock').textContent!=='0:00');
    await clickControl(page,'#play');
    const elapsed=await page.locator('#clock').textContent();
    await page.locator(selector('overview')).click();
    await waitForCity(terrain,'长社',false);
    assert.equal(await terrain.locator('.battle-cast-caption:visible').count(),0);
    const before=await geographic.evaluate(()=>({...window.atlasApp.camera}));
    await waitDetail(terrain,null);
    await checkScale(geographic,false);
    await capture(page,'宋金全国形势');
    await page.locator(selector('shanzhou')).click();
    await geographic.waitForFunction(width=>window.atlasApp.camera.w<width*.5,before.w);
    await waitForCity(terrain,'陕州',true);
    await waitDetail(terrain,111.19);
    await checkScale(geographic,true);
    await setCastStage(page,terrain,'relieved');
    await checkCast(terrain,westCast);
    await capture(page,'陕州近景');
    await clickTown(page,terrain,'陕州',2);
    assert.equal(await page.locator('#clock').textContent(),elapsed);
    assert.equal(await (await geographic.locator('#fusion-terrain').elementHandle()).contentFrame(),terrain);
    const box=await canvas.boundingBox();
    assert.ok(box && box.width>0 && box.height>0);
    const x=box.x+box.width*.57,y=box.y+box.height*.47;
    await page.mouse.move(x,y);
    const width=await geographic.evaluate(()=>window.atlasApp.camera.w);
    await page.mouse.wheel(0,-240);
    await geographic.waitForFunction(w=>window.atlasApp.camera.w<w*.99,width);
    const start=await geographic.evaluate(()=>window.atlasApp.camera.x);
    await page.mouse.down();
    await page.mouse.move(x+65,y+20,{steps:6});
    await page.mouse.up();
    await geographic.waitForFunction(x=>Math.abs(window.atlasApp.camera.x-x)>.1,start);
    await page.locator('#intro-open').click();
    await page.locator('#situation-tabs [data-front="0"]').click();
    await page.locator('#situation-close').click();
    await waitDetail(terrain,112.53);
    await checkCast(terrain,[['zhao','南阳守军',true],['jin-nanyang','兀术',true]]);
    assert.deepEqual(errors,[]);
    assert.deepEqual(oldRequests,[]);
    assert.deepEqual(adminRequests,[],'A battle map with hidden county labels must skip the county package');
    assert.ok(firstMaps.some(status=>status===200||status===304),'The prepared 1128 first map must load');
    console.log('PASS desktop: one national WebGL scene, city models at both sites, national overview, city cards, wheel, drag and playback.');
  } finally { await page.close(); }
}

async function mobile(browser,base,flat) {
  const {page,errors,oldRequests}=await openBattle(browser,base,{width:390,height:844});
  try {
    await page.locator('#situation-intro [data-atlas-view="shanzhou"]').click();
    if(flat){
      const atlas=page.frameLocator('#national-atlas');
      await atlas.locator('#fusion-status').filter({hasText:/失败|平面/}).waitFor({state:'attached',timeout:90000});
      await atlas.locator('.changshe-towns button').filter({hasText:'陕州'}).click();
      assert.match(await page.locator('#situation-front-2').innerText(),/李彦仙/);
      await page.locator('#situation-close').click();
      await page.locator(selector('changshe')).click();
      await atlas.locator('.changshe-towns button').filter({hasText:'长社'}).click();
      await page.locator('#situation-front-1').waitFor();
    }else{
      const {terrain}=await openTerrain(page);
      await waitForCity(terrain,'陕州',true);
      await waitDetail(terrain,111.19);
      await capture(page,'陕州手机');
      await clickTown(page,terrain,'陕州',2);
      await page.locator(selector('changshe')).click();
      await waitDetail(terrain,113.82);
      await checkCast(terrain,changsheCast(true));
      await capture(page,'长社手机');
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(oldRequests,[]);
    console.log('PASS mobile: '+(flat?'WebGL unavailable, both flat-map cards accessible.':'WebGL western front and Li Yanxian card.'));
  } finally { await page.close(); }
}

async function main(){
  const {chromium}=loadPlaywright();
  const base=terrainTestUrl();
  const executablePath=process.env.TERRAIN_TEST_CHROME ||
    (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  const args=process.argv.includes('--software')?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
  const browser=await chromium.launch({executablePath,args});
  try{await desktop(browser,base);await mobile(browser,base,false);}finally{await browser.close();}
  const flat=await chromium.launch({executablePath,args:['--disable-webgl']});
  try{await mobile(flat,base,true);}finally{await flat.close();}
}

if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={desktop,mobile};
