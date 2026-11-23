(function(){
  'use strict';
  const cfg=window.atlasCampaignDemo;
  const get=id=>document.getElementById(id);
  const map=get('map'), play=get('play'), result=get('result');
  let campaign=createAtlasCampaign(cfg), view={kind:'all'}, running=false, frame=0, clockBase=0;
  let latest=campaign.snapshot(), shownEvents=-1, shownTime=-1;
  let introDismissed=false;
  const svg=(kind,attributes,parent)=>{
    const node=document.createElementNS('http://www.w3.org/2000/svg',kind);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    if(parent)parent.append(node);
    return node;
  };
  const text=(kind,value,parent)=>{
    const node=document.createElement(kind);node.textContent=value;parent.append(node);return node;
  };
  const terrainCanvas=get('terrain-canvas');
  const terrainNotice=get('terrain-notice'), nationalAtlas=get('national-atlas');
  if(nationalAtlas)window.addEventListener('message',event=>{
    if(event.source!==nationalAtlas.contentWindow||event.origin!==location.origin||view.kind!=='national')return;
    if(event.data?.type==='atlas-changshe-front'){selectSituation(event.data.index);return;}
    if(event.data?.type!=='atlas-changshe-enter')return;
    view={kind:terrain?'situation':'all'};
    paint(latest);
    views.find(item=>item.kind===view.kind)?.button.focus();
  });
  let terrain=null;
  if(terrainCanvas){
    try{
      terrain=createChangsheTerrain(terrainCanvas,get('terrain-labels'),cfg);
      terrainCanvas.hidden=false;
      terrainNotice.hidden=true;
      map.setAttribute('hidden','');
      document.documentElement.dataset.terrain='webgl';
    }catch(error){
      terrainNotice.textContent='无法启动 3D 地形，已切换到示意图。';
      console.warn(error);
    }
  }
  const mapBrief=get('map-brief'), mapPhase=get('map-phase'), mapHeadline=get('map-headline'), mapExplain=get('map-explain'), mapMotion=get('map-motion');
  if(nationalAtlas)view={kind:'national'};
  function selectSituation(index){
    if(!Number.isInteger(index)||index<0||index>2)return;
    if(running)pause();
    introDismissed=false;
    get('situation-intro').hidden=false;
    get('intro-open').hidden=true;
    for(const button of document.querySelectorAll('#situation-tabs button'))button.setAttribute('aria-pressed',String(Number(button.dataset.front)===index));
    for(let i=0;i<3;i++)get('situation-front-'+i).hidden=i!==index;
  }
  document.querySelectorAll('#situation-tabs button').forEach(button=>button.onclick=()=>selectSituation(Number(button.dataset.front)));
  const situationStatus=get('situation-status');
  const gateFocus={meeting:'yanling',contact:'ford','wang-arrival':'ford',banner:'ford',relief:'changshe'};
  let lastMapEvent=null;
  const sceneDialog=get('scene-dialog'), sceneOpen=get('scene-open');
  const sceneImage=get('scene-image'), sceneArt=get('scene-art');
  let resumeAfterScene=false;
  if(sceneImage){
    sceneImage.onload=()=>{sceneArt.hidden=false;};
    sceneImage.onerror=()=>{sceneArt.hidden=true;};
  }
  function showScene(event){
    const scene=cfg.scenes?.[event?.id];
    if(!scene||!sceneDialog||sceneDialog.open)return;
    get('scene-title').textContent=scene.title;
    get('scene-text').textContent=scene.text;
    get('scene-source').textContent=event.source??'';
    if(sceneImage.getAttribute('src')!==scene.image){
      sceneArt.hidden=true;
      sceneImage.src=scene.image;
    }
    resumeAfterScene=running;
    if(resumeAfterScene)pause();
    sceneDialog.showModal();
  }
  if(sceneOpen)sceneOpen.onclick=()=>showScene(latest.log.at(-1));
  sceneDialog?.addEventListener('close',()=>{
    if(resumeAfterScene){
      resumeAfterScene=false;
      start();
    }
    if(cfg.scenes?.[latest.log.at(-1)?.id]){
      actions.find(({button})=>!button.disabled)?.button.focus();
    }
  });
  const reviewOpen=get('review-open'), reviewDialog=get('review-dialog');
  if(reviewOpen){
    let resumeAfterReview=false;
    reviewOpen.onclick=()=>{
      resumeAfterReview=running;
      if(running)pause();
      const list=get('review-list');
      list.replaceChildren();
      for(const event of [...latest.log].reverse()){
        const [title,detail]=cfg.mapCues?.[event.id]??[event.title,event.detail];
        const item=text('li','',list);
        text('strong',title,item);
        text('p',detail,item);
      }
      reviewDialog.showModal();
      reviewDialog.scrollTop=0;
    };
    reviewDialog.onclose=()=>{if(resumeAfterReview)start();};
  }
  const frontNames=new Map(cfg.fronts.map(front=>[front.id,front.name]));
  function updateBrief(snapshot,waiting,finished){
    if(!mapHeadline)return;
    const event=snapshot.log.at(-1);
    const route=snapshot.groups.find(unit=>unit.route&&unit.id===view.id)
      ??snapshot.groups.find(unit=>unit.route&&unit.id===cfg.motionCues?.[event?.id])
      ??snapshot.groups.find(unit=>unit.route);
    if(reviewOpen)reviewOpen.hidden=!event;
    const brief=cfg.mapCues?.[event?.id];
    if(sceneOpen)sceneOpen.hidden=!cfg.scenes?.[event?.id];
    if(situationStatus){
      const besieged=snapshot.fronts.find(front=>front.id===cfg.situation.siege).status!=='解围';
      const united=event?.id==='joint'||event?.id==='standards-advance';
      const clearing=united||snapshot.groups.some(group=>group.id==='han'&&group.route);
      const pressure=!besieged?'长社已解围':united?'宋军会师，长社待解围':clearing?'韩世忠正在突围':besieged?'长社仍被围':'';
      if(situationStatus.textContent!==pressure)situationStatus.textContent=pressure;
      situationStatus.dataset.pressure=!besieged?'clear':clearing?'breaking':'siege';
    }
    const phase=finished?'本局结局':waiting?'等待下令':route?'行军中':event?'战役进行中':'战役开场';
    const title=brief?.[0]??event?.title??'长社被围，赵玖仍在南阳';
    const detail=brief?.[1]??event?.detail??'点「从南阳出发」。赵玖与赤心队将向东绕行，韩世忠仍在长社。';
    const motion=route?route.name+' → '+frontNames.get(route.route.front)+' · '+Math.min(100,Math.round(100*(snapshot.time-route.route.start)/(route.route.end-route.route.start)))+'%':
      waiting?'选择下一条命令继续。':finished?'可在各处查看结局，或重开。':'';
    for(const [element,value] of [[mapPhase,phase],[mapHeadline,title],[mapExplain,detail],[mapMotion,motion]]){
      if(element.textContent!==value)element.textContent=value;
    }
  }
  const actions=(cfg.controls??[]).map(action=>{
    const button=text('button',action.label,get('orders'));
    button.type='button';
    button.onclick=()=>{
      if(!introDismissed)return;
      if(action.focus)view={...action.focus};
      paint(campaign.report(action.signal));
      if(!running&&!play.disabled)start();
    };
    return {button,action};
  });
  let selectedEvent=null;
  function showStory(event){
    const panel=get('story');
    if(!panel)return;
    panel.replaceChildren();
    text('h2',event?.title??'战役开场',panel);
    text('p',event?.detail??'南阳金军压境，长社韩世忠所部受围。下令后可从事件记录回看关键人物和剧情。',panel);
    if(event?.people)text('p','人物 · '+event.people,panel);
    if(event?.source)text('small',event.source,panel);
  }
  const views=[], unitView=get('unit-view');
  function viewButton(name,kind,id,parent){
    const button=text('button',name,parent);
    button.type='button';
    button.onclick=()=>{if(!introDismissed&&kind!=='national')return;view={kind,id};paint(latest);};
    views.push({button,kind,id});
  }
  if(nationalAtlas)viewButton('全国 3D 地图','national',undefined,get('views'));
  viewButton('战役总览','all',undefined,get('views'));
  if(terrain&&cfg.situation)viewButton('长社战局','situation',undefined,get('views'));
  const fronts=cfg.fronts.map(front=>{
    if(!front.hiddenView)viewButton(front.name,'front',front.id,get('views'));
    const row=text('li',front.name,get('front-status')), status=text('strong','',row);
    const siege=cfg.terrain&&front.id==='nanyang'
      ?svg('circle',{class:'map-siege',cx:front.x,cy:front.y,r:3.3},get('landmarks')):null;
    const dot=svg('circle',{class:'front-dot',cx:front.x,cy:front.y,r:1.25},get('landmarks'));
    const label=svg('text',{class:'map-label',x:front.x+1.8,y:front.y-.8},get('landmarks'));
    label.textContent=front.name;
    return {status,dot,label,siege};
  });
  const statusNames={waiting:'待命',marching:'行军中',fighting:'交战中',arrived:'已抵达',holding:'守住阵地',routed:'阵溃',charge:'冲向徐庆阵',rout:'阵溃',standard:'举旗推进',withdraw:'沿河撤离',withdrawing:'撤离',isolated:'受阻'};
  const units=cfg.groups.map(group=>{
    if(unitView)text('option',group.name,unitView).value=group.id;
    const row=text('li','',get('units'));
    viewButton(group.name,'unit',group.id,row);
    const status=text('span','',row);status.className='role';
    const route=svg('line',{class:'route'},get('routes'));
    const parts=svg('g',{},get('forces'));
    const flag=svg('rect',{class:'flag '+group.side,x:-1.15,y:-.57,width:2.3,height:1.14,rx:.17},parts);
    const scale=svg('rect',{x:1.6,y:1.15,width:6,height:.34,fill:'#24302c',stroke:'#f0d8a2','stroke-width':.08},parts);
    const scaleFill=svg('rect',{x:1.6,y:1.15,width:0,height:.34,fill:'#ffe07a'},parts);
    const label=svg('text',{class:'map-label',x:1.6,y:group.labelY??.72},parts);
    label.textContent=group.name;
    return {status,route,parts,flag,label,scale,scaleFill};
  });
  if(unitView)unitView.onchange=()=>{
    if(unitView.value)view={kind:'unit',id:unitView.value};
    else view={kind:'all'};
    paint(latest);
  };
  function paint(snapshot){
    latest=snapshot;
    const eventId=snapshot.log.at(-1)?.id??null;
    const sceneChanged=eventId!==lastMapEvent;
    if(mapHeadline&&sceneChanged){
      lastMapEvent=eventId;
      if(cfg.cameraCues?.[eventId]&&view.kind!=='national')view={...cfg.cameraCues[eventId]};
      else if(eventId==='meeting'&&terrain&&cfg.situation&&view.kind!=='national')view={kind:'situation'};
      else if(gateFocus[eventId]&&view.kind!=='national')view={kind:'front',id:gateFocus[eventId]};
    }
    if(unitView)unitView.value=view.kind==='unit'?view.id:'';
    const compact=view.kind==='front'||view.kind==='unit';
    const national=Boolean(nationalAtlas&&view.kind==='national');
    if(nationalAtlas){
      const intro=get('situation-intro'), introOpen=get('intro-open');
      if(intro){intro.hidden=!national||introDismissed;introOpen.hidden=!national||!introDismissed;}
      if(national&&!nationalAtlas.hasAttribute('src')){
        nationalAtlas.src='../index.html?embed=1&lock=1&year=1128&terrain=3d&battle=changshe';
      }
      nationalAtlas.classList.toggle('is-active',national);
      nationalAtlas.setAttribute('aria-hidden',String(!national));
      nationalAtlas.tabIndex=national?0:-1;
      get('terrain-labels').hidden=national;
      if(terrainCanvas)terrainCanvas.hidden=national||!terrain;
      map.toggleAttribute('hidden',national||Boolean(terrain));
      terrainNotice.hidden=national||Boolean(terrain);
    }
    if(terrain&&!national)terrain.render(snapshot,view);
    else if(!national){
      map.classList.toggle('compact',compact);
      if(compact){
        const focus=(view.kind==='front'?snapshot.fronts:snapshot.groups).find(item=>item.id===view.id);
        map.setAttribute('viewBox',[(focus.x-16),(focus.y-11),32,22].join(' '));
      }else map.setAttribute('viewBox','0 0 100 68');
    }
    for(const {button,kind,id} of views)button.setAttribute('aria-pressed',String(view.kind===kind&&view.id===id));
    const reachedYanling=cfg.terrain&&snapshot.log.some(event=>event.id==='meeting');
    mapBrief?.toggleAttribute('data-night-detour',!national&&cfg.terrain&&!reachedYanling);
    snapshot.fronts.forEach((front,i)=>{
      const {status,label,siege}=fronts[i];
      status.textContent=front.status;
      if(siege){
        siege.toggleAttribute('hidden',reachedYanling);
        label.setAttribute('x',front.x+(reachedYanling?1.8:4.2));
        label.textContent=reachedYanling?front.name:front.name+' · 金军围城';
      }
    });
    snapshot.groups.forEach((group,i)=>{
      const {parts,status,route,label,scale,scaleFill}=units[i];
      const strength=cfg.strengthFor?.(group,snapshot.log);
      const strengthValue=cfg.strengthScale?.(group,snapshot.log);
      scaleFill.setAttribute('width',strengthValue==null?0:6*Math.min(strengthValue,80000)/80000);
      scale.setAttribute('stroke-dasharray',strengthValue==null?'.3 .2':'');
      label.textContent='⚑ '+group.name+(strength?' · '+strength:'')+(group.id==='emperor'&&group.route&&!reachedYanling?' · 夜间绕行':'');
      status.textContent=(statusNames[group.route?.motion??group.status]??group.status)+' · '+group.morale;
      parts.style.display=(group.reveal&&!snapshot.log.some(event=>event.id===group.reveal))||(group.displayUntil&&snapshot.log.some(event=>event.id===group.displayUntil))?'none':'';
      parts.setAttribute('transform','translate('+group.x+' '+group.y+')');
      parts.setAttribute('data-unit',group.id);
      parts.setAttribute('data-position',group.x.toFixed(2)+','+group.y.toFixed(2));
      route.style.display=group.route?'':'none';
      if(group.route)for(const [key,value] of Object.entries({x1:group.x,y1:group.y,x2:group.route.toX,y2:group.route.toY}))route.setAttribute(key,value);
    });
    const whole=Math.floor(snapshot.time);
    if(whole!==shownTime){shownTime=whole;get('clock').textContent=Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');}
    if(snapshot.log.length!==shownEvents){
      shownEvents=snapshot.log.length;get('journal').replaceChildren();
      showStory(snapshot.log.find(event=>event.id===selectedEvent)??snapshot.log.filter(event=>event.people).at(-1));
      for(const event of [...snapshot.log].reverse()){
        const row=text('li','',get('journal'));
        if(get('story')){
          const button=text('button',Math.floor(event.time)+'秒 · '+event.title,row);
          button.type='button';
          button.onclick=()=>{
            selectedEvent=event.id;
            showStory(event);
            if(terrain&&cfg.terrain)get('story').scrollIntoView({block:'nearest'});
            showScene(event);
          };
        }else{
          text('strong',Math.floor(event.time)+'秒 · '+event.title,row);text('small',event.detail,row);
        }
      }
    }
    const done=new Set(snapshot.log.map(event=>event.id));
    if(result)result.disabled=!done.has('join')||done.has('won');
    const finished=done.has(cfg.finishAt??'relief');
    for(const {button,action} of actions){
      button.disabled=finished||done.has(action.consumed)||(action.after??[]).some(id=>!done.has(id));
    }
    if(mapHeadline)for(const {button} of actions)button.hidden=button.disabled;
    const waiting=cfg.pauseAt?.includes(snapshot.log.at(-1)?.id);
    if(cfg.controls&&(finished||waiting)){
      pause();
      play.textContent=finished?'战役结束':'等待下令';
    }
    updateBrief(snapshot,waiting,finished);
    play.disabled=Boolean((national&&!introDismissed)||(cfg.controls&&(finished||waiting)));
    for(const item of views)item.button.disabled=!introDismissed&&item.kind!=='national';
    if(unitView)unitView.disabled=!introDismissed;
    if(sceneChanged&&waiting)showScene(snapshot.log.at(-1));
  }
  function pause(){
    running=false;cancelAnimationFrame(frame);play.textContent=latest.time?'继续':'开始';
  }
  function tick(now){
    if(!running)return;
    paint(campaign.advance(Math.max(latest.time,(now-clockBase)/1000)));
    if(running)frame=requestAnimationFrame(tick);
  }
  function start(){
    running=true;clockBase=performance.now()-latest.time*1000;play.textContent='暂停';frame=requestAnimationFrame(tick);
  }
  play.onclick=()=>{
    if(!introDismissed)return;
    if(running){pause();return;}
    if(!latest.log.length&&cfg.autoStartSignal){
      view={kind:'all'};
      paint(campaign.report(cfg.autoStartSignal));
    }
    if(!play.disabled)start();
  };
  if(get('intro-close'))get('intro-close').onclick=()=>{introDismissed=true;view={kind:latest.log.length?'situation':'all'};paint(latest);};
  if(get('intro-open'))get('intro-open').onclick=()=>{selectSituation(0);paint(latest);};
  get('reset').onclick=()=>{pause();introDismissed=false;campaign=createAtlasCampaign(cfg);view={kind:nationalAtlas?'national':'all'};selectedEvent=null;play.disabled=false;paint(campaign.snapshot());play.textContent='开始';};
  result?.addEventListener('click',()=>paint(campaign.report('east:won')));
  const detailsToggle=get('toggle-details');
  if(detailsToggle)detailsToggle.onclick=()=>{
    const details=get('campaign-details');
    details.hidden=!details.hidden;
    detailsToggle.setAttribute('aria-expanded',String(!details.hidden));
    detailsToggle.textContent=details.hidden?'显示右侧资料':'收起右侧资料';
    details.closest('.board').classList.toggle('details-hidden',details.hidden);
    paint(latest);
  };
  paint(latest);
})();
