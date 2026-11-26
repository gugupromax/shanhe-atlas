#!/usr/bin/env node
/**
 * Regression: resolvePlace must honour a settlement's appear/vanish window.
 *
 * Before this guard, 蓝田县 (appear 741, vanish 742) resolved in every year from
 * 739 to 819, so search jumped to a coordinate the map never draws.
 */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createValidationContext } = require(path.join(__dirname, 'harness.js'));

const { ctrl } = createValidationContext({ fastMode: true });

const seat = ctrl.resolvePlace('蓝田县', 741);
assert.ok(seat, '蓝田县 must resolve in 741');
assert.deepEqual(Array.from(seat.coord), [109.32, 34.17], '蓝田县 741 seat coordinate');
assert.deepEqual(Array.from(ctrl.resolvePlace('Lantian County', 741).coord), [109.32, 34.17]);

for (const year of [739, 740, 742, 743, 819]) {
  const hit = ctrl.resolvePlace('蓝田县', year);
  assert.equal(hit, null, `蓝田县 must not resolve in ${year} (window is 741–741)`);
  const english = ctrl.resolvePlace('Lantian County', year);
  assert.equal(english, null, `Lantian County must not resolve in ${year}`);
  assert.deepEqual(Array.from(ctrl.resolvePlace('蓝田关', year).coord), [109.48, 34.03]);
}

// Undated settlements keep working in every year.
assert.ok(ctrl.resolvePlace('长安', 741), '长安 must resolve in 741');
assert.ok(ctrl.resolvePlace('长安', -200), '长安 must resolve in 前200');

// An appearance-only window has no upper bound: 云中 appears in 前300.
assert.ok(ctrl.resolvePlace('云中', -300), '云中 must resolve at its appearance year');
assert.equal(ctrl.resolvePlace('云中', -301), null, '云中 must not resolve before 前300');
assert.ok(ctrl.resolvePlace('云中', 800), '云中 must still resolve in 800 (no vanish year)');

// The Warring States entry for 寿春 is visible from 241 through 224 BCE, inclusive.
assert.ok(ctrl.resolvePlace('寿春', -241), '寿春 must resolve at 前241');
assert.ok(ctrl.resolvePlace('寿春', -240), '寿春 must resolve at 前240');
assert.ok(ctrl.resolvePlace('寿春', -224), '寿春 must resolve at 前224');
for (const year of [-242, -223]) {
  const hit = ctrl.resolvePlace('寿春', year);
  assert.equal(hit.kind, 'gazetteer', 'the gazetteer alias remains available without opening the city pin');
  assert.equal(hit.name, '肥水');
}
assert.equal(ctrl.resolvePlace('寿春', 2).kind, 'city', 'the Han entry for 寿春 must remain available');

console.log('PASS: settlement appear/vanish windows are honoured by resolvePlace.');
