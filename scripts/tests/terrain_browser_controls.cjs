'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function terrainTestUrl() {
  let address = process.env.TERRAIN_TEST_URL;
  if (!address) {
    const record = path.join(__dirname, '..', '..', '.runtime', 'server.json');
    try {
      address = JSON.parse(fs.readFileSync(record, 'utf8')).url;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      throw new Error('没有找到本地地图地址。请先运行「启动地图.cmd」，' +
        '或将 TERRAIN_TEST_URL 设为手动启动的地址，例如 http://127.0.0.1:8000/。');
    }
  }
  const url = new URL(address);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && !url.username && !url.password, 'Terrain browser tests require a local HTTP URL');
  return url;
}

// Headless software rendering can stall animation-frame based click readiness.
// Measure the visible control and verify the hit target before sending a real mouse click.
async function clickControl(page, selector) {
  const control = page.locator(selector);
  await control.waitFor({state:'visible'});
  const point = await control.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return el.contains(document.elementFromPoint(x, y)) ? {x, y} : null;
  });
  assert.ok(point, 'Expected an unobstructed control: ' + selector);
  await page.mouse.click(point.x, point.y);
}

async function enableCountyLayer(page) {
  await clickControl(page, '#act-layers-menu');
  await clickControl(page, '.admin-level-picker label:has(#chk-admin-counties)');
  assert.equal(await page.locator('#chk-admin-counties').isChecked(), true);
  await clickControl(page, '#act-layers-menu');
  assert.equal(await page.locator('#act-layers-menu').getAttribute('aria-expanded'), 'false');
}

module.exports = {clickControl, enableCountyLayer, terrainTestUrl};
