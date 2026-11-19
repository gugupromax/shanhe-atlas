'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const versions = require('../sync_version');
const { measureBundle, extractSyncScriptPaths } = require('../perf_budget');
const ROOT = path.resolve(__dirname, '..', '..');

test('upstream merges normalize only present asset hashes and preserve fork and upstream attributes', () => {
  const older = '<script async src="js/app.js?v=1234" data-v-lore="abcd" data-v-new="5678"></script>';
  assert.equal(versions.normalizeIndexHtmlHashes(older),
    '<script async src="js/app.js?v=00000000" data-v-lore="00000000" data-v-new="5678"></script>');
  const nested = '<a href="../?year=741">Home</a>';
  assert.equal(versions.normalizeIndexHtmlHashes(nested), nested);
});

test('public staging excludes local-only generated map layers', () => {
  const docker = fs.readFileSync(path.join(ROOT,'.dockerignore'),'utf8').split(/\r?\n/);
  const pages = fs.readFileSync(path.join(ROOT,'.github/workflows/deploy-pages.yml'),'utf8');
  for (const directory of ['data/tiles','assets/tang-741-tiles']) {
    assert.ok(docker.includes(directory), directory);
    assert.ok(pages.includes("--exclude='" + directory + "/'"), directory);
  }
});

function fixture(t, newline = '\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-fork-ci-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const assets = new Set([
    ...versions.STATIC_TAG_ASSETS,
    ...versions.LAZY_ATTR_ASSETS.map(asset => asset.relPath),
  ]);
  for (const rel of assets) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `/* ${rel}: 地图 */${newline}const value = 1;${newline}`);
  }
  const html = versions.STATIC_TAG_ASSETS.map(rel => rel.endsWith('.css')
    ? `<link rel="stylesheet" href="${rel}?v=old" />`
    : `<script src="${rel}?v=old"></script>`).join(newline) +
    `${newline}<script>preload('js/atlas_snapshots.js?v=old')</script>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return dir;
}

test('cache hashes and gzip sizes agree for LF and CRLF text checkouts', t => {
  const lf = fixture(t);
  const crlf = fixture(t, '\r\n');
  assert.deepEqual(versions.computeAssetHashes(lf), versions.computeAssetHashes(crlf));
  const source = fs.readFileSync(path.join(lf, 'integration.js'));
  const digest = crypto.createHash('sha256').update(source).digest('hex').slice(0, 8);
  assert.equal(versions.computeAssetHashes(crlf)['integration.js'], digest);
  for (const rel of versions.STATIC_TAG_ASSETS) {
    assert.deepEqual(measureBundle(rel, lf), measureBundle(rel, crlf));
  }
});

test('sync covers local integration assets without requiring an analytics tag', t => {
  const dir = fixture(t);
  assert.ok(!versions.STATIC_TAG_ASSETS.includes('js/atlas_track.js'));
  for (const rel of ['integration.css', 'map-surface.js', 'integration.js']) {
    assert.ok(versions.STATIC_TAG_ASSETS.includes(rel));
  }
  // Isolate the Git-config dependency: write-only must not even attempt it.
  const childProcess = require('node:child_process');
  const originalExec = childProcess.execFileSync;
  let gitCalls = 0;
  let isolated;
  try {
    childProcess.execFileSync = () => { gitCalls++; throw new Error('Git config forbidden'); };
    delete require.cache[require.resolve('../sync_version')];
    isolated = require('../sync_version');
  } finally {
    childProcess.execFileSync = originalExec;
    delete require.cache[require.resolve('../sync_version')];
  }
  assert.equal(isolated.syncIndexHtmlAssetHashes(dir, { configureGitMergeDriver: false }).changed, true);
  assert.equal(gitCalls, 0);
  assert.doesNotThrow(() => versions.verifyIndexHtmlAssetHashes(dir, null, ''));
  assert.equal(isolated.syncIndexHtmlAssetHashes(dir, { configureGitMergeDriver: false }).changed, false);
  assert.ok(!fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('atlas_track.js'));
  for (const rel of ['integration.css', 'map-surface.js', 'integration.js']) {
    const synced = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    fs.appendFileSync(path.join(dir, rel), '\n/* changed */\n');
    assert.throws(() => versions.verifyIndexHtmlAssetHashes(dir, synced, ''), error => error.message.includes(rel));
    isolated.syncIndexHtmlAssetHashes(dir, { configureGitMergeDriver: false });
  }
});

function adapterFixture(readyState, appExists) {
  const listeners = new Map();
  const nodes = new Map();
  let iframeCount = 0, frame;
  const element = () => ({
    setAttribute() {}, getAttribute(name) { return this[name]; }, addEventListener() {}, appendChild() {},
    classList: { toggle() {}, add() {}, remove() {} },
    insertBefore(node) { if (node.id === 'fusion-terrain') { iframeCount++; frame = node; } },
    querySelectorAll: () => [],
  });
  const doc = {
    readyState,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element,
    querySelector: element,
    addEventListener() {},
  };
  const app = { svg: element(), _openChallenge() {} };
  const win = {
    document: doc,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
  };
  // js/app.js registers this controller creation before either deferred adapter.
  win.addEventListener('DOMContentLoaded', () => { win.atlasApp = app; });
  if (appExists) win.atlasApp = app;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'integration.js'), 'utf8'), {
    window: win, setTimeout() {}, clearTimeout() {},
  });
  return {
    win,
    get iframeCount() { return iframeCount; },
    get iframeSrc() { return frame?.src; },
    domContentLoaded() {
      doc.readyState = 'interactive';
      for (const handler of listeners.get('DOMContentLoaded') || []) handler();
    },
  };
}

test('full adapter waits for controller creation during parser and deferred loading', () => {
  for (const state of ['loading', 'interactive']) {
    const f = adapterFixture(state, false);
    assert.equal(f.iframeCount, 0);
    assert.equal(f.win.atlasFusion, undefined);
    f.domContentLoaded();
    assert.equal(f.iframeCount, 1, `${state}: creates the 3D iframe after the controller`);
    assert.equal(typeof f.win.atlasFusion.setMode, 'function');
    f.domContentLoaded();
    assert.equal(f.iframeCount, 1, 'installation remains idempotent');
  }
  const late = adapterFixture('complete', true);
  assert.equal(late.iframeCount, 1, 'late loading installs against an existing controller');
});

test('3D resources load only when the user enables the 3D view', () => {
  const f = adapterFixture('complete', true);
  assert.equal(f.iframeSrc, undefined);
  f.win.atlasFusion.setMode(true);
  assert.match(f.iframeSrc, /^terrain\.html\?embedded=1/);
  assert.equal(f.win.atlasFusion.ready, false);
});

test('HTML keeps both integration scripts deferred and in dependency order', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const tags = html.match(/<script\b[^>]*>/gi);
  const surface = tags.find(tag => /src="map-surface\.js\?v=/.test(tag));
  const adapter = tags.find(tag => /src="integration\.js\?v=/.test(tag));
  assert.ok(surface && adapter);
  for (const tag of [surface, adapter]) {
    assert.match(tag, /\bdefer\b/);
    assert.doesNotMatch(tag, /\basync\b/);
  }
  assert.ok(html.indexOf(surface) < html.indexOf(adapter));
  const sync = extractSyncScriptPaths(html);
  assert.ok(!sync.includes('map-surface.js') && !sync.includes('integration.js'));
});
