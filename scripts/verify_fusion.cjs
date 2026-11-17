const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),protocol=require('../fusion-protocol.js'),bridge=require('../integration.js');
const good={channel:protocol.CHANNEL,type:'state',active:true,seq:1,year:1080,center:[114.9,30.4],widthKm:1500,locations:[{name:'黄州',coord:[114.9,30.4],kind:'journey',index:2,year:1080}],selection:{personKey:'sushi',stopIndex:2},snapshot:{polities:[]},layers:{polities:true}};
assert.equal(protocol.validateState(good).selection.personKey,'sushi');
assert.equal(protocol.validateState({...good,year:2027}).year,2027);
for(const patch of [{year:0},{year:Infinity},{center:[NaN,30]},{center:[190,30]},{widthKm:Infinity},{widthKm:-1}])assert.equal(protocol.validateState({...good,...patch}),null);
assert.equal(protocol.validateState({...good,locations:[{name:'bad',coord:[NaN,0]}]}).locations.length,0);
const sent=[],parent={postMessage:m=>sent.push(m)},handlers={};let received=0;
const fake={parent,addEventListener:(k,v)=>handlers[k]=v};
const child=protocol.createChild(fake,{onState:()=>received++,onConfig:()=>{}});child.ready();child.ready();assert.equal(sent.length,1);
handlers.message({source:{},data:good});assert.equal(received,0);
handlers.message({source:parent,data:good});assert.equal(received,1);
handlers.message({source:parent,data:{...good,seq:0}});assert.equal(received,1);
const context={window:{addEventListener:()=>{}},setTimeout,clearTimeout,URLSearchParams};vm.runInNewContext(fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context);
const projector=new context.window.MercatorProjector(1000,650,{west:66,east:142,south:14,north:55});
for(const rect of [{width:1280,height:666},{width:390,height:790},{width:1000,height:650}])for(const c of [{x:0,y:0,w:1000,h:650,zoom:1},{x:200,y:150,w:250,h:162.5,zoom:4}]){
  const app={projector,camera:c},view=bridge.readView(app,rect),round=bridge.cameraForView(app,rect,view.center,view.widthKm);
  for(const key of ['x','y','w','h'])assert.ok(Math.abs(round[key]-c[key])<1e-7,key);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('integration.js'));assert.ok(!/<script[^>]+src=["']https?:/i.test(html));assert.ok(!html.includes('src="js/atlas_track.js'));
for(const file of ['terrain.html','fusion-layers.js','fusion-protocol.js','integration.css'])assert.ok(fs.existsSync(path.join(root,file)),file);
const source=fs.readFileSync(path.join(root,'terrain-app.js'),'utf8');
const start=source.indexOf("$('stage').addEventListener('keydown',e=>{");
const end=source.indexOf("$('exaggeration').addEventListener",start);
for(const embedded of [true,false]){
  let handler;const sent=[],shown=[];let emitted=0;
  vm.runInNewContext(source.slice(start,end),{$:()=>({addEventListener:(type,fn)=>{handler=fn;}}),embedded,fusion:{send:type=>sent.push(type)},show:key=>shown.push(key),emitFusionView:()=>emitted++,dirty:false});
  for(const key of ['h','H'])handler({key,preventDefault(){}});
  assert.deepEqual(sent,embedded?['reset-view','reset-view']:[]);
  assert.deepEqual(shown,embedded?[]:['national','national']);
  assert.equal(emitted,0,'H must not send a view update while resetting');
}
console.log('PASS: projector/shared-view roundtrips, protocol guards, local assets and embedded H reset without rebuilding or losing the scene.');
