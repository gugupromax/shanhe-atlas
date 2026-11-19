'use strict';

// Offline generation. Only rasterization requires the local map server.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { coverage, tileBounds } = require('../tang-741-tiles.js');

const project = path.resolve(__dirname, '..');
const destination = path.join(project, 'assets', 'tang-741-tiles');
const bundledModules = path.join(os.homedir(), '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
const tiers = [
  { tier: 'far', zoom: 1.6, grid: 1, batch: 1, tileWidth: 2048 },
  { tier: 'far', zoom: 1.6, grid: 1, batch: 1, tileWidth: 4096, hd: true },
  { tier: 'mid', zoom: 3.6, grid: 3, batch: 3, tileWidth: 1280 },
  { tier: 'near', zoom: 8, grid: 8, batch: 4, tileWidth: 1024 },
];
const manifestPath = path.join(destination, 'manifest.json');
const inputPaths = [
  'index.html', 'assets/terrain_relief.webp', 'css/style.css', 'integration.css',
  'js/china_geo_data.js', 'js/map_data.js', 'js/lore_core.js', 'js/atlas_boot.js',
  'js/atlas_snapshots.js', 'js/app.js', 'js/atlas_area.js', 'js/tang_741.js',
  'map-surface.js', 'scripts/build_tang_741_tiles.cjs',
];
const mY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const [west, south, east, north] = coverage;
const aspectHeight = (mY(north) - mY(south)) / ((east - west) * Math.PI / 180);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function inputHashes() {
  const pairs = await Promise.all(inputPaths.map(async relative => {
    const bytes = await fs.readFile(path.join(project, relative));
    const input = /\.(?:c?js|css|html)$/.test(relative) ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes;
    return [relative, hash(input)];
  }));
  return Object.fromEntries(pairs);
}

function imageSize(bytes, relative) {
  if (relative.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', relative);
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', relative);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', relative);
  assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8L', relative);
  assert.equal(bytes[20], 0x2f, relative);
  const header = bytes.readUInt32LE(21);
  return [(header & 0x3fff) + 1, ((header >>> 14) & 0x3fff) + 1];
}

async function tileInventory(directory) {
  const files = {};
  for (const {tier, grid, tileWidth, hd} of tiers) {
    const height = Math.round(tileWidth * aspectHeight);
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const relative = tier === 'far' ? (hd ? 'base-hd.webp' : 'base.png') : tier + '/' + row + '-' + col + '.png';
        const bytes = await fs.readFile(path.join(directory, relative));
        assert.deepEqual(imageSize(bytes, relative), [tileWidth, height], 'Invalid tile dimensions: ' + relative);
        files[relative] = { width: tileWidth, height, bytes: bytes.length, sha256: hash(bytes) };
      }
    }
  }
  return files;
}

function makeManifest(files, inputs, adopted) {
  const version = 'v-' + hash(JSON.stringify({files, inputs})).slice(0, 16);
  return { schema: 1, year: 741, version, directory: adopted ? '' : version, coverage, inputs, files };
}

async function verifiedManifest() {
  const actual = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.match(actual.version, /^v-[a-f0-9]{16}$/);
  assert.ok(actual.directory === '' || actual.directory === actual.version, 'Invalid tile asset directory');
  const files = await tileInventory(path.join(destination, actual.directory));
  const expected = makeManifest(files, await inputHashes(), actual.directory === '');
  assert.deepEqual(actual.inputs, expected.inputs, 'Tile inputs have changed. Rebuild the complete tile set.');
  assert.deepEqual(actual, expected, 'Manifest and on-disk tile contents differ.');
  return actual;
}

