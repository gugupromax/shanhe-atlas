'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(readFileSync(path.join(__dirname, '../../js/china_geo_data.js'), 'utf8'), context);
const { rivers, lakes, labels } = JSON.parse(JSON.stringify(context.window.HYDRO_DATA));
const visible = (row, y) => (row.appear ?? -Infinity) <= y && y < (row.vanish ?? Infinity);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const orientedArea = ring => ring.reduce((area, a, i) => {
  const b = ring[(i + 1) % ring.length];
  return area + a[0] * b[1] - a[1] * b[0];
}, 0) / 2;

// Integer hundredths make endpoint touches and collinear crossings exact.
function intersects(a, b, c, d) {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const boundsOverlap = [0, 1].every(k =>
    Math.min(a[k], b[k]) <= Math.max(c[k], d[k]) && Math.min(c[k], d[k]) <= Math.max(a[k], b[k]));
  return boundsOverlap && side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0;
}

test('each lake shore is a simple ring and Baikal retains its island hole', () => {
  for (const [i, lake] of lakes.entries()) {
    for (const coords of lake.rings) {
      const ring = coords.map(point => point.map(n => Math.round(n * 100)));
      if (same(ring[0], ring.at(-1))) ring.pop();
      assert.ok(ring.length >= 3 && orientedArea(ring) !== 0);
      for (let j = 0; j < ring.length; j++) {
        const next = (j + 1) % ring.length;
        assert.ok(!same(ring[j], ring[next]), 'Collapsed lake edge');
        for (let k = j + 2; k < ring.length; k++) {
          const end = (k + 1) % ring.length;
          if (end === j) continue;
          assert.ok(!intersects(ring[j], ring[next], ring[k], ring[end]),
            `Lake ${lake.name || i}: shoreline edges ${j} and ${k} intersect`);
        }
      }
    }
  }
  const rings = lakes.find(l => l.name === 'Lake Baikal').rings;
  assert.equal(rings.length, 2);
  assert.ok(orientedArea(rings[0]) * orientedArea(rings[1]) < 0, 'Nonzero fill must leave Olkhon as land');
});

test('river deltas restore the published negative steps and tributary junctions', () => {
  const irrawaddy = rivers.find(r => r.name === 'Irrawaddy Delta');
  // First four decimal pairs in the original uncompressed atlas geometry (a9d3019).
  assert.deepEqual(irrawaddy.lines[0].slice(0, 4), [[95.45,17.82],[95.26,17.75],[95.08,17.38],[94.94,17.34]]);
  const upper = rivers.flatMap(r => r.name === 'Huang' ? r.lines : [])
    .find(line => line.length > 100 && same(line[0], [97.76,35.09]));
  assert.deepEqual(upper.at(-1), [110.27,34.64]);
  const huai = rivers.filter(r => r.name === 'Huai').flatMap(r => r.lines);
  assert.ok(huai.some(line => same(line[0], [116.52,32.50])));
  assert.deepEqual(rivers.find(r => r.name === 'Ying').lines[0].at(-1), [116.52,32.50]);
});

test('Yellow River captions and lower courses agree for every annual frame', () => {
  for (let y = -403; y <= 2026; y++) {
    if (!y) continue;
    const captions = labels.filter(l => l.kind === 'trunk' && l.coord[0] > 113 && /^(黄|河水)/.test(l.zh) && visible(l, y));
    assert.equal(captions.length, 1, `One lower Yellow River caption in ${y}`);
    const east = rivers.filter(r => r.name === 'Huang' && r.rank === 1 && visible(r, y)).flatMap(r => r.lines);
    const ends = point => east.some(line => same(line.at(-1), point));
    if (y >= 1855) {
      const diverted = y >= 1938 && y < 1947;
      assert.equal(ends([116.52,32.50]), diverted, `Huai outlet in ${y}`);
      assert.equal(ends([119.03,37.80]), !diverted, `Shandong outlet in ${y}`);
      assert.equal(captions[0].zh.includes('南泛'), diverted);
    }
    assert.equal(captions[0].zh.includes('王景'), y >= 70 && y < 1048);
  }
});

function contains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, prev = ring.length - 1; i < ring.length; prev = i++) {
    const [ax, ay] = ring[prev], [bx, by] = ring[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

test('lake captions fall on their own water surface when a matching outline is available', () => {
  const names = {
    '洞庭':'Dongting Hu', '彭蠡·鄱阳':'Poyang Hu', '太湖':'Tai Hu', '巢湖':'Chao Hu',
    '青海':'Qinghai Hu', '滇池':'Dian Chi', '北海（贝加尔）':'Lake Baikal', '蒲昌海·罗布泊':'Lop Nur',
    '博斯腾湖':'Bosten Hu', '热海（伊塞克）':'Issyk-Kul', '夷播海（巴尔喀什）':'Lake Balkhash',
    '斋桑泊':'Lake Zaysan', '居延泽':'Juyan Hai', '东居延海':'East Juyan Lake', '洪泽':'Hongze Hu',
    '巨野泽':'Juye Ze', '梁山泊':'Juye Ze', '云梦泽':'Yunmeng Ze',
  };
  for (const [title, feature] of Object.entries(names)) {
    const lake = lakes.find(l => l.name === feature);
    const captions = labels.filter(l => l.kind === 'lake' && l.zh === title);
    assert.ok(lake && captions.length, title);
    for (const caption of captions) {
      assert.ok(contains(lake.rings[0], caption.coord), title);
      assert.ok(!lake.rings.slice(1).some(hole => contains(hole, caption.coord)), title);
    }
  }
});

test('east Juyan distinguishes a dry bed, refilling and the modern reference shore', () => {
  const historical = lakes.find(l => l.name === 'Juyan Hai');
  const modern = lakes.find(l => l.name === 'East Juyan Lake');
  for (const [y, title, water] of [
    [1926,'居延泽',historical], [1927,'东居延海',null], [1991,'东居延海',null],
    [1992,'东居延海（干涸）',null], [2001,'东居延海（干涸）',null],
    [2002,'东居延海（复水期）',null], [2004,'东居延海（复水期）',null], [2005,'东居延海',null],
    [2020,'东居延海',null], [2021,'东居延海',modern], [2026,'东居延海',modern],
  ]) {
    const fills = [historical, modern].filter(l => visible(l, y));
    assert.deepEqual(fills, water ? [water] : [], String(y));
    const captions = labels.filter(l => l.kind === 'lake' && l.zh.includes('居延') && visible(l, y));
    assert.deepEqual(captions.map(l => l.zh), [title]);
    if (water) assert.ok(contains(water.rings[0], captions[0].coord));
  }
  // The largest contiguous 2021 class-80 component has about 38 km² of open water.
  const areaKm2 = Math.abs(orientedArea(modern.rings[0])) * 111.32 ** 2 * Math.cos(42.3 * Math.PI / 180);
  assert.ok(Math.abs(areaKm2 - 38.08) < 2);
  const modernRiver = rivers.find(r => r.name === 'Ruo Shui' && visible(r, 2021));
  const outlet = modernRiver.lines[0].at(-1);
  assert.ok(modern.rings[0].some(vertex => same(vertex, outlet)), 'Modern inlet meets the simplified southwest shore');
});
