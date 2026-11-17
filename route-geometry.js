/* Clip before sampling: never clamp out-of-bounds routes onto a terrain edge. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TaihangRouteGeometry=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function clipSegment(a,b,bounds){
    const [w,s,e,n]=bounds,dx=b[0]-a[0],dy=b[1]-a[1];let low=0,high=1;
    if(Math.abs(dx)+Math.abs(dy)<1e-12)return null;
    const p=[-dx,dx,-dy,dy],q=[a[0]-w,e-a[0],a[1]-s,n-a[1]];
    for(let i=0;i<4;i++){
      if(Math.abs(p[i])<1e-12){if(q[i]<0)return null;continue;}
      const t=q[i]/p[i];if(p[i]<0)low=Math.max(low,t);else high=Math.min(high,t);
      if(low>high)return null;
    }
    if(high-low<1e-10)return null;
    return [[a[0]+low*dx,a[1]+low*dy],[a[0]+high*dx,a[1]+high*dy]];
  }
  function clippedSegments(nodes,bounds){
    const result=[];
    for(let i=1;i<nodes.length;i++){
      const seg=clipSegment(nodes[i-1].slice(1),nodes[i].slice(1),bounds);if(seg)result.push(seg);
    }
    return result;
  }
  return {clipSegment,clippedSegments};
});
