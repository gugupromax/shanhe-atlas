/* Shared command simulation and controls for configured battle sandboxes. */
(function () {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const number=unit=>Math.ceil(unit.hp/unit.stats.hp);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  window.createBattleCommand=function(view,ui,scenario){
    const types=window.atlasBattleUnits, formations=window.atlasBattleFormations;
    const {units:roster,opponent,bounds,objective}=scenario;
    const stakeSlots=scenario.experimental?.barriers??[];
    const {minX,maxX,minZ,maxZ}=bounds;
    const enemy=unit=>unit.side===opponent;
    for(const unit of roster){
      const allowed=unit.experimental?scenario.experimental?.allowed:scenario.allowed;
      if(!types[unit.type]||!formations[unit.formation]||!allowed?.[unit.side]?.includes(unit.type)
        ||!Number.isInteger(unit.count)||unit.count<=0)
        throw new Error('Invalid battle unit: '+unit.name);
    }
    const units=roster.map((unit,id)=>({
      ...unit,id,stats:types[unit.type],shape:formations[unit.formation],hp:unit.count*types[unit.type].hp,
      yaw:unit.side===opponent?0:Math.PI,order:{kind:'hold'},cooldown:0,shotClock:0,flash:0,speed:0,impact:0,morale:100,routed:false,lowMoraleTime:0
    }));
    let chosen=0,running=false,elapsed=0,outcome='',frame=0,last=0,drawn=0,stake=0;
    const shots=[];
    let experimental=false, captured=false, revealAt=null;
    const enabled=unit=>experimental||!unit.experimental;
    const cards=[];
    const get=id=>ui.querySelector('#'+id);
    const modeStart=get('command-start'), status=get('command-status'), info=get('command-selection');
    const evidence=get('command-evidence');
    for(const [side,allowed] of Object.entries(scenario.allowed)){
      const row=document.createElement('p');
      row.textContent=(scenario.sideLabels?.[side]??side)+'：'+allowed.map(type=>types[type].name).join('、');
      evidence.append(row);
    }
    for(const [label,description] of [...scenario.evidence,['当前不提供',scenario.unsupported]]){
      const row=document.createElement('p'), title=document.createElement('strong');
      title.textContent=label+' · ';
      row.append(title,description);
      evidence.append(row);
    }
    for(const [label,href] of scenario.sources){
      const link=document.createElement('a');
      link.textContent=label;link.href=href;link.target='_blank';link.rel='noopener';
      evidence.append(link);
    }
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
        button.querySelector('small').textContent=unit.stats.name+' / '+unit.shape.name+' · '+count+'/'+unit.count+' 人'+(unit.routed?' · 溃散':' · 士气 '+Math.round(unit.morale)+(unit.lowMoraleTime>0?" · 动摇":""));
        button.querySelector('i').style.width=(unit.hp/(unit.count*unit.stats.hp))*100+'%';
      }
      const unit=units[chosen];
      info.textContent=unit&&fighting(unit)
        ? unit.name+'　命令：'+orderText[unit.order.kind]+'　攻击 '+unit.stats.attack+' / 防御 '+unit.stats.defense+' / 单兵血量 '+unit.stats.hp
        :'点击己方方阵选择部队';
      status.textContent=outcome|| (running?'交战进行中 · '+Math.floor(elapsed)+' 秒':elapsed?'已暂停 · 可继续下令':'布阵阶段 · 可以先下令，再开始战斗');
      modeStart.textContent=outcome?'本局结束':running?'暂停':elapsed?'继续战斗':'开始战斗';
      modeStart.disabled=Boolean(outcome);
      get('command-hold').disabled=!unit||!fighting(unit)||Boolean(outcome);
      const selected=units[chosen];
      if(selected?.stats.mounted&&alive(selected)){
        info.textContent+=' / 速度 '+selected.speed.toFixed(1)+(selected.impact>0?' / 上次冲击 +'+selected.impact+'%':'');
      }
      if(selected?.stats.shotRange&&alive(selected))info.textContent+=' / 射程 '+selected.stats.shotRange;
      get('command-objective').textContent=objective?
        (revealAt!==null?objective.revealed:captured?objective.captured:objective.instructions):'';
      const stakes=get('command-stakes');
      stakes.hidden=!experimental||!stakeSlots.length;
      get("command-roster-label").hidden=!scenario.experimental;
      stakes.disabled=elapsed>0||running;
      get('command-roster').disabled=elapsed>0||running;
      get('command-units').classList.toggle('experimental',experimental);
      stakes.textContent=['拒马：东侧','拒马：中路','拒马：西侧'][stake];
      view.commandFrame(units,chosen,experimental?stakeSlots[stake]:null,shots,elapsed,{captured,objective});
    }
    for(const unit of units.filter(u=>!enemy(u))){
      const button=document.createElement('button');
      const title=document.createElement('strong'),label=document.createElement('small'),bar=document.createElement('i');
      title.textContent=unit.name;
      button.type='button';button.append(title,label,bar);button.onclick=()=>select(unit.id);
      cards[unit.id]=button;get('command-units').append(button);
    }
    function select(id){
      if(!units[id]||enemy(units[id])||!fighting(units[id]))return;
      chosen=id;update();
    }
    function order(point,target){
      const unit=units[chosen];
      if(!unit||!fighting(unit)||outcome)return;
      unit.order=target&&enemy(target)&&fighting(target)
        ? {kind:'attack',target:target.id}
        : {kind:'move',x:clamp(point.x,minX,maxX),z:clamp(point.z,minZ,maxZ)};
      update();
    }
    function advance(u,x,z,dt,stop=0){
      const previous=u.speed;
      const obstacle=stakeSlots[stake];
      const dx=x-u.x,dz=z-u.z,dist=Math.hypot(dx,dz);
      if(dist<=.05)return;
      const nearStake=experimental&&obstacle&&Math.abs(u.x-obstacle.x)<4.5&&Math.abs(u.z-obstacle.z)<3;
      const pace=u.stats.speed*(nearStake?(u.stats.mounted?.23:.66):1);
      if(dt<=0)return;
      const travel=Math.min(Math.max(0,dist-stop),Math.min(pace,previous+24*dt)*dt);
      if(travel<=0)return;
      u.yaw=Math.atan2(dx,dz);
      const x0=u.x,z0=u.z;
      u.x=clamp(x0+dx*travel/dist,minX,maxX);u.z=clamp(z0+dz*travel/dist,minZ,maxZ);
      u.speed=Math.hypot(u.x-x0,u.z-z0)/dt;
    }
    function step(dt){
      elapsed+=dt;
      while(shots.length&&elapsed-shots[0].time>.48)shots.shift();
      const active=units.filter(fighting);
      const losses=new Map();
      for(const unit of active){
        const enemies=active.filter(other=>enemy(unit)!==enemy(other));
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
        if(enemy(unit)&&elapsed>=(unit.aiAfter??0))target=nearest;
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
        const engaged=Math.min(number(unit),Math.round(frontage*unit.shape.frontage));
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
      if(objective){
        const defenders=units.filter(u=>enemy(u)&&fighting(u));
        if(!captured&&!defenders.some(u=>distance(u,objective)<=objective.guardRadius)){
          captured=units.some(u=>!enemy(u)&&fighting(u)&&u.type===objective.captureType&&distance(u,objective)<=objective.radius);
        }
        if(captured&&revealAt===null&&defenders.some(u=>distance(u,objective)<=objective.noticeRadius))revealAt=elapsed;
      }
      for(const enemySide of [false,true]){
        const army=units.filter(u=>enabled(u)&&enemy(u)===enemySide);
        const total=army.reduce((sum,u)=>sum+u.count,0);
        const remaining=army.reduce((sum,u)=>sum+number(u),0);
        const armyLoss=1-remaining/total;
        for(const unit of army){
          if(!alive(unit))continue;
          const ownLoss=1-unit.hp/(unit.count*unit.stats.hp);
          const bank=scenario.waterline;
          const modifiers=window.atlasBattleMorale.conditions(scenario,unit.side,{
            backToWater:bank&&unit.side===bank.side&&unit.x<=bank.maxX&&unit.z>=bank.minZ&&unit.z<=bank.maxZ,
            believesCommanderCaptured:revealAt!==null,
            secondsSinceReveal:revealAt===null?0:elapsed-revealAt
          });
          const result=window.atlasBattleMorale.evaluate({armyLoss,ownLoss,...modifiers});
          unit.morale=result.morale;
          unit.lowMoraleTime=result.routed?unit.lowMoraleTime+dt:0;
          unit.routed ||= unit.lowMoraleTime>=3;
          if(unit.routed)advance(unit,unit.x,enemySide?minZ:maxZ,dt);
        }
      }
      if(!units.some(u=>enemy(u)&&fighting(u))&&!units.some(u=>!enemy(u)&&fighting(u)))outcome='双方阵线瓦解';
      else if(!units.some(u=>enemy(u)&&fighting(u)))outcome=scenario.victory;
      else if(!units.some(u=>!enemy(u)&&fighting(u)))outcome=scenario.defeat;
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
    get('command-stakes').onclick=()=>{if(!elapsed&&!running&&stakeSlots.length){stake=(stake+1)%stakeSlots.length;update();}};
    get('command-roster').onchange=event=>{
      experimental=Boolean(scenario.experimental)&&event.target.value==='experimental';
      reset();
    };
    get('command-reset').onclick=reset;
    function reset(){
      cancelAnimationFrame(frame);running=false;elapsed=0;outcome='';chosen=0;stake=0;shots.length=0;captured=false;revealAt=null;
      units.forEach((unit,i)=>{
        const {x,z,count}=roster[i];
        Object.assign(unit,{x,z,hp:enabled(unit)?count*unit.stats.hp:0,yaw:unit.side===opponent?0:Math.PI,
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