async function replaceManifest(manifest) {
  const temporary = path.join(destination, '.manifest-' + process.pid + '.json');
  await fs.writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n');
  try {
    await fs.rename(temporary, manifestPath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function dependency(name) {
  const override = process.env.TANG_TILES_NODE_MODULES;
  if (override) return require(path.join(path.resolve(override), name));
  try {
    return require(name);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(bundledModules, name));
  }
}

function sourceUrl() {
  const argument = process.argv.slice(2).find(arg => arg !== '--base-hd') || 'http://127.0.0.1:8773/';
  const url = new URL(argument);
  assert.equal(url.protocol, 'http:', 'The tile source must be the local atlas HTTP server.');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.ok(!url.username && !url.password);
  url.hash = '';
  url.search = '?year=741';
  return url;
}

async function configureSource(page, tier) {
  return await page.evaluate(async ({ zoom, tier, coverage }) => {
    const { atlasApp, JiangshanMapSurface } = window;
    const source = atlasApp.svg;
    atlasApp.closeMilestoneBalloon();
    atlasApp.closeMapArea();
    atlasApp._cancelCameraAnimation();
    const adminLevel = document.getElementById('chk-admin-counties');
    adminLevel.checked = true;
    adminLevel.dispatchEvent(new Event('change', { bubbles: true }));

    // A viewport-specific hillshade tile would create a patch on an otherwise
    // global render. Keep the existing global hillshade for all three tiers.
    clearTimeout(atlasApp._terrainTileTimer);
    document.getElementById('grp-terrain-tiles').replaceChildren();
    atlasApp.terrainTileLayer = null;
    const relief = document.getElementById('terrain-relief-img');
    if (!relief.getAttribute('href')) relief.setAttribute('href', relief.dataset.href);

    const width = 1000 / zoom;
    const height = width * .65;
    const [centerX, centerY] = atlasApp.projector.toScreen(108.95, 34.27);
    atlasApp.camera = { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height, zoom };
    atlasApp._applyCamera(true);
    if (source.classList.contains('is-tang741-overview') !== (tier === 'far') ||
        source.classList.contains('is-tang741-counties') !== (tier === 'near')) {
      throw new Error('741 年地图的瓦片缩放层级与预期不匹配。');
    }

    // Reuse the browser exporter up to its serialized SVG. Stop immediately
    // before its image decode so the same frozen labels, styles and inline assets
    // can be used for every tile in this tier.
    let serialized;
    const prototype = XMLSerializer.prototype;
    const originalSerialize = prototype.serializeToString;
    const captured = Symbol('atlas ready for offline rasterization');
    prototype.serializeToString = function (node) {
      const result = originalSerialize.call(this, node);
      if (node.id === 'atlas-svg') {
        serialized = result;
        throw captured;
      }
      return result;
    };
    try {
      await JiangshanMapSurface.create({ app: atlasApp, svg: source })
        .render({ bounds: coverage, width: 2048, height: 2048, screenLabels: true });
    } catch (error) {
      if (error !== captured) throw error;
    } finally {
      prototype.serializeToString = originalSerialize;
    }
    if (!serialized) throw new Error('无法获取地图 SVG。');
    window.tang741BuildSvg = new DOMParser().parseFromString(serialized, 'image/svg+xml').documentElement;
    if (window.tang741BuildSvg.localName !== 'svg') throw new Error('地图 SVG 无法解析。');
    if (window.tang741BuildSvg.querySelector('#grp-region-labels text, #grp-settlements text.name, #grp-settlements .pass-gate-icon, #grp-settlements .is-county .dot')) {
      throw new Error('741 年屏幕文字或标记仍留在瓦片底图中。');
    }
    return {
      countyDots: Array.from(source.querySelectorAll('.settlement-node.is-county'))
        .filter((node) => getComputedStyle(node).display !== 'none').length,
      prefectureLines: Array.from(source.querySelectorAll('.prefecture-boundary-mesh'))
        .filter((node) => getComputedStyle(node).display !== 'none').length,
      scene: source.getAttribute('class'),
    };
  }, { tier: tier.tier, zoom: tier.zoom, coverage });
}

async function rasterize(page, { bounds, width, height }) {
  const url = await page.evaluate(async ({ bounds, width, height }) => {
    const { atlasApp, JiangshanMapSurface, tang741BuildSvg: svg } = window;
    const projected = JiangshanMapSurface.projectedBounds(atlasApp.projector, bounds);
    svg.setAttribute('viewBox', [projected.x, projected.y, projected.width, projected.height].join(' '));
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.setProperty('width', width + 'px', 'important');
    svg.style.setProperty('height', height + 'px', 'important');

    const xml = new XMLSerializer().serializeToString(svg);
    const objectUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, { bounds, width, height });
  assert.ok(url.startsWith('data:image/png;base64,'), 'PNG rasterization did not produce a valid image.');
  return Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
}

function groupBounds(tier, row, col) {
  const northwest = tileBounds(tier.tier, row, col);
  const southeast = tileBounds(tier.tier, row + tier.batch - 1, col + tier.batch - 1);
  return [northwest[0], southeast[1], southeast[2], northwest[3]];
}

async function cropBatch(sharp, image, staging, tier, startRow, startCol) {
  if (tier.tier === 'far') {
    if (tier.hd) await sharp(image).webp({ lossless: true }).toFile(path.join(staging, 'base-hd.webp'));
    else await fs.writeFile(path.join(staging, 'base.png'), image);
    return;
  }
  // Decode once for every batch. Subsequent crops use the same RGBA pixels.
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [tier.tileWidth * tier.batch, tier.tileHeight * tier.batch, 4]);
  for (let row = 0; row < tier.batch; row++) {
    await Promise.all(Array.from({ length: tier.batch }, (_, col) => sharp(data, { raw: info })
      .extract({ left: col * tier.tileWidth, top: row * tier.tileHeight, width: tier.tileWidth, height: tier.tileHeight })
      .png()
      .toFile(path.join(staging, tier.tier, `${startRow + row}-${startCol + col}.png`))));
  }
}

async function build() {
  if (process.argv.includes('--check')) {
    const manifest = await verifiedManifest().catch(error => {
      if (process.argv.includes('--allow-unbuilt') && error.code === 'ENOENT' && error.path === manifestPath) return null;
      throw error;
    });
    if (!manifest) {
      console.log('741 tiles are generated locally. The live surface is available on a clean checkout.');
      return;
    }
    console.log('741 tile manifest verified: ' + Object.keys(manifest.files).length + ' files, ' + manifest.version);
    return;
  }
  if (process.argv.includes('--adopt-existing')) {
    // One-time import of an existing local tile set. Subsequent rebuilds
    // are versioned, and the original asset URLs remain usable by older pages.
    const alreadyExists = await fs.stat(manifestPath).then(() => true, error => {
      if (error.code !== 'ENOENT') throw error;
      return false;
    });
    assert.equal(alreadyExists, false, 'A tile manifest already exists.');
    await replaceManifest(makeManifest(await tileInventory(destination), await inputHashes(), true));
    return;
  }
  const { chromium } = dependency('playwright');
  const sharp = dependency('sharp');
  const url = sourceUrl();
  const executablePath = process.env.TANG_TILES_CHROME || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : undefined);
  await fs.mkdir(destination, { recursive: true });
  const staging = await fs.mkdtemp(path.join(destination, '.build-'));
  const onlyHd = process.argv.includes('--base-hd');
  const chosen = onlyHd ? tiers.filter(tier => tier.hd) : tiers;
  const inputs = await inputHashes();
  let browser;
  try {
    for (const tier of ['mid', 'near']) await fs.mkdir(path.join(staging, tier));
    if (onlyHd) {
      const previous = await verifiedManifest();
      for (const name of Object.keys(previous.files)) {
        if (name !== 'base-hd.webp') {
          await fs.copyFile(path.join(destination, previous.directory, name), path.join(staging, name));
        }
      }
    }
    browser = await chromium.launch({ executablePath, headless: true,
      args: ['--disable-webgl', '--disable-gpu', '--disable-background-timer-throttling'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'zh-CN', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**/*', (route) => {
      const requested = new URL(route.request().url());
      return requested.origin === url.origin || ['blob:', 'data:'].includes(requested.protocol)
        ? route.continue() : route.abort();
    });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.atlasApp?.year === 741 && window.TANG_741_ATLAS &&
      window.JiangshanMapSurface && !window.atlasApp.svg.classList.contains('is-awaiting-snapshot') &&
      document.querySelectorAll('#grp-tang741-circuit-guides path').length === 2 &&
      document.querySelector('#grp-prefectures .prefecture-boundary-mesh'), {}, { timeout: 30000 });

    for (const tier of chosen) {
      tier.tileHeight = Math.round(tier.tileWidth * aspectHeight);
      const layout = await configureSource(page, tier);
      assert.equal(layout.countyDots > 0, tier.tier === 'near');
      console.log(tier.tier, `${tier.tileWidth}×${tier.tileHeight}`, JSON.stringify(layout));
      for (let row = 0; row < tier.grid; row += tier.batch) {
        for (let col = 0; col < tier.grid; col += tier.batch) {
          const image = await rasterize(page, { bounds: groupBounds(tier, row, col),
            width: tier.tileWidth * tier.batch, height: tier.tileHeight * tier.batch });
          await cropBatch(sharp, image, staging, tier, row, col);
          console.log(tier.tier, `batch ${row / tier.batch + 1},${col / tier.batch + 1} rendered`);
        }
      }
    }
    assert.deepEqual(await inputHashes(), inputs, 'Tile inputs changed during rasterization.');
    const manifest = makeManifest(await tileInventory(staging), inputs, false);
    const published = path.join(destination, manifest.directory);
    try {
      await fs.rename(staging, published);
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      assert.deepEqual(await tileInventory(published), manifest.files, 'Existing versioned directory has different contents.');
    }
    await replaceManifest(manifest);
    console.log('741 tile version: ' + manifest.version);
  } finally {
    if (browser) await browser.close();
    const prefix = destination + path.sep + '.build-';
    if (!path.resolve(staging).startsWith(prefix)) throw new Error('Unsafe tile build cleanup path.');
    await fs.rm(staging, { recursive: true, force: true });
  }
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
