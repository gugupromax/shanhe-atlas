/* Small, ground-anchored gate symbols for the 3D historical atlas. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JiangshanTerrainGates = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function gateGeometry(THREE) {
    const source = new THREE.BoxGeometry(1, 1, 1);
    const cube = source.toNonIndexed();
    source.dispose();
    const positions = cube.getAttribute('position');
    const normals = cube.getAttribute('normal');
    const vertices = [];
    const colors = [];
    const top = new THREE.Color('#dec29a');
    const south = new THREE.Color('#a58666');
    const side = new THREE.Color('#78604b');
    const footing = new THREE.Color('#a98c6c');

    function box(x, y, z, width, height, depth, roof = top) {
      for (let i = 0; i < positions.count; i++) {
        vertices.push(x + positions.getX(i) * width, y + positions.getY(i) * height,
          z + positions.getZ(i) * depth);
        const color = normals.getY(i) > 0 ? roof : normals.getZ(i) > 0 ? south : side;
        colors.push(color.r, color.g, color.b);
      }
    }

    box(0, -.11, 0, 1, .26, .78, footing); // The footing sits partly in the ground.
    box(0, .084, -.33, .94, .168, .11);
    box(-.42, .084, 0, .12, .168, .65);
    box(.42, .084, 0, .12, .168, .65);
    box(0, .207, .28, .70, .077, .11); // Open gate below the lintel.
    box(-.33, .154, .28, .29, .308, .21);
    box(.33, .154, .28, .29, .308, .21);
    // The short ramparts reach out from the gate in the landscape.
    box(-.58, .055, .28, .25, .11, .11);
    box(.58, .055, .28, .25, .11, .11);
    box(0, .263, .275, .42, .045, .21, new THREE.Color('#a35943'));
    cube.dispose();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }

  // The main foot and the two projecting ramparts have different base heights.
  const feet = [
    [-.5, -.39, .5, .39, -.24],
    [-.705, .225, -.5, .335, 0],
    [.5, .225, .705, .335, 0],
  ];

  function footingSides(vertices, point, scale, rise, groundHeight, step) {
    for (const [west, north, east, south, base] of feet) {
      const outline = [[west,north],[east,north],[east,south],[west,south],[west,north]];
      const top = point.y + base * rise;
      for (let edge = 0; edge < 4; edge++) {
        const [x0,z0]=outline[edge], [x1,z1]=outline[edge+1];
        const segments = 16;
        let previous;
        for (let i=0; i<=segments; i++) {
          const t=i/segments;
          const x=point.x+(x0+(x1-x0)*t)*scale;
          const z=point.z+(z0+(z1-z0)*t)*scale;
          const low=Math.min(top,groundHeight(x,z,step)-.10);
          if (previous && (previous.low < top || low < top)) {
            vertices.push(previous.x,top,previous.z,previous.x,previous.low,previous.z,x,low,z,
              previous.x,top,previous.z,x,low,z,x,top,z);
          }
          previous={x,z,low};
        }
      }
    }
  }

  function create(THREE, anchors, opacity = 1, {width:referenceWidth = 1, reliefs = [], groundHeight} = {}) {
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, opacity, transparent: opacity < 1 });
    const mesh = new THREE.InstancedMesh(gateGeometry(THREE), material, anchors.length);
    mesh.name = 'atlas-pass-gates';
    mesh.visible = false;
    const footing=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({
      color:'#78604b',side:THREE.DoubleSide,opacity,transparent:opacity<1
    }));
    footing.name='atlas-pass-footings';
    footing.visible=false;
    const matrix = new THREE.Matrix4();
    const viewPoint = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    const modelWidth = bounds.max.x - bounds.min.x;
    const modelHeight = bounds.max.y;

    // Place the gate at a fixed size in terrain coordinates. The camera only
    // changes its projection, just as it does for the surrounding hills.
    const sizes = anchors.map((point, i) => {
      const relief = reliefs[i] || 0;
      const width = referenceWidth + Math.min(referenceWidth * .18, relief * .12);
      const height = Math.max(width * .16, Math.min(width * .28, relief * .15));
      const scale = width / modelWidth;
      return {width,scale,rise:height/modelHeight};
    });
    let groundStep;
    function alignToTerrain(step) {
      if (groundStep === step) return;
      groundStep = step;
      const vertices=[];
      anchors.forEach((point,i)=>{
        const {scale,rise}=sizes[i];
        if(groundHeight){
          point.y=groundHeight(point.x,point.z,step);
          footingSides(vertices,point,scale,rise,groundHeight,step);
        }
        matrix.makeScale(scale,rise,scale).setPosition(point);
        mesh.setMatrixAt(i,matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      footing.geometry.dispose();
      footing.geometry=geometry;
    }
    alignToTerrain(1);
    const clearances = anchors.map(() => ({x:0, y:0}));

    function update(camera, viewportHeight) {
      const perPixel = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, viewportHeight);
      anchors.forEach((point, i) => {
        viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse);
        const depth = Math.max(camera.near, -viewPoint.z);
        // Screen measurements are for caption spacing only.
        const pixels = sizes[i].width / (depth * perPixel);
        clearances[i].x = Math.ceil(pixels * .58);
        clearances[i].y = Math.ceil(pixels * .46);
      });
    }
    return { mesh, footing, alignToTerrain, update, anchors, clearances };
  }

  return { create };
});
