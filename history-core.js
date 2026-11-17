(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JiangshanTime=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function yearLabel(year){return year<0?'公元前 '+Math.abs(year)+' 年':'公元 '+year+' 年';}
  function findFrame(data,year){
    if(!Number.isInteger(year)||year===0||year<-403||year>2026)return null;
    if(year>=1949)return {modern:true,title:'现代',from:1949,to:2026};
    const period=data.periods.find(p=>year>=p.from&&year<=p.to);if(!period)return null;
    const phase=period.phases.find(p=>year>=p.from&&year<=p.to);return phase?{...phase,title:period.title,key:period.key}:null;
  }
  function criticalYears(data){return [...new Set([-403,1949,2026,...data.events.map(e=>e.year),...data.periods.flatMap(p=>p.phases.map(ph=>ph.from))])].filter(y=>y!==0&&y>=-403&&y<=2026).sort((a,b)=>a-b);}
  return {yearLabel,findFrame,criticalYears};
});
