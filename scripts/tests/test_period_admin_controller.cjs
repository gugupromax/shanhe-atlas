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
    projector: {toScreen:(lng,lat)=>[lng,lat],
      greatCircleKm:context.HistoricalAtlasController._projectorClass.prototype.greatCircleKm},
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
  const index = ctrl._adminSearchIndex([{kind:'prefecture', titleZh:'甲州', coord:first.anchor, dynasty:ctrl.dynasties[0]}]);
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

test('administrative search replaces a unique local match and preserves homonyms and ambiguous candidates', () => {
  const ctrl = setup(1368);
  const dynasty = ctrl.dynasties[0];
  const native = (name, coord) => ({kind:'city',titleZh:name,coord,dynasty});
  const seat = (name, coord, key) => ({level:'county',ancient:name,coord,areaKey:'county/'+key});
  const jiangnan = native('苏州', [120.581,31.301]);
  const town = native('某县', [110,30]);
  const homonym = native('某县', [110.5,30]);
  const disputed = native('同名县', [115,35]);
  const places = [
    seat('苏州', [102.1816,28.8619], 'chgis:1:200282'),
    seat('某县', [110.01,30], 'local'),
    seat('同名县', [114.98,35], 'west'), seat('同名县', [115.02,35], 'east'),
  ];
  ctrl._periodAdminAreas = () => places;
  const results = ctrl._adminSearchIndex([jiangnan,town,homonym,disputed]);
  assert(results.includes(jiangnan) && results.includes(homonym) && results.includes(disputed));
  assert(!results.includes(town));
  assert.equal(results.filter(item => item.adminArea).length, 4);
  // Search ranking must not reapply the legacy 120 km city-clustering radius to a dated seat.
  const ranked = ctrl._rankQuickSearchResults(results.filter(item => item.titleZh === '某县')
    .map(item => ({...item,score:item.adminArea ? 110 : 105})));
  assert.equal(ranked.length,2);
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

  ctrl._showAdminPlace({ancient:'苏州',level:'county',historicalType:'州',coord:[102.1816,28.8619]});
  assert.equal(nodes.get('map-area-kicker').textContent, '199 · 县级治所 · 州');
  assert.deepEqual(ctrl.activeMapArea.highlight.point,[102.1816,28.8619]);
  ctrl._showAdminPlace({ancient:'某路',level:'prefecture',historicalType:'路',coord:[114,30]});
  assert.deepEqual(ctrl.activeMapArea.highlight.point,[114,30], 'an attested seat without a polygon still highlights');
  ctrl._showAdminPlace({ancient:'某县',level:'county',historicalType:'县',coord:[113,31]});
  assert.equal(nodes.get('map-area-kicker').textContent, '199 · 县治');
});

test('pick order follows the visible SVG and keeps prefectures clipped to the historical territory', () => {
  const ctrl = setup(1060);
  const box = (title,role,from,to) => ({...marker(title,from,to),role});
  const snapshot = {
    polities:[box('都护府','protectorate',101,108),box('主政权','main',100,110),box('邻国','neighbor',108,118)],
    regions:[box('某道',null,100,118)],
    prefectures:[box('底层',null,101,116),box('顶层',null,102,116)],
  };
  ctrl.lastRenderedSnap = snapshot;
  ctrl.grpPolities = mockLayer();
  ctrl._isMobileViewport = () => false;
  ctrl.openMapAreaAt(103,34);
  assert.equal(ctrl.card[1],'顶层');
  ctrl._syncTang741Detail(1.5);
  ctrl.openMapAreaAt(103,34);
  assert.equal(ctrl.card[1],'某道');
  ctrl.grpPrefectures.classList.add('is-hidden');
  ctrl.openMapAreaAt(103,34);
  assert.equal(ctrl.card[1],'都护府');
  ctrl.grpPrefectures.classList.remove('is-hidden');
  ctrl.openMapAreaAt(113,34);
  assert.equal(ctrl.card[0],'neighbor');
  assert.equal(ctrl.card[1],'邻国');
});

