'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const THREE = require('../../vendor/three.min.js');

test('the archived local renderer builds its mounted and foot actors from the shared figure recipe',()=>{
  const window={THREE:{...THREE,WebGLRenderer:class {setPixelRatio(){}}}};
  const element=()=>({dataset:{},append(){},setAttribute(){},addEventListener(){},getContext:()=>({fillText(){}})});
  const context=vm.createContext({
    window,document:{createElement:element,getElementById:()=>null},atob,devicePixelRatio:1,
    matchMedia:()=>({matches:true}),ResizeObserver:class {observe(){}},
  });
  const load=name=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../../battles',name),'utf8'),context,{filename:name});
  load('battle-units.js');
  load('campaign-changshe-config.js');
  load('changshe-terrain.js');
  window.changsheTerrainGrid={width:2,height:2,bounds:[110,31,115,35],data:Buffer.alloc(8).toString('base64')};
  const recorded={slots:[],parts:[]};
  const source=window.ChangsheFigures;
  // Compare conspicuous proportions against the original local makeUnit geometry.
  const horse=source.parts(true).find(([role])=>role==='horse');
  assert.deepEqual(Array.from(horse),['horse','box','wood',0,.12,0,.19,.18,.26]);
  assert.equal(source.parts(false).some(([role])=>role==='horse'),false);
  assert.deepEqual(Array.from(source.standard[1]).slice(3),[-.84,.64,0,.39,.29,.035]);
  window.ChangsheFigures={...source};
  for(const name of Object.keys(recorded)){
    window.ChangsheFigures[name]=(...args)=>{
      const value=source[name](...args);
      recorded[name].push({argument:args[0],length:value.length});
      return value;
    };
  }
  const config=window.atlasCampaignDemo;
  const groups=['emperor','han','jin'].map(id=>config.groups.find(group=>group.id===id));
  window.createChangsheTerrain(element(),element(),{...config,groups});
  assert.deepEqual(recorded.slots.map(entry=>entry.length),[12,15,12]);
  assert.ok(recorded.parts.some(entry=>entry.argument===true),'the old local view requests mounted figures');
  assert.ok(recorded.parts.some(entry=>!entry.argument),'the old local view requests foot figures');
});
