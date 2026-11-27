'use strict';

// Run against a local atlas server. Real clicks check that entering and playing
// a chapter keep the national renderer, and that local terrain loads on demand.
const assert = require('node:assert/strict');
const {loadPlaywright} = require('./load_playwright.cjs');
const {clickControl, terrainTestUrl} = require('./tests/terrain_browser_controls.cjs');

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
    await page.getByRole('button',{name:'局部沙盘',exact:true}).click();
    await page.locator('#terrain-canvas').waitFor();
    assert.ok(localAssets.length >= 2);
    await page.getByRole('button',{name:'长社一带',exact:true}).click();
    await surface.waitFor({state:'attached',timeout:120000});
    assert.ok(await page.locator('#national-atlas.is-active').isVisible());
    assert.equal(page.frames().find(frame=>frame.url().includes('terrain.html?embedded=1')),original);
    assert.deepEqual(errors,[]);
    console.log('PASS: Changshe opens and plays on the 1128 atlas, four town labels, optional local view and return.');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
