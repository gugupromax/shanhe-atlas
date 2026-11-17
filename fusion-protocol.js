(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JiangshanFusion=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const CHANNEL='jiangshan-fusion';
  const validCoord=c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85;
  function validateState(value){
    if(!value||!Number.isInteger(value.year)||value.year===0||value.year<-403||value.year>3000||!validCoord(value.center)||!Number.isFinite(value.widthKm)||value.widthKm<.01||value.widthKm>200000)return null;
    const locations=(Array.isArray(value.locations)?value.locations:[]).slice(0,1500).filter(p=>p&&validCoord(p.coord)&&typeof p.name==='string').map(p=>({name:p.name.slice(0,200),coord:[p.coord[0],p.coord[1]],kind:['city','journey','selected','event'].includes(p.kind)?p.kind:'city',year:Number.isInteger(p.year)?p.year:undefined,index:Number.isInteger(p.index)?p.index:undefined,trackIdx:Number.isInteger(p.trackIdx)?p.trackIdx:undefined,tint:typeof p.tint==='string'?p.tint:undefined}));
    const sel=value.selection||{},selection={personKey:typeof sel.personKey==='string'?sel.personKey.slice(0,300):'',personTitle:typeof sel.personTitle==='string'?sel.personTitle.slice(0,200):'',stopIndex:Number.isInteger(sel.stopIndex)?sel.stopIndex:-1,traceCoord:validCoord(sel.traceCoord)?sel.traceCoord.slice(0,2):null};
    return {active:value.active===true,reason:value.reason||'controller',sceneKey:typeof value.sceneKey==='string'?value.sceneKey:'',seq:Number.isInteger(value.seq)?value.seq:0,year:value.year,center:value.center.slice(0,2),widthKm:value.widthKm,locations,selection,snapshot:value.snapshot&&Array.isArray(value.snapshot.polities)?value.snapshot:{polities:[],regions:[],prefectures:[]},layers:value.layers||{},overlays:value.overlays||{}};
  }
  function createChild(root,handlers){
    let latest=null,lastSeq=-1,ready=false;
    function send(type,data={}){if(root.parent!==root)root.parent.postMessage({channel:CHANNEL,type,...data},'*');}
    root.addEventListener('message',event=>{
      const message=event.data;if(event.source!==root.parent||root.parent===root||!message||message.channel!==CHANNEL)return;
      if(message.type==='state'){
        const state=validateState(message);if(!state||state.seq<lastSeq)return;
        lastSeq=state.seq;latest=state;handlers.onState(state);
      }else if(message.type==='surface' && typeof handlers.onSurface==='function'){
        if(typeof message.sceneKey!=='string'||!Number.isInteger(message.renderId)||!['base','detail'].includes(message.quality)||typeof message.url!=='string'||!message.url.startsWith('data:image/png;base64,')||message.url.length>64000000||!Array.isArray(message.bounds)||message.bounds.length!==4||!message.bounds.every(Number.isFinite))return;
        const [w,s,e,n]=message.bounds;if(w>=e||s>=n||w< -180||e>180||s< -85||n>85)return;
        handlers.onSurface({sceneKey:message.sceneKey,renderId:message.renderId,quality:message.quality,url:message.url,bounds:message.bounds.slice()});
      }else if(message.type==='surface-error' && typeof handlers.onSurfaceError==='function'){
        if(typeof message.sceneKey==='string')handlers.onSurfaceError(message.sceneKey);
      }else if(message.type==='config'){
        const config={};if(['map','relief','top','east'].includes(message.view))config.view=message.view;
        if(Number.isFinite(message.exaggeration)&&message.exaggeration>=1&&message.exaggeration<=120)config.exaggeration=message.exaggeration;
        handlers.onConfig(config);
      }
    });
    return {send,get latest(){return latest;},ready(){if(!ready){ready=true;send('ready');}},applied(seq,year,supported=true){send('applied',{seq,year,supported});}};
  }
  return {CHANNEL,validCoord,validateState,createChild};
});
