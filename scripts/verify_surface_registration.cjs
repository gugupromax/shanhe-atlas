const assert=require('node:assert/strict');
const geometry=require('../viewport-geometry.js'),surface=require('../map-surface-material.js'),protocol=require('../fusion-protocol.js');
const coverage=[40,-10,165,70],detail=[100,20,125,50],frame=geometry.createFrame(coverage,true),rect=surface.uvRect(detail,coverage);
const eps=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
surface.uvRect(coverage,coverage).forEach((v,i)=>eps(v,[0,0,1,1][i]));
for(const lon of [100,111,125])for(const lat of [20,35,50]){
  const p=frame.toWorld(lon,lat),uv=[.5+p.x/frame.width,.5-p.z/frame.depth];
  const fromBase=[(uv[0]-rect[0])/rect[2],(uv[1]-rect[1])/rect[3]];
  eps(fromBase[0],(lon-detail[0])/(detail[2]-detail[0]));
  eps(fromBase[1],(geometry.mercatorY(lat)-geometry.mercatorY(detail[1]))/(geometry.mercatorY(detail[3])-geometry.mercatorY(detail[1])));
}
assert.ok(Math.abs(rect[1]-30/80)>.05,'Mercator registration must not use linear latitude');
let listener,received=0;const parent={postMessage(){}};
protocol.createChild({parent,addEventListener:(name,fn)=>listener=fn},{onState(){},onConfig(){},onSurface(){received++;}});
const good={channel:protocol.CHANNEL,type:'surface',sceneKey:'1080',renderId:1,quality:'base',url:'data:image/png;base64,AA==',bounds:coverage};
for(const patch of [{url:'https://example.com/map.png'},{quality:'script'},{bounds:[40,70,165,-10]},{bounds:[40,-10,165,Infinity]}])listener({source:parent,data:{...good,...patch}});
listener({source:{},data:good});assert.equal(received,0);
listener({source:parent,data:good});assert.equal(received,1);
console.log('PASS: full/detail texture and real terrain share Mercator coordinates at nine reference points; surface messages reject external URLs and invalid bounds.');
