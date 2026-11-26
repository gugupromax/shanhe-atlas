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
  // Lantian County is now a static 741 seat (map_data settlements) as well as a
  // lazy-loaded layer entry, so the deep link resolves to the same distinct pin
  // before and after js/tang_741.js loads.
  assert.ok(before, '蓝田县 resolves before the 741 layer loads');
  assert.deepEqual(Array.from(before.coord), Array.from(county.coord), '蓝田县');
  county.coord[0] = 0;
  assert.deepEqual(Array.from(ctrl.resolvePlace('蓝田县', 741).coord), [109.32, 34.17]);
  assert.equal(ctrl.resolvePlace('蓝关', 819).name, '蓝田关');
  const suzhou = sandbox.window.TANG_741_ATLAS.places.find(place => place.ancient === '苏州');
  assert.deepEqual(Array.from(ctrl.resolvePlace('长洲县', 741).coord), Array.from(suzhou.coord));
  assert.deepEqual(Array.from(ctrl.resolvePlace('吴县', 741).coord), Array.from(suzhou.coord));
  assert.equal(ctrl.inspect({year:741, place:'吴县'}).nearestCity.ancient, '吴县');
  const near = ctrl.inspect({year:741, lng:109.32, lat:34.17}).nearestCity;
  assert.equal(near.ancient, '蓝田县');
  assert.equal(near.distanceKm, 0);
});

