/* Scenario rules for the optional Xiangji Temple command mode. */
(function () {
  'use strict';
  const types = {
    shield: {name:'持盾步兵', attack:4, defense:55, hp:18, interval:2, speed:3.1, range:5.4, frontage:24},
    blade: {name:'长刀步兵', attack:7, defense:25, hp:15, interval:2.2, speed:3.7, range:5.4, frontage:24},
    cavalry: {name:'轻骑兵', attack:5, defense:20, hp:14, interval:1.8, speed:6.9, range:6.1, frontage:22}
  };
  const roster = [
    ['shield','tang','唐军盾阵',-19,12,68],
    ['blade','tang','李嗣业所部',-8,21,60],
    ['cavalry','uyghur','回纥轻骑',14,20,48],
    ['shield','yan','燕军前锋',-17,-9,64],
    ['blade','yan','燕军正面',-4,-15,64],
    ['cavalry','yan','燕军东侧伏骑',32,-2,48]
  ];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const number=unit=>Math.ceil(unit.hp/unit.stats.hp);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  window.createXiangjiCommand=function(view,ui){
    const units=roster.map(([type,side,name,x,z,count],id)=>({
      id,type,side,name,x,z,count,stats:types[type],hp:count*types[type].hp,
      yaw:side==='yan'?0:Math.PI,order:{kind:'hold'},cooldown:0,flash:0
    }));
    let chosen=0,running=false,elapsed=0,outcome='',frame=0,last=0,drawn=0;
    const cards=[];
    const get=id=>ui.querySelector('#'+id);
    const modeStart=get('command-start'), status=get('command-status'), info=get('command-selection');
    const orderText={hold:'坚守',move:'移动',attack:'攻击'};
    const alive=u=>u.hp>0;
    function update(){
      for(const unit of units){
        const button=cards[unit.id];
        if(!button)continue;
        button.disabled=!alive(unit);
        button.setAttribute('aria-pressed',String(chosen===unit.id));
        const count=number(unit);
        button.querySelector('small').textContent=unit.stats.name+' · '+count+'/'+unit.count+' 人';
        button.querySelector('i').style.width=(unit.hp/(unit.count*unit.stats.hp))*100+'%';
      }
      const unit=units[chosen];
      info.textContent=unit&&alive(unit)
        ? unit.name+'　命令：'+orderText[unit.order.kind]+'　攻击 '+unit.stats.attack+' / 防御 '+unit.stats.defense+' / 单兵血量 '+unit.stats.hp
        :'点击唐军或回纥方阵选择部队';
      status.textContent=outcome|| (running?'交战进行中 · '+Math.floor(elapsed)+' 秒':elapsed?'已暂停 · 可继续下令':'布阵阶段 · 可以先下令，再开始战斗');
      modeStart.textContent=outcome?'本局结束':running?'暂停':elapsed?'继续战斗':'开始战斗';
      modeStart.disabled=Boolean(outcome);
      get('command-hold').disabled=!unit||!alive(unit)||Boolean(outcome);
      view.commandFrame(units,chosen);
    }
    for(const unit of units.filter(u=>u.side!=='yan')){
      const button=document.createElement('button');
      const title=document.createElement('strong'),label=document.createElement('small'),bar=document.createElement('i');
      title.textContent=unit.name;
      button.type='button';button.append(title,label,bar);button.onclick=()=>select(unit.id);
      cards[unit.id]=button;get('command-units').append(button);
    }
    function select(id){
      if(units[id]?.side==='yan'||!units[id]||!alive(units[id]))return;
      chosen=id;update();
    }
    function order(point,target){
      const unit=units[chosen];
      if(!unit||!alive(unit)||outcome)return;
      unit.order=target?.side==='yan'&&alive(target)
        ? {kind:'attack',target:target.id}
        : {kind:'move',x:clamp(point.x,-34,49),z:clamp(point.z,-45,42)};
      update();
    }
    function advance(u,x,z,dt,stop=0){
      const dx=x-u.x,dz=z-u.z,dist=Math.hypot(dx,dz);
      if(dist<=.05)return;
      u.yaw=Math.atan2(dx,dz);
      const step=Math.min(Math.max(0,dist-stop),u.stats.speed*dt)/dist;
      u.x=clamp(u.x+dx*step,-34,49);u.z=clamp(u.z+dz*step,-45,42);
    }
    function step(dt){
      elapsed+=dt;
      const active=units.filter(alive);
      const losses=new Map();
      for(const unit of active){
        const enemies=active.filter(other=>(unit.side==='yan')!==(other.side==='yan'));
        let nearest=null;
        for(const enemy of enemies)if(!nearest||distance(unit,enemy)<distance(unit,nearest))nearest=enemy;
        unit.flash=Math.max(0,unit.flash-dt);unit.cooldown=Math.max(0,unit.cooldown-dt);
        let target=unit.order.kind==='attack'?units[unit.order.target]:null;
        if(target&&!alive(target)){
          target=null;unit.order={kind:'hold'};
        }
        if(unit.side==='yan'&&(unit.type!=='cavalry'||elapsed>=10))target=nearest;
        if(unit.order.kind==='move'){
          advance(unit,unit.order.x,unit.order.z,dt);
          if(distance(unit,unit.order)<.24)unit.order={kind:'hold'};
          continue;
        }
        if(target)advance(unit,target.x,target.z,dt,unit.stats.range-.2);
        const struck=target&&distance(unit,target)<=unit.stats.range?target:
          nearest&&distance(unit,nearest)<=unit.stats.range?nearest:null;
        if(!struck||unit.cooldown>0)continue;
        unit.yaw=Math.atan2(struck.x-unit.x,struck.z-unit.z);
        unit.cooldown=unit.stats.interval;unit.flash=.28;
        const engaged=Math.min(number(unit),unit.stats.frontage);
        const damage=engaged*unit.stats.attack*100/(100+struck.stats.defense);
        losses.set(struck,(losses.get(struck)||0)+damage);
      }
      for(const [unit,damage] of losses)unit.hp=Math.max(0,unit.hp-damage);
      if(!units.some(u=>u.side==='yan'&&alive(u)))outcome='燕军退场 · 唐军守住阵线';
      else if(!units.some(u=>u.side!=='yan'&&alive(u)))outcome='唐军退场 · 阵线失守';
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
      if(units[chosen]&&alive(units[chosen]))units[chosen].order={kind:'hold'};
      update();
    };
    get('command-reset').onclick=reset;
    function reset(){
      cancelAnimationFrame(frame);running=false;elapsed=0;outcome='';chosen=0;
      units.forEach((unit,i)=>{
        const [,side,,x,z,count]=roster[i];
        Object.assign(unit,{x,z,hp:count*unit.stats.hp,yaw:side==='yan'?0:Math.PI,
          order:{kind:'hold'},cooldown:0,flash:0});
      });
      update();
    }
    function pick(point){
      let closest=null;
      for(const unit of units)if(alive(unit)&&distance(unit,point)<4.6&&
          (!closest||distance(unit,point)<distance(closest,point)))closest=unit;
      return closest;
    }
    return {reset,pause,select,order,pick};
  };
})();
