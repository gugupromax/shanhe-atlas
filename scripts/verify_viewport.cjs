const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const T=require('../vendor/three.min.js'),geo=require('../viewport-geometry.js');
const frame=geo.createFrame([40,-10,165,70],true),guard=geo.createGuard(T);
for(const [lon,lat] of [[66,14],[142,55],[104,35],[121,23.7],[40,-10],[165,70]]){const p=frame.toWorld(lon,lat),round=frame.toGeo(p.x,p.z);assert.ok(Math.abs(round[0]-lon)<1e-8);assert.ok(Math.abs(round[1]-lat)<1e-8);}
for(const aspect of [.46,1,1.9,3.5])for(const phi of [.012,.18,.8,1.05])for(const angle of [0,1.1,2.8]){
  const input={theta:angle,phi,distance:80000,x:999999,z:-999999},view=guard.constrain(input,frame,aspect,40,-30,150),box=guard.footprint(view,aspect,40,-30,150);
  assert.ok(box);assert.ok(view.distance<input.distance);
  for(const x of [box.minX,box.maxX])assert.ok(x+view.x>-frame.width/2&&x+view.x<frame.width/2,'x outside terrain');
  for(const z of [box.minZ,box.maxZ])assert.ok(z+view.z>-frame.depth/2&&z+view.z<frame.depth/2,'z outside terrain');
}
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/context.js'),'utf8'),ctx);
const data=ctx.window.TAIHANG_GRIDS.context,raw=Buffer.from(data.data,'base64');assert.equal(raw.length,data.width*data.height*2);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),data.sha256);assert.deepEqual(Array.from(data.bounds),[40,-10,165,70]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/context_manifest.json'),'utf8'));assert.deepEqual(manifest.initialViewBounds,[66,14,142,55]);
let limit=guard.constrain({theta:0,phi:.08,distance:80000,x:0,z:0},frame,1.92,40,-30,150);
for(let i=0;i<10;i++){const next=guard.constrain({...limit,distance:limit.distance*1.25},frame,1.92,40,-30,150);assert.ok(Math.abs(next.distance-limit.distance)<.02,'zoom-out limit drifts or zooms inward');limit=next;}
// Flat boxes are legitimate town models. The terrain itself must be built from its DEM.
const terrainSource=fs.readFileSync(path.join(root,'terrain-app.js'),'utf8');
const groundBuilders=terrainSource.slice(terrainSource.indexOf('  function terrainPatch('),terrainSource.indexOf('  function rebuildMarkers('));
assert.ok(groundBuilders.includes('function buildEmbeddedMeshes(')&&groundBuilders.includes('function build(d)'));
assert.ok(!groundBuilders.includes('new THREE.BoxGeometry'),'terrain must not introduce a slab under the DEM');
const whole=geo.meshIndices(12,10),tiled=geo.meshIndices(12,10,4);
const triangles=(indices)=>{
  const list=[];
  for(let i=0;i<indices.length;i+=3)list.push(Array.from(indices.slice(i,i+3)).join(','));
  return list.sort();
};
assert.deepEqual(triangles(tiled.indices),triangles(whole.indices),'near tiles retain each original triangle with no seams or overlap');
const overview=geo.meshIndices(12,10,12,4);
assert.equal(overview.indices.length,54);
assert.ok(overview.indices.includes(119),'overview reaches the final row and column despite partial steps');
// Compare the memory-bounded grid lighting to THREE's indexed normals, including
// boundary vertices, nonuniform row spacing and reusing the same buffer after a height change.
const normalGrid=new T.BufferGeometry(), normalWidth=13, normalHeight=10;
const gridPositions=new Float32Array(normalWidth*normalHeight*3);
normalGrid.setAttribute('position',new T.BufferAttribute(gridPositions,3));
const topology=geo.meshIndices(normalWidth,normalHeight,4);
assert.deepEqual(topology.tiles,geo.meshTiles(normalWidth,normalHeight,4));
normalGrid.setIndex(new T.BufferAttribute(topology.indices,1));
const reusableNormals=new Float32Array(gridPositions.length);
for(const scale of [0,1,120]){
  for(let r=0;r<normalHeight;r++)for(let c=0;c<normalWidth;c++){
    const i=(r*normalWidth+c)*3;
    gridPositions[i]=c*2;gridPositions[i+1]=Math.sin(r+c*c)*scale;gridPositions[i+2]=r*(1+r*.15);
  }
  normalGrid.computeVertexNormals();
  assert.equal(geo.gridNormals(normalWidth,normalHeight,gridPositions,reusableNormals),reusableNormals);
  for(let i=0;i<reusableNormals.length;i++){
    assert.ok(Math.abs(reusableNormals[i]-normalGrid.attributes.normal.array[i])<2e-6);
  }
  for(let i=0;i<reusableNormals.length;i+=3){
    assert.ok(reusableNormals[i+1]>0,'terrain normals face upwards');
    assert.ok(Math.abs(Math.hypot(reusableNormals[i],reusableNormals[i+1],reusableNormals[i+2])-1)<1e-6);
  }
}
// Exercise packed production geometry against the original full-grid vertices.
const sourceGrid=new T.BufferGeometry();
const sourcePositions=new Float32Array(12*10*3);
for(let i=0;i<sourcePositions.length;i++)sourcePositions[i]=i;
sourceGrid.setAttribute('position',new T.BufferAttribute(sourcePositions,3));
sourceGrid.setAttribute('normal',new T.BufferAttribute(sourcePositions.slice(),3));
sourceGrid.setAttribute('uv',new T.BufferAttribute(new Float32Array(12*10*2),2));
const {terrainPatch,fillTerrainPatch}=new Function('THREE','viewportGeometry','geometry','dataset',
  terrainSource.slice(terrainSource.indexOf('  function terrainPatch('),terrainSource.indexOf('  function buildEmbeddedMeshes('))+
  '\nreturn {terrainPatch,fillTerrainPatch};')(T,geo,sourceGrid,{width:12});
const bounds=new T.Box3(new T.Vector3(0,0,0),new T.Vector3(1,1,1));
const left=terrainPatch(bounds,null,{row:0,col:0,lastRow:4,lastCol:4},1);
const right=terrainPatch(bounds,null,{row:0,col:4,lastRow:4,lastCol:8},1);
assert.equal(left.geometry.index,null,'unseen patches have no GPU buffers');
fillTerrainPatch(left);fillTerrainPatch(right);
assert.equal(left.geometry.attributes.position.count,25);
assert.ok(left.geometry.index.array instanceof Uint16Array);
for(let row=0;row<5;row++)for(const name of ['position','normal']){
  const a=left.geometry.attributes[name].array,b=right.geometry.attributes[name].array;
  assert.deepEqual(a.slice((row*5+4)*3,(row*5+5)*3),b.slice(row*15,row*15+3),'seam vertices agree');
}
const coarse=terrainPatch(bounds,null,{row:0,col:0,lastRow:9,lastCol:11},4);
fillTerrainPatch(coarse);
assert.equal(coarse.geometry.attributes.position.getX(15),sourcePositions[119*3]);
sourceGrid.attributes.position.setY(0,1234);fillTerrainPatch(left);
assert.equal(left.geometry.attributes.position.getY(0),1234,'height changes reach rendered patches');
console.log('PASS: Mercator geographic roundtrips, 48 tilt/viewport/pan clamp cases, buffered DEM hash and upstream view bounds; no slab base.');
