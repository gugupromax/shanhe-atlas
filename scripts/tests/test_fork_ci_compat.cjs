'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
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
  const localImage = 'battles/changshe-conference.local.png';
  assert.ok(docker.includes(localImage));
  assert.ok(pages.includes(`--exclude='/${localImage}'`));
  assert.ok(pages.includes(`test ! -e _site/${localImage}`));
});

test('verify_all rejects invalid selections and reports successful subsets', () => {
  const run = (selection) => spawnSync(process.execPath, ['scripts/verify_all.cjs', selection, '--quiet'], {
    cwd: ROOT, encoding: 'utf8', timeout: 20_000,
  });
  const invalid = run('--only=fusion,hstory, typo');
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /hstory, typo/);
  assert.equal(invalid.stdout, '');
  const empty = run('--only=');
  assert.equal(empty.status, 2);
  assert.match(empty.stderr, /--only/);
  const valid = run('--only= fusion ');
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.match(valid.stdout, /1 passed, 0 failed/);
  assert.match(valid.stdout, /所选.*fusion/);
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
    fs.writeFileSync(full, rel.endsWith('.webp') ? Buffer.from([0x52,0x49,0x46,0x46,13,10]) :
      `/* ${rel}: 地图 */${newline}const value = 1;${newline}`);
  }
  const html = versions.STATIC_TAG_ASSETS.map(rel => rel.endsWith('.css')
    ? `<link rel="stylesheet" href="${rel}?v=old" />`
    : `<script src="${rel}?v=old"></script>`).join(newline) +
    `${newline}<script>preload('js/atlas_snapshots.js?v=old')</script>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.mkdirSync(path.join(dir, 'battles'), {recursive:true});
  fs.writeFileSync(path.join(dir, 'battles/changshe.html'), '<script src="battle-units.js?v=old"></script>');
  fs.writeFileSync(path.join(dir, 'battles/battle-units.js'), 'window.atlasBattleUnits={};');
  return dir;
}

test('both Changshe entry points use the same version of the shared figures', t => {
  const dir = fixture(t);
  const child = path.join(dir, 'terrain.html'), battle = path.join(dir, 'battles/changshe.html');
  fs.writeFileSync(child, '<script data-figure-src="battles/battle-units.js"></script>');
  const stamp = file => fs.readFileSync(file,'utf8').match(/battle-units\.js\?v=([a-f\d]{8})/)[1];
  versions.syncIndexHtmlAssetHashes(dir, {configureGitMergeDriver:false});
  const before = stamp(child);
  assert.equal(stamp(battle), before);
  fs.appendFileSync(path.join(dir,'battles/battle-units.js'), '\n// changed model');
  assert.throws(() => versions.verifyIndexHtmlAssetHashes(dir, null, ''), /Stale terrain/);
  versions.syncIndexHtmlAssetHashes(dir, {configureGitMergeDriver:false});
  assert.notEqual(stamp(child), before);
  assert.equal(stamp(battle), stamp(child));
});

test('terrain renderer changes invalidate both the iframe and its script URL', t => {
  const dir = fixture(t);
  const child = path.join(dir, 'terrain.html');
  const script = path.join(dir, 'terrain-app.js');
  fs.writeFileSync(child, '<script src="terrain-app.js"></script>\r\n');
  fs.writeFileSync(script, '/* v1 */\r\n');
  const sync = () => versions.syncIndexHtmlAssetHashes(dir, {configureGitMergeDriver:false});
  sync();
  const oldChild = fs.readFileSync(child, 'utf8');
  const oldParent = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.match(oldChild, /terrain-app\.js\?v=[a-f0-9]{8}/);
  assert.match(oldParent, /data-v-terrain="[a-f0-9]{8}"/);
  fs.appendFileSync(script, '/* v2 */\n');
  assert.throws(() => versions.verifyIndexHtmlAssetHashes(dir, null, ''), /Stale terrain/);
  sync();
  assert.notEqual(fs.readFileSync(child, 'utf8'), oldChild);
  assert.notEqual(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), oldParent);
  assert.doesNotThrow(() => versions.verifyIndexHtmlAssetHashes(dir, null, ''));
});

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

function adapterFixture(readyState, appExists, search = '', vTerrain) {
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
  doc.getElementById('atlas-app-script').dataset = { vTerrain };
  const win = {
    document: doc,
    performance,
    location: { search, protocol: "https:", origin: "https://example.test" },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
  };
  // js/app.js registers this controller creation before either deferred adapter.
  win.addEventListener('DOMContentLoaded', () => { win.atlasApp = app; });
  if (appExists) win.atlasApp = app;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'integration.js'), 'utf8'), {
    window: win, URLSearchParams, setTimeout() {}, clearTimeout() {},
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

test('the terrain iframe carries its version and only the supported antialiasing override', () => {
  for (const [search, version, expected] of [
    ['', undefined, 'terrain.html?embedded=1'],
    ['', 'test hash', 'terrain.html?embedded=1&v=test%20hash'],
    ['?year=741&aa=0', 'hash', 'terrain.html?embedded=1&v=hash&aa=0'],
    ['?aa=0', undefined, 'terrain.html?embedded=1&aa=0'],
    ['?aa=1', 'hash', 'terrain.html?embedded=1&v=hash'],
    ['?aa=00', 'hash', 'terrain.html?embedded=1&v=hash'],
  ]) {
    const f = adapterFixture('complete', true, search, version);
    f.win.atlasFusion.setMode(true);
    assert.equal(f.iframeSrc, expected);
  }
  const rewritten = adapterFixture('complete', true, '?year=741&aa=0');
  rewritten.win.location.search = '?year=742';
  rewritten.win.atlasFusion.setMode(true);
  assert.equal(rewritten.iframeSrc, 'terrain.html?embedded=1&aa=0');
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