test('the 1911 reference polygons stay in the source archive and out of all Republican snapshots', () => {
  const dir = path.join(root,'data/atlas/roc');
  for (const filename of fs.readdirSync(dir).filter(name => name.endsWith('.geojson'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir,filename),'utf8'));
    if (filename === 's_roc.geojson') {
      const archived = doc.referenceLayers.find(layer => layer.year === 1911);
      assert.equal(archived.features.length,344);
      assert(archived.features.some(id => id.endsWith('/济南府')));
    }
    assert.equal(doc.snapshot.prefRef,undefined,filename);
    assert.equal(doc.snapshot.prefectures?.length || 0,0,filename);
    assert(doc.snapshot.regions?.length || doc.snapshot.regionRef,filename);
  }
});

test('overlapping town and dated seat have one clickable marker without hiding the original town at other levels', () => {
  const ctrl = setup(960);
  ctrl.projector.greatCircleKm = context.HistoricalAtlasController._projectorClass.prototype.greatCircleKm;
  const town = {ancient:'古城', eraNames:[{from:950,until:965,zh:'某州'}], coord:[110,34],
    isCapital:true, capitalPeriods:[[950,970]], remark:'城镇沿革'};
  const homonym = {ancient:'某州',coord:[112,34]};
  const vanished = {ancient:'某州',coord:[110,34],vanish:960};
  const seat = {ancient:'某州',coord:[110.02,34],areaKey:'prefecture/test',level:'prefecture',
    modern:'今址',parent:'某路'};
  ctrl._periodAdminAreas = () => [seat];
  const visible = ctrl._adminVisiblePlaces([town, homonym, vanished], ctrl.dynasties[0]);
  assert.equal(visible.length, 3);
  const merged = visible[0];
  assert.equal(merged.areaKey, seat.areaKey);
  assert.equal(merged.coord, seat.coord);
  assert.equal(merged.capitalPeriods, town.capitalPeriods);
  assert.equal(merged.isCapital, true);
  assert.equal(merged.level, undefined, 'town keeps its original layer and zoom rules');
  assert.equal(merged.parent, seat.parent);
  assert.equal(merged.remark, town.remark);
  assert.equal(visible[1], homonym);
  assert.equal(visible[2], vanished);
  assert.equal(town.areaKey, undefined, 'a match for one year must not modify the source object');
  ctrl.openMapSettlementAt(...merged.coord, '某州', merged.areaKey);
  assert.equal(ctrl.card[3], seat);
  ctrl.year = 965;
  assert.equal(ctrl._adminVisiblePlaces([town, homonym], ctrl.dynasties[0]).length, 3,
    'a historical name that has expired does not claim the seat');
});

test('nearby names with ambiguous identities and different names at the same site stay separate', () => {
  const ctrl = setup();
  ctrl.projector.greatCircleKm = context.HistoricalAtlasController._projectorClass.prototype.greatCircleKm;
  const town = {ancient:'甲府',coord:[110,34]};
  const otherTown = {...town,coord:[110.03,34]};
  const seat = {ancient:'甲府',coord:[110.01,34],areaKey:'prefecture/one',level:'prefecture'};
  const otherSeat = {...seat,coord:[110.02,34],areaKey:'prefecture/two'};
  const county = {...seat,ancient:'乙县',areaKey:'county/three',level:'county'};
  ctrl._periodAdminAreas = () => [seat, otherSeat, county];
  assert.deepEqual(Array.from(ctrl._adminVisiblePlaces([town], ctrl.dynasties[0])),
    [town, seat, otherSeat, county]);
  ctrl._periodAdminAreas = () => [seat];
  assert.deepEqual(Array.from(ctrl._adminVisiblePlaces([town,otherTown], ctrl.dynasties[0])),
    [town, otherTown, seat]);
});
