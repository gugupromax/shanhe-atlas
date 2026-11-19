const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const THREE = require('../../vendor/three.min.js');
const {createFrame, meshIndices} = require('../../viewport-geometry.js');

test('map anchors and selected outlines use the rendered triangles at both terrain detail levels', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../terrain-app.js'), 'utf8');
  const functionSource = (name, next) => source.slice(
    source.indexOf('  function ' + name + '('), source.indexOf('  function ' + next + '('));
  const dataset = {bounds:[100,30,101,31],width:8,height:7};
  const frame = createFrame(dataset.bounds, true);
  const geometry = new THREE.BufferGeometry();
  const vertices = new THREE.BufferAttribute(new Float32Array(dataset.width * dataset.height * 3), 3);
  geometry.setAttribute('position', vertices);
  const overview = {visible:false};
  const xyz = new Function('THREE','dataset','geometry','mapFrame','terrainOverview',
    'const embedded=true;' + functionSource('terrainSurfaceHeight','gateSite') + functionSource('xyz','isSeaAt') + 'return xyz;'
  )(THREE, dataset, geometry, frame, overview);
  const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const ray = new THREE.Raycaster();
  for (const exaggeration of [1,20,120]) {
    for (let r=0; r<dataset.height; r++) for (let c=0; c<dataset.width; c++) {
      const lat=31-r/(dataset.height-1), p=frame.toWorld(100+c/(dataset.width-1),lat);
      // This nonlinear ridge deliberately has different bilinear, near and overview heights.
      const y=((r*c+c)%7)/7 * exaggeration * frame.heightScale(lat);
      vertices.setXYZ(r*dataset.width+c,p.x,y,p.z);
    }
    geometry.computeBoundingSphere();
    for (const step of [1,4]) {
      overview.visible=step===4;
      geometry.setIndex(new THREE.BufferAttribute(meshIndices(dataset.width,dataset.height,16,step).indices,1));
      const mesh=new THREE.Mesh(geometry,material);
      for (const [lon,lat] of [[100.02,30.98],[100.19,30.85],[100.57,30.53],[100.91,30.03],[100.999,30.001]]) {
        const anchor=xyz(lon,lat);
        ray.set(new THREE.Vector3(anchor.x,1000,anchor.z),new THREE.Vector3(0,-1,0));
        const ground=ray.intersectObject(mesh,false)[0];
        assert.ok(ground);
        assert.ok(Math.abs(anchor.y-ground.point.y)<1e-6,'the anchor matches the ray-picked mesh at step '+step);
        assert.ok(Math.abs(xyz(lon,lat,0.15).y-ground.point.y-0.15)<1e-6,'route/label offset measured from ground');
      }
    }
  }
});
