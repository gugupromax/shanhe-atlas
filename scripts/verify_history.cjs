const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),core=require('../history-core.js');
const w={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/history.js'),'utf8'),w);const data=w.window.JIANGSHAN_HISTORY;
require('./build_standalone_history.cjs').syncHistory(true);
const atlas = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/map_data.js'),'utf8'),atlas);
const periods = atlas.window.DYNASTY_DATA.filter(d => d.key !== 'prc');
const phaseKeys = new Set(periods.flatMap(d => d.phases?.length ? d.phases.map(p => p.snap) : ['s_' + d.key]));
assert.deepEqual(new Set(data.snapshotKeys),phaseKeys);
assert.equal(data.snapshotKeys.length,phaseKeys.size);
assert.equal(data.periods.length,17);assert.equal(data.metadata.layers.join(','),'polity');assert.ok(!data.snapshotKeys.includes('s_prc'));
for(let y=-403;y<=2026;y++){if(!y){assert.equal(core.findFrame(data,y),null);continue;}const frame=core.findFrame(data,y);assert.ok(frame,'no frame '+y);assert.ok(y>=frame.from&&y<=frame.to);if(y>=1949)assert.ok(frame.modern);else assert.ok(data.snapshotKeys.includes(frame.snapshot));}
assert.equal(core.findFrame(data,-221).title,'秦');assert.equal(core.findFrame(data,-222).title,'战国');assert.equal(core.findFrame(data,618).title,'唐');assert.equal(core.findFrame(data,617).title,'隋');assert.ok(core.findFrame(data,1949).modern);assert.equal(core.findFrame(data,2027),null);
for (const [year, expected] of [[1937,'s_roc'], [1938,'s_roc_1938'], [1944,'s_roc_1938'], [1945,'s_roc_c']]) {
  assert.equal(core.findFrame(data, year).snapshot, expected, 'War of Resistance boundary at ' + year);
}
for (const [year, title] of [[1940,'百团大战'], [1942,'长沙会战']]) {
  assert.ok(data.events.some(e => e.year === year && e.title.includes(title)), String(year));
}
let shapes=0;
for(const key of data.snapshotKeys){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/history',key+'.js'),'utf8'),c);const snap=c.window.JIANGSHAN_SNAPSHOTS[key];assert.ok(Array.isArray(snap.polities));assert.ok(!('prefectures'in snap)&&!('regions'in snap));for(const p of snap.polities){assert.ok(p.title);assert.ok(['Polygon','MultiPolygon'].includes(p.shape.type));shapes++;}}
for(const e of data.events){assert.ok(Number.isInteger(e.year)&&e.year!==0);assert.ok(e.title);assert.ok(Number.isFinite(e.coord[0])&&Number.isFinite(e.coord[1]));}
const national={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/national.js'),'utf8'),national);const grid=national.window.TAIHANG_GRIDS.national,raw=Buffer.from(grid.data,'base64');assert.equal(raw.length,grid.width*grid.height*2);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),grid.sha256);assert.ok(grid.min<-5000&&grid.max>6000);assert.deepEqual(Array.from(grid.bounds),[70,3,138,55]);
console.log(`PASS: all years -403..2026 (excluding year 0), ${data.snapshotKeys.length} snapshots, ${shapes} polity shapes, ${data.events.length} events, national DEM hash.`);
