'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createValidationContext} = require('./harness');

test('Hainan commandery outlines follow establishment, merger and abolition in the Western Han frames', () => {
  const context = createValidationContext({fastMode:true});
  context.ensureHydrated();
  const {ctrl, snapshots, xihanDyn} = context;
  const island = new Set(['儋耳郡','珠崖郡']);
  for (let year = -202; year <= 24; year++) {
    if (!year) continue;
    const key = ctrl._resolveSnapKey(xihanDyn, year);
    const snap = snapshots[key];
    const shapes = (snap.prefectures || []).filter(p => island.has(p.title) && p.shape);
    assert.equal(shapes.length, year >= -110 && year < -82 ? 2 : 0, String(year));
    if (year >= -82 && year < -46) assert.match(snap.note, /并入珠崖郡/);
  }
  for (const [year, both] of [[-111,false],[-110,true],[-83,true],[-82,false],[-46,false]]) {
    assert.equal(Boolean(ctrl.resolvePlace('儋耳郡',year)), both);
    assert.equal(Boolean(ctrl.resolvePlace('珠崖郡',year)), both);
  }
  for (const [extra, old] of [['s_xihan_daner_merge','s_xihan_b'],['s_xihan_zhuya_end','s_xihan_c']]) {
    assert.deepEqual(snapshots[extra].polities, snapshots[old].polities);
    assert.deepEqual(snapshots[extra].regions, snapshots[old].regions);
    assert.deepEqual(snapshots[extra].prefectures.filter(p => !island.has(p.title)),
      snapshots[old].prefectures.filter(p => !island.has(p.title)));
  }
});

test('the Western Han abolition frame excludes the last-year source point, keeping the previous frame and later namesakes', () => {
  const context = createValidationContext({fastMode:true});
  context.ensureHydrated();
  const {ctrl, sandbox} = context;
  const zhuya = {ancient:'珠崖郡', level:'prefecture', coord:[110.16,19.25], sources:[]};
  sandbox.window.ATLAS_PERIOD_ADMIN = {placesForYear(year) {
    if (year === 242) return [{...zhuya, id:'later-zhuya', from:242, through:242}];
    return [{...zhuya, id:'chgis:0:34273', from:-110, through:-46}];
  }};
  for (const [year, present] of [[-47,true],[-46,false],[-47,true],[242,true]]) {
    ctrl.year = year;
    ctrl.dynastyIdx = ctrl._findDynastyIndex(year);
    const matches = ctrl._periodAdminAreas().filter(p => !p.schematic && p.ancient === zhuya.ancient);
    assert.equal(matches.length, present ? 1 : 0, String(year));
    if (year === -47) assert.equal(matches[0].shape, undefined);
    if (year < 0) assert.equal(Boolean(ctrl.resolvePlace('珠崖郡',year)), present);
  }
});
