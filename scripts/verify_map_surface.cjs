'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const surface = require('../map-surface.js');

// Exercise the original projector rather than a second approximation.
const context = { window: { addEventListener() {} }, setTimeout, clearTimeout, URLSearchParams };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8'), context);
const projector = new context.window.MercatorProjector(1000, 700,
  { west: 66, east: 142, south: 14, north: 55 });
for (const bounds of [[66, 14, 142, 55], [40, -10, 165, 70], [110, 25, 115, 42]]) {
  const p = surface.projectedBounds(projector, bounds);
  const nw = projector.toScreen(bounds[0], bounds[3]);
  const se = projector.toScreen(bounds[2], bounds[1]);
  assert.deepEqual(p, { x: nw[0], y: nw[1], width: se[0] - nw[0], height: se[1] - nw[1] });
  for (const limits of [[undefined, undefined], [1024, undefined], [undefined, 512], [9000, 8192]]) {
    const s = surface.textureSize(p, ...limits);
    assert.ok(s.width > 0 && s.width <= Math.min(limits[0] || 4096, 4096));
    assert.ok(s.height > 0 && s.height <= Math.min(limits[1] || 4096, 4096));
    assert.ok(Math.abs(s.width / s.height - p.width / p.height) < 0.01);
  }
}
for (const b of [null, [0, 0, 1], [0, NaN, 1, 2], [10, 1, 0, 2], [0, -90, 10, 2]]) {
  assert.throws(() => surface.projectedBounds(projector, b));
}
assert.throws(() => surface.textureSize({ width: 1, height: 2 }, 0));
assert.throws(() => surface.textureSize({ width: 1, height: 2 }, Infinity));
const base = 'http://127.0.0.1:8123/index.html';
assert.equal(surface.localAssetUrl('assets/map.webp', base), 'http://127.0.0.1:8123/assets/map.webp');
assert.ok(surface.localAssetUrl('data:image/png;base64,AA==', base).startsWith('data:'));
assert.ok(surface.localAssetUrl('a.png', 'file:///E:/map/index.html').endsWith('/map/a.png'));
for (const url of ['https://example.com/a.png', '//evil.test/a.png', 'http://127.0.0.1:9000/a.png',
  'javascript:alert(1)', 'data:text/html,<script>', 'file://server/share/a.png']) {
  assert.throws(() => surface.localAssetUrl(url, base));
}
assert.throws(() => surface.localAssetUrl('a.png', 'https://example.com/index.html'));
const projectPage = 'https://gugupromax.github.io/shanhe-atlas/';
assert.equal(surface.localAssetUrl('css/style.css?v=1', projectPage), projectPage + 'css/style.css?v=1');
assert.equal(surface.localAssetUrl('../assets/map.webp', projectPage + 'css/style.css'), projectPage + 'assets/map.webp');
for (const value of ['../other/map.webp', '/shanhe-atlas2/map.webp', '%2e%2e/other/map.webp',
  'assets/%2e%2e%2f%2e%2e%2fother/map.webp', 'assets/%5cmap.webp', 'assets/%252e%252e%252fmap.webp',
  'https://guest@gugupromax.github.io/shanhe-atlas/assets/map.webp', 'https://cdn.example.com/map.webp',
  'http://gugupromax.github.io/shanhe-atlas/assets/map.webp', 'https://gugupromax.github.io:9000/shanhe-atlas/assets/map.webp']) {
  assert.throws(() => surface.localAssetUrl(value, projectPage), value);
}
assert.throws(() => surface.localAssetUrl(projectPage + 'map.webp', 'https://gugupromax.github.io/other/'));
assert.throws(() => surface.localAssetUrl(projectPage + 'map.webp', base));

