/* Load the pre-rendered, locally hosted Tang 741 historical map. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JiangshanTangTiles = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const rootPath = 'assets/tang-741-tiles/';
  const timeoutMs = 12000;
  const coverage = Object.freeze([40, -10, 165, 70]);
  const [west, south, east, north] = coverage;
  const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const latitude = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
  const northY = mercatorY(north);
  const spanY = northY - mercatorY(south);
  const grids = new Map([['mid', 3], ['near', 8]]);

  async function loadManifest(fetch) {
    const response = await fetch(rootPath + 'manifest.json', {
      cache: 'no-cache', signal: AbortSignal.timeout?.(timeoutMs),
    });
    if (!response.ok) throw new Error('无法读取唐 741 年瓦片清单。');
    const manifest = await response.json();
    if (manifest.schema !== 1 || manifest.year !== 741 ||
        !/^v-[a-f0-9]{16}$/.test(manifest.version) ||
        (manifest.directory !== '' && manifest.directory !== manifest.version)) {
      throw new Error('唐 741 年瓦片清单版本无效。');
    }
    return manifest;
  }

  function tileBounds(tier, row, col) {
    if (tier === 'far' && row === 0 && col === 0) return coverage.slice();
    const size = grids.get(tier);
    if (!size || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= size || col >= size) return null;
    return [
      west + (east - west) * col / size,
      row + 1 === size ? south : latitude(northY - spanY * (row + 1) / size),
      west + (east - west) * (col + 1) / size,
      row === 0 ? north : latitude(northY - spanY * row / size),
    ];
  }

  function plan(tier, bounds) {
    const size = grids.get(tier);
    if (!size || !Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) return null;
    const w = Math.max(west, bounds[0]);
    const s = Math.max(south, bounds[1]);
    const e = Math.min(east, bounds[2]);
    const n = Math.min(north, bounds[3]);
    if (w >= e || s >= n) return null;

    const xIndex = (lon) => size * (lon - west) / (east - west);
    const yIndex = (lat) => size * (northY - mercatorY(lat)) / spanY;
    // Inverse projection can introduce tiny rounding errors at an exact tile edge.
    const snap = (value) => Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value;
    const minIndex = (edge) => Math.max(0, Math.min(size - 1, Math.floor(snap(edge))));
    const maxIndex = (edge) => Math.max(0, Math.min(size - 1, Math.ceil(snap(edge)) - 1));
    const colStart = minIndex(xIndex(w)), colEnd = Math.max(colStart, maxIndex(xIndex(e)));
    const rowStart = minIndex(yIndex(n)), rowEnd = Math.max(rowStart, maxIndex(yIndex(s)));
    const northwest = tileBounds(tier, rowStart, colStart);
    const southeast = tileBounds(tier, rowEnd, colEnd);
    const tiles = [];
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        tiles.push({ x: col - colStart, y: row - rowStart,
          path: `${rootPath}${tier}/${row}-${col}.png`, bounds: tileBounds(tier, row, col) });
      }
    }
    return {
      tier, key: `${tier}:${rowStart}-${rowEnd}:${colStart}-${colEnd}`,
      columns: colEnd - colStart + 1, rows: rowEnd - rowStart + 1,
      bounds: [northwest[0], southeast[1], southeast[2], northwest[3]], tiles,
    };
  }

  function create({ document, maxSize = 2048, manifest }) {
    const maxExtent = Number.isFinite(maxSize) ? Math.max(8, Math.min(4096, Math.floor(maxSize))) : 2048;
    const cache = new Map();
    const loading = new Map();
    const composing = new Map();
    const bases = new Map();
    let lastDetail;
    let detailSequence = 0;

    function readImage(path) {
      return new Promise((resolve, reject) => {
        const image = document.createElement('img');
        image.decoding = 'async';
        const finish = (error) => {
          clearTimeout(timer);
          image.onload = image.onerror = null;
          if (error) reject(new Error(error + path));
          else resolve(image);
        };
        const timer = setTimeout(() => {
          finish('唐 741 年地图瓦片加载超时：');
          image.removeAttribute('src');
        }, timeoutMs);
        image.onload = () => finish();
        image.onerror = () => finish('无法读取唐 741 年地图瓦片：');
        image.src = manifest?.directory ? rootPath + manifest.directory + '/' + path.slice(rootPath.length)
          : manifest ? path + '?v=' + manifest.version : path;
      });
    }

    function loadBase(hd = false) {
      const name = hd ? 'base-hd.webp' : 'base.png';
      if (!bases.has(name)) {
        bases.set(name, readImage(rootPath + name).catch((error) => {
          bases.delete(name);
          if (hd) return loadBase();
          throw error;
        }));
      }
      return bases.get(name);
    }

    function loadTile(path) {
      if (cache.has(path)) {
        const image = cache.get(path);
        cache.delete(path);
        cache.set(path, image);
        return Promise.resolve(image);
      }
      if (!loading.has(path)) {
        loading.set(path, readImage(path).then((image) => {
          cache.set(path, image);
          if (cache.size > 32) cache.delete(cache.keys().next().value);
          return image;
        }).finally(() => loading.delete(path)));
      }
      return loading.get(path);
    }

    function stitch(grid, images) {
      const canvas = document.createElement('canvas');
      const nativeWidth = images[0].naturalWidth * grid.columns;
      const nativeHeight = images[0].naturalHeight * grid.rows;
      const scale = Math.min(1, maxExtent / Math.max(nativeWidth, nativeHeight));
      canvas.width = Math.max(grid.columns, Math.floor(nativeWidth * scale));
      canvas.height = Math.max(grid.rows, Math.floor(nativeHeight * scale));
      // A short-lived texture atlas only needs a CPU backing surface.
      // Allocating a second accelerated canvas competes with WebGL startup.
      const started = document.defaultView?.performance.now();
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('浏览器无法拼接唐 741 年地图瓦片。');
      for (let index = 0; index < grid.tiles.length; index++) {
        const { x, y } = grid.tiles[index];
        const left = Math.round(x * canvas.width / grid.columns);
        const right = Math.round((x + 1) * canvas.width / grid.columns);
        const top = Math.round(y * canvas.height / grid.rows);
        const bottom = Math.round((y + 1) * canvas.height / grid.rows);
        context.drawImage(images[index], left, top, right - left, bottom - top);
      }
      if (started !== undefined) document.defaultView.performance.measure('atlas-3d:tile-compose', { start: started });
      return { canvas, bounds: grid.bounds, key: grid.key };
    }

    function loadDetail(tier, bounds) {
      const grid = plan(tier, bounds);
      if (!grid) return Promise.resolve(null);
      const sequence = ++detailSequence;
      if (lastDetail?.key === grid.key) return Promise.resolve(lastDetail);
      if (!composing.has(grid.key)) {
        composing.set(grid.key, Promise.all(grid.tiles.map(({ path }) => loadTile(path)))
          .then((images) => stitch(grid, images)).finally(() => composing.delete(grid.key)));
      }
      return composing.get(grid.key).then((detail) => {
        if (sequence === detailSequence) lastDetail = detail;
        return detail;
      });
    }

    function loadCenter(grid, [lng, lat]) {
      // The center may be clamped at the coverage edge. The first match is
      // deterministic for a center exactly on a shared edge.
      const tile = grid.tiles.find(({ bounds: [w, s, e, n] }) =>
        lng >= w && lng <= e && lat >= s && lat <= n) || grid.tiles[0];
      return loadTile(tile.path).then((image) => ({ image, bounds: tile.bounds }));
    }

    function loadTiles(grid) {
      return Promise.all(grid.tiles.map(async ({ path, bounds }) => ({ image: await loadTile(path), bounds })));
    }

    return { loadBase, loadCenter, loadDetail, loadTiles, plan };
  }

  return { coverage, tileBounds, plan, create, loadManifest };
});
