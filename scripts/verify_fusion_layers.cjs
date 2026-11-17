'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { draw } = require('../fusion-layers.js');

// A small recording context retains paths and clip rules; no browser or data files needed.
class RecordingContext {
  constructor() {
    this.events = [];
    this.path = [];
    this.clips = [];
    this.stack = [];
    this.globalAlpha = 0.3;
    this.globalCompositeOperation = 'multiply';
    this.lineWidth = 12;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.lineDashOffset = 2;
    this.strokeStyle = '#123456';
    this.fillStyle = '#654321';
    this.dash = [11, 3];
  }
  state() {
    return Object.fromEntries(['globalAlpha', 'globalCompositeOperation', 'lineWidth', 'lineCap',
      'lineJoin', 'lineDashOffset', 'strokeStyle', 'fillStyle', 'dash', 'clips'].map(key => [key, this[key]]));
  }
  save() { this.stack.push(this.state()); }
  restore() { assert.ok(this.stack.length, 'balanced restore'); Object.assign(this, this.stack.pop()); }
  setLineDash(value) { assert.ok(value.every(Number.isFinite)); this.dash = value.slice(); }
  beginPath() { this.path = []; }
  moveTo(x, y) { this.xy(x, y); this.path.push({ points: [[x, y]], closed: false }); }
  lineTo(x, y) { this.xy(x, y); assert.ok(this.path.length); this.path.at(-1).points.push([x, y]); }
  closePath() { assert.ok(this.path.length); this.path.at(-1).closed = true; }
  rect(x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
  }
  xy(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y), 'Canvas receives finite pixels only'); }
  clip(rule = 'nonzero') { this.clips = this.clips.concat({ path: structuredClone(this.path), rule }); }
  record(kind, rule) {
    assert.ok(Number.isFinite(this.globalAlpha) && Number.isFinite(this.lineWidth));
    this.events.push({ kind, rule, path: structuredClone(this.path), ...this.state() });
  }
  fill(rule = 'nonzero') { this.record('fill', rule); }
  stroke() { this.record('stroke'); }
}

// Independent winding-number check lets tests examine actual clipped coverage,
// including overlapping shells with opposite source windings and holes.
function inside(path, point, rule) {
  let winding = 0;
  const [x, y] = point;
  for (const subpath of path) {
    const points = subpath.points;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const cross = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y && b[1] > y && cross > 0) winding++;
      if (a[1] > y && b[1] <= y && cross < 0) winding--;
    }
  }
  return rule === 'evenodd' ? Math.abs(winding) % 2 === 1 : winding !== 0;
}
function withinClips(event, point) {
  return event.clips.every(clip => inside(clip.path, point, clip.rule));
}
const square = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
const polygon = (...rings) => ({ type: 'Polygon', coordinates: rings });
const base = { bounds: [0, 0, 20, 20], width: 200, height: 100 };
const allLayers = { polities: true, prefectures: true, hydro: true, corridors: true, modernProvinces: true };
const fixture = {
  ...base,
  layers: allLayers,
  snapshot: {
    polities: [{ category: 'main', tint: '#aBc123', shape: polygon(square(2, 2, 12, 18), square(4, 6, 6, 10)) }],
    regions: [{ shape: polygon(square(0, 0, 20, 20)) }],
    prefectures: [{ shape: polygon(square(1, 1, 19, 19)) }],
  },
  overlays: {
    rivers: [{ lines: [[[0, 10], [10, 10], [20, 10]]] }],
    lakes: [{ rings: [square(13, 2, 15, 5)] }],
    corridors: [{ segments: [[[1, 1], [10, 15]]] }],
    provinces: [{ shape: { type: 'MultiPolygon', coordinates: [[square(5, 5, 15, 15)]] } }],
  },
};
function render(options) {
  const ctx = new RecordingContext();
  const before = structuredClone(ctx.state());
  draw(ctx, options);
  assert.deepEqual(ctx.state(), before, 'drawing state is restored');
  assert.equal(ctx.stack.length, 0);
  return ctx.events;
}

// Missing and disabled flags do not draw, including non-boolean truthy flags.
assert.equal(render({ ...fixture, layers: {} }).length, 0);
assert.equal(render({ ...fixture, layers: Object.fromEntries(Object.keys(allLayers).map(k => [k, false])) }).length, 0);
assert.equal(render({ ...fixture, layers: { polities: 'true', hydro: 1 } }).length, 0);
const expectedCounts = { polities: 2, prefectures: 2, hydro: 3, corridors: 1, modernProvinces: 1 };
for (const key of Object.keys(allLayers)) {
  assert.equal(render({ ...fixture, layers: { [key]: true } }).length, expectedCounts[key], key + ' independently toggles');
}

const events = render(fixture);
assert.equal(events.length, 9);
const polityFill = events.find(event => event.kind === 'fill' && event.fillStyle === '#aBc123');
assert.equal(polityFill.rule, 'evenodd');
assert.ok(polityFill.globalAlpha > 0 && polityFill.globalAlpha < 1, 'terrain remains visible under tint');
assert.ok(inside(polityFill.path, [30, 50], polityFill.rule));
assert.ok(!inside(polityFill.path, [50, 60], polityFill.rule), 'polity hole remains clear');
const admin = events.find(event => event.kind === 'stroke' && event.strokeStyle === '#66513d');
assert.ok(withinClips(admin, [30, 50]));
assert.ok(!withinClips(admin, [150, 50]), 'admin boundary clipped outside polity');
assert.ok(!withinClips(admin, [50, 60]), 'admin boundary clipped in polity hole');
const river = events.find(event => event.strokeStyle === '#477e91');
assert.deepEqual(river.path[0].points, [[0, 50], [100, 50], [200, 50]], 'geographic midpoints map to texture pixels');
assert.ok(withinClips(river, [150, 50]), 'admin clip does not leak into hydro');
assert.deepEqual(events.at(-1).dash, [7, 4], 'corridors are schematic dashed paths');
assert.ok(events.filter(event => event.strokeStyle === '#59675b').every(event => !event.dash.length));

