'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const context = vm.createContext({ addEventListener() {} });
context.window = context;
for (const asset of ['atlas_area.js', 'app.js', 'atlas_search.js', 'tang_741.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', asset), 'utf8'), context, { filename: asset });
}
const app = Object.create(context.HistoricalAtlasController.prototype);
const { places, replacedNames, circuitGuides } = context.TANG_741_ATLAS;

test('741 supplements are unique, sourced and confined to their reviewed year', () => {
  assert.equal(new Set(places.map((place) => [place.ancient, place.parent, place.level].join('/'))).size, places.length);
  for (const place of places) {
    assert.match(place.level, /^(county|prefecture)$/);
    assert(place.parent && place.precision);
    assert(place.coord.every(Number.isFinite));
    assert(place.coord[0] >= 73 && place.coord[0] <= 125);
    assert(place.coord[1] >= 18 && place.coord[1] <= 45);
    assert(place.sources.every(([, url]) => ['https:', 'http:'].includes(new URL(url).protocol)));
    if (place.level === 'county') {
      assert(place.sources.some(([, url]) => url.includes('figshare.30518417.v2')));
    }
  }
  const retained = { ancient: '太和城' };
  const old = [retained, ...Array.from(replacedNames, (ancient) => ({ ancient }))];
  for (const year of [740, 742]) {
    app.year = year;
    assert.equal(app._tang741VisiblePlaces(old), old);
  }
  app.year = 741;
  const fitted = app._tang741VisiblePlaces(old);
  assert(fitted.includes(retained));
  assert(fitted.some(({ ancient, parent }) => ancient === '曲阿县' && parent === '润州'));
  assert(fitted.some(({ ancient, parent }) => ancient === '新丰县' && parent === '京兆府'));
  assert(!fitted.some(({ ancient }) => ['升州', '兴元', '处州', '昭应县', '澶州'].includes(ancient)));
});

test('741 search results open the same sourced places and guides as the map', () => {
  const ctrl = Object.create(context.HistoricalAtlasController.prototype);
  let card;
  Object.assign(ctrl, {
    year: 741, dynasties: [{ key: 'tang' }], dynastyIdx: 0,
    _enDict: (name) => name, _enModernCity: (name) => name,
    _id: () => ({}), stopAutoplay() {}, clearCustomRoute() {}, _clearQuickSearchInput() {},
    grpPrefectures: { classList: { remove() {} } }, grpRegionLabels: { classList: { remove() {} } },
    grpSettlements: { classList: { remove() {} } },
    projector: { toScreen: (lng, lat) => [lng, lat] },
    _materializeDeferredPrefectures() {}, _getViewportAspect: () => 0.7,
    _animateCameraTo: (camera) => { ctrl.targetCamera = camera; },
    _showMapArea: (...args) => { card = args; },
  });
  const baseIndex = [];
  const index = ctrl._tang741SearchIndex(baseIndex);
  assert.equal(index.length, places.length + circuitGuides.length);
  assert.equal(new Set(index.map((item) => item.tangArea)).size, index.length);
  const shared = index.find(item => item.titleZh === '苏州');
  for (const name of ['吴县', '长洲县']) {
    assert(shared.aliases.includes(name), 'a co-located county should resolve to its prefecture marker');
    assert(shared.subZh.includes(name));
  }
  for (const [name, parent, book] of [['新渝县', '袁州', '卷041'], ['方与县', '兖州', '卷038']]) {
    const county = places.find(item => item.ancient === name && item.parent === parent);
    assert(county && county.sources.some(([,url]) => url.includes(book)));
  }
  assert(!places.some(item => item.ancient === '新喻县' || item.ancient === '方舆县'));
  for (const title of ['蓝田县', '曲阿县', '盩厔县']) {
    const place = places.find((item) => item.ancient === title);
    const item = index.find((entry) => entry.titleZh === title);
    ctrl._selectSearchResult(item);
    assert.deepEqual(card, ['county', title, card[2], place]);
    assert.equal(card[2][0], place.parent);
    assert(ctrl.targetCamera.w <= 1000 / 5.4, 'county seat must be visible after search zoom');
    const searchedCard = card;
    ctrl.openMapSettlementAt(...place.coord, title);
    assert.deepEqual(card, searchedCard);
  }
  for (const guide of circuitGuides) {
    const item = index.find((entry) => entry.titleZh === guide.title);
    ctrl._selectSearchResult(item);
    assert.deepEqual(card, ['boundary', guide.title, guide.members, guide]);
  }
  for (const adjacentYear of [740, 742]) {
    ctrl.year = adjacentYear;
    assert.equal(ctrl._tang741SearchIndex(baseIndex), baseIndex);
    card = null;
    ctrl._selectSearchResult(index[0]);
    assert.equal(card, null, 'stale results may not show a 741 card in another year');
  }
});

