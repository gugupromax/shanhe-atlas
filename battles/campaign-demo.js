(function(){
  'use strict';
  const cfg=window.atlasCampaignDemo;
  const clockStops=[...(cfg.pauseAt??[]),cfg.finishAt??'relief'];
  const get=id=>document.getElementById(id);
  const map=get('map'), play=get('play'), result=get('result');
  let campaign=createAtlasCampaign(cfg), view={kind:'all'}, running=false, frame=0, clockBase=0;
  let latest=campaign.snapshot(), shownEvents=-1, shownTime=-1;
  let introDismissed=!get('situation-intro');
  const svg=(kind,attributes,parent)=>{
    const node=document.createElementNS('http://www.w3.org/2000/svg',kind);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    if(parent)parent.append(node);
    return node;
  };
  const text=(kind,value,parent)=>{
    const node=document.createElement(kind);node.textContent=value;parent.append(node);return node;
  };
  const nationalAtlas=get('national-atlas');
  const intro=get('situation-intro');
  const locationViews=['nanyang','story','shanzhou'];
  const chapterViews={briefing:'story',courier:'nanyang',meeting:'yanling','march-yue':'story',contact:'changshe','reserve-exit':'story'};
  const actionViews={briefing:'yanling',depart:'nanyang',yamen:'yanling',conference:'yanling'};
  let atlasMode='overview', cardIndex=0, resumeAfterCard=false, followChapters=false, lastChapter=null;
  function sendAtlasView(refocus=false){
    nationalAtlas.contentWindow.postMessage({type:'atlas-changshe-map',mode:atlasMode,refocus},
      location.origin==='null'?'*':location.origin);
  }
  function setAtlasView(mode){
    atlasMode=mode;
    if(mode!=='overview')cardIndex=mode==='shanzhou'?2:mode==='nanyang'?0:1;
    sendAtlasView(true);
    for(const button of get('views').querySelectorAll('[data-atlas-view]')){
      button.setAttribute('aria-pressed',String(button.dataset.atlasView===mode));
    }
    get('west-note').hidden=mode!=='shanzhou';
    get('polity-legend').hidden=mode!=='overview';
  }
  function closeSituation(){
    introDismissed=true;
    intro.hidden=true;
    get('intro-open').hidden=false;
    paint(latest);
    if(resumeAfterCard&&!play.disabled)start();
    resumeAfterCard=false;
  }
  function selectSituation(index){
    if(!Number.isInteger(index)||index<0||index>=locationViews.length)return;
    cardIndex=index;
    if(running){resumeAfterCard=true;pause();}
    intro.hidden=false;
    intro.classList.toggle('location-card',introDismissed);
    get('intro-open').hidden=true;
    get('situation-close').hidden=!introDismissed;
    get('intro-choices').hidden=introDismissed;
    for(const button of get('situation-tabs').querySelectorAll('button')){
      button.setAttribute('aria-pressed',String(Number(button.dataset.front)===index));
    }
    for(let i=0;i<locationViews.length;i++)get('situation-front-'+i).hidden=i!==index;
    play.disabled=true;
  }
  if(nationalAtlas){
    window.addEventListener('message',event=>{
      if(event.source!==nationalAtlas.contentWindow||event.origin!==location.origin)return;
      if(event.data?.type==='atlas-changshe-ready')sendAtlasView();
      else if(event.data?.type==='atlas-changshe-scale'&&typeof event.data.wide==='boolean'){
        get('polity-legend').hidden=!event.data.wide;
      }
      else if(event.data?.type==='atlas-changshe-front'){
        if(!Number.isInteger(event.data.index)||event.data.index<0||event.data.index>=locationViews.length)return;
        introDismissed=true;
        selectSituation(event.data.index);
      }
      else if(event.data?.type==='atlas-changshe-enter'){closeSituation();setAtlasView('changshe');}
    });
    for(const button of document.querySelectorAll('[data-atlas-view]')){
      button.onclick=()=>{
        followChapters=button.id==='intro-close';
        closeSituation();setAtlasView(button.dataset.atlasView);
      };
    }
    for(const button of get('situation-tabs').querySelectorAll('button')){
      button.onclick=()=>{
        const index=Number(button.dataset.front);
        followChapters=false;
        selectSituation(index);
        setAtlasView(locationViews[index]);
      };
    }
    get('intro-open').onclick=()=>selectSituation(atlasMode==='shanzhou'?2:cardIndex);
    get('situation-close').onclick=closeSituation;
  }
  const mapPhase=get('map-phase'),mapSource=get('map-source'),mapHeadline=get('map-headline'),mapExplain=get('map-explain');
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
  function updateBrief(snapshot,waiting,finished){
    if(!mapHeadline)return;
    const event=snapshot.log.at(-1);
    if(reviewOpen)reviewOpen.hidden=!event;
    const brief=cfg.mapCues?.[event?.id];
    if(sceneOpen)sceneOpen.hidden=!cfg.scenes?.[event?.id];
    const chapters=cfg.chapters??[];
    const chapterIndex=Math.max(0,chapters.findLastIndex(([id])=>snapshot.log.some(item=>item.id===id)));
    const chapter=chapters[chapterIndex];
    if(chapter&&chapter[0]!==lastChapter){
      lastChapter=chapter[0];
      const next=chapterViews[lastChapter];
      if(followChapters&&introDismissed&&next&&atlasMode!==next)setAtlasView(next);
    }
    const phase=chapter?(chapterIndex+1)+' / '+chapters.length+'　'+chapter[1]:finished?'本局结局':waiting?'等待下令':event?'战役进行中':'战役开场';
    const title=brief?.[0]??event?.title??cfg.openingBrief?.[0]??'战役开场';
    const detail=brief?.[1]??event?.detail??cfg.openingBrief?.[1]??'';
    for(const [element,value] of [[mapPhase,phase],[mapSource,chapter?.[2]??''],[mapHeadline,title],[mapExplain,detail]]){
      if(element&&element.textContent!==value)element.textContent=value;
    }
  }
  const actions=(cfg.controls??[]).map(action=>{
    const button=text('button',action.label,get('orders'));
    button.type='button';
    button.onclick=()=>{
      if(!introDismissed)return;
      paint(campaign.report(action.signal));
      if(nationalAtlas&&actionViews[action.signal])setAtlasView(actionViews[action.signal]);
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
  const views=[];
  function viewButton(name,kind,id,parent){
    const button=text('button',name,parent);
    button.type='button';
    button.onclick=()=>{
      view={kind,id};
      paint(latest);
    };
    views.push({button,kind,id});
  }
  if(map)viewButton('战役总览','all',undefined,get('views'));
  const fronts=cfg.fronts.map(front=>{
    const row=text('li',front.name,get('front-status')), status=text('strong','',row);
    if(!map)return {status};
    viewButton(front.name,'front',front.id,get('views'));
    const dot=svg('circle',{class:'front-dot',cx:front.x,cy:front.y,r:1.25},get('landmarks'));
    const label=svg('text',{class:'map-label',x:front.x+1.8,y:front.y-.8},get('landmarks'));
    label.textContent=front.name;
    return {status,dot,label};
  });
  const statusNames={waiting:'待命',marching:'行军中',fighting:'交战中',arrived:'已抵达',holding:'守住阵地',routed:'阵溃',charge:'冲向徐庆阵',rout:'阵溃',standard:'举旗推进',withdraw:'沿河撤离',withdrawing:'撤离',isolated:'受阻'};
  const units=cfg.groups.map(group=>{
    const row=text('li','',get('units'));
    if(map)viewButton(group.name,'unit',group.id,row);
    else text('span',group.name,row);
    const status=text('span','',row);status.className='role';
    if(!map)return {status};
    const route=svg('line',{class:'route'},get('routes'));
    const parts=svg('g',{},get('forces'));
    const flag=svg('rect',{class:'flag '+group.side,x:-1.15,y:-.57,width:2.3,height:1.14,rx:.17},parts);
    const scale=svg('rect',{x:1.6,y:1.15,width:6,height:.34,fill:'#24302c',stroke:'#f0d8a2','stroke-width':.08},parts);
    const scaleFill=svg('rect',{x:1.6,y:1.15,width:0,height:.34,fill:'#ffe07a'},parts);
    const label=svg('text',{class:'map-label',x:1.6,y:group.labelY??.72},parts);
    label.textContent=group.name;
    return {status,route,parts,flag,label,scale,scaleFill};
  });
  function paint(snapshot){
    latest=snapshot;
    const done=new Set(snapshot.log.map(event=>event.id));
    const eventId=snapshot.log.at(-1)?.id??null;
    const sceneChanged=eventId!==lastMapEvent;
    lastMapEvent=eventId;
    if(map){
      const compact=view.kind==='front'||view.kind==='unit';
      map.classList.toggle('compact',compact);
      if(compact){
        const focus=(view.kind==='front'?snapshot.fronts:snapshot.groups).find(item=>item.id===view.id);
        map.setAttribute('viewBox',[(focus.x-16),(focus.y-11),32,22].join(' '));
      }else map.setAttribute('viewBox','0 0 100 68');
    }
    for(const {button,kind,id} of views)button.setAttribute('aria-pressed',String(view.kind===kind&&view.id===id));
    snapshot.fronts.forEach((front,i)=>{
      const {status,label,dot}=fronts[i];
      status.textContent=front.status;
      if(!map)return;
      const hidden=Boolean(front.reveal&&!done.has(front.reveal));
      dot.toggleAttribute('hidden',hidden);
      label.toggleAttribute('hidden',hidden);
    });
    snapshot.groups.forEach((group,i)=>{
      const {parts,status,route,label,scale,scaleFill}=units[i];
      status.textContent=(statusNames[group.route?.motion??group.status]??group.status)+' · '+group.morale;
      if(!map)return;
      scaleFill.setAttribute('width',0);
      scale.setAttribute('stroke-dasharray','.3 .2');
      label.textContent='⚑ '+group.name;
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
            if(nationalAtlas){
              const chapter=[...snapshot.log.slice(0,snapshot.log.indexOf(event)+1)].reverse().find(item=>chapterViews[item.id]);
              if(chapter){followChapters=false;setAtlasView(chapterViews[chapter.id]);}
              get('story').scrollIntoView({block:'nearest'});
            }
            showScene(event);
          };
        }else{
          text('strong',Math.floor(event.time)+'秒 · '+event.title,row);text('small',event.detail,row);
        }
      }
    }
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
    play.disabled=Boolean((intro&&!intro.hidden)||(cfg.controls&&(finished||waiting)));
    if(sceneChanged&&waiting)showScene(snapshot.log.at(-1));
  }
  function pause(){
    running=false;cancelAnimationFrame(frame);play.textContent=latest.time?'继续':'开始';
  }
  function tick(now){
    if(!running)return;
    paint(campaign.advance(Math.max(latest.time,(now-clockBase)/1000),clockStops));
    if(running)frame=requestAnimationFrame(tick);
  }
  function start(){
    running=true;clockBase=performance.now()-latest.time*1000;play.textContent='暂停';frame=requestAnimationFrame(tick);
  }
  play.onclick=()=>{
    if(!introDismissed)return;
    if(running){pause();return;}
    if(!latest.log.length&&cfg.autoStartSignal){
      paint(campaign.report(cfg.autoStartSignal));
    }
    if(!play.disabled)start();
  };
  get('reset').onclick=()=>{
    pause();
    campaign=createAtlasCampaign(cfg);view={kind:'all'};selectedEvent=null;lastMapEvent=null;
    if(nationalAtlas){
      introDismissed=false;resumeAfterCard=false;followChapters=false;lastChapter=null;
      selectSituation(0);setAtlasView('overview');
    }
    paint(campaign.snapshot());play.textContent='开始';
  };
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
  if(nationalAtlas)selectSituation(0);
  paint(latest);
})();
