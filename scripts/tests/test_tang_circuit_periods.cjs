'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const context = {window: {}};
for (const file of ['js/map_data.js', 'js/atlas_snapshots.js', 'js/tang_741.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const {DYNASTY_DATA, ATLAS_SNAPSHOTS, TANG_741_ATLAS} = context.window;
const tang = DYNASTY_DATA.find(d => d.key === 'tang');
const ten = ['关内道','河南道','河东道','河北道','山南道','陇右道','淮南道','江南道','剑南道','岭南道'];
const keyAt = year => tang.phases.find(p => year < p.until).snap;
const regions = year => {
  const snap = ATLAS_SNAPSHOTS[keyAt(year)];
  return (snap.regions || ATLAS_SNAPSHOTS[snap.regionRef]?.regions) || [];
};

test('circuit names and available shapes follow both Tang administrative transitions', () => {
  for (let year = 618; year < 907; year++) {
    const items = regions(year);
    if (year < 627) {
      assert.equal(items.length, 0, String(year));
    } else if (year < 733) {
      assert.deepEqual(Array.from(items, r => r.title), ten, String(year));
      assert(items.every(r => r.anchor.length === 2 && !r.shape), 'Directional labels must not imply measured boundaries');
    } else {
      // Existing later phases omit Longyou after the loss of the northwest.
      assert.equal(items.length, year >= 764 && year < 848 ? 12 : 13, String(year));
      assert(items.every(r => r.shape));
      assert(items.some(r => r.title === '山南东道'));
    }
  }
  assert.notEqual(keyAt(626), keyAt(627));
  assert.notEqual(keyAt(732), keyAt(733));
  for (const [a,b] of [[626,627],[732,733]]) {
    const previous = ATLAS_SNAPSHOTS[keyAt(a)], next = ATLAS_SNAPSHOTS[keyAt(b)];
    assert(previous.polities.every((p,i) => p === next.polities[i]), 'A circuit change must not move the polity border');
    assert.equal(previous.prefRef, next.prefRef);
  }
  assert.deepEqual(Array.from(TANG_741_ATLAS.circuitGuides, g => g.title), ['京畿道','都畿道']);
});

test('unverified early circuit boundary drawings remain in the source archive', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root,'data/atlas/tang/s_tang_0.geojson'),'utf8'));
  const layer = raw.referenceLayers.find(l => l.period === '唐');
  assert.equal(layer.year, undefined);
  assert.ok(layer.dateNote && layer.features.length === 6);
  for (const ref of layer.features) {
    const [source, id] = ref.split('/');
    const other = JSON.parse(fs.readFileSync(path.join(root,`data/atlas/tang/${source}.geojson`),'utf8'));
    assert(['Polygon','MultiPolygon'].includes(other.features.find(f => f.id === id)?.geometry?.type));
  }
  assert.equal(ATLAS_SNAPSHOTS.s_tang_0.referenceLayers, undefined);
});
