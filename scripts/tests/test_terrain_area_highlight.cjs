'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const THREE = require('../../vendor/three.min.js');
const { create } = require('../../terrain-area-highlight.js');

function node() {
  const attributes = new Map();
  return {
    attributes,
    style: {},
    children: [],
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    appendChild(child) { this.children.push(child); },
  };
}

function fixture(projectPoint = (lon, lat) => new THREE.Vector3(lon, lat, 0)) {
  const labels = node();
  const stage = {
    clientWidth: 200,
    clientHeight: 100,
    ownerDocument: { createElementNS: node },
    querySelector(id) { return id === '#labels' ? labels : null; },
    insertBefore(child, before) {
      assert.equal(before, labels);
      this.overlay = child;
    },
  };
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5);
  camera.position.z = 2;
  camera.updateMatrixWorld();
  const highlight = create({ THREE, stage, projectPoint });
  const stroke = stage.overlay.children[1];
  return { highlight, stage, camera, stroke, path: () => stroke.attributes.get('d') };
}

test('3D boundary segments stay independent, track the camera and keep a screen-width stroke', () => {
  const { highlight, stage, camera, stroke, path } = fixture();
  highlight.set({ segments: [[[-0.5, 0], [0, 0]], [[0.5, 0], [0.8, 0]]] });
  highlight.render(camera);
  assert.equal(stage.overlay.id, 'fusion-area-highlight');
  assert.equal(stage.overlay.style.pointerEvents, 'none');
  assert.equal(stroke.attributes.get('stroke'), '#963d2a');
  assert.equal(stroke.attributes.get('stroke-width'), '3.5');
  assert.match(path(), /^M50\.0 50\.0L.*M150\.0 50\.0L/);
  assert.equal((path().match(/M/g) || []).length, 2);
  const original = path();
  camera.position.x = 0.1;
  camera.updateMatrixWorld();
  highlight.render(camera);
  assert.notEqual(path(), original);
  stage.clientWidth = 400;
  highlight.render(camera);
  assert.equal(stage.overlay.attributes.get('viewBox'), '0 0 400 100');
  assert.equal(stroke.attributes.get('stroke-width'), '3.5');

  highlight.clear();
  highlight.render(camera);
  assert.equal(stage.overlay.style.display, 'none');
  assert.equal(path(), undefined);
});

test('area outlines close rings individually and draw no quad or fill', () => {
  const { highlight, camera, stroke, path } = fixture();
  highlight.set({ shape: { type: 'MultiPolygon', coordinates: [
    [[[-0.5, 0], [0, 0], [0, 0.5]]],
    [[[0.5, 0], [0.75, 0], [0.75, 0.25]]],
  ] } });
  highlight.render(camera);
  const paths = path().split('M').slice(1);
  assert.equal(paths.length, 2);
  for (const line of paths) {
    const points = line.split('L');
    assert.equal(points[0], points.at(-1));
  }
  assert.equal(stroke.attributes.get('fill'), 'none');
});

test('county focus stays on its terrain coordinate, clips outside the view and clears on a new selection', () => {
  const { highlight, stage, camera } = fixture();
  const marker = stage.overlay.children[2];
  highlight.set({ point: [0.25, 0] });
  highlight.render(camera);
  assert.equal(stage.overlay.style.display, 'block');
  assert.equal(marker.attributes.get('cx'), 125);
  assert.equal(marker.attributes.get('cy'), 50);
  camera.zoom = 2;
  camera.updateProjectionMatrix();
  highlight.render(camera);
  assert.equal(marker.attributes.get('cx'), 150);
  assert.equal(marker.attributes.get('r'), '5.5');
  camera.position.x = 5;
  camera.updateMatrixWorld();
  highlight.render(camera);
  assert.equal(stage.overlay.style.display, 'none');
  highlight.set({ segments: [[[0, 0], [0.25, 0]]] });
  assert.equal(marker.style.display, 'none');
  highlight.clear();
  assert.equal(stage.overlay.style.display, 'none');
});

test('segments are clipped at the visible frustum and then cleared for an invalid selection', () => {
  const { highlight, stage, camera, path } = fixture((lon, lat) =>
    new THREE.Vector3(lon, 0, lat));
  highlight.set({ segments: [[[-2, 0], [0, 0], [1, 3]]] });
  highlight.render(camera);
  assert.match(path(), /^M0\.0 50\.0/);
  assert.doesNotMatch(path(), /Infinity|NaN/);
  assert.ok(path().includes('L100.0 50.0'));
  highlight.set({ shape: { type: 'Polygon' } });
  highlight.render(camera);
  assert.equal(stage.overlay.style.display, 'none');
  assert.equal(path(), undefined);
});
