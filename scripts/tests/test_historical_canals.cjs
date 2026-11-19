'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const context = { window: {} };
for (const file of ['js/map_data.js','js/china_geo_data.js','js/i18n_dict.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const { CORRIDOR_DATA, DYNASTY_DATA, EN_LOCALE, HYDRO_DATA } = JSON.parse(JSON.stringify(context.window));
const canals = CORRIDOR_DATA.filter(c => c.kind === 'canal');
const at = year => canals.filter(c => c.span[0] <= year && year <= c.span[1]).map(c => c.key);
const part = name => canals.find(c => c.key === name);

test('dated Sui canal works reach south of the Yangtze from 610 and hand over to the Yuan trunk', () => {
  for (const [year, expected] of [
    [604, []],
    [605, ['canal_tongji','canal_hangou']],
    [608, ['canal_tongji','canal_hangou','canal_yongji']],
    [609, ['canal_tongji','canal_hangou','canal_yongji']],
    [610, ['canal_tongji','canal_hangou','canal_yongji','canal_jiangnan']],
    [1292, ['canal_tongji','canal_hangou','canal_yongji','canal_jiangnan']],
    [1293, ['canal_jinghang']],
  ]) assert.deepEqual(at(year).sort(), expected.sort(), String(year));
  const hasHangzhou = year => at(year).some(key => part(key).segments.flat().some(p => p[1] < 31));
  assert.equal(hasHangzhou(609), false);
  assert.equal(hasHangzhou(610), true);
  assert.deepEqual(part('canal_jiangnan').segments[0][0], [119.45,32.2]);
  assert.deepEqual(part('canal_jiangnan').segments[0].at(-1), [120.15,30.27]);
});

test('canal and water junctions, captions and event pins occupy the intended localities', () => {
  const mouth = part('canal_tongji').segments[0].at(-1);
  assert.deepEqual(mouth, [118.5,33.03], 'Tongji ends at the Bian–Huai confluence near Xuyi');
  assert.ok(HYDRO_DATA.rivers.some(r => r.name === 'Huai' && r.vanish === 1194 &&
    r.lines.some(line => line.some(p => p[0] === mouth[0] && p[1] === mouth[1]))));
  for (const c of canals) {
    const [x, y] = c.labelAt;
    const nearCanal = c.segments.some(line => line.some(([x1,y1], i) => {
      if (!i) return false;
      const [x0,y0] = line[i - 1], dx = x1 - x0, dy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((x - x0)*dx + (y - y0)*dy) / (dx*dx + dy*dy)));
      return Math.hypot(x - x0 - dx*t, y - y0 - dy*t) < .025;
    }));
    assert.ok(nearCanal, 'Caption is detached from ' + c.key);
    assert.equal(EN_LOCALE.corridors[c.key].length, 2);
  }
  const sui = DYNASTY_DATA.find(d => d.key === 'sui').milestones.find(m => m.year === 610);
  const yuan = DYNASTY_DATA.find(d => d.key === 'yuan').milestones.find(m => m.year === 1293);
  assert.deepEqual(sui.coord, part('canal_jiangnan').segments[0][0]);
  assert.match(EN_LOCALE.milestones['sui:610'][1], /Jingkou/);
  assert.deepEqual(yuan.coord, [116.38,39.94]);
  assert.match(yuan.site, /积水潭/);
  assert.match(EN_LOCALE.milestones['yuan:1293'][1], /Jishuitan/);
});
