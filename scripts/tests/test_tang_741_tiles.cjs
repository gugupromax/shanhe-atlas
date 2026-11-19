'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const tiles = require('../../tang-741-tiles.js');

test('tile rows meet in Mercator space and exact edges do not include neighbors', () => {
  const { coverage, plan, tileBounds } = tiles;
  assert.deepEqual(tileBounds('far', 0, 0), coverage);
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const top = tileBounds('near', 0, 0);
  const lower = tileBounds('near', 1, 0);
  assert.equal(top[1], lower[3]);
  assert.ok(Math.abs((y(top[3]) - y(top[1])) - (y(lower[3]) - y(lower[1]))) < 1e-12);
  assert.equal(tileBounds('near', 3, 1)[2], tileBounds('near', 3, 2)[0]);

  for (const [tier, size] of [['mid', 3], ['near', 8]]) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const bounds = tileBounds(tier, row, col);
        const grid = plan(tier, bounds);
        assert.equal(grid.tiles.length, 1);
        assert.equal(grid.tiles[0].path, `assets/tang-741-tiles/${tier}/${row}-${col}.png`);
        assert.deepEqual(grid.bounds, bounds);
      }
    }
  }

  assert.deepEqual(plan('mid', [-100, -80, 180, 85]).bounds, coverage);
  assert.equal(plan('near', [20, 30, 40, 40]), null);
  assert.equal(plan('near', [60, 31, NaN, 40]), null);
  assert.equal(plan('far', coverage), null);
  assert.equal(plan('../../elsewhere', coverage), null);
});

function fixture() {
  const images = [], canvases = [];
  const fail = new Set();
  const document = {
    createElement(name) {
      if (name === 'img') {
        return {
          naturalWidth: 1024, naturalHeight: 900,
          set src(path) {
            images.push(path);
            queueMicrotask(() => fail.delete(path) ? this.onerror() : this.onload());
          },
        };
      }
      assert.equal(name, 'canvas');
      const draw = [];
      const canvas = { draw, getContext: () => ({ drawImage: (_image, ...rect) => draw.push(rect) }) };
      canvases.push(canvas);
      return canvas;
    },
  };
  return { document, images, canvases, fail };
}

test('only requested tiles load and simultaneous requests share an aligned canvas', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document, maxSize: 1500 });
  const bounds = [tiles.tileBounds('near', 3, 3)[0], tiles.tileBounds('near', 4, 4)[1],
    tiles.tileBounds('near', 4, 4)[2], tiles.tileBounds('near', 3, 3)[3]];
  const [a, b] = await Promise.all([loader.loadDetail('near', bounds), loader.loadDetail('near', bounds)]);
  assert.equal(a, b);
  assert.equal(f.canvases.length, 1);
  assert.equal(f.images.length, 4);
  assert.deepEqual(f.images, loader.plan('near', bounds).tiles.map(({ path }) => path));
  assert.deepEqual(a.bounds, bounds);
  const { canvas } = a;
  assert.equal(canvas.width, 1500);
  assert.equal(canvas.height, Math.floor(1800 * (1500 / 2048)));
  const middle = Math.round(canvas.height / 2);
  assert.deepEqual(canvas.draw, [
    [0, 0, 750, middle], [750, 0, 750, middle],
    [0, middle, 750, canvas.height - middle], [750, middle, 750, canvas.height - middle],
  ]);
  assert.equal(await loader.loadDetail('near', bounds), a);
  assert.equal(await loader.loadDetail('far', bounds), null);
  assert.equal(f.images.length, 4);
});

test('a failed tile can be retried and the base image loads just once', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document });
  const basePath = 'assets/tang-741-tiles/base.png';
  f.fail.add(basePath);
  await assert.rejects(loader.loadBase(), /base\.png/);
  const base = await loader.loadBase();
  assert.equal(await loader.loadBase(), base);
  const bounds = tiles.tileBounds('mid', 1, 1);
  const tilePath = 'assets/tang-741-tiles/mid/1-1.png';
  f.fail.add(tilePath);
  await assert.rejects(loader.loadDetail('mid', bounds), /1-1\.png/);
  assert.equal((await loader.loadDetail('mid', bounds)).key, loader.plan('mid', bounds).key);
  assert.deepEqual(f.images, [basePath, basePath, tilePath, tilePath]);
});

