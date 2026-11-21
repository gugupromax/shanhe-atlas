/* Scenario rules for the optional Xiangji Temple command mode. */
(function () {
  'use strict';
  const types = {
    shield: {name:'持盾步兵', attack:4, defense:55, hp:18, interval:2, speed:3.1, range:5.4, frontage:24},
    blade: {name:'长刀步兵', attack:7, defense:25, hp:15, interval:2.2, speed:3.7, range:5.4, frontage:24},
    cavalry: {name:'轻骑兵', attack:5, defense:20, hp:14, interval:1.8, speed:6.9, range:6.1, frontage:22, mounted:true, shotRange:17, shotAttack:3},
    elite: {name:'精骑（轻重未详）', attack:6, defense:28, hp:15, interval:2.1, speed:6.2, range:6.1, frontage:22, mounted:true},
    heavy: {name:'重骑兵', attack:7, defense:45, hp:18, interval:2.5, speed:5.6, range:6.1, frontage:20, mounted:true},
    archer: {name:'弓兵', attack:2, defense:15, hp:12, interval:2.4, speed:3.3, range:5.1, frontage:24, shotRange:23, shotAttack:5}
  };
  const roster = [
    ['shield','tang','唐军盾阵',-19,12,68],
    ['blade','tang','李嗣业所部',-8,21,60],
    ['cavalry','uyghur','回纥轻骑',14,20,48],
    ['archer','tang','唐军弓队',-24,23,52],
    ['heavy','tang','唐军重骑',23,28,44],
    ['shield','yan','燕军前锋',-17,-9,64],
    ['blade','yan','燕军正面',-4,-15,64],
    ['elite','yan','燕军东侧精骑',32,-2,48]
  ];
  const stakeSlots=[{x:21,z:12},{x:4,z:10},{x:-18,z:5}];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const number=unit=>Math.ceil(unit.hp/unit.stats.hp);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  window.createXiangjiCommand=function(view,ui){
    const units=roster.map(([type,side,name,x,z,count],id)=>({
      id,type,side,name,x,z,count,stats:types[type],hp:count*types[type].hp,
      yaw:side==='yan'?0:Math.PI,order:{kind:'hold'},cooldown:0,shotClock:0,flash:0,speed:0,impact:0,morale:100,routed:false,lowMoraleTime:0
    }));
    let chosen=0,running=false,elapsed=0,outcome='',frame=0,last=0,drawn=0,stake=0;
    const shots=[];
    let experimental=false;
    const optional=unit=>unit.type==="archer"||unit.type==="heavy";
    const enabled=unit=>experimental||!optional(unit);
    const cards=[];
    const get=id=>ui.querySelector('#'+id);
    const modeStart=get('command-start'), status=get('command-status'), info=get('command-selection');
    const orderText={hold:'坚守',move:'移动',attack:'攻击'};
    const alive=u=>enabled(u)&&u.hp>0;
    const fighting=u=>alive(u)&&!u.routed;
    function update(){
      for(const unit of units){
        const button=cards[unit.id];
        if(!button)continue;
        button.hidden=!enabled(unit);
        button.disabled=!fighting(unit);
        button.setAttribute('aria-pressed',String(chosen===unit.id));
        const count=number(unit);
        button.querySelector('small').textContent=unit.stats.name+' · '+count+'/'+unit.count+' 人'+(unit.routed?' · 溃散':' · 士气 '+Math.round(unit.morale)+(unit.lowMoraleTime>0?" · 动摇":""));
        button.querySelector('i').style.width=(unit.hp/(unit.count*unit.stats.hp))*100+'%';
      }
      const unit=units[chosen];
      info.textContent=unit&&fighting(unit)
        ? unit.name+'　命令：'+orderText[unit.order.kind]+'　攻击 '+unit.stats.attack+' / 防御 '+unit.stats.defense+' / 单兵血量 '+unit.stats.hp
        :'点击唐军或回纥方阵选择部队';
      status.textContent=outcome|| (running?'交战进行中 · '+Math.floor(elapsed)+' 秒':elapsed?'已暂停 · 可继续下令':'布阵阶段 · 可以先下令，再开始战斗');
      modeStart.textContent=outcome?'本局结束':running?'暂停':elapsed?'继续战斗':'开始战斗';
      modeStart.disabled=Boolean(outcome);
      get('command-hold').disabled=!unit||!fighting(unit)||Boolean(outcome);
      const selected=units[chosen];
      if(selected?.stats.mounted&&alive(selected)){
        info.textContent+=' / 速度 '+selected.speed.toFixed(1)+(selected.impact>0?' / 上次冲击 +'+selected.impact+'%':'');
      }
      if(selected?.stats.shotRange&&alive(selected))info.textContent+=' / 射程 '+selected.stats.shotRange;
      const stakes=get('command-stakes');
      stakes.hidden=!experimental;
      stakes.disabled=elapsed>0||running;
      get('command-roster').disabled=elapsed>0||running;
      get('command-units').classList.toggle('experimental',experimental);
      stakes.textContent=['拒马：东侧','拒马：中路','拒马：西侧'][stake];
      view.commandFrame(units,chosen,experimental?stakeSlots[stake]:null,shots,elapsed);
    }
    for(const unit of units.filter(u=>u.side!=='yan')){
      const button=document.createElement('button');
      const title=document.createElement('strong'),label=document.createElement('small'),bar=document.createElement('i');
      title.textContent=unit.name;
      button.type='button';button.append(title,label,bar);button.onclick=()=>select(unit.id);
      cards[unit.id]=button;get('command-units').append(button);
    }
    function select(id){
      if(units[id]?.side==='yan'||!units[id]||!fighting(units[id]))return;
      chosen=id;update();
    }
    function order(point,target){
      const unit=units[chosen];
      if(!unit||!fighting(unit)||outcome)return;
      unit.order=target?.side==='yan'&&alive(target)
        ? {kind:'attack',target:target.id}
        : {kind:'move',x:clamp(point.x,-34,49),z:clamp(point.z,-45,42)};
      update();
    }
    function advance(u,x,z,dt,stop=0){
      const previous=u.speed;
      const obstacle=stakeSlots[stake];
      const dx=x-u.x,dz=z-u.z,dist=Math.hypot(dx,dz);
      if(dist<=.05)return;
      const nearStake=experimental&&Math.abs(u.x-obstacle.x)<4.5&&Math.abs(u.z-obstacle.z)<3;
      const pace=u.stats.speed*(nearStake?(u.stats.mounted?.23:.66):1);
      if(dt<=0)return;
      const travel=Math.min(Math.max(0,dist-stop),Math.min(pace,previous+24*dt)*dt);
      if(travel<=0)return;
      u.yaw=Math.atan2(dx,dz);
      const x0=u.x,z0=u.z;
      u.x=clamp(x0+dx*travel/dist,-34,49);u.z=clamp(z0+dz*travel/dist,-45,42);
      u.speed=Math.hypot(u.x-x0,u.z-z0)/dt;
    }
    function step(dt){
      elapsed+=dt;
      while(shots.length&&elapsed-shots[0].time>.48)shots.shift();
      const active=units.filter(fighting);
      const losses=new Map();
      for(const unit of active){
        const enemies=active.filter(other=>(unit.side==='yan')!==(other.side==='yan'));
        let nearest=null;
        for(const enemy of enemies)if(!nearest||distance(unit,enemy)<distance(unit,nearest))nearest=enemy;
        unit.flash=Math.max(0,unit.flash-dt);unit.cooldown=Math.max(0,unit.cooldown-dt);
        unit.shotClock=Math.max(0,unit.shotClock-dt);
        const approach=unit.speed;
        unit.speed=Math.max(0,unit.speed-12*dt);
        let target=unit.order.kind==='attack'?units[unit.order.target]:null;
        if(target&&!fighting(target)){
          target=null;unit.order={kind:'hold'};
        }
        if(unit.side==='yan'&&(!unit.stats.mounted||elapsed>=10))target=nearest;
        const {range,shotRange,shotAttack,attack,interval,frontage,mounted}=unit.stats;
        const moving=unit.order.kind==='move';
        let struck=target??nearest;
        if(moving){
          const before=nearest?distance(unit,nearest):Infinity;
          advance(unit,unit.order.x,unit.order.z,dt);
          if(distance(unit,unit.order)<.24)unit.order={kind:'hold'};
          // A pass-through hit needs actual forward motion into an enemy formation.
          if(!mounted||!nearest||unit.speed<unit.stats.speed*.48||
             distance(unit,nearest)>=before||distance(unit,nearest)>range)continue;
          struck=nearest;
        }else if(target){
          advance(unit,target.x,target.z,dt,unit.type==='archer'?shotRange*.76:range-.2);
        }
        if(!struck)continue;
        const gap=distance(unit,struck);
        const melee=gap<=range;
        if(melee?unit.cooldown>0:(!shotRange||gap>shotRange||unit.shotClock>0))continue;
        const engaged=Math.min(number(unit),frontage);
        let power=shotAttack;
        if(melee){
          unit.cooldown=interval;unit.flash=.28;
          const speed=mounted?(moving?unit.speed:Math.max(approach,unit.speed)):0;
          unit.impact=Math.round(speed*(moving?16:10));
          power=attack*(1+unit.impact/100);
        }else{
          unit.shotClock=interval;
          shots.push({unitId:unit.id,x:unit.x,z:unit.z,endX:struck.x,endZ:struck.z,time:elapsed});
        }
        if(!moving)unit.yaw=Math.atan2(struck.x-unit.x,struck.z-unit.z);
        const damage=engaged*power*100/(100+struck.stats.defense);
        losses.set(struck,(losses.get(struck)||0)+damage);
      }
      for(const [unit,damage] of losses)unit.hp=Math.max(0,unit.hp-damage);
      for(const enemySide of [false,true]){
        const army=units.filter(u=>enabled(u)&&(u.side==='yan')===enemySide);
        const total=army.reduce((sum,u)=>sum+u.count,0);
        const remaining=army.reduce((sum,u)=>sum+number(u),0);
        const armyLoss=1-remaining/total;
        for(const unit of army){
          if(!alive(unit))continue;
          const ownLoss=1-unit.hp/(unit.count*unit.stats.hp);
          const modifiers=window.atlasBattleMorale.conditions("xiangjisi",unit.side);
          const result=window.atlasBattleMorale.evaluate({armyLoss,ownLoss,...modifiers});
          unit.morale=result.morale;
          unit.lowMoraleTime=result.routed?unit.lowMoraleTime+dt:0;
          unit.routed ||= unit.lowMoraleTime>=3;
          if(unit.routed)advance(unit,unit.x,enemySide?-45:42,dt);
        }
      }
      if(!units.some(u=>u.side==='yan'&&fighting(u))&&!units.some(u=>u.side!=='yan'&&fighting(u)))outcome='双方阵线瓦解';
      else if(!units.some(u=>u.side==='yan'&&fighting(u)))outcome='燕军退场 · 唐军守住阵线';
      else if(!units.some(u=>u.side!=='yan'&&fighting(u)))outcome='唐军退场 · 阵线失守';
      if(outcome)running=false;
    }
    function tick(now){
      if(!running)return;
      const dt=Math.min(.07,Math.max(0,(now-last)/1000));last=now;
      step(dt);
      if(now-drawn>=33||!running){update();drawn=now;}
      if(running)frame=requestAnimationFrame(tick);
    }
    function pause(){running=false;cancelAnimationFrame(frame);update();}
    modeStart.onclick=()=>{
      if(running){pause();return;}
      if(outcome)return;
      running=true;last=performance.now();update();frame=requestAnimationFrame(tick);
    };
    get('command-hold').onclick=()=>{
      if(units[chosen]&&fighting(units[chosen]))units[chosen].order={kind:'hold'};
      update();
    };
    get('command-stakes').onclick=()=>{if(!elapsed&&!running){stake=(stake+1)%stakeSlots.length;update();}};
    get('command-roster').onchange=event=>{
      experimental=event.target.value==='experimental';
      reset();
    };
    get('command-reset').onclick=reset;
    function reset(){
      cancelAnimationFrame(frame);running=false;elapsed=0;outcome='';chosen=0;stake=0;shots.length=0;
      units.forEach((unit,i)=>{
        const [,side,,x,z,count]=roster[i];
        Object.assign(unit,{x,z,hp:enabled(unit)?count*unit.stats.hp:0,yaw:side==='yan'?0:Math.PI,
          order:{kind:'hold'},cooldown:0,shotClock:0,flash:0,speed:0,impact:0,morale:100,routed:false,lowMoraleTime:0});
      });
      update();
    }
    function pick(point){
      let closest=null;
      for(const unit of units)if(fighting(unit)&&distance(unit,point)<4.6&&
          (!closest||distance(unit,point)<distance(closest,point)))closest=unit;
      return closest;
    }
    return {reset,pause,select,order,pick};
  };
})();
