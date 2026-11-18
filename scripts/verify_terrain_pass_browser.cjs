'use strict';

// Test the real year controller, shared 3D map and a clean checkout's live fallback.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

function playwright() {
  if (process.env.TERRAIN_TEST_PLAYWRIGHT) return require(process.env.TERRAIN_TEST_PLAYWRIGHT);
  try { return require('playwright'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}

async function main() {
  const {chromium} = playwright();
  const url = new URL(process.env.TERRAIN_TEST_URL || 'http://127.0.0.1:8773/');
  assert.ok(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  url.search = '?year=741&zoom=7&center=119.77,40.01';
  const withoutTiles = process.argv.includes('--without-tiles');
  const args = process.argv.includes('--software')
    ? ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] : [];
  const executablePath = process.env.TERRAIN_TEST_CHROME || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const browser = await chromium.launch({executablePath,args});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:690},reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let missingManifests=0;
    if(withoutTiles){
      await page.route('**/assets/tang-741-tiles/manifest.json',route=>{
        missingManifests++;
        return route.fulfill({status:404,body:'Local tiles are absent'});
      });
    }
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.atlasApp?.year===741&&window.TANG_741_ATLAS);
    await page.click('#fusion-3d');
    const frame = page.frameLocator('#fusion-terrain');
    const wait = (year,source) => frame.locator('body[data-surface-year="'+year+'"][data-map-surface="'+source+'"]')
      .waitFor({state:'attached',timeout:50000});
    function readNames() {
      return frame.locator('.tang-label[data-kind="pass"]').allTextContents();
    }
    async function checkNames(year, source, required, absent = []) {
      await page.waitForFunction(year=>window.atlasApp?.year===year&&
        !atlasApp.svg.classList.contains('is-awaiting-snapshot'),year);
      await wait(year,source);
      const actual=await readNames();
      const original=await page.locator('#grp-settlements .settlement-node.is-pass').evaluateAll(
        nodes=>nodes.map(node=>node.querySelector('.pass-name').textContent.trim()));
      assert.deepEqual([...actual].sort(),original.sort(),year+' follows the 2D year controller');
      for(const name of required)assert.ok(actual.includes(name),year+' '+name);
      for(const name of absent)assert.ok(!actual.includes(name),year+' '+name);
      console.log(year,source,actual.length,'passes');
    }

    await checkNames(741,withoutTiles?'original-svg':'tang-741-tiles',['临渝关','潼关'],['山海关','函谷关','嘉峪关']);
    if(withoutTiles){
      assert.equal(missingManifests,1);
      assert.ok(await frame.locator('.tang-label[data-kind="county"]').count()>0);
      await frame.getByRole('button',{name:'临渝关',exact:true}).click({timeout:12000});
      await page.locator('#genealogy-card:not(.is-hidden)').waitFor({timeout:12000});
      console.log('Fresh checkout fallback renders Tang counties and opens a historical pass card.');
    }else{
      const transitions=[
        [742,['临渝关','潼关'],['嘉峪关']],
        [199,['函谷关','潼关'],['嘉峪关']],
        [200,['潼关'],['函谷关']],
        [1371,['临渝关'],['嘉峪关','山海关']],
        [1372,['嘉峪关','临渝关'],['山海关']],
        [1380,['临渝关'],['山海关']],
        [1381,['山海关'],['临渝关']],
      ];
      for(const [year,required,absent] of transitions){
        await page.evaluate(year=>window.atlasApp.jumpToYear(year),year);
        await checkNames(year,'original-svg',required,absent);
      }
      await frame.getByRole('button',{name:'山海关',exact:true}).click({timeout:12000});
      await page.locator('#genealogy-card:not(.is-hidden)').waitFor({timeout:12000});
      assert.match(await page.locator('#genealogy-card').innerText(),/山海关/);
      await page.evaluate(()=>{window.atlasApp.closeGenealogyCard();window.atlasApp.jumpToYear(1950);});
      await checkNames(1950,'original-svg',[],['山海关','嘉峪关']);
      assert.equal((await readNames()).length,0);
    }
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
