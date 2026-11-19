'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const benchmarkExpected = {2:861, 742:1087, 1102:1036, 1820:1273};
// Multiple Figshare coordinates matched each of these CHGIS records in the same year.
const retainedSeriesIds = {
  2: [82801,45339,87491,45026,85251,95075],
  742: [44074,44028,43964,43877,44036,200057,96001,82678,44355,82892,83048,82432,82546,82344],
  1102: [200222],
  1820: [],
};
const fullInputs = {
  'chgis-v6-prefecture-wgs84.zip': 5214,
  'chgis-v6-county-wgs84.zip': 10493,
  'figshare-county-wgs84.csv': 4257,
  'mcgd-republic-county-wgs84.csv': 1956,
  'chgis-1911-wgs84.csv': 2490,
};

function verifyInputs(inputFiles) {
  assert.ok(Array.isArray(inputFiles) && inputFiles.length, 'full local verification requires a source inventory');
  const sources = new Map(inputFiles.map(item => [item.file, item]));
  assert.equal(sources.size, inputFiles.length, 'duplicate source inventory entry');
  for (const [file, count] of Object.entries(fullInputs)) {
    const item = sources.get(file);
    assert.ok(item, 'missing required source: ' + file);
    assert.equal(item.rows, count, 'unexpected normalized row count for ' + file);
  }
  const atlas = sources.get('figshare-county-wgs84.csv');
  assert.equal(atlas.rows + atlas.skipped?.['ambiguous CHGIS identity'], 4300, 'Figshare candidate accounting');
  const index = sources.get('tan-atlas-toponym-index-gbk.zip');
  assert.ok(index && index['index names'] > 0, 'full verification requires the Tan atlas name index');
  for (const item of inputFiles) assert.match(item.sha256, /^[0-9a-f]{64}$/, item.file);
}

function verify1911(places) {
  const slice = places.filter(p => p.id.startsWith('slice:1911:'));
  assert.equal(slice.filter(p => p.level === 'county').length, 2139, '1911 county slice');
  assert.equal(slice.filter(p => p.level === 'prefecture').length, 351, '1911 prefecture slice');
  assert.ok(slice.every(p => p.source === 5 && p.from === 1911 && p.through === 1911 && p.parent), '1911 dates and parents');
  assert.ok(slice.some(p => p.ancient === '盐城县' && p.parent === '淮安府'), '1911 Yancheng County parent');
}

function verifyProvider({placesForYear, inputFiles}) {
  verifyInputs(inputFiles);
  assert.equal(placesForYear(0).length, 0);
  let minCount = Infinity;
  for (let year = -403; year <= 1911; year++) {
    if (!year) continue;
    const places = placesForYear(year);
    assert.ok(places.length > 0, 'empty historical coverage at ' + year);
    minCount = Math.min(minCount, places.length);
    assert.equal(new Set(places.map(p => p.id)).size, places.length, 'duplicate point IDs at ' + year);
    for (const p of places) {
      assert.ok(p.from <= year && year <= p.through, p.id);
      assert.ok(p.level === 'prefecture' || p.level === 'county', p.id);
      assert.ok(p.sources.length && p.sources.every(source => /^https?:/.test(source[1])), p.id);
      if (p.id.startsWith('atlas:') || p.id.startsWith('slice:')) assert.equal(p.from, p.through, p.id);
    }
    if (Object.hasOwn(benchmarkExpected, year)) {
      assert.equal(places.filter(p => p.id.startsWith('atlas:')).length, benchmarkExpected[year], 'benchmark ' + year);
      const series = new Set(places.filter(p => p.source === 1).map(p => p.id));
      for (const id of retainedSeriesIds[year]) {
        assert.ok(series.has('chgis:1:' + id), 'missing original CHGIS county ' + id + ' at ' + year);
      }
    }
    if (year === 1911) verify1911(places);
  }
  for (const year of [1912, 1930, 1932, 1949, 2026]) assert.equal(placesForYear(year).length, 0);
  const republic = placesForYear(1931);
  assert.equal(republic.length, 1956, '1931 county slice');
  assert.ok(republic.every(p => p.id.startsWith('slice:1931:') && p.source === 4 && p.level === 'county' && p.from === 1931 && p.through === 1931 && p.parent),
    '1931 dates and parents');
  assert.ok(republic.some(p => p.ancient === '三原县' && p.parent === '陕西'));
  return {first: -403, last: 1911, minCount, republicCount: republic.length};
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const context = vm.createContext({window: {}});
  for (const file of ['js/map_data.js', 'data/tiles/period-admin.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
  }
  console.log('Full local dated seats verified', verifyProvider(context.window.ATLAS_PERIOD_ADMIN));
}
module.exports = {verifyProvider, verify1911};
