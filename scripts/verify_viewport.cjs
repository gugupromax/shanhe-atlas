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
assert.ok(!fs.readFileSync(path.join(root,'terrain-app.js'),'utf8').includes('new THREE.BoxGeometry'));
console.log('PASS: Mercator geographic roundtrips, 48 tilt/viewport/pan clamp cases, buffered DEM hash and upstream view bounds; no slab base.');
