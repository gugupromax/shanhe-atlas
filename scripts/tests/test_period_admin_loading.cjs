'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loader() {
  let clock = 100000;
  let release;
  const win = {};
  const context = vm.createContext({window:win, document:{}, Date:{now:() => clock},
    setTimeout:callback => {release = callback;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/atlas_area.js'), 'utf8'), context);
  let prototype;
  win.__ATLAS_MIXINS[0]({_extendPrototype:Mixin => {prototype = Mixin.prototype;}});
  const ctrl = Object.create(prototype);
  const requests = [];
  const renders = [];
  Object.assign(ctrl, {year:1102, dynasties:['Song','Tang'], dynastyIdx:0,
    _loadScriptOnce:src => {requests.push(src); return Promise.resolve();},
    _renderSettlements:dynasty => renders.push(dynasty)});
  return {win, ctrl, requests, renders, document:context.document, waitRetry:async () => {
    await new Promise(resolve => setImmediate(resolve)); assert.ok(release); release(); release = null;
  }, advance:ms => {clock += ms;}};
}

test('map and search share one retry, and successful data renders for the current dynasty', async () => {
  const f = loader();
  const first = f.ctrl._loadPeriodAdminPlaces();
  assert.equal(f.ctrl._loadPeriodAdminPlaces(true), first);
  f.ctrl.year = 742; f.ctrl.dynastyIdx = 1;
  const load = f.ctrl._loadScriptOnce;
  f.ctrl._loadScriptOnce = src => {f.win.ATLAS_PERIOD_ADMIN = {}; return load(src);};
  await f.waitRetry(); await first;
  assert.deepEqual(f.requests, Array(2).fill('data/tiles/period-admin.js'));
  assert.deepEqual(f.renders, ['Tang']);
  assert.equal(f.ctrl._loadPeriodAdminPlaces(true), undefined);
});

test('a deployed site that omitted the optional county package never requests it', () => {
  const f = loader();
  f.document.getElementById = () => ({dataset:{periodAdmin:'absent'}});
  assert.equal(f.ctrl._loadPeriodAdminPlaces(), undefined);
  assert.equal(f.ctrl._loadPeriodAdminPlaces(true, 1931), undefined);
  assert.equal(f.requests.length, 0);
});

test('an absent optional file stays quiet until a later search or year change', async () => {
  const f = loader();
  const load = f.ctrl._loadPeriodAdminPlaces();
  await f.waitRetry(); await load;
  assert.equal(f.requests.length, 2);
  assert.equal(f.ctrl._loadPeriodAdminPlaces(true), undefined);
  f.advance(31000);
  assert.equal(f.ctrl._loadPeriodAdminPlaces(), undefined);
  const next = f.ctrl._loadPeriodAdminPlaces(true);
  assert.equal(f.requests.length, 3);
  await new Promise(resolve => setImmediate(resolve));
  f.ctrl.year = 741;
  await f.waitRetry(); await next;
  assert.equal(f.requests.length, 3);
  assert.deepEqual(f.renders, []);
  f.ctrl.year = 742;
  const changed = f.ctrl._loadPeriodAdminPlaces();
  assert.ok(changed);
  assert.equal(f.requests.length, 4);
  await f.waitRetry(); await changed;
  assert.equal(f.requests.length, 5);
});
