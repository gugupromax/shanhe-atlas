'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createValidationContext} = require('./harness');

function fixture() {
  const {ctrl, sandbox} = createValidationContext({fastMode:true});
  const timers = new Map();
  let sequence = 0;
  Object.assign(sandbox, {
    setTimeout(fn) { timers.set(++sequence, fn); return sequence; },
    clearTimeout(id) { timers.delete(id); },
    requestIdleCallback() {},
    document:{createElementNS() {
      const cls = new Set();
      return {classList:{add:s => cls.add(s),contains:s => cls.has(s)}, setAttribute(){},
        addEventListener(type, fn) { this[type] = fn; }};
    }},
  });
  const layer = {
    appendChild(node) { node.parentNode = this; },
    insertBefore(node) { this.appendChild(node); },
    removeChild(node) { node.parentNode = null; },
  };
  let keys;
  Object.assign(ctrl, {terrainTileLayer:layer, _terrainReady:() => true, _terrainIndex:new Map(),
    _terrainTilesFor:() => keys.map((k,i) => [k,{z:5,x:10+i,y:5,top:true}])});
  const view = (...next) => { keys = next; ctrl._updateTerrainTiles(); };
  return {ctrl, layer, view, timers};
}

test('returning to a cached hillshade tile survives late loads and stale timers', () => {
  const {ctrl, view, timers, layer} = fixture();
  view('A');
  const a = ctrl._terrainTiles.get('A');
  a.load();
  view('B');
  const b = ctrl._terrainTiles.get('B');
  assert.equal(a.parentNode, layer, 'old relief covers a pending request');
  view('B');
  assert.equal(a.parentNode, layer, 'an unchanged pending view keeps its fallback');
  view('A');
  b.load();
  for (const fn of timers.values()) fn();
  assert.equal(ctrl._terrainTiles.get('A'), a);
  assert.equal(a.parentNode, layer);
  assert.equal(ctrl._terrainTiles.has('B'), false);
});

test('a failed hillshade tile is requested again on revisit and cannot remove its replacement', () => {
  const {ctrl, view, layer} = fixture();
  view('A');
  const bad = ctrl._terrainTiles.get('A');
  bad.error();
  view('B');
  view('A');
  const replacement = ctrl._terrainTiles.get('A');
  assert.notEqual(replacement, bad);
  bad.error();
  assert.equal(ctrl._terrainTiles.get('A'), replacement);
  replacement.load();
  assert.equal(replacement.parentNode, layer);
});

test('a temporary index failure recovers after cooldown and simultaneous detail views share the request', async () => {
  const {ctrl, sandbox} = createValidationContext({fastMode:true});
  let clock = 100000, attempts = 0;
  sandbox.Date = {now:() => clock};
  sandbox.fetch = async () => {
    attempts++;
    return attempts === 1 ? {ok:false} : {ok:true, json:async () => ({tileSize:512, levels:{5:['25_12']}})};
  };
  const first = ctrl._loadTerrainIndex();
  assert.equal(ctrl._loadTerrainIndex(), first);
  assert.equal(await first, null);
  assert.equal(await ctrl._loadTerrainIndex(), null);
  assert.equal(attempts, 1);
  clock += 10001;
  const index = await ctrl._loadTerrainIndex();
  assert.equal(attempts, 2);
  assert.ok(index.get(5).has('25_12'));
});

test('the base view and data saver do not request an unused relief index', async () => {
  const {ctrl, sandbox} = createValidationContext({fastMode:true});
  let attempts = 0;
  Object.assign(ctrl, {camera:{w:500,h:300}, _getDefaultCamera:() => ({w:500}),
    _cameraViewportRect:{width:1280,height:800}, terrainMode:true,
    _terrainReady:() => true, _loadTerrainIndex:() => { attempts++; return Promise.resolve(null); }});
  ctrl._updateTerrainTiles();
  ctrl.camera = {w:100,h:60};
  sandbox.navigator = {connection:{saveData:true}};
  ctrl._updateTerrainTiles();
  assert.equal(attempts, 0);
  sandbox.navigator = {};
  ctrl._updateTerrainTiles();
  assert.equal(attempts, 1);
});
