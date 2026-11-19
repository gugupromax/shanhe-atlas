'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.resolve(__dirname, '../..');
const context = vm.createContext({addEventListener() {}});
context.window = context;
for (const asset of ['atlas_area.js', 'app.js', 'atlas_search.js', 'tang_741.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', asset), 'utf8'), context, {filename: asset});
}

const marker = (title, min, max) => ({
  title,
  anchor: [(min + max) / 2, 34],
  shape: {type:'Polygon', coordinates:[[[min,32],[max,32],[max,36],[min,36],[min,32]]]},
});
const first = marker('甲州', 101, 105);
const second = marker('乙府', 101, 105);
const shared = {polities:[marker('某国', 100, 110)], regions:[]};
const mockLayer = () => {
  const flags = new Set();
  return {
    classList: {
      add: flag => flags.add(flag),
      remove: flag => flags.delete(flag),
      contains: flag => flags.has(flag),
      toggle: (flag, value) => value ? flags.add(flag) : flags.delete(flag),
    },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({width:900,height:600}),
  };
};
function setup(year = 199) {
  const ctrl = Object.create(context.HistoricalAtlasController.prototype);
  const dynasty = {key:'sample', fromYear:1, toYear:240, phases:[
    {until:200,snap:'first'},{until:240,snap:'second'}
  ]};
  Object.assign(ctrl,{
    year, dynasties:[dynasty], dynastyIdx:0, svg:mockLayer(),
    snapshots:{first:{...shared,prefectures:[first]},second:{...shared,prefectures:[second]}},
    grpPrefectures:mockLayer(), grpSettlements:mockLayer(), grpRegionLabels:mockLayer(),
    _id: () => ({}), _enDict: name => name, formatYear: y => String(y),
    _materializeDeferredPrefectures() {}, _getViewportAspect: () => .7,
    projector: {toScreen:(lng,lat)=>[lng,lat]},
    _animateCameraTo(camera) { this.focused = camera; },
    _showMapArea(...args) { this.card = args; return true; },
    openGenealogyAt(...coords) { this.genealogy = coords; },
    stopAutoplay() {}, _clearQuickSearchInput() {}, clearCustomRoute() {},
  });
  return ctrl;
}

test('all-period prefecture labels are snapshot-scoped, schematic, and selectable', () => {
  const ctrl = setup();
  const [place] = ctrl._periodAdminAreas();
  assert.equal(place.ancient, '甲州');
  assert.equal(place.schematic, true);
  assert.equal(place.seat, undefined);
  assert.equal(place.shape, first.shape);
  assert.equal(ctrl._syncTang741Detail(1.8), 'overview');
  assert(ctrl.svg.classList.contains('is-admin-overview'));
  assert(!ctrl.svg.classList.contains('is-tang741-overview'));
  assert.equal(ctrl._syncTang741Detail(3), 'prefectures');
  assert(!ctrl.svg.classList.contains('is-admin-overview'));
  assert.equal(ctrl._syncTang741Detail(7), 'counties');
  assert(ctrl.svg.classList.contains('is-admin-counties'));
  assert(!ctrl.svg.classList.contains('is-tang741-counties'));

  ctrl._adminLevel = 'prefectures';
  assert.equal(ctrl._syncTang741Detail(7), 'prefectures');
  assert(!ctrl.svg.classList.contains('is-admin-counties'));
  ctrl.year = 741;
  assert.equal(ctrl._syncTang741Detail(7), 'prefectures');
  assert(ctrl.svg.classList.contains('is-tang741-counties'), '741 keeps its near terrain textures');
  ctrl._adminLevel = 'counties';
  assert.equal(ctrl._syncTang741Detail(7), 'counties');
  assert(ctrl.svg.classList.contains('is-admin-counties'));
  ctrl.year = 199;

  const original = [{ancient:'甲州',coord:[103,34]}];
  assert.equal(ctrl._adminVisiblePlaces(original, ctrl.dynasties[0]).length, 1);
  const index = ctrl._adminSearchIndex([{kind:'prefecture', titleZh:'甲州', dynasty:ctrl.dynasties[0]}]);
  assert.equal(index.length, 1);
  assert.equal(index[0].adminArea, place.areaKey);
  ctrl._selectSearchResult(index[0]);
  assert.equal(ctrl.card[1], '甲州');
  assert.equal(ctrl.card[3].shape, first.shape);
  ctrl.openMapSettlementAt(...place.coord, place.ancient, place.areaKey);
  assert.equal(ctrl.card[3], place);
  ctrl.openMapSettlementAt(103.2,34,'甲州');
  assert.equal(ctrl.card[3], place);

  ctrl.year = 200;
  assert.equal(ctrl._periodAdminAreas()[0].ancient, '乙府');
  const lastCard = ctrl.card;
  ctrl._selectSearchResult(index[0]);
  assert.equal(ctrl.card, lastCard, 'a stale result cannot open an area in a different year');
  assert.notEqual(ctrl._adminSettlementRevision(ctrl.dynasties[0]), 'first:');
});

