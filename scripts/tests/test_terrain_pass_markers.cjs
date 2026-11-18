'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const THREE = require('../../vendor/three.min.js');
const gates = require('../../terrain-pass-markers.js');

test('the pass model has low walls, an open front and a footprint anchored at its map point', () => {
  const anchor = new THREE.Vector3(12, 3, -4);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  camera.position.set(12, 3, 96);
  camera.lookAt(anchor);
  camera.updateMatrixWorld();

  const { mesh, update, clearances } = gates.create(THREE, [anchor], 1, {width:9});
  update(camera, 600);
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  assert.ok(box.min.y < 0 && box.max.y > 0 && box.max.y < (box.max.x - box.min.x) / 2);

  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), anchor.toArray());
  const scale = new THREE.Vector3().setFromMatrixScale(matrix).x;
  const ray = new THREE.Raycaster(
    new THREE.Vector3(anchor.x, anchor.y + scale * .1, anchor.z + scale * 2),
    new THREE.Vector3(0, 0, -1)
  );
  const hit = ray.intersectObject(mesh, false)[0];
  assert.equal(hit?.instanceId, 0);
  assert.ok(hit.point.z < anchor.z, 'the view through the low front opening reaches the rear wall');

  const nearPixels=clearances[0].x;
  camera.position.z = 146;
  camera.lookAt(anchor);
  camera.updateMatrixWorld();
  update(camera, 600);
  mesh.getMatrixAt(0, matrix);
  assert.ok(Math.abs(new THREE.Vector3().setFromMatrixScale(matrix).x / scale - 1) < 1e-6,
    'normal zoom preserves the gate footprint in terrain coordinates');
  assert.ok(nearPixels > clearances[0].x * 1.35, 'the near gate grows on screen');

  for (const [z, expected] of [[46, 2], [496, .2]]) {
    camera.position.z = z;
    camera.updateMatrixWorld();
    update(camera, 600);
    mesh.getMatrixAt(0, matrix);
    assert.ok(Math.abs(new THREE.Vector3().setFromMatrixScale(matrix).x - scale) < 1e-6,
      'even very close and far views preserve the world footprint');
    assert.ok(Math.abs(clearances[0].x - nearPixels * expected) <= 2,
      'screen size follows the camera distance at both ends');
  }
});

test('nearby relief raises the wall and broadens the marker within the same view', () => {
  const anchors=[new THREE.Vector3(-4,0,0),new THREE.Vector3(4,0,0)];
  const camera=new THREE.PerspectiveCamera(40,1,.1,1000);
  camera.position.z=120;
  camera.updateMatrixWorld();
  const {mesh,update}=gates.create(THREE,anchors,1,{width:11,reliefs:[0,30]});
  update(camera,600);
  const matrix=new THREE.Matrix4();
  mesh.getMatrixAt(0,matrix);
  const plain=new THREE.Vector3().setFromMatrixScale(matrix);
  mesh.getMatrixAt(1,matrix);
  const mountain=new THREE.Vector3().setFromMatrixScale(matrix);
  assert.ok(mountain.x>plain.x);
  assert.ok(mountain.y>plain.y*1.2);
});

test('the sloped footing meets the sampled ground without stretching the gate', () => {
  const groundHeight=(x,z,step)=>(12-.85*x+.24*z)/step;
  const anchor=new THREE.Vector3(0,0,0);
  const {mesh,footing,alignToTerrain}=gates.create(THREE,[anchor],1,{
    width:11,reliefs:[20],groundHeight
  });
  const matrix=new THREE.Matrix4();
  let scale;
  for(const step of [1,4]){
    alignToTerrain(step);
    mesh.getMatrixAt(0,matrix);
    const nextScale=new THREE.Vector3().setFromMatrixScale(matrix).toArray();
    if(scale)assert.deepEqual(nextScale,scale);
    scale=nextScale;
    assert.ok(Math.abs(matrix.elements[13]-groundHeight(0,0,step))<1e-6);
    const positions=footing.geometry.getAttribute('position');
    assert.ok(positions.count>0,'the downhill side has a foundation wall');
    for(let quad=0;quad<positions.count;quad+=6){
      for(const offset of [1,2,4]){
        const i=quad+offset;
        assert.ok(positions.getY(i)<=groundHeight(positions.getX(i),positions.getZ(i),step)-.099);
      }
    }
  }
});
