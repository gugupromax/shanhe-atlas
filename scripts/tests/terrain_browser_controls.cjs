'use strict';
const assert = require('node:assert/strict');

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

module.exports = {clickControl, enableCountyLayer};
