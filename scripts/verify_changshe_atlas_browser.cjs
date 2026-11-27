'use strict';

// Exercise both map entrances against a local atlas server.
const assert = require('node:assert/strict');
const {loadPlaywright} = require('./load_playwright.cjs');
const {clickControl, terrainTestUrl} = require('./tests/terrain_browser_controls.cjs');

async function checkLocalScene(page) {
  const canvas = page.locator('#terrain-canvas');
  await canvas.waitFor({state:'visible',timeout:90000});
  await page.waitForFunction(() => {
    const canvas = document.getElementById('terrain-canvas');
    if (document.documentElement.dataset.terrain !== 'webgl' || !canvas.clientWidth || !canvas.clientHeight) return false;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl && !gl.isContextLost() && gl.drawingBufferWidth > 0 && gl.getParameter(gl.CURRENT_PROGRAM));
  }, null, {timeout:30000});
  assert.equal(await page.locator('#map').isVisible(),false);
  assert.equal(await page.locator('#national-atlas.is-active').count(),0);
}

async function main() {
  const {chromium} = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.TERRAIN_TEST_CHROME ||
      (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
    args: process.argv.includes('--software') ? ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] : [],
  });
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}, reducedMotion:'reduce'});
    const errors = [];
    const localAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/changshe-terrain(?:-data)?\.js$/.test(new URL(request.url()).pathname)) localAssets.push(request.url());
    });
    await page.goto(new URL('battles/changshe.html', terrainTestUrl()).href, {waitUntil:'domcontentloaded'});
    const geographic = page.frameLocator('#national-atlas');
    const child = geographic.frameLocator('#fusion-terrain');
    const surface = child.locator('body[data-surface-year="1128"][data-surface-quality="detail"]');
    await surface.waitFor({state:'attached',timeout:120000});
    const original = page.frames().find(frame => frame.url().includes('terrain.html?embedded=1'));
    await page.locator('#intro-close').click();
    await page.getByRole('button',{name:'长社一带',exact:true,pressed:true}).waitFor();
    await clickControl(page,'#play');
    await page.waitForFunction(()=>document.getElementById('clock').textContent !== '0:00');
    await clickControl(page,'#play');
    assert.ok(await page.locator('#national-atlas.is-active').isVisible());
    assert.equal(await page.locator('#terrain-canvas').isVisible(),false);
    assert.deepEqual(localAssets,[]);
    const towns = child.locator('button.fusion-place.battle');
    assert.deepEqual((await towns.allTextContents()).sort(), ['南阳','鄢陵','长社','陕州'].sort());
    await towns.filter({hasText:'鄢陵'}).click();
    await page.locator('#situation-front-1').waitFor({state:'visible'});
    await page.locator('#intro-close').click();
    await page.getByRole('button',{name:'3D 战场',exact:true}).click();
    await checkLocalScene(page);
    assert.ok(localAssets.length >= 2);
    await page.getByRole('button',{name:'长社一带',exact:true}).click();
    await surface.waitFor({state:'attached',timeout:120000});
    assert.ok(await page.locator('#national-atlas.is-active').isVisible());
    assert.equal(page.frames().find(frame=>frame.url().includes('terrain.html?embedded=1')),original);
    await page.close();
    const mobile = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.route('**/changshe-terrain-data.js',route=>route.abort(),{times:1});
    await mobile.goto(new URL('battles/changshe.html',terrainTestUrl()).href,{waitUntil:'domcontentloaded'});
    await mobile.getByRole('button',{name:'进入 3D 战场',exact:true}).click();
    await mobile.locator('#terrain-retry').waitFor();
    assert.ok(await mobile.locator('#map').isVisible());
    assert.match(await mobile.locator('#terrain-status').innerText(),/平面/);
    await mobile.locator('#terrain-retry').click();
    await checkLocalScene(mobile);
    const cityView = mobile.getByRole('button',{name:'长社',exact:true,pressed:true});
    await cityView.waitFor();
    assert.ok(await mobile.locator('#unit-view').isVisible());
    await mobile.locator('#play').click();
    await mobile.waitForFunction(()=>document.getElementById('clock').textContent!=='0:00');
    await cityView.waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: both Changshe entrances, 1128 atlas playback and towns, local WebGL rendering on desktop and mobile.');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
