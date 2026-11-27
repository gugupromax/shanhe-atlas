'use strict';

// With the local atlas running, run this after changing the 1128 map or its
// cartography, then run scripts/sync_version.js --write-only.
const fs = require('node:fs/promises');
const path = require('node:path');
const {loadPlaywright} = require('./load_playwright.cjs');
const {terrainTestUrl} = require('./tests/terrain_browser_controls.cjs');
const {changsheNearBounds} = require('../integration.js');

async function build() {
  const {chromium} = loadPlaywright();
  const executablePath = process.env.TERRAIN_TEST_CHROME ||
    (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const browser = await chromium.launch({executablePath});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    // Export the same live SVG used by the public map. Render the national
    // overview without a WebGL context, optional local layers or battle actors.
    await page.route('**/terrain.html?*', route => route.abort());
    await page.goto(new URL('battles/changshe.html',terrainTestUrl()).href);
    const atlas = await (await page.locator('#national-atlas').elementHandle()).contentFrame();
    await atlas.waitForFunction(() => window.atlasApp?.year===1128 &&
      window.atlasApp.battleGeography && !atlasApp.svg.classList.contains('is-awaiting-snapshot') &&
      ['南宋','金'].every(title=>Array.from(atlasApp.grpPolities.querySelectorAll('path')).some(p=>p.dataset.polityTitle===title)) &&
      atlasApp.svg.querySelector('#terrain-relief-img')?.getAttribute('href'));
    for (const [kind,bounds,size] of [['base',[40,-10,165,70],1024],['near',changsheNearBounds,3072]]) {
      if (kind==='near') {
        await page.locator('#intro-close').click();
        await atlas.waitForFunction(()=>atlasApp.camera.zoom>35 &&
          atlasApp.svg.querySelector('#grp-terrain-tiles image.is-loaded') &&
          !atlasApp.svg.querySelector('#grp-terrain-tiles image:not(.is-loaded)'));
      }
      const data = await atlas.evaluate(async ({kind,bounds,size}) => {
        const surface = await JiangshanMapSurface.create({app:atlasApp,svg:atlasApp.svg}).render({
          bounds,width:size,height:size,screenLabels:true,
        });
        const img = new Image();
        img.src = surface.url;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        if (kind==='base') {
          const box=JiangshanMapSurface.projectedBounds(atlasApp.projector,bounds);
          ctx.font='bold 12px serif';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.lineWidth=2.5;ctx.strokeStyle='#f3ead8';ctx.fillStyle='#3d392c';
          for (const title of atlasApp.grpPolityLabels.querySelectorAll('[data-polity-title]')) {
            const x=(Number(title.dataset.baseX)-box.x)/box.width*canvas.width;
            const y=(Number(title.dataset.baseY)-box.y)/box.height*canvas.height;
            ctx.strokeText(title.textContent,x,y);ctx.fillText(title.textContent,x,y);
          }
        }
        return canvas.toDataURL('image/webp',.92).split(',')[1];
      },{kind,bounds,size});
      await fs.writeFile(path.join(__dirname,'../assets/changshe-1128-'+kind+'.webp'),Buffer.from(data,'base64'));
    }
  } finally { await browser.close(); }
}
build().catch(error=>{console.error(error);process.exitCode=1;});
