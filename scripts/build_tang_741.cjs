'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'js/tang_741.js');
const sources = ['js/tang_741_north.json', 'js/tang_741_south.json'];
const block = /(  \/\/ GENERATED-741-GROUPS-START\n)[\s\S]*?(\n  \/\/ GENERATED-741-GROUPS-END)/;
const original = fs.readFileSync(target, 'utf8');
const text = original.replace(/\r\n/g, '\n');
assert(block.test(text), 'Tang 741 generation markers are missing');

const groups = sources.flatMap((source) =>
  JSON.parse(fs.readFileSync(path.join(root, source), 'utf8')));
assert(groups.length > 0, 'No verified Tang 741 supplement groups');
const stateKeys = new Set();
for (const group of groups) {
  assert(group.circuit && Array.isArray(group.prefectures) && group.prefectures.length);
  for (const entry of [group.map, group.history]) {
    assert(entry && entry[0] && /^https?:\/\//.test(entry[1]), 'Missing map or textual source');
  }
  for (const state of group.prefectures) {
    assert(state.name && Array.isArray(state.counties));
    const key = group.circuit + '/' + state.name;
    assert(!stateKeys.has(key), 'Duplicate state source row: ' + key);
    stateKeys.add(key);
    for (const coord of [state.coord, ...state.counties.map((row) => row.slice(1))].filter(Boolean)) {
      assert.equal(coord.length, 2, 'Expected longitude and latitude for ' + key);
      assert(coord.every(Number.isFinite), 'Invalid coordinates for ' + key);
      assert(coord[0] >= 73 && coord[0] <= 125 && coord[1] >= 18 && coord[1] <= 45, key);
    }
  }
}
const compiled = [
  '  const extraGroups = [',
  ...groups.map((group) => '    ' + JSON.stringify(group) + ','),
  '  ];',
].join('\n');
const updated = text.replace(block, (_, start, stop) => start + compiled + stop);
if (process.argv.includes('--check')) {
  assert(updated === text, 'Run node scripts/build_tang_741.cjs to refresh the Tang 741 bundle');
} else if (updated !== text) {
  fs.writeFileSync(target, original.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated);
}
console.log(`Tang 741 source bundle verified: ${stateKeys.size} prefecture groups.`);