test('coarse area selection prefers a circuit, detail prefers a visible prefecture, and holes exclude the prefecture', () => {
  const ring = (lo, hi) => [[lo, lo - 80], [hi, lo - 80], [hi, hi - 80], [lo, hi - 80], [lo, lo - 80]];
  const shape = (title, role, rings) => ({ title, role, shape: { type: 'Polygon', coordinates: rings } });
  const polity = shape('唐', 'main', [ring(100, 120)]);
  const circuit = shape('某道', '', [ring(102, 117)]);
  const prefecture = shape('某州', '', [ring(105, 116), ring(110, 112)]);
  const makeLayer = () => {
    const active = new Set();
    return {
      classList: {
        contains: (name) => active.has(name),
        toggle: (name, on) => on ? active.add(name) : active.delete(name),
      },
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    };
  };
  Object.assign(app, {
    year: 741, dynasties: [{ key: 'tang' }], dynastyIdx: 0, svg: makeLayer(),
    projector: { toScreen: (lng, lat) => [lng * 10, -lat * 10], scale: 10 },
    camera: { w: 320, h: 240 },
    grpPrefectures: makeLayer(), grpPolities: makeLayer(), grpSettlements: makeLayer(),
    lastRenderedSnap: { polities: [polity], regions: [circuit], prefectures: [prefecture] },
    _isMobileViewport: () => false, _showMapArea: (type) => type,
    closeMapArea: () => {},
  });
  assert.equal(app._syncTang741Detail(1.5), 'overview');
  assert.equal(app.openMapAreaAt(109, 29), 'circuit');
  assert.equal(app._syncTang741Detail(3), 'prefectures');
  assert.equal(app.openMapAreaAt(109, 29), 'prefecture');
  assert.equal(app.openMapAreaAt(111, 31), 'circuit');
  assert.equal(app._syncTang741Detail(7), 'counties');
  app.grpPrefectures.classList.toggle('is-hidden', true);
  assert.equal(app.openMapAreaAt(109, 29), 'polity');
  assert.equal(app.openMapAreaAt(90, 10), false);
  app.svg.classList.toggle('is-awaiting-snapshot', true);
  assert.equal(app.openMapAreaAt(109, 29), false);
});

test('two capital circuits have sourced open segments with local line hits, never polygon fills', () => {
  assert.deepEqual(Array.from(circuitGuides, ({ title }) => title), ['京畿道', '都畿道']);
  const ctrl = Object.create(context.HistoricalAtlasController.prototype);
  Object.assign(ctrl, {
    year: 741,
    svg: { getBoundingClientRect: () => ({ width: 1000, height: 800 }) },
    camera: { w: 180, h: 144 },
    projector: { toScreen: (lng, lat) => [lng * 10, -lat * 10], scale: 10 },
  });
  for (const guide of circuitGuides) {
    assert(guide.members.length && guide.sources.length >= 2 && !guide.shape);
    for (const segment of guide.segments) {
      assert(segment.length >= 2);
      assert.notDeepEqual(segment[0], segment.at(-1));
      const [a, b] = segment;
      const mid = [(a[0] + b[0]) * .5, (a[1] + b[1]) * .5];
      assert.equal(ctrl._tang741GuideAt(...mid)?.title, guide.title);
    }
  }
  assert.equal(ctrl._tang741GuideAt(108.95, 34.27), null);
  assert(!ctrl._tangGuidePath(circuitGuides[0].segments).includes('Z'));
  ctrl.year = 742;
  assert.equal(ctrl._tang741GuideAt(...circuitGuides[0].segments[0][0]), null);
});