function countySearchLink(query = '金牛县', year = '741') {
  const {ctrl, sandbox, ROOT} = createValidationContext({fastMode:true});
  const timers = [];
  const input = {value:''};
  const loads = [];
  const selections = [];
  let release, reject;
  const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  sandbox.location.search = `?year=${encodeURIComponent(year)}&q=${encodeURIComponent(query)}`;
  sandbox.setTimeout = (fn) => timers.push(fn);
  Object.assign(ctrl, {
    _fullSnapshotsLoaded:true,
    _id: id => id === 'inp-map-search' ? input : null,
    _armUrlSync() {},
    jumpToYear(year) { this.year = year; input.value = ''; },
    _loadTang741Places() { loads.push(this.year); return pending; },
    _loadPeriodAdminPlaces() { loads.push(this.year); return pending; },
    _selectSearchResult(hit) { selections.push({title:hit.titleZh, year:this.year}); },
  });
  return {
    ctrl, input, loads, selections,
    releaseCountyData() {
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/tang_741.js'), 'utf8'), sandbox);
      release();
    },
    rejectCountyData() { reject(new Error('County asset unavailable')); },
    async flush() {
      await new Promise(resolve => setImmediate(resolve));
      for (const fn of timers.splice(0)) fn();
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('URL quick search selects a 741 county once after its data arrives', async () => {
  const link = countySearchLink();
  link.ctrl._restoreFromQuery();
  assert.deepEqual(Array.from(link.ctrl._queryQuickSearch('金牛县')), []);
  await link.flush();
  assert.deepEqual(link.selections, []);
  link.releaseCountyData();
  await link.flush();
  assert.equal(link.ctrl._queryQuickSearch('金牛县')[0].titleZh, '金牛县');
  assert.deepEqual(link.selections, [{title:'金牛县',year:741}]);
  assert.deepEqual(link.loads, [741]);
});

test('URL quick search waits for a year label that needs the Chinese dictionary', async () => {
  const link = countySearchLink('金牛县', '開元二十九年');
  let dictionaryReady = false;
  let finishDictionary;
  const dictionary = new Promise(resolve => { finishDictionary = resolve; });
  Object.assign(link.ctrl, {
    _hasZhHant: () => dictionaryReady,
    _ensureZhHant: () => dictionary,
    _parseYearList: () => dictionaryReady ? [741] : [],
  });
  link.ctrl._restoreFromQuery();
  await link.flush();
  assert.equal(link.input.value, '金牛县');
  assert.deepEqual(link.loads, []);
  dictionaryReady = true;
  finishDictionary();
  await link.flush();
  assert.deepEqual(link.loads, [741]);
  assert.equal(link.input.value, '金牛县');
  link.releaseCountyData();
  await link.flush();
  assert.deepEqual(link.selections, [{title:'金牛县',year:741}]);
});

test('URL quick search does not replay when input or year changes while county data loads', async () => {
  for (const changed of ['input', 'year']) {
    const link = countySearchLink();
    link.ctrl._restoreFromQuery();
    assert.equal(link.input.value, '金牛县');
    await link.flush();
    assert.deepEqual(link.loads, [741]);
    if (changed === 'input') link.input.value = '蓝田县';
    else link.ctrl.year = 819;
    link.releaseCountyData();
    await link.flush();
    assert.deepEqual(link.selections, []);
    assert.equal(link.input.value, changed === 'input' ? '蓝田县' : '金牛县');
    assert.equal(link.ctrl.year, changed === 'year' ? 819 : 741);
  }
});

test('URL quick search falls back to existing data when the optional county request rejects', async () => {
  const link = countySearchLink('蓝田县');
  link.ctrl._restoreFromQuery();
  const baseHit = link.ctrl._queryQuickSearch('蓝田县')[0];
  assert.ok(baseHit);
  await link.flush();
  assert.deepEqual(link.loads, [741]);
  link.rejectCountyData();
  await link.flush();
  assert.deepEqual(link.selections, [{title:baseHit.titleZh,year:741}]);
  assert.deepEqual(link.loads, [741]);
});

test('other years request the optional admin layer only for county names', async () => {
  const ordinary = countySearchLink('蓝关', '819');
  ordinary.ctrl._restoreFromQuery();
  await ordinary.flush();
  assert.deepEqual(ordinary.loads, []);
  assert.equal(ordinary.selections.length, 1);
  const county = countySearchLink('蓝田县', '819');
  county.ctrl._restoreFromQuery();
  await county.flush();
  assert.deepEqual(county.loads, [819]);
  assert.deepEqual(county.selections, []);
  county.rejectCountyData();
  await county.flush();
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

test('restoring a year already drawn by the boot snapshot keeps it selectable', () => {
  const {ctrl, sandbox, snapshots} = createValidationContext({fastMode:true});
  sandbox.location = {search:'?year=-402'};
  sandbox.URLSearchParams = URLSearchParams;
  const key = ctrl._resolveSnapKey(ctrl.dynasties[0], -402);
  const drawn = snapshots[key];
  const jumps = [];
  Object.assign(ctrl, {year:-402, lastRenderedSnap:drawn, _fullSnapshotsLoaded:true,
    grpGhostDiff:{innerHTML:'old transition'}, _armUrlSync() {},
    jumpToYear(year, showTransition) { jumps.push([year, showTransition]); },
  });
  ctrl._restoreFromQuery();
  assert.equal(ctrl.lastRenderedSnap, drawn);
  assert.equal(ctrl.grpGhostDiff.innerHTML, '');
  assert.deepEqual(jumps, [[-402, false]]);
});

test('settlement revisions follow data epochs and refresh an existing pass when a nearby event enters its window', () => {
  const {ctrl, sandbox, dynasties, loreData} = createValidationContext({fastMode:true});
  const dyn = dynasties.find(d => d.key === 'zhanguo');
  sandbox.window.ATLAS_PERIOD_ADMIN = {revisionForYear:y => y < -330 ? -350 : -330};
  ctrl.year = -332;
  assert.equal(ctrl._adminSettlementRevision(dyn, -334), ctrl._adminSettlementRevision(dyn, -333));
  assert.notEqual(ctrl._adminSettlementRevision(dyn, -332), ctrl._adminSettlementRevision(dyn, -330));
  const pass = loreData.STRATEGIC_PASSES.find(p => p.ancientZh === '函谷关');
  assert.equal(ctrl._passNearMilestone(dyn, ctrl._passAtYear(pass,-332).coord, -332), false);
  assert.equal(ctrl._passNearMilestone(dyn, ctrl._passAtYear(pass,-331).coord, -331), true);
  assert.notEqual(ctrl._settlementMask(dyn,-332), ctrl._settlementMask(dyn,-331));
});