for (const [input, expected] of [
  ['.one, .two:hover, .three', ['.one', '.two:hover', '.three']],
  ['.history :is(summary, a):focus-visible, .route', ['.history :is(summary, a):focus-visible', '.route']],
  [':is(.a, :where(.b, :not(.c, .d))), [data-label="a,b"]', [':is(.a, :where(.b, :not(.c, .d)))', '[data-label="a,b"]']],
  [String.raw`[data-label="a,\"b,c"], [data-label='a,\'b,c']`, [String.raw`[data-label="a,\"b,c"]`, String.raw`[data-label='a,\'b,c']`]],
  [String.raw`.escaped\,comma, .escaped\(paren, .last`, [String.raw`.escaped\,comma`, String.raw`.escaped\(paren`, '.last']],
  [String.raw`[data-label=one\,two], .last`, [String.raw`[data-label=one\,two]`, '.last']],
  ['.a/* (, [ */,.b', ['.a/* (, [ */', '.b']],
  ['', []],
]) assert.deepEqual(surface.splitSelectorList(input), expected, 'top-level selector split: ' + input);

// A small DOM/canvas fixture verifies the export pipeline and cleanup without
// installing a browser. Pixel appearance is checked by the parent in Chromium.
class Style {
  constructor(values = {}) { this.values = { ...values }; }
  setProperty(k, v, priority) { this.values[k] = String(v); if (priority) this.values[k + '!'] = priority; }
  getPropertyValue(k) { return this.values[k] || ''; }
}
class Node {
  constructor(tagName, attrs = {}, children = []) {
    this.tagName = tagName; this.attrs = { ...attrs }; this.children = children; this.style = new Style();
    this.classList = { remove: name => { this.attrs.class = (this.attrs.class || '').split(/\s+/).filter(x => x !== name).join(' '); } };
    this.children.forEach(n => { n.parentNode = this; });
  }
  get firstChild() { return this.children[0] || null; }
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] || null; }
  getAttributeNS(ns, k) { return this.getAttribute('xlink:' + k); }
  removeAttribute(k) { delete this.attrs[k]; }
  removeAttributeNS(ns, k) { this.removeAttribute('xlink:' + k); }
  insertBefore(node, before) {
    node.parentNode = this;
    const index = before ? this.children.indexOf(before) : this.children.length;
    this.children.splice(index, 0, node);
  }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); }
  cloneNode() {
    const copy = new Node(this.tagName, this.attrs, this.children.map(n => n.cloneNode(true)));
    copy.style = new Style(this.style.values); copy.textContent = this.textContent;
    return copy;
  }
  querySelectorAll(selector) {
    const tags = selector.split(',').map(s => s.trim());
    const nodes = this.children.flatMap(n => [n, ...n.querySelectorAll('*')]);
    const hasClass = (node, name) => (node?.attrs.class || '').split(/\s+/).includes(name);
    return nodes.filter(n => tags.some(t => {
      if (t === '#grp-settlements .pass-gate-icon') return hasClass(n, 'pass-gate-icon');
      if (t === '#grp-settlements .settlement-node.is-pass > text.name') {
        return n.tagName === 'text' && hasClass(n, 'name') && hasClass(n.parentNode, 'is-pass');
      }
      if (t === '#grp-settlements .settlement-node:not(.is-pass) > text.name') {
        return n.tagName === 'text' && hasClass(n, 'name') && hasClass(n.parentNode, 'settlement-node') && !hasClass(n.parentNode, 'is-pass');
      }
      if (t === '#grp-region-labels text') return n.tagName === 'text' && n.parentNode?.attrs.id === 'grp-region-labels';
      if (t === '#grp-settlements .is-admin-prefecture > text.name' || t === '#grp-settlements .is-county > text.name') {
        return n.tagName === 'text' && hasClass(n, 'name') && hasClass(n.parentNode, t.includes('is-county') ? 'is-county' : 'is-admin-prefecture');
      }
      if (t === '#grp-settlements .is-county .dot') {
        return hasClass(n, 'dot') && hasClass(n.parentNode, 'is-county');
      }
      return t === '*' || (t[0] === '#' ? n.attrs.id === t.slice(1) : n.tagName === t);
    }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getScreenCTM() { return { a: 2, b: 0, c: 0, d: 2 }; }
}

function fixture(page = base) {
  let fetchCount = 0, revoked = 0, serialized = null, imageFails = false, canvasFails = false, contextMode = 'person';
  const rootCss = Object.assign(new Style({ '--water-fill': '#d6e0de', '--serif-stack': 'SimSun, serif' }),
    { 0: '--water-fill', 1: '--serif-stack', length: 2, fontFamily: 'SimSun, serif' });
  // Modern CSSStyleRule exposes cssRules even when it has no nested rules.
  const rule = (selectorText, cssText, cssRules = []) => ({ type: 1, selectorText,
    style: { cssText }, cssRules, cssText: selectorText + '{' + cssText + '}' });
  const doc = {
    baseURI: page, documentElement: new Node('html', { lang: 'en' }), fonts: { ready: Promise.resolve() },
    styleSheets: [{ href: new URL('css/style.css', page).href, cssRules: [
      rule('.polity-shape', 'fill:#c49562;stroke-width:2;vector-effect:non-scaling-stroke'),
      rule('.polity-shape:hover', 'fill:red'),
      rule('.person-history :is(summary, a):focus-visible', 'outline:2px solid #963f2c;'),
      rule('.journey-route-overview', 'fill:none;stroke:#a85c49;stroke-dasharray:5 4;'),
      rule('.is-route-overview :is(.journey-track-focus, .journey-track-halo.is-focus)', 'stroke-dasharray:5 3;'),
      rule('.static-shape, .hover-shape:hover, .focus-shape:focus-within', 'fill:#315544;'),
      rule(':where(.one, :not(.two, .three)) [data-label="river, mountain"]', 'opacity:0.6;'),
      rule(String.raw`[data-label="say \"yes, no\""]`, 'fill:#123456;'),
      rule('html[lang="en"] .polity-caption', 'font-size:13px;letter-spacing:0.04em;'),
      rule('html[lang="en"] .region-caption', 'font-size:7.5px;letter-spacing:0.01em;'),
      { type: 4, conditionText: '(max-width:640px)', cssRules: [rule('.polity-shape', 'stroke-width:1.18')] },
      { type: 4, conditionText: '(min-width:641px)', cssRules: [rule('.polity-shape', 'stroke-width:2')] },
      rule('.nested', 'fill:none;', [rule('& .label', 'fill:#abcdef;'),
        { type: 4, conditionText: '(max-width:640px)', cssRules: [rule('& .small', 'opacity:0.4;')] },
        { type: 0, style: { cssText: 'opacity:0.75;' }, cssText: 'opacity:0.75;' }]),
      { type: 0, cssText: '@layer cartography { .layered { fill: #112233; } }',
        cssRules: [rule('.layered', 'fill:#112233;')] },
      { type: 5, cssText: '@font-face{src:url(https://example.com/font.woff2)}' },
    ] }],
    createElementNS: (ns, tag) => new Node(tag),
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return { getContext: () => ({ fillRect() {}, drawImage() {} }),
        toDataURL: () => { if (canvasFails) throw new Error('tainted fixture'); return 'data:image/png;base64,AA=='; } };
    },
  };
  doc.defaultView = {
    AbortController, setTimeout, clearTimeout,
    getComputedStyle(node) {
      if (node === doc.documentElement || node.tagName === 'svg') return rootCss;
      if (['grp-settlements', 'grp-corridors', 'grp-milestones'].includes(node.attrs.id)) {
        const opacity = node.attrs.id === 'grp-settlements' ? (contextMode === 'person' ? '0.25' : '0.22')
          : node.attrs.id === 'grp-corridors' ? '0.22' : (contextMode === 'person' ? '0.14' : '1');
        return { vectorEffect: 'none', opacity, display: node.attrs.id === 'grp-milestones' ? 'none' : 'inline',
          visibility: 'hidden' }; // The original SVG's 3D-mode ancestor is hidden.
      }
      if (node.tagName === 'path') return { vectorEffect: 'non-scaling-stroke', strokeWidth: '2px',
        strokeDasharray: '4px, 2px', strokeDashoffset: '1px' };
      return { vectorEffect: 'none' };
    },
    matchMedia: query => ({ matches: query === '(max-width:640px)' }),
    CSS: { supports: () => true },
    fetch: async (url, options) => {
      assert.equal(url, new URL('assets/terrain_relief.webp', page).href);
      assert.equal(options.mode, 'same-origin');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      fetchCount++;
      return { ok: true, blob: async () => ({ type: 'image/webp' }) };
    },
    FileReader: class { readAsDataURL() { this.result = 'data:image/webp;base64,AA=='; this.onload(); } },
    Blob: class {},
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL: () => { revoked++; } },
    XMLSerializer: class { serializeToString(node) { serialized = node; return '<svg/>'; } },
    Image: class { set src(value) { if (imageFails) this.onerror(); else this.onload(); } },
  };
  const svg = new Node('svg', { id: 'atlas-svg', class: 'terrain-active is-camera-moving', viewBox: '200 100 300 200' }, [
    new Node('defs', {}, [new Node('clipPath', { id: 'prefecture-clip' })]),
    new Node('g', { id: 'camera-rig', transform: 'translate(30 20) scale(2)' }, [
      new Node('image', { id: 'terrain-relief-img', href: 'assets/terrain_relief.webp' }),
      new Node('image', { id: 'deferred', 'data-href': 'assets/not-loaded.webp' }),
      new Node('g', { id: 'grp-rivers', class: 'is-hidden' }, [new Node('path', { d: 'M1 2L3 4' })]),
      new Node('g', { id: 'grp-polities' }, [new Node('path', { class: 'polity-shape is-hovered', d: 'M0 0L1 1Z', onclick: 'bad()' })]),
      new Node('g', { id: 'grp-region-labels' }, [new Node('text', {id:'region-label'})]),
      new Node('g', { id: 'grp-map-area' }, [new Node('g', { id: 'map-area-focus' })]),
      new Node('g', { id: 'grp-settlements' }, [
        new Node('g', { class: 'settlement-node is-admin-prefecture' }, [
          new Node('circle', { id: 'prefecture-dot', class: 'dot' }),
          new Node('text', { id: 'prefecture-label', class: 'name' }),
        ]),
        new Node('g', { class: 'settlement-node' }, [new Node('text', { id: 'city-label', class: 'name' })]),
        new Node('g', { class: 'settlement-node is-pass' }, [
          new Node('path', { id: 'pass-icon', class: 'pass-gate-icon' }),
          new Node('text', { id: 'pass-label', class: 'name pass-name' }),
        ]),
        new Node('g', { class: 'settlement-node is-county' }, [
          new Node('circle', { id: 'county-dot', class: 'dot' }),
          new Node('text', { id: 'county-label', class: 'name' }),
        ]),
      ]),
      new Node('g', { id: 'grp-corridors' }),
      new Node('g', { id: 'grp-milestones', class: 'is-hidden' }),
      new Node('g', { id: 'grp-journey' }, [new Node('text', {}, [])]),
      new Node('script'),
    ]),
  ]);
  svg.ownerDocument = doc;
  svg.querySelector('#grp-journey').children[0].textContent = '苏轼 · 黄州';
  return { svg, doc, exporter: surface.create({ app: { projector }, svg }),
    get fetchCount() { return fetchCount; }, get revoked() { return revoked; }, get clone() { return serialized; },
    failImage() { imageFails = true; }, failCanvas() { canvasFails = true; },
    setContext(value) { contextMode = value; } };
}

