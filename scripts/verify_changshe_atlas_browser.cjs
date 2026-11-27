'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadPlaywright} = require('./load_playwright.cjs');
const {clickControl,terrainTestUrl} = require('./tests/terrain_browser_controls.cjs');

const selector = mode => `#views [data-atlas-view="${mode}"]`;
const legacyTerrain = /\/changshe-terrain(?:-data)?\.js$/;

async function openBattle(browser, base, viewport, {storyClock=false,partyLink=false}={}) {
  const context = await browser.newContext({viewport,reducedMotion:'reduce'});
  const page = await context.newPage();
  if(storyClock)await page.clock.install();
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
  await context.addInitScript(()=>{
    window.testBattleMessages=[];
    window.addEventListener('message',event=>{
      if(event.source===parent&&['atlas-changshe-map','atlas-changshe-cast'].includes(event.data?.type))
        window.testBattleMessages.push(event.data);
    });
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
  const target=new URL('battles/changshe.html',base);
  if(partyLink)target.searchParams.set('view','zhao');
  await page.goto(target.href,{waitUntil:'domcontentloaded'});
  await page.locator(partyLink?selector('zhao')+'[aria-pressed=true]':'#intro-close').waitFor();
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
  assert.equal(await geographic.locator('#fusion-terrain').count(),1);
  assert.equal(await terrain.locator('#canvas-host canvas').count(),1);
  await terrain.waitForFunction(()=>typeof window.ChangsheFigures?.slots==='function',null,{timeout:45000});
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
      const columns=new Set(),rows=new Set();
      let clear=0;
      for(let i=0;i<heads.count;i++){
        heads.getMatrixAt(i,transform);
        p.setFromMatrixPosition(transform);
        columns.add(p.x.toFixed(4));rows.add(p.z.toFixed(4));
        p.applyMatrix4(heads.matrixWorld).project(window.testTerrainCamera);
        if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)continue;
        const x=stage.x+(p.x+1)*stage.width/2,y=stage.y+(1-p.y)*stage.height/2;
        if(!labels.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))clear++;
      }
      const mounts=group.getObjectByName(id==='zhao'?'party-horses':'mounts');
      return {visible:true,clear,total:heads.count,rows:rows.size,columns:columns.size,mounts:mounts?.count||0};
    },id);
    assert.equal(result.visible,visible,id+' geometry visibility');
    if(visible){
      assert.ok(result.clear>=result.total/2,id+' heads visible and clear of labels: '+JSON.stringify(result));
      // Changshe's original actor table gives the emperor a column, Jin horsemen
      // a mounted formation, and Han's foot soldiers a block.
      const mounted=id==='zhao'||id.startsWith('jin-');
      const [rows,columns]=id==='zhao'?[4,3]:mounted?[3,4]:[3,5];
      assert.deepEqual([result.rows,result.columns,result.total,result.mounts],
        [rows,columns,rows*columns,mounted?rows*columns:0],id+' retains its original formation and mount count');
    }
  }
  const boxes=await Promise.all(expected.filter(([, ,visible])=>visible).map(([id])=>
    terrain.locator('[data-cast="'+id+'"]').evaluate(el=>el.getBoundingClientRect().toJSON())));
  for (const [i,a] of boxes.entries()) for (const b of boxes.slice(i+1)) {
    assert.ok(a.bottom<=b.top||b.bottom<=a.top||a.right<=b.left||b.right<=a.left,'Character labels must not overlap');
  }
}

async function checkSiegeRing(terrain,city,besieged){
  await terrain.waitForFunction(({city,besieged})=>{
    const site=window.testTerrainScene?.getObjectByName('ChangsheCity:'+city);
    const ring=site?.getObjectByName('ChangsheSiege:'+city);
    if(!site||!ring)return false;
    if(!besieged)return !ring.visible;
    if(!ring.visible||!site.visible||!ring.getObjectByName('siege-pennants')?.isInstancedMesh)return false;
    const outline=new THREE.Box3().setFromObject(ring);
    const walls=new THREE.Box3().setFromObject(site.getObjectByName('city-walls'));
    return outline.min.x<walls.min.x&&outline.max.x>walls.max.x&&
      outline.min.z<walls.min.z&&outline.max.z>walls.max.z;
  },{city,besieged},{timeout:30000});
}

async function checkPartyCity(terrain,city){
  await terrain.waitForFunction(city=>{
    const parties=[];
    window.testTerrainScene.traverseVisible(node=>{
      if(node.name==='ChangsheCast:zhao')parties.push(node);
    });
    const party=parties[0], horses=party?.getObjectByName('party-horses');
    return parties.length===1 && party.parent.name==='ChangsheCity:'+city &&
      horses?.isInstancedMesh && horses.count>1;
  },city,{timeout:30000});
}

