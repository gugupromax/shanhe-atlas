'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {auditDoc} = require('../audit_prefectures');

function rectangle(title, west, south, east, north, role) {
  const ring = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  return {title, role, shape: {type: 'Polygon', coordinates: [ring]}};
}

test('shared prefecture cells retain all pairs and owners across changing core territory', () => {
  // At 0.05 degrees, A and B cover the first two columns, C the last two.
  const features = [
    rectangle('A', 0, 0, .1, .1),
    rectangle('B', 0, 0, .1, .1),
    rectangle('C', .05, 0, .15, .1),
    rectangle('core', -.05, -.05, .05, .15, 'main'),
  ];
  const snapshots = {
    first: {prefectures: [0, 1, 2], polities: [3]},
    other: {prefectures: [0], polities: [3]},
    inherited: {prefRef: 'first', polities: []},
  };
  const rows = auditDoc({features, snapshots}, ['first', 'other', 'inherited']);
  assert.deepEqual(rows.map(r => [r.key, r.overlap, r.outside]), [
    ['first', 4, 4], ['other', 0, 2], ['inherited', 4, 6],
  ]);
  assert.deepEqual([...rows[0].pairs], [['A / B', 4], ['A / C', 2], ['B / C', 2]]);
  assert.deepEqual([...rows[0].outsideBy], [['A', 2], ['B', 2], ['C', 4]]);
  assert.deepEqual([...rows[2].outsideBy], [['A', 4], ['B', 4], ['C', 4]]);
});