const corners = render({ ...base, layers: { polities: true }, snapshot: {
  polities: [{ shape: polygon(square(0, 0, 20, 20)) }],
} });
assert.deepEqual(corners[0].path[0].points, [[0, 100], [200, 100], [200, 0], [0, 0], [0, 100]], 'north maps to texture top');

// The clip is a union, even with overlapping polygons and differing winding.
for (const category of ['main', 'rival', 'protectorate']) {
  const overlap = render({ ...fixture, layers: { prefectures: true }, snapshot: {
    ...fixture.snapshot,
    polities: [
      { category, shape: polygon(square(2, 2, 12, 18)) },
      { category: 'rival', shape: polygon(square(8, 2, 18, 18).reverse()) },
      { category: 'neighbor', shape: polygon(square(0, 0, 20, 20)) },
    ],
  } });
  assert.ok(withinClips(overlap[0], [100, 50]), category + ' overlapping coverage does not cancel');
  assert.ok(!withinClips(overlap[0], [5, 50]), 'neighbor never expands administrative clip');
}
const noCore = render({ ...fixture, layers: { prefectures: true }, snapshot: {
  ...fixture.snapshot, polities: [{ category: 'neighbor', shape: polygon(square(2, 2, 12, 18)) }],
} });
assert.ok(withinClips(noCore[0], [150, 50]), 'when no core geometry exists, valid administrative geometry remains visible');

// Every MultiPolygon member survives and has its own evenodd hole semantics.
const multi = render({ ...base, layers: { polities: true }, snapshot: { polities: [{
  shape: { type: 'MultiPolygon', coordinates: [[square(1, 1, 5, 5)], [square(10, 10, 15, 15)]] },
}] } });
assert.equal(multi.filter(event => event.kind === 'fill').length, 2);

const invalidRing = [[0, 0], [Infinity, 5], [10, 10]];
const sparseRing = [[0, 0], , [10, 10], [0, 10]];
const malformed = { ...base, layers: allLayers, snapshot: {
  polities: [null, 4, {}, { shape: null }, { shape: polygon(invalidRing) },
    { shape: polygon(square(0, 0, 10, 10), invalidRing) }, { shape: polygon(sparseRing) },
    { shape: { type: 'Polygon', coordinates: [] } },
    { shape: { type: 'Polygon', coordinates: [null] } },
    { shape: { type: 'MultiPolygon', coordinates: [null, []] } }],
  prefectures: 'invalid', regions: [null, { shape: { type: 'Point', coordinates: [1, 1] } }],
}, overlays: { rivers: [null, { lines: [] }], lakes: [null, { rings: [invalidRing] }],
  corridors: [null], provinces: [{ shape: { type: 'Polygon', coordinates: {} } }] } };
assert.equal(render(malformed).length, 0, 'broken geometry is skipped without spurious fill');
for (const options of [null, {}, { ...fixture, bounds: [0, 0, 0, 20] },
  { ...fixture, bounds: [0, 0, NaN, 20] }, { ...fixture, bounds: [0, , 20, 20] },
  { ...fixture, width: Infinity }, { ...fixture, height: 0 }]) assert.equal(render(options).length, 0);
assert.doesNotThrow(() => draw(null, fixture));

const gaps = render({ ...base, layers: { hydro: true }, overlays: { rivers: [{ lines: [
  [[0, 10], [2, 10], [NaN, 10], [6, 10], [8, 10], [Infinity, 2], [12, 10]],
  { type: 'MultiLineString', coordinates: [[[10, 2], [20, 2]]] },
] }] } });
assert.equal(gaps.length, 1);
assert.deepEqual(gaps[0].path.map(sub => sub.points), [
  [[0, 50], [20, 50]], [[60, 50], [80, 50]], [[100, 90], [200, 90]],
], 'invalid vertices split lines; no connection across the gap or isolated point');
const cyclic = []; cyclic.push(cyclic);
assert.equal(render({ ...base, layers: { hydro: true }, overlays: { rivers: [{ lines: cyclic }] } }).length, 0);

// Freeze catches in-place sorts, ring reversal, array edits, or metadata caching.
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const original = structuredClone(fixture);
freeze(fixture);
render(fixture);
assert.deepEqual(fixture, original, 'source geometry and metadata remain unchanged');

// Browser global and CommonJS expose the same deliberately small public API.
const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../fusion-layers.js'), 'utf8'), browser);
assert.equal(typeof browser.window.JiangshanFusionLayers.draw, 'function');
assert.deepEqual(Object.keys(require('../fusion-layers.js')), ['draw']);
console.log('PASS: fusion layer switches, UV projection, polygon holes, union clips, nested hydro/corridor lines, malformed data, immutable inputs, state restoration and UMD exports.');
