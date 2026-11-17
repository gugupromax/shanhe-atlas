/* Local in-memory atlas overlays. This module contains no map data. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JiangshanFusionLayers = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const array = value => Array.isArray(value) ? value : [];
  const record = value => value && typeof value === 'object' ? value : {};
  const coreRoles = new Set(['main', 'rival', 'protectorate']);
  const order = { neighbor: 0, main: 1, rival: 2, protectorate: 3 };
  const role = item => item.category || item.role;
  const color = (value, fallback) => typeof value === 'string' &&
    /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : fallback;

  function projector(bounds, width, height) {
    if (!Array.isArray(bounds) || bounds.length !== 4 || !Array.from(bounds).every(Number.isFinite) ||
        !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const [w, s, e, n] = bounds;
    if (w < -180 || e > 180 || s < -90 || n > 90 || e <= w || n <= s) return null;
    // Terrain UVs, unlike world-space mesh vertices, are spaced linearly in lat/lon.
    return coord => {
      if (!Array.isArray(coord) || coord.length < 2 || !Number.isFinite(coord[0]) ||
          !Number.isFinite(coord[1]) || Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90) return null;
      const x = (coord[0] - w) / (e - w) * width;
      const y = (n - coord[1]) / (n - s) * height;
      return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    };
  }

  function area(ring) {
    // Translate before computing area to avoid cancellation far outside the viewport.
    const [ox, oy] = ring[0];
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      sum += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy);
    }
    return sum;
  }

  function polygons(shape, project) {
    shape = record(shape);
    const source = shape.type === 'Polygon' ? [shape.coordinates] :
      shape.type === 'MultiPolygon' ? array(shape.coordinates) : [];
    const result = [];
    for (const polygon of source) {
      if (!Array.isArray(polygon) || !polygon.length) continue;
      const rings = [];
      for (const sourceRing of polygon) {
        if (!Array.isArray(sourceRing) || sourceRing.length < 3) break;
        const ring = Array.from(sourceRing, project);
        if (ring.some(point => !point)) break;
        const signedArea = area(ring);
        if (!Number.isFinite(signedArea) || signedArea === 0) break;
        rings.push(ring);
      }
      // Reject a broken polygon as a whole: dropping a hole would paint invalid land.
      if (rings.length === polygon.length) result.push(rings);
    }
    return result;
  }

  function appendPolygon(ctx, polygon, oriented) {
    for (let r = 0; r < polygon.length; r++) {
      const ring = polygon[r];
      // Nonzero clipping builds a union of shells while retaining each polygon's holes.
      const reverse = oriented && (area(ring) > 0) !== (r === 0);
      const first = reverse ? ring.length - 1 : 0;
      ctx.moveTo(ring[first][0], ring[first][1]);
      for (let i = 1; i < ring.length; i++) {
        const point = ring[reverse ? ring.length - 1 - i : i];
        ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
    }
  }

  function strokePolygons(ctx, items, project, stroke, alpha, width) {
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.setLineDash([]);
    for (const item of array(items)) {
      for (const polygon of polygons(record(item).shape, project)) {
        ctx.beginPath();
        appendPolygon(ctx, polygon, false);
        ctx.stroke();
      }
    }
  }

  function strokeLines(ctx, source, project) {
    // Accept a LineString, MultiLineString or nested arrays of individual lines.
    // Iteration avoids recursive stack exhaustion on malformed nested input.
    const pending = [source];
    const seen = new Set();
    let drawn = false;
    ctx.beginPath();
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (!Array.isArray(value)) {
        if (value.type === 'LineString' || value.type === 'MultiLineString') pending.push(value.coordinates);
        continue;
      }
      if (!value.length) continue;
      // A candidate line contains coordinate tuples. Invalid tuples become gaps.
      if (value.some(point => Array.isArray(point) && typeof point[0] === 'number')) {
        let previous = null;
        let started = false;
        for (const coordinate of value) {
          const point = project(coordinate);
          if (!point) { previous = null; started = false; continue; }
          if (previous) {
            if (!started) ctx.moveTo(previous[0], previous[1]);
            ctx.lineTo(point[0], point[1]);
            started = true;
            drawn = true;
          }
          previous = point;
        }
      } else {
        for (let i = value.length - 1; i >= 0; i--) pending.push(value[i]);
      }
    }
    if (drawn) ctx.stroke();
  }

  /** Paint onto the existing terrain texture without clearing it or changing input data.
   * options: {snapshot:{polities,regions,prefectures}, layers, overlays, bounds, width, height}.
   * Every layer is opt-in. Coordinates map to terrain UV pixels, north at y=0.
   */
  function draw(ctx, options) {
    options = record(options);
    const project = projector(options.bounds, options.width, options.height);
    if (!ctx || !project) return;
    const snapshot = record(options.snapshot), layers = record(options.layers);
    const overlays = record(options.overlays);
    const polities = array(snapshot.polities).filter(item => item && typeof item === 'object');
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      ctx.rect(0, 0, options.width, options.height);
      ctx.clip();
      if (layers.polities === true) {
        const sorted = polities.slice().sort((a, b) => (order[role(a)] || 0) - (order[role(b)] || 0));
        for (const item of sorted) {
          ctx.fillStyle = color(item.tint, '#b48e64');
          ctx.strokeStyle = color(item.tint, '#6c5944');
          ctx.lineWidth = role(item) === 'neighbor' ? 1 : 1.5;
          ctx.setLineDash(role(item) === 'protectorate' ? [5, 3] : []);
          for (const polygon of polygons(item.shape, project)) {
            ctx.beginPath();
            appendPolygon(ctx, polygon, false);
            ctx.globalAlpha = role(item) === 'neighbor' ? 0.16 : 0.42;
            ctx.fill('evenodd');
            ctx.globalAlpha = 0.8;
            ctx.stroke();
          }
        }
      }
      if (layers.prefectures === true) {
        const clipPolygons = polities.filter(item => coreRoles.has(role(item)))
          .flatMap(item => polygons(item.shape, project));
        ctx.save();
        try {
          if (clipPolygons.length) {
            ctx.beginPath();
            for (const polygon of clipPolygons) appendPolygon(ctx, polygon, true);
            ctx.clip('nonzero');
          }
          strokePolygons(ctx, snapshot.prefectures, project, '#625743', 0.42, 0.65);
          strokePolygons(ctx, snapshot.regions, project, '#66513d', 0.72, 1.2);
        } finally { ctx.restore(); }
      }
      ctx.setLineDash([]);
      if (layers.modernProvinces === true) {
        strokePolygons(ctx, overlays.provinces, project, '#59675b', 0.6, 1);
      }
      if (layers.hydro === true) {
        ctx.fillStyle = '#7fa9b4';
        ctx.strokeStyle = '#4e8291';
        ctx.lineWidth = 0.85;
        for (const lake of array(overlays.lakes)) {
          const item = record(lake);
          for (const polygon of polygons(item.shape || { type: 'Polygon', coordinates: item.rings }, project)) {
            ctx.beginPath();
            appendPolygon(ctx, polygon, false);
            ctx.globalAlpha = 0.65;
            ctx.fill('evenodd');
            ctx.globalAlpha = 0.85;
            ctx.stroke();
          }
        }
        ctx.strokeStyle = '#477e91';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.25;
        for (const river of array(overlays.rivers)) strokeLines(ctx, record(river).lines, project);
      }
      if (layers.corridors === true) {
        ctx.strokeStyle = '#963f2c';
        ctx.globalAlpha = 0.82;
        ctx.lineWidth = 1.7;
        ctx.setLineDash([7, 4]);
        for (const corridor of array(overlays.corridors)) strokeLines(ctx, record(corridor).segments, project);
      }
    } finally { ctx.restore(); }
  }
  return { draw };
});