(async function () {
  const f = fixture(), before = JSON.stringify(f.svg.attrs);
  const request = { bounds: [66, 14, 142, 55], width: 1024 };
  const published = fixture(projectPage);
  assert.match((await published.exporter.render(request)).url, /^data:image\/png;base64,/);
  assert.equal(published.fetchCount, 1, 'published atlas reads its own relief image');
  const output = await f.exporter.render(request);
  assert.match(output.url, /^data:image\/png;base64,/);
  assert.deepEqual(output.bounds, request.bounds);
  assert.notEqual(output.bounds, request.bounds);
  assert.equal(output.width, 1024);
  assert.equal(f.revoked, 1);
  assert.equal(f.fetchCount, 1);
  assert.equal(JSON.stringify(f.svg.attrs), before, 'source SVG must stay unchanged');
  assert.equal(f.svg.querySelector('#camera-rig').getAttribute('transform'), 'translate(30 20) scale(2)');
  assert.equal(f.clone.querySelector('#camera-rig').getAttribute('transform'), null);
  assert.ok(f.svg.querySelector('#map-area-focus'));
  assert.equal(f.clone.querySelector('#map-area-focus'), null, 'temporary county focus must not be baked into the terrain');
  assert.equal(f.clone.querySelector('#grp-rivers').getAttribute('class'), 'is-hidden');
  assert.equal(f.clone.getAttribute('lang'), 'en');
  for (const [id, opacity, display] of [['grp-settlements', '0.25', 'inline'],
    ['grp-corridors', '0.22', 'inline'], ['grp-milestones', '0.14', 'none']]) {
    const layer = f.clone.querySelector('#' + id);
    assert.equal(layer.style.getPropertyValue('opacity'), opacity, id + ' inherits person-mode opacity');
    assert.equal(layer.style.getPropertyValue('display'), display, id + ' preserves layer display');
    assert.equal(layer.style.getPropertyValue('visibility'), '', 'ancestor 3D visibility must not be frozen');
  }
  assert.equal(f.clone.querySelector('#grp-journey').children[0].textContent, '苏轼 · 黄州');
  assert.ok(f.clone.querySelector('#prefecture-clip'));
  const stroke = f.clone.querySelector('#grp-polities').children[0];
  assert.equal(stroke.style.values['stroke-width'], '1');
  assert.equal(stroke.style.values['vector-effect'], 'none');
  assert.equal(stroke.style.values['stroke-dasharray'], '2 1');
  assert.equal(stroke.getAttribute('onclick'), null);
  assert.equal(stroke.getAttribute('class'), 'polity-shape');
  assert.equal(f.clone.querySelector('script'), null);
  assert.match(f.clone.querySelector('#terrain-relief-img').getAttribute('href'), /^data:image\/webp/);
  assert.equal(f.clone.querySelector('#deferred').getAttribute('href'), null);
  const css = f.clone.querySelector('style').textContent;
  assert.ok(!css.includes('.person-history') && !css.includes(':focus-visible'),
    'render must discard the complete interactive functional selector, without an unclosed fragment');
  assert.ok(css.includes('.journey-route-overview{fill:none;stroke:#a85c49;stroke-dasharray:5 4;}'),
    'the route rule after the filtered selector must retain fill:none in exported CSS');
  assert.ok(css.includes('.is-route-overview :is(.journey-track-focus, .journey-track-halo.is-focus){stroke-dasharray:5 3;}'),
    'render must keep non-interactive functional selector lists intact');
  assert.ok(css.includes('.static-shape{fill:#315544;}') && !css.includes('.hover-shape') && !css.includes('.focus-shape'),
    'only interactive members of a top-level selector list are removed');
  assert.ok(css.includes(':where(.one, :not(.two, .three)) [data-label="river, mountain"]{opacity:0.6;}'),
    'render must retain nested functional selectors and quoted attribute commas');
  assert.ok(css.includes(String.raw`[data-label="say \"yes, no\""]{fill:#123456;}`),
    'render must retain escaped quotes within selector attributes');
  assert.ok(css.includes('.polity-shape{fill:#c49562;stroke-width:2;vector-effect:non-scaling-stroke}'),
    'ordinary CSSStyleRule declarations must survive an empty cssRules list');
  assert.match(css, /\.nested\{fill:none;& \.label\{fill:#abcdef;\}/);
  assert.match(css, /& \.small\{opacity:0\.4;\}\nopacity:0\.75;\}/,
    'nested style rules and following CSSNestedDeclarations retain scope and order');
  assert.match(css, /@layer cartography \{\.layered\{fill:#112233;\}\}/,
    'non-style grouping rules must preserve their wrapper');
  assert.match(css, /stroke-width:1\.18/);
  assert.ok(!css.includes(':hover') && !css.includes('@font-face') && !css.includes('stroke-width:2}'));
  assert.match(css, /animation:none!important/);
  assert.ok(css.includes('#atlas-svg[lang="en"] .polity-caption{font-size:13px;letter-spacing:0.04em;}'));
  assert.ok(css.includes('#atlas-svg[lang="en"] .region-caption{font-size:7.5px;letter-spacing:0.01em;}'));
  assert.ok(!css.includes('html[lang='), 'locale CSS must target the exported SVG root');
  assert.equal(f.clone.style.getPropertyValue('--water-fill'), '#d6e0de');
  assert.equal(f.clone.children[1].getAttribute('fill'), '#d6e0de');
  f.setContext('journey');
  f.doc.documentElement.setAttribute('lang', 'zh-CN');
  await f.exporter.render(request);
  assert.equal(f.clone.getAttribute('lang'), 'zh-CN');
  assert.equal(f.clone.querySelector('#grp-settlements').style.getPropertyValue('opacity'), '0.22');
  assert.equal(f.clone.querySelector('#grp-milestones').style.getPropertyValue('opacity'), '1');
  assert.ok(f.clone.querySelector('#pass-icon') && f.clone.querySelector('#pass-label'));
  await f.exporter.render({ ...request, screenPasses: true });
  assert.equal(f.clone.querySelector('#pass-icon'), null, 'remove the flat gate when the model is drawn independently');
  assert.equal(f.clone.querySelector('#pass-label'), null, 'remove the painted pass caption');
  assert.ok(f.clone.querySelector('#county-dot') && f.clone.querySelector('#county-label'), 'preserve other years’ marker artwork');
  await f.exporter.render({ ...request, screenPasses: true, screenAdmin: true });
  for (const id of ['pass-icon','pass-label','county-dot','county-label','prefecture-label','city-label','region-label']) {
    assert.equal(f.clone.querySelector('#' + id), null, id + ' is drawn as part of the screen overlay');
  }
  assert.ok(f.clone.querySelector('#prefecture-dot'), 'the texture retains the seat symbol');
  await f.exporter.render({ ...request, screenLabels: true });
  for (const id of ['pass-icon','pass-label','county-dot','county-label']) assert.equal(f.clone.querySelector('#' + id), null);
  assert.ok(f.svg.querySelector('#pass-icon') && f.svg.querySelector('#pass-label'), 'preserve the original 2D gate');
  assert.equal(f.fetchCount, 1, 'local image reads must be cached');
  f.svg.querySelector('#terrain-relief-img').setAttribute('href', 'https://example.com/map.png');
  await assert.rejects(f.exporter.render(request), /拒绝/);
  assert.equal(f.fetchCount, 1, 'remote URLs must never reach fetch');
  const decode = fixture(); decode.failImage();
  await assert.rejects(decode.exporter.render(request), /解析失败/);
  assert.equal(decode.revoked, 1);
  const canvas = fixture(); canvas.failCanvas();
  await assert.rejects(canvas.exporter.render(request), /tainted fixture/);
  assert.equal(canvas.revoked, 1);
  console.log('PASS: original Mercator bounds/aspect, 4096 cap, local and published project assets/cache, SVG clone/state/fonts/CSS/strokes, export errors and blob cleanup. Pixel rendering requires browser validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
