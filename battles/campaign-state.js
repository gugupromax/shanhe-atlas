/* Shared clock and causality for linked battle views. Coordinates and time are scenario-defined. */
(function () {
  'use strict';
  window.createAtlasCampaign=function(config){
    const fronts=new Map(config.fronts.map(front=>[front.id,front]));
    const groups=new Map(config.groups.map(group=>{
      if(!fronts.has(group.front)||!window.atlasBattleUnits[group.type]||
        !window.atlasBattleFormations[group.formation])throw new Error('Invalid campaign group: '+group.id);
      return [group.id,{...group,status:group.status??'waiting',morale:group.morale??100,route:null}];
    }));
    if(fronts.size!==config.fronts.length||groups.size!==config.groups.length)throw new Error('Duplicate campaign IDs');
    const events=config.events.map(event=>({...event})).sort((a,b)=>a.at-b.at);
    const ids=new Set();
    for(const event of events){
      if(ids.has(event.id)||event.after?.some(id=>!ids.has(id))||event.unless?.some(id=>!ids.has(id)))throw new Error('Invalid event dependency: '+event.id);
      if(!Number.isFinite(event.at)||event.at<0||event.arrived&&!groups.has(event.arrived))
        throw new Error('Invalid campaign event: '+event.id);
      for(const action of event.effects){
        const valid=action.kind==='front'?fronts.has(action.front)
          :action.kind==='march'?groups.has(action.unit)&&fronts.has(action.front)&&action.duration>0&&Number.isFinite(action.duration)
          :action.kind==='morale'?groups.has(action.unit)&&Number.isFinite(action.delta)
          :action.kind==='contest'?Boolean(action.win&&action.lose&&[action.attackers,action.defenders]
            .every(list=>Array.isArray(list)&&list.length&&list.every(id=>groups.has(id))))
          :action.kind==='status'&&groups.has(action.unit);
        if(!valid)throw new Error('Invalid campaign action: '+event.id);
      }
      ids.add(event.id);
    }
    const signals=new Map(), completed=new Map(), log=[];
    let time=0;
    function settle(at){
      for(const group of groups.values()){
        const route=group.route;
        if(!route)continue;
        const fraction=Math.min(1,(at-route.start)/(route.end-route.start));
        group.x=route.x+(route.toX-route.x)*fraction;
        group.y=route.y+(route.toY-route.y)*fraction;
        if(fraction>=1){
          group.front=route.front;
          group.status='arrived';
          group.route=null;
        }
      }
    }
    function apply(event,at){
      for(const action of event.effects){
        const group=groups.get(action.unit);
        if(action.kind==='march'){
          const destination=fronts.get(action.front);
          group.route={x:group.x,y:group.y,toX:action.x??destination.x,toY:action.y??destination.y,
            start:at,end:at+action.duration,front:action.front,motion:action.motion};
          group.status='marching';
        }else if(action.kind==='morale'){
          group.morale=Math.max(0,Math.min(100,group.morale+action.delta));
        }else if(action.kind==='status'){
          group.status=action.value;
          group.route=null;
        }else if(action.kind==='contest'){
          const power=ids=>ids.reduce((sum,id)=>{
            const unit=groups.get(id),type=window.atlasBattleUnits[unit.type];
            return sum+unit.count*(.35+.65*unit.morale/100)*(type.attack+type.defense/20);
          },0);
          const offense=power(action.attackers), defense=power(action.defenders);
          signals.set(offense>=defense?action.win:action.lose,at);
        }else if(action.kind==='front'){
          fronts.set(action.front,{...fronts.get(action.front),status:action.value});
        }
      }
      completed.set(event.id,at);
      log.push({id:event.id,time:at,title:event.title,detail:event.detail,people:event.people,source:event.source});
    }
    function advance(to,pauseAt=[]){
      if(!Number.isFinite(to)||to<time)throw new RangeError('Campaign clock must advance');
      for(;;){
        let next=null,nextTime=Infinity;
        for(const event of events){
          if(completed.has(event.id)||event.after?.some(id=>!completed.has(id))||event.unless?.some(id=>completed.has(id)))continue;
          const signalAt=event.signal?signals.get(event.signal):null;
          if(event.signal&&signalAt===undefined)continue;
          const arriving=event.arrived?groups.get(event.arrived).route?.end:null;
          if(event.arrived&&arriving==null&&groups.get(event.arrived).status!=='arrived')continue;
          const dependencyTime=event.after?.length?Math.max(...event.after.map(id=>completed.get(id))):0;
          const due=Math.max(time,event.at,dependencyTime+(event.delay??0),signalAt??0,arriving??0);
          if(due<=to&&due<nextTime){next=event;nextTime=due;}
        }
        if(!next)break;
        settle(nextTime);time=nextTime;apply(next,time);
        if(pauseAt.includes(next.id))return snapshot();
      }
      settle(to);time=to;
      return snapshot();
    }
    function report(signal){
      // Battle adapters report a result at the current campaign time.
      if(!signals.has(signal))signals.set(signal,time);
      return advance(time);
    }
    function snapshot(){
      return {time,fronts:[...fronts.values()].map(f=>({...f})),
        groups:[...groups.values()].map(({route,...group})=>({...group,route:route?{...route}:null})),
        log:log.map(event=>({...event}))};
    }
    return {advance,report,snapshot};
  };
})();
