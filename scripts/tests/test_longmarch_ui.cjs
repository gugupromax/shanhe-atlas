'use strict';
const assert = require('node:assert/strict');
const { createValidationContext } = require('./harness');
const ctx = createValidationContext({ fastMode: true });
const { ctrl, sandbox } = ctx;

// Exercise the installed production methods; the DOM below only captures their output/events.
function element() {
  const classes = new Set();
  const el = {
    children: [], dataset: {}, style: { setProperty() {} }, handlers: {}, scrollTop: 0,
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle(c, on) { on ? classes.add(c) : classes.delete(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    querySelector(s) { return s === '.person-history' ? this.detail : null; },
    querySelectorAll() { return []; },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set(value) {
      html = value;
      if (!value) el.children.length = 0;
      el.detail = value.includes('class="person-history"')
        ? { open: /class="person-history" open/.test(value) } : null;
    },
  });
  return el;
}

const detail = {
  kindZh: '<战役>', kindEn: 'Battle',
  battleZh: '<img src=x onerror=alert(1)>', battleEn: 'Battle account',
  resultZh: '结果 & 说明', resultEn: 'Outcome', terrainZh: '山地', terrainEn: 'Mountains',
  terrainBasis: 'interpretation', dateNoteZh: '1935年1月', dateNoteEn: 'January 1935',
  locationNoteZh: '代表地段', locationNoteEn: 'Representative location',
  sources: [
    { title: '<来源>', url: 'https://example.org/source?a=1&b=2', org: '档案', published: '2026', locator: '第2页', evidenceUse: '<核对日期>', accessBasis: '已查阅缓存' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
    { title: 'Data', url: 'data:text/html,test' },
    { title: 'Relative', url: '//example.org/' },
    { title: 'Quote', url: 'https://example.org/" onclick="evil' },
    { title: 'HTTP', url: 'http://example.org/' },
    { title: 'Control', url: 'https://example.org/\nfoo' },
  ],
};
const safe = ctrl._personHistoryHtml(detail, false, true);
assert(safe.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert(safe.includes('&lt;来源&gt; · 档案 · 2026 · 第2页'));
assert(safe.includes('地形解读'));
assert(safe.includes('&lt;核对日期&gt; 已查阅缓存'));
assert.equal((safe.match(/<a /g) || []).length, 2);
assert.equal((safe.match(/rel="noopener noreferrer"/g) || []).length, 2);
assert(safe.includes('a=1&amp;b=2'));
assert(safe.includes('person-history" open'));
assert(!ctrl._personHistoryHtml(detail, true, false).includes('person-history" open'));
assert(ctrl._personHistoryHtml(detail, true, false).includes('Battle account'));
assert.equal(ctrl._personHistoryHtml(undefined, false, true), '');

const profile = {
  key: 'test-longmarch', zh: '长征', en: 'Long March', isStory: true,
  routeOverview: true, span: [1934, 1935],
  routeNoteZh: '史料节点连线，非实测行军路基。', routeNoteEn: 'Schematic source nodes, not surveyed roads.',
  stops: [
    { year: 1934, month: 10, subEraZh: '1934年10月', subEraEn: 'October 1934', coord: [115, 26] },
    { year: 1935, month: 1, subEraZh: '1935年1月15—17日', subEraEn: '15–17 January 1935', coord: [107, 28], fromCoord: [115, 26], via: [[110, 26]], fromStopIdx: 0 },
    { year: 1935, month: 10, subEraZh: '1935年10月19日', subEraEn: '19 October 1935', coord: [108, 37], fromStopIdx: 1 },
    { year: 1935, month: 10.1, subEraZh: '1935年10月21日', subEraEn: '21 October 1935', coord: [109, 38], historyDetail: { ...detail, routeStop: false }, fromCoord: [108, 37] },
  ].map((s, i) => ({ ancientZh: `地点${i}`, ancientEn: `Site ${i}`, titleZh: '节点', titleEn: 'Node', descZh: '说明', descEn: 'Description', historyDetail: detail, ...s })),
};
const events = ctrl._collectPersonEvents(profile);
assert.equal(events[1].historyDetail, detail, 'Metadata object must pass through without a copy');
assert.equal(events[1].subEraZh, '1935年1月15—17日');
assert.equal(events[1].month, 1);

const ids = new Map(['genealogy-timeline', 'genealogy-lore'].map((id) => [id, element()]));
ctrl._id = (id) => ids.get(id) || null;
sandbox.document = { createElement: element };
ctrl.activePerson = { profile, events, isMulti: false };
ctrl.activePersonEventIdx = 1;
ctrl._renderPersonChronicleCard();
const rows = ids.get('genealogy-timeline').children;
assert.equal(rows.length, 4);
assert(rows[1].innerHTML.includes('&lt;战役&gt;'));
assert(rows[1].innerHTML.includes('1935年1月15—17日'));
assert(!rows[1].innerHTML.includes('前0年'));
assert.equal(rows[1].detail.open, true);
assert.equal(rows[0].detail.open, false);
assert(ids.get('genealogy-lore').innerHTML.includes(profile.routeNoteZh));
let selected = null;
ctrl.selectPersonEvent = (idx) => { selected = idx; };
for (const target of ['summary', 'a', 'p']) {
  rows[0].handlers.click({ target: { closest: () => target } });
  assert.equal(selected, null, `${target} must not select a station`);
}
rows[0].handlers.click({ target: { closest: () => null } });
assert.equal(selected, 0);
for (const key of [' ', 'Enter']) {
  let stopped = false;
  rows[0].handlers.keydown({ key, target: { closest: () => true }, stopPropagation() { stopped = true; }, preventDefault() { throw Error('Native detail/link activation must stay enabled'); } });
  assert(stopped, 'Detail activation must not reach the global timeline autoplay shortcut');
}
let unrelatedStopped = false;
rows[0].handlers.keydown({ key: 'Escape', target: { closest: () => true }, stopPropagation() { unrelatedStopped = true; } });
assert.equal(unrelatedStopped, false, 'Escape still reaches the original overlay handler');
ctrl.activePersonEventIdx = 2;
ctrl._renderPersonChronicleCard(true);
assert.equal(rows[1].detail.open, false, 'Previously selected details must fold on navigation');
assert.equal(rows[2].detail.open, true, 'Fast card updates must open the new current details');

const nodes = [];
ctrl.grpJourney = element();
ctrl._svgNode = (tag, attrs) => {
  const node = element();
  nodes.push({ tag, attrs });
  return node;
};
ctrl._invalidateTypographyLayout = ctrl._rescaleSvgTypography = () => {};
function render(idx, enabled = true) {
  profile.routeOverview = enabled;
  ctrl.activePersonEventIdx = idx;
  nodes.length = 0;
  ctrl._renderPersonPinsOverlay();
  return nodes.filter((n) => n.attrs.class === 'journey-route-overview');
}
const overview = render(-1);
assert.equal(overview.length, 1);
const expected = ctrl._buildJourneySegmentInfo(events[1].fromCoord, events[1].coord, events[1].via).d +
  ctrl._buildJourneySegmentInfo(events[1].coord, events[2].coord, events[2].via).d;
assert.equal(overview[0].attrs.d, expected, 'Full line must use the curated via and fromStopIdx and skip context');
assert.equal(nodes.filter((n) => n.attrs.class === 'journey-track-focus').length, 0);
assert.equal(render(1)[0].attrs.d, expected);
assert.equal(nodes.filter((n) => n.attrs.class === 'journey-track-focus').length, 1);
assert(ctrl.grpJourney.classList.contains('is-route-overview'));
assert.equal(render(3)[0].attrs.d, expected);
assert.equal(nodes.filter((n) => n.attrs.class === 'journey-track-focus').length, 0, 'Context is not an extra march leg');
assert.equal(render(-1, false).length, 0);
assert(!ctrl.grpJourney.classList.contains('is-route-overview'));
assert.equal(render(1, false).length, 0);
assert.equal(nodes.filter((n) => n.attrs.class === 'journey-track-focus').length, 1, 'Existing stories retain current-segment rendering');

// Metadata-free rows keep their original markup and no added controls.
const oldProfile = { ...profile, routeOverview: false, key: 'test-old', stops: profile.stops.map(({ historyDetail, ...s }) => s) };
const oldEvents = ctrl._collectPersonEvents(oldProfile);
ctrl.activePerson = { profile: oldProfile, events: oldEvents, isMulti: false };
ctrl._renderPersonChronicleCard();
assert(ids.get('genealogy-timeline').children.every((r) => !r.detail && r.innerHTML.includes('<span class="t-val">')));
assert(!ids.get('genealogy-lore').innerHTML.includes('person-route-note'));
assert(ctrl._getSearchSampleQueries().includes('长征'));
console.log('✓ Long March UI: safe evidence, native details events, fast selection, overview/current/context and legacy isolation');