test('county points stay inside their sourced date interval and never stand in for polygons', () => {
  const ctrl = setup();
  const record = {
    id:'one', level:'county', ancient:'某县', parent:'甲州', coord:[103,34], from:195, through:199,
    precision:'县治为历史记录点位', sources:[['来源','https://example.org/record']],
  };
  context.ATLAS_PERIOD_ADMIN = {placesForYear: () => [record, record, {...record,id:'future',from:210}]};
  try {
    let places = ctrl._periodAdminAreas();
    const rows = places.filter((place) => place.level === 'county');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].shape, undefined);
    const result = ctrl._adminSearchIndex([]).find((item) => item.adminLevel==='county');
    assert.equal(result.adminArea,'county/one');
    ctrl._selectSearchResult(result);
    assert.equal(ctrl.card[0], 'county');
    assert.equal(ctrl.card[2][0], '甲州');
    assert(ctrl.focused.w < 1000/5.4);
    const searchCard=ctrl.card;
    ctrl.openMapSettlementAt(...record.coord,record.ancient,result.adminArea);
    assert.equal(ctrl.card[3],searchCard[3]);

    ctrl.year = 200;
    places = ctrl._periodAdminAreas();
    assert(!places.some((place) => place.level === 'county'));
    assert.equal(ctrl._adminSearchIndex([]).some((item) => item.adminLevel==='county'), false);
  } finally {
    delete context.ATLAS_PERIOD_ADMIN;
  }
});

test('late Western Han uses Suiyang seats and does not reuse the old Dang commandery', () => {
  const provider = context.ATLAS_PERIOD_ADMIN;
  context.ATLAS_PERIOD_ADMIN = {placesForYear() {
    return [{id:'chgis:0:210768',ancient:'砀郡',level:'prefecture',coord:[115.604,34.3656]}];
  }};
  try {
    const ctrl = setup();
    ctrl.dynasties[0].key = 'xihan';
    ctrl._snapshotForAdmin = () => null;
    ctrl.year = -127;
    assert.equal(ctrl._periodAdminAreas().length, 0, 'the obsolete source record is absent in other Western Han years too');
    for(const [year,title,parent] of [
      [-126,'梁国','西汉'],[-24,'梁国','豫州（刺史部）'],
      [2,'梁国','豫州（刺史部）'],[3,'梁郡','豫州（刺史部）'],[5,'梁国','豫州（刺史部）'],
    ]){
      ctrl.year = year;
      const items = ctrl._periodAdminAreas();
      assert.equal(items.length,1);
      assert.equal(items[0].ancient,title);
      assert.equal(items[0].parent,parent);
      assert.equal(items[0].seat,'睢阳');
      assert.equal(items[0].shape,undefined);
    }
    const old = JSON.parse(fs.readFileSync(path.join(root,'data/atlas/xihan/s_xihan_a.geojson'),'utf8'));
    const qin = JSON.parse(fs.readFileSync(path.join(root,'data/atlas/qin/s_qin.geojson'),'utf8'));
    assert.ok(!old.snapshot.prefectures.includes('砀郡'));
    assert.ok(qin.snapshot.prefectures.some(id=>id.endsWith('/砀郡')));
  } finally {
    context.ATLAS_PERIOD_ADMIN = provider;
  }
});

