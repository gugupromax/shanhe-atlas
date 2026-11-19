'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const {createValidationContext} = require('./harness');

test('741 county deep links match all the distinct named pins, including after lazy loading', () => {
  const {ctrl, sandbox, ROOT} = createValidationContext({fastMode:true});
  const before = ctrl.resolvePlace('蓝田县', 741);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/tang_741.js'), 'utf8'), sandbox);
  const counties = sandbox.window.TANG_741_ATLAS.places.filter(seat => seat.level === 'county');
  assert.ok(counties.length > 250);
  for (const seat of counties) {
    const resolved = ctrl.resolvePlace(seat.ancient, 741);
    assert.equal(resolved?.name, seat.ancient);
    assert.deepEqual(Array.from(resolved.coord), Array.from(seat.coord), seat.ancient);
  }
  const county = ctrl.resolvePlace('蓝田县', 741);
  assert.notDeepEqual(before && Array.from(before.coord), Array.from(county.coord));
  county.coord[0] = 0;
  assert.deepEqual(Array.from(ctrl.resolvePlace('蓝田县', 741).coord), [109.32, 34.17]);
  assert.equal(ctrl.resolvePlace('蓝关', 819).name, '蓝田关');
  const suzhou = sandbox.window.TANG_741_ATLAS.places.find(place => place.ancient === '苏州');
  assert.deepEqual(Array.from(ctrl.resolvePlace('长洲县', 741).coord), Array.from(suzhou.coord));
  assert.deepEqual(Array.from(ctrl.resolvePlace('吴县', 741).coord), Array.from(suzhou.coord));
});

test('county lookup respects the requested year and withholds ambiguous coordinates', () => {
  const {ctrl, sandbox} = createValidationContext({fastMode:true});
  const seat = (ancient, coord) => ({level:'county', ancient, coord});
  const early = [seat('某县', [112,34]), seat('同名县',[113,34]), seat('同名县',[115,32])];
  const late = [seat('某县', [112.3,34.6])];
  sandbox.window.ATLAS_PERIOD_ADMIN = {placesForYear:year => year === 960 ? early : late};
  assert.deepEqual(Array.from(ctrl.resolvePlace('某县', 960).coord), [112,34]);
  assert.deepEqual(Array.from(ctrl.resolvePlace('某县', 961).coord), [112.3,34.6]);
  assert.deepEqual(Array.from(ctrl.resolvePlace('某县', 960).coord), [112,34]);
  assert.equal(ctrl.resolvePlace('同名县', 960), null);
});

test('late county or dictionary loads do not replay an older locate request or loop after a failed load', async () => {
  const {ctrl} = createValidationContext({fastMode:true});
  const rendered = [];
  let release;
  const slow = new Promise(resolve => { release = resolve; });
  Object.assign(ctrl, {year:741, _fullSnapshotsLoaded:true,
    _hasEnDict:() => true, _hasZhHant:() => true, _isLoreDetailLoaded:() => true,
    stopAutoplay() {}, jumpToYear(year) { this.year = year; },
    _loadTang741Places:() => slow, inspect:() => ({}),
    _applyLocation(opts) { rendered.push(opts.place); return {}; },
  });
  ctrl.locate({year:741, place:'蓝田县'});
  assert.deepEqual(rendered, []);
  ctrl.locate({year:819, place:'蓝关'});
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(rendered, ['蓝关']);
  let attempts = 0;
  ctrl._hasEnDict = () => false;
  ctrl._ensureEnglishLocale = () => { attempts++; return Promise.resolve(); };
  ctrl.locate({year:819, place:'Lantian Pass'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1);
  assert.deepEqual(rendered.slice(1), ['Lantian Pass','Lantian Pass']);
});
