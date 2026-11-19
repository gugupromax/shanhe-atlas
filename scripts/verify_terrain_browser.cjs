'use strict';

// Run against a local atlas server. Uses the existing Playwright installation.
// Options: --software selects SwiftShader, --failure tests retry, --profile reports upload timings,
// and --period-data requires a local all-period county index.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const {clickControl, enableCountyLayer} = require('./tests/terrain_browser_controls.cjs');

function playwright() {
  if (process.env.TERRAIN_TEST_PLAYWRIGHT) return require(process.env.TERRAIN_TEST_PLAYWRIGHT);
  try {
    return require('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}

async function verifyViewportReadBudget(frame) {
  // Measure one redraw on a stationary, populated scene. An extra read per marker
  // can force synchronous layout after every label position write.
  const reads = await frame.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      const stage = document.getElementById('stage');
      let count = 0;
      for (const name of ['clientWidth', 'clientHeight']) {
        const getter = Object.getOwnPropertyDescriptor(Element.prototype, name).get;
        Object.defineProperty(stage, name, {
          configurable: true,
          get() { count++; return getter.call(this); },
        });
      }
      document.getElementById('route-toggle').dispatchEvent(new Event('change'));
      requestAnimationFrame(() => {
        delete stage.clientWidth;
        delete stage.clientHeight;
        resolve(count);
      });
    });
  }));
  assert.ok(reads > 0 && reads <= 20, `Expected bounded viewport reads in a terrain redraw, got ${reads}`);
}

async function main() {
  const { chromium } = playwright();
  const url = new URL(process.env.TERRAIN_TEST_URL || 'http://127.0.0.1:8773/');
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  url.search = '?year=741&zoom=8&center=109,34';
  const simulateFailure = process.argv.includes('--failure');
  const software = process.argv.includes('--software');
  const executablePath = process.env.TERRAIN_TEST_CHROME ||
    (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    if (process.argv.includes('--profile')) {
      await page.addInitScript(() => {
        window.atlasUploadProfile = [];
        function measureCalls(prototype, method, extra) {
          if (!prototype?.[method]) return;
          const original = prototype[method];
          prototype[method] = function (...args) {
            const start = performance.now();
            const result = original.apply(this, args);
            const elapsed = performance.now() - start;
            if (elapsed >= 1 || method === 'bufferData') {
              window.atlasUploadProfile.push({ method, elapsed, ...extra?.(args) });
            }
            return result;
          };
        }
        measureCalls(HTMLCanvasElement.prototype, 'getContext', ([kind]) => ({ kind }));
        const gl = window.WebGL2RenderingContext?.prototype;
        measureCalls(gl, 'bufferData', ([, data]) => ({ bytes: data?.byteLength ?? data }));
        measureCalls(gl, 'texSubImage2D');
        for (const method of ['generateMipmap','linkProgram','getProgramParameter','getProgramInfoLog','getActiveUniform','drawElements']) {
          measureCalls(gl, method);
        }
      });
    }
    const errors = [];
    const messages = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'warning') messages.push(message.text());
    });
    let failures = 0;
    let cutConnection = simulateFailure;
    if (simulateFailure) {
      // At the test view this is the neighboring tile; the center tile still loads.
      await page.route(/\/near\/4-3\.png(?:\?|$)/, request => {
        if (!cutConnection) return request.continue();
        failures++;
        return request.abort();
      });
    }
    await page.goto(url.href, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.atlasApp?.year === 741 && window.TANG_741_ATLAS &&
      document.querySelector('#grp-prefectures path'));
    await enableCountyLayer(page);
    const frame = page.frameLocator('#fusion-terrain');
    const wait = selector => frame.locator(selector).waitFor({state:'attached', timeout:60000});
    const visibleMap = '#viewport-frame.fusion-is-3d';
    const near = 'body[data-surface-year="741"][data-tile-tier="near"]';
    const complete = near + '[data-tile-progress="complete"]';
    try {
      await clickControl(page, '#fusion-3d');
      await page.locator(visibleMap).waitFor({state:'attached', timeout:110000});
      await wait(simulateFailure ? near + '[data-tile-progress="degraded"]' : complete);
      const childFrame = page.frames().find(child => child.url().includes('terrain.html'));
      const phases = simulateFailure ? ['center','degraded'] : ['complete'];
      const sampledPhase = await childFrame.waitForFunction(phases => phases.find(phase =>
        performance.getEntriesByName('atlas-3d:draw-' + phase, 'measure').length), phases, {polling:100, timeout:30000});
      const phase = await sampledPhase.jsonValue();
      assert.ok(await frame.locator('.tang-label[data-kind="county"]').count() > 0);
      await verifyViewportReadBudget(childFrame);
      const parentTiming = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('mark')
        .filter(e => e.name.startsWith('atlas-3d:')).map(e => [e.name, Math.round(e.startTime)])));
      const frameTiming = await frame.locator('body').evaluate(() =>
        Object.fromEntries(performance.getEntries().filter(e => e.name.startsWith('atlas-3d:'))
          .map(e => [e.name, Math.round(e.entryType === 'mark' ? e.startTime : e.duration)])));
      const clickedAt = await page.evaluate(() => performance.timeOrigin + performance.getEntriesByName('atlas-3d:open','mark')[0].startTime);
      const firstFrame = await childFrame.evaluate(({phase,clickedAt}) => {
        const draw = performance.getEntriesByName('atlas-3d:draw-' + phase, 'measure')[0];
        const uploads = (window.atlasUploadProfile || []).filter(entry => entry.method === 'bufferData');
        return {
          drawCompleteFromClickMs: Math.round(performance.timeOrigin + draw.startTime + draw.duration - clickedAt),
          canvasCompositions: performance.getEntriesByName('atlas-3d:tile-compose').length,
          ...(window.atlasUploadProfile ? {
            uploadedBytes: uploads.reduce((total, entry) => total + entry.bytes, 0),
            longestCalls: [...window.atlasUploadProfile].sort((a,b) => b.elapsed-a.elapsed).slice(0,6),
          } : {}),
        };
      }, {phase,clickedAt});
      console.dir({ software, simulateFailure, parentTiming, frameTiming, firstFrame },{ depth:null });
      if (simulateFailure) {
        assert.equal(failures, 2, 'One bounded retry should preserve the center tile');
        cutConnection = false;
        await page.evaluate(() => { window.atlasApp.camera.x += 0.1; window.atlasApp._applyCamera(true); });
        await wait(complete);
        console.log('Single-tile failure and recovery passed.');
      } else {
        await clickControl(page, '#fusion-flat');
        await clickControl(page, '#fusion-3d');
        await wait(complete);
        await page.evaluate(() => window.atlasApp.jumpToYear(742));
        await wait('body[data-surface-year="742"][data-map-surface="original-svg"]');
        assert.ok(await frame.locator('.tang-label[data-kind="circuit"]').count() > 0);
        assert.ok(await frame.locator('.tang-label[data-kind="prefecture"]').count() > 0);
        if (process.argv.includes('--period-data')) {
          await frame.locator('.tang-label[data-kind="county"]').first().waitFor({state:'attached', timeout:45000});
        }
        assert.ok(await frame.locator('.tang-label[data-kind="pass"]').count() > 0);
        await page.evaluate(() => window.atlasApp.jumpToYear(741));
        await wait(complete);
        console.log('741 cold and warm views, and 742 live-map roundtrip passed.');
      }
      assert.deepEqual(errors, []);
    } catch (error) {
      const state = await page.locator('#fusion-status').textContent();
      console.error('Atlas status:', state, 'Page errors:', errors, 'Browser warnings:', messages);
      throw error;
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
