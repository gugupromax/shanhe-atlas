const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const geo=require('../route-geometry.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/routes.js'),'utf8'),scope);
const data=scope.window.TAIHANG_ROUTES;
assert.equal(data.geometryKind,'schematic-waypoint-links');assert.equal(data.routes.length,8);
assert.equal(new Set(data.routes.map(r=>r.key)).size,8);
const norm=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(geo.clipSegment([-2,5],[12,5],[0,0,10,10]),[[0,5],[10,5]]);
assert.equal(geo.clipSegment([-2,-2],[-1,12],[0,0,10,10]),null);
assert.equal(geo.clipSegment([2,2],[2,2],[0,0,10,10]),null);
assert.deepEqual(geo.clipSegment([5,-5],[5,15],[0,0,10,10]),[[5,0],[5,10]]);
assert.equal(geo.clippedSegments([['a',2,2],['b',15,2],['c',15,8],['d',2,8]],[0,0,10,10]).length,2);
for(const route of data.routes){
  assert.ok(route.nodes.length>=3,route.key);assert.ok(route.sourceIds.length);
  for(const id of route.sourceIds)assert.ok(data.sources[id]?.url?.startsWith('https://'));
  const text=fs.readFileSync(path.join(root,'data',route.key+'.js'),'utf8');
  const local=JSON.parse(text.split(']=')[1].replace(/;\s*$/,''));
  const segments=geo.clippedSegments(norm(route.nodes),local.bounds);
  assert.ok(segments.length>0,route.key);
  for(const seg of segments)for(const [lon,lat] of seg){const [w,s,e,n]=local.bounds;assert.ok(lon>=w-1e-9&&lon<=e+1e-9&&lat>=s-1e-9&&lat<=n+1e-9,route.key);}
  console.log(route.key,route.nodes.length+' nodes',segments.length+' clipped segments');
}
assert.equal(data.routes.find(r=>r.key==='puyin').status,'disputed');
console.log('PASS: eight source-backed corridor diagrams, clipping and missing-data separation.');
