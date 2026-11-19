/* Camera-projected outlines for selected areas on the 3D terrain. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JiangshanTerrainHighlight = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SAMPLE_DEGREES = 0.08;

  function sourceLines(selection) {
    if (Array.isArray(selection?.segments)) return selection.segments;
    const shape = selection?.shape;
    if (!Array.isArray(shape?.coordinates)) return [];
    if (shape?.type === 'Polygon') return shape.coordinates;
    if (shape?.type === 'MultiPolygon') return shape.coordinates.flat();
    return [];
  }

  function sampledLines(selection) {
    const lines = [];
    for (const line of sourceLines(selection)) {
      if (!Array.isArray(line) || line.length < 2 || !line.every(point =>
        Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 180 && Math.abs(point[1]) < 85.1)) continue;
      const first = line[0];
      const last = line.at(-1);
      const close = !Array.isArray(selection.segments) &&
        (first[0] !== last[0] || first[1] !== last[1]);
      const samples = [first];
      for (let i = 1; i < line.length + Number(close); i++) {
        const [lon, lat] = line[i - 1];
        const [nextLon, nextLat] = line[i] || first;
        const deltaLon = nextLon - lon;
        const deltaLat = nextLat - lat;
        const steps = Math.min(128, Math.max(1,
          Math.ceil(Math.max(Math.abs(deltaLon), Math.abs(deltaLat)) / SAMPLE_DEGREES)));
        for (let j = 1; j <= steps; j++) {
          samples.push([lon + deltaLon * j / steps, lat + deltaLat * j / steps]);
        }
      }
      lines.push(samples);
    }
    return lines;
  }

  // Clip in homogeneous space before dividing by w. This avoids joined or
  // mirrored strokes when a selected boundary crosses behind the camera.
  function clipRange(a, b) {
    let start = 0;
    let end = 1;
    for (const axis of ['x', 'y', 'z']) {
      for (const direction of [-1, 1]) {
        const from = a.w + direction * a[axis];
        const to = b.w + direction * b[axis];
        if (from < 0 && to < 0) return null;
        if (from < 0) start = Math.max(start, from / (from - to));
        else if (to < 0) end = Math.min(end, from / (from - to));
        if (start > end) return null;
      }
    }
    return [start, end];
  }

  function create({ THREE, stage, projectPoint }) {
    const svg = stage.ownerDocument.createElementNS(SVG_NS, 'svg');
    svg.id = 'fusion-area-highlight';
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      overflow: 'hidden', pointerEvents: 'none', display: 'none',
    });
    function outline(color, width) {
      const path = stage.ownerDocument.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', width);
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
      return path;
    }
    const casing = outline('#fff9e8', '5.5');
    const stroke = outline('#963d2a', '3.5');
    const marker = stage.ownerDocument.createElementNS(SVG_NS, 'circle');
    marker.setAttribute('r', '5.5');
    marker.setAttribute('fill', '#963d2a');
    marker.setAttribute('stroke', '#fff9e8');
    marker.setAttribute('stroke-width', '2');
    svg.appendChild(marker);
    stage.insertBefore(svg, stage.querySelector('#labels'));

    const projection = new THREE.Matrix4();
    const a = new THREE.Vector4();
    const b = new THREE.Vector4();
    const clipped = new THREE.Vector4();
    let lines = [];
    let previousSelection;

    function clear() {
      previousSelection = null;
      lines = [];
      marker.style.display = 'none';
      svg.style.display = 'none';
      casing.removeAttribute('d');
      stroke.removeAttribute('d');
    }

    function set(selection) {
      if (selection === previousSelection) return;
      clear();
      previousSelection = selection;
      lines = sampledLines(selection);
    }

    function project(coord, target) {
      const point = projectPoint(coord[0], coord[1]);
      if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return false;
      target.set(point.x, point.y, point.z, 1).applyMatrix4(projection);
      return true;
    }

    function render(camera) {
      const point = previousSelection?.point;
      if (!point && !lines.length) return;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) {
        svg.style.display = 'none';
        return;
      }
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      if (point) {
        const visible = project(point, a) && a.w > 0 && clipRange(a, a);
        svg.style.display = visible ? 'block' : 'none';
        if (visible) {
          marker.setAttribute('cx', (a.x / a.w * 0.5 + 0.5) * width);
          marker.setAttribute('cy', (0.5 - a.y / a.w * 0.5) * height);
          marker.style.display = '';
        }
        return;
      }
      const screenPoint = (fraction) => {
        clipped.copy(a).lerp(b, fraction);
        if (clipped.w <= 0) return null;
        const x = (clipped.x / clipped.w * 0.5 + 0.5) * width;
        const y = (0.5 - clipped.y / clipped.w * 0.5) * height;
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
      };
      let d = '';
      for (const line of lines) {
        let previous = '';
        let haveStart = project(line[0], a);
        for (let i = 1; i < line.length; i++) {
          const haveEnd = project(line[i], b);
          const range = haveStart && haveEnd ? clipRange(a, b) : null;
          if (range) {
            const from = screenPoint(range[0]);
            const to = screenPoint(range[1]);
            if (from && to) {
              if (from !== previous) d += `M${from}`;
              d += `L${to}`;
              previous = to;
            } else previous = '';
          } else previous = '';
          if (haveEnd) a.copy(b);
          haveStart = haveEnd;
        }
      }
      svg.style.display = d ? 'block' : 'none';
      casing.setAttribute('d', d);
      stroke.setAttribute('d', d);
    }

    return { set, render, clear };
  }

  return { create };
});