test('large viewports can use a separate lossless base with a standard fallback', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document });
  const hd = 'assets/tang-741-tiles/base-hd.webp';
  const standard = 'assets/tang-741-tiles/base.png';
  f.fail.add(hd);
  assert.equal(await loader.loadBase(true), await loader.loadBase());
  const upgraded = await loader.loadBase(true);
  assert.equal(await loader.loadBase(true), upgraded);
  assert.notEqual(await loader.loadBase(), upgraded);
  assert.deepEqual(f.images, [hd, standard, hd]);
});

test('a 4096-pixel texture budget preserves three columns of source tiles', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document, maxSize: 4096 });
  const detail = await loader.loadDetail('mid', tiles.coverage);
  assert.deepEqual([detail.canvas.width, detail.canvas.height], [3072, 2700]);
  assert.equal(f.images.length, 9);
});

test('center preview picks the containing tile and reuses its request in the detail atlas', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document });
  const grid = loader.plan('near', tiles.coverage);
  const tile = grid.tiles.find(({bounds: [w, s, e, n]}) => 109 > w && 109 < e && 34 > s && 34 < n);
  const preview = await loader.loadCenter(grid, [109, 34]);
  assert.deepEqual(preview.bounds, tile.bounds);
  assert.deepEqual(f.images, [tile.path]);
  await loader.loadDetail('near', tiles.coverage);
  assert.equal(f.images.filter(path => path === tile.path).length, 1);
});

test('panning retains decoded neighbors in the new viewport without starting extra preview requests', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document });
  const grid = (col) => {
    const [west,,,north] = tiles.tileBounds('near', 3, col);
    const [,south,east] = tiles.tileBounds('near', 4, col+1);
    return loader.plan('near', [west, south, east, north]);
  };
  const firstView = grid(3), nextView = grid(4);
  const first = await loader.loadTiles(firstView);
  const [w,s,e,n] = nextView.tiles[1].bounds;
  const center = await loader.loadCenter(nextView, [(w+e)/2, (s+n)/2]);
  const partial = loader.availableTiles(nextView, center);
  assert.deepEqual(partial.map(tile => tile.image), [first[1].image, center.image, first[3].image]);
  assert.deepEqual(partial.map(tile => tile.bounds), nextView.tiles.slice(0,3).map(tile => tile.bounds));
  assert.equal(f.images.length, 5, 'the other missing tile has not been requested');
  assert.equal(f.canvases.length, 0);
  const complete = await loader.loadTiles(nextView);
  assert.equal(f.images.length, 6);
  assert.deepEqual(loader.availableTiles(nextView, center), complete);
});

test('versioned paths are local and match the validated manifest directory', async () => {
  const f = fixture();
  const version = 'v-0123456789abcdef';
  const manifest = { schema: 1, year: 741, version, directory: version };
  const decode = value => tiles.loadManifest(async url => {
    assert.equal(url, 'assets/tang-741-tiles/manifest.json');
    return { ok: true, json: async () => value };
  });
  const loader = tiles.create({ document: f.document, manifest: await decode(manifest) });
  await loader.loadBase();
  assert.deepEqual(f.images, ['assets/tang-741-tiles/' + version + '/base.png']);
  await assert.rejects(decode({...manifest, directory: '../elsewhere'}), /版本无效/);
  await assert.rejects(decode({...manifest, year: 742}), /版本无效/);
});

test('walking through more than 32 detail tiles evicts the least recently used tile', async () => {
  const f = fixture();
  const loader = tiles.create({ document: f.document });
  for (let i = 0; i < 33; i++) {
    await loader.loadDetail('near', tiles.tileBounds('near', Math.floor(i / 8), i % 8));
  }
  await loader.loadDetail('near', tiles.tileBounds('near', 0, 0));
  assert.equal(f.images.length, 34);
  assert.equal(f.images[0], f.images[33]);
});