const changsheCast=besieged=>[['song-changshe',besieged?'韩世忠':'长社解围',true],['jin-changshe','挞懒',besieged]];
const party=['zhao','赤心队',true];
const nanyangCast=[['song-nanyang','南阳守军',true],['jin-nanyang','兀术',true]];
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
    await checkSiegeRing(terrain,'长社',true);
    await capture(page,'长社被围');
    await checkCloserDetail(page,terrain,canvas);
    // Replay the story's two boundary messages through the real parent bridge without
    // advancing the gameplay clock or changing the camera.
    for(const stage of ['relieved','siege']){
      await setCastStage(page,terrain,stage);
      await checkCast(terrain,changsheCast(stage==='siege'));
      await checkSiegeRing(terrain,'长社',stage==='siege');
      await checkSiegeRing(terrain,'南阳',true);
      await checkPartyCity(terrain,stage==='siege'?'南阳':'长社');
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
    await checkCast(terrain,nanyangCast);
    // Restore the bridge after the independent western-view relief probe.
    await setCastStage(page,terrain,'siege');
    await page.locator('#reset').click();
    await page.locator('#situation-intro [data-atlas-view="zhao"]').click();
    await waitDetail(terrain,112.53);
    await checkPartyCity(terrain,'南阳');
    await checkCast(terrain,[...nanyangCast,party]);
    assert.equal(await page.locator(selector('zhao')).getAttribute('aria-pressed'),'true');
    await capture(page,'南阳赵玖赤心队');
    await clickControl(page,'#play');
    const depart=page.getByRole('button',{name:'南阳佯动 · 赵玖绕行',exact:true});
    await depart.click({timeout:45000});
    await terrain.waitForFunction(()=>window.testCastStages.includes('journey'));
    await terrain.waitForFunction(()=>window.testCastStages.at(-1)==='yanling',null,{timeout:60000});
    await waitDetail(terrain,114.18);
    await checkPartyCity(terrain,'鄢陵');
    await checkCast(terrain,[['yue','岳飞',true],party]);
    await capture(page,'鄢陵会合');
    await page.locator(selector('changshe')).click();
    await waitDetail(terrain,113.82);
    for(const stage of ['reinforcing','joined','relieved','aftermath']){
      await setCastStage(page,terrain,stage);
      const besieged=stage==='reinforcing'||stage==='joined';
      await checkPartyCity(terrain,'长社');
      await checkCast(terrain,[...changsheCast(besieged),party]);
      await checkSiegeRing(terrain,'长社',besieged);
      if(stage==='relieved')await capture(page,'长社解围');
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(oldRequests,[]);
    assert.deepEqual(adminRequests,[],'A battle map with hidden county labels must skip the county package');
    assert.ok(firstMaps.some(status=>status===200||status===304),'The prepared 1128 first map must load');
    console.log('PASS desktop: one national WebGL scene, city models at both sites, national overview, city cards, wheel, drag and playback.');
  } finally { await page.context().close(); }
}

async function mobile(browser,base,flat) {
  const {page,errors,oldRequests}=await openBattle(browser,base,{width:390,height:844},{partyLink:!flat});
  try {
    if(flat){
      await page.locator('#situation-intro [data-atlas-view="shanzhou"]').click();
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
      await waitDetail(terrain,112.53);
      await checkPartyCity(terrain,'南阳');
      await checkCast(terrain,[...nanyangCast,party]);
      await checkSiegeRing(terrain,'南阳',true);
      await capture(page,'赵玖赤心队手机');
      await page.locator(selector('shanzhou')).click();
      await waitForCity(terrain,'陕州',true);
      await waitDetail(terrain,111.19);
      await capture(page,'陕州手机');
      await clickTown(page,terrain,'陕州',2);
      await page.locator(selector('changshe')).click();
      await waitDetail(terrain,113.82);
      await checkCast(terrain,changsheCast(true));
      await checkSiegeRing(terrain,'长社',true);
      await capture(page,'长社被围手机');
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(oldRequests,[]);
    console.log('PASS mobile: '+(flat?'WebGL unavailable, both flat-map cards accessible.':'WebGL western front and Li Yanxian card.'));
  } finally { await page.context().close(); }
}

// Advance only the test browser clock; controls, novel events and focus messages
// are still produced by the same public UI and story engine as normal playback.
async function followStory(browser,base){
  const {page,errors}=await openBattle(browser,base,{width:1100,height:790},{storyClock:true});
  try{
    await page.locator('#situation-intro [data-atlas-view="zhao"]').click();
    const atlas=await (await page.locator('#national-atlas').elementHandle()).contentFrame();
    const expectFocus=async(mode,stage)=>{
      await atlas.waitForFunction(({mode,stage})=>{
        const m=window.testBattleMessages??[];
        return m.filter(msg=>msg.type==='atlas-changshe-map').at(-1)?.mode===mode &&
          m.filter(msg=>msg.type==='atlas-changshe-cast').at(-1)?.stage===stage;
      },{mode,stage});
    };
    const action=index=>page.locator('#orders button').nth(index);
    await expectFocus('nanyang','siege');
    await page.locator('#play').click();
    await page.clock.fastForward(16000);
    await action(1).click();
    await expectFocus('nanyang','journey');
    await page.clock.fastForward(19000);
    await expectFocus('yanling','yanling');
    await action(2).click();
    await action(3).click();
    await page.locator('#scene-dialog form button').click();
    await action(4).click();
    await page.clock.fastForward(90000);
    await expectFocus('changshe','reinforcing');
    await page.locator(selector('shanzhou')).click();
    await action(5).click();
    for(let i=0;i<60;++i){
      await page.clock.fastForward(1500);
      if((await page.locator('#play').innerText())==='战役结束')break;
    }
    await expectFocus('shanzhou','aftermath');
    const messages=await atlas.evaluate(()=>window.testBattleMessages);
    const stages=messages.filter(m=>m.type==='atlas-changshe-cast').map(m=>m.stage);
    assert.ok(stages.includes('joined')&&stages.includes('relieved'),'Playback reached meeting and relief');
    assert.equal(await page.locator(selector('zhao')).getAttribute('aria-pressed'),'false');
    assert.deepEqual(errors,[]);
    console.log('PASS story: following Zhao uses actual chapter changes, manual western view stays selected through the ending.');
  }finally{await page.context().close();}
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
  try{await mobile(flat,base,true);await followStory(flat,base);}finally{await flat.close();}
}

if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={desktop,mobile,followStory};
