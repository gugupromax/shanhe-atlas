const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function openScenario(name, configure = scenario => scenario) {
  const nodes = new Map();
  function element() {
    return {style:{},classList:{toggle(){}},append(){},querySelector:element,setAttribute(){}};
  }
  const ui = {querySelector(key) {
    if (!nodes.has(key)) nodes.set(key, element());
    return nodes.get(key);
  }};
  let time = 0;
  let pending = null;
  let state;
  const context = vm.createContext({
    window:{},document:{createElement:element},performance:{now:()=>time},
    requestAnimationFrame(callback){pending=callback;return 1;},
    cancelAnimationFrame(){pending=null;}
  });
  for (const file of ['battle-morale','battle-units','scenario-'+name,'battle-command']) {
    const filename = path.join(__dirname, file+'.js');
    vm.runInContext(fs.readFileSync(filename,'utf8'), context, {filename});
  }
  const config = configure(context.window.atlasBattleScenario);
  const command = context.window.createBattleCommand({
    commandFrame(units,selected,barrier,shots,elapsed,events) {
      state = {units,selected,barrier,shots,elapsed,events};
    }
  },ui,config);
  command.reset();
  return {
    command, config, node:key=>ui.querySelector('#command-'+key), current:()=>state,
    tick(seconds) {
      for (let i=0;pending&&i<Math.round(seconds/.05);i++){
        const callback=pending;pending=null;time+=50;callback(time);
      }
    }
  };
}

const jing = openScenario('jingxing');
const jingUnits = jing.current().units;
const horse = jingUnits.find(u=>u.type==='light');
const defenders = jingUnits.filter(u=>u.side==='zhao');
jing.command.select(horse.id);
jing.command.order(jing.config.objective,null);
jing.node('start').onclick();
jing.tick(1);
assert.equal(jing.current().events.captured,false);
jing.command.pause();
Object.assign(horse,{x:29,z:-6});
defenders.forEach(u=>Object.assign(u,{x:-9,z:3,hp:550}));
jing.node('start').onclick();
jing.tick(.1);
assert.equal(jing.current().events.captured,true);
assert.match(jing.node('objective').textContent,/尚未发现/);
Object.assign(defenders[0],{x:12,z:-6});
jing.tick(5.5);
assert.match(jing.node('objective').textContent,/误判/);
assert(defenders[0].morale<60);
jing.command.reset();
assert.equal(jing.current().events.captured,false);
assert.equal(jing.current().barrier,null);

const tang = openScenario('xiangjisi');
assert.equal(tang.current().units.filter(u=>u.hp>0&&u.side!=='yan').length,3);
tang.node('roster').onchange({target:{value:'experimental'}});
assert.equal(tang.current().units.filter(u=>u.hp>0&&u.side!=='yan').length,5);
assert(tang.current().barrier);
assert.equal(tang.current().units.find(u=>u.type==='elite').stats.shotRange,undefined);

const future = openScenario('jingxing', config=>({
  ...config,id:'fixture',opponent:'blue',waterline:undefined,objective:undefined,morale:undefined,
  allowed:{red:['infantry'],blue:['infantry']},
  units:[
    {type:'infantry',side:'red',name:'A',x:0,z:0,count:30,formation:'line'},
    {type:'infantry',side:'blue',name:'B',x:0,z:4,count:30,formation:'column',aiAfter:0}
  ]
}));
future.node('start').onclick();
future.tick(.3);
assert(future.current().units.every(u=>u.hp<510));
assert.throws(()=>openScenario('jingxing',config=>({
  ...config, units:[{...config.units[0],type:'heavy'}]
})),/Invalid battle unit/);
console.log('Two battle configs, camp seizure/reveal/reset, opt-in roster, new faction identifiers and rejection of unsupported units passed.');