test('every Eastern Han phase retires the Dang polygon, and Liang seats follow dated evidence', () => {
  const {ctrl, dynasties, snapshots, sandbox, ensureHydrated} = require('./harness')
    .createValidationContext({fastMode:true});
  ensureHydrated();
  const east = dynasties.find(d => d.key === 'donghan');
  const west = dynasties.find(d => d.key === 'xihan');
  const keys = new Set();
  const legacy = {id:'chgis:0:210768', ancient:'砀郡', level:'prefecture', coord:[115.604,34.3656]};
  for (const provider of [undefined, {placesForYear:() => [legacy]}]) {
    sandbox.window.ATLAS_PERIOD_ADMIN = provider;
    for (let year = 23; year <= 219; year++) {
      ctrl.year = year;
      const dynasty = year < 25 ? west : east;
      const key = ctrl._resolveSnapKey(dynasty, year);
      if (year >= 25) keys.add(key);
      assert(!snapshots[key].prefectures.some(p => p.title === '砀郡'), key);
      const places = ctrl._periodAdminAreas(dynasty);
      assert(!places.some(p => p.ancient === '砀郡'), String(year));
      const rows = places.filter(p => ['梁郡', '梁国'].includes(p.ancient));
      if (year >= 26 && year <= 28) {
        assert.equal(rows.length, 0, 'the contested capital is omitted in ' + year);
        continue;
      }
      assert.equal(rows.length, 1, 'one seat in ' + year);
      const [place] = rows;
      assert.equal(place.ancient, year >= 29 && year <= 78 ? '梁郡' : '梁国');
      assert.equal(place.seat, year < 26 ? '睢阳' : '下邑（约）');
      assert.equal(place.shape, undefined);
      if (year >= 29) assert.match(place.precision, /迁治的确年待考/);
    }
  }
  assert.equal(keys.size, east.phases.length);
  assert(snapshots.s_qin.prefectures.some(p => p.title === '砀郡'));
});

test('two clicks in a single prefecture keep its hierarchy and separate point-specific map layers', () => {
  const ctrl = setup();
  const prefecture = marker('某郡', 101, 109);
  ctrl.lastRenderedSnap = {
    polities:shared.polities, prefectures:[prefecture],
    regions:[marker('甲州', 100, 105), marker('乙州', 105, 110)],
  };
  const nodes = new Map();
  Object.assign(ctrl, {
    locale:'zh', _zh:value=>value, trTerm:value=>value, _isMobileViewport:()=>false,
    _id(id) {
      if (!nodes.has(id)) nodes.set(id, {replaceChildren() {}});
      return nodes.get(id);
    },
    viewportFrame:mockLayer(), _svgNode() {}, closeGenealogyCard() {}, closeMilestoneBalloon() {},
  });
  ctrl.projector.shapeToSvgPath = () => '';
  delete ctrl._showMapArea;
  for (const [lng, region] of [[102,'甲州'],[108,'乙州']]) {
    assert(ctrl.openMapAreaAt(lng, 34));
    assert.equal(nodes.get('map-area-title').textContent, '某郡');
    assert.equal(nodes.get('map-area-hierarchy').hidden, true);
    assert.equal(nodes.get('map-area-hierarchy').textContent, '');
    assert(nodes.get('map-area-note').textContent.includes('点选位置所在图层 · 某国 · ' + region));
    assert.equal(ctrl.activeMapArea.highlight.shape, prefecture.shape);
  }
  prefecture.parent = '史料所载之州';
  assert(ctrl.openMapAreaAt(102, 34));
  assert.equal(nodes.get('map-area-hierarchy').textContent, '史料所载之州');
  assert(!nodes.get('map-area-hierarchy').hidden);
});
