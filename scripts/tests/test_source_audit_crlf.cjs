'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
test('the real source auditor accepts Windows checkout line endings without rewriting sources',()=>{
  const script=`const fs=require('node:fs'),read=fs.readFileSync;
fs.readFileSync=function(file,...args){const value=read.call(this,file,...args),p=String(file).replace(/\\\\/g,'/');
return typeof value==='string'&&(p.includes('/data/sources/')||p.endsWith('/js/milestone_sources.js'))?value.replace(/\\r?\\n/g,'\\r\\n'):value;};
process.argv=[process.execPath,'audit_sources.js','--check'];require(${JSON.stringify(path.join(root,'scripts/audit_sources.js'))});`;
  const result=spawnSync(process.execPath,['-e',script],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,/Sources OK/);
});
