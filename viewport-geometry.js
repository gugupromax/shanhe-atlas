(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JiangshanViewport=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const R=6378.137,DEG=Math.PI/180;
  const mercatorY=lat=>R*Math.log(Math.tan(Math.PI/4+Math.max(-80,Math.min(80,lat))*DEG/2));
  function createFrame(bounds,mercator=false){
    const [w,s,e,n]=bounds,cx=(w+e)/2,cy=(s+n)/2;
    const unit=mercator?R*DEG:111.32*Math.cos(cy*DEG);
    const originY=mercator?(mercatorY(s)+mercatorY(n))/2:cy*111.32;
    const width=(e-w)*unit,depth=mercator?mercatorY(n)-mercatorY(s):(n-s)*111.32;
    return {width,depth,mercator,
      toWorld:(lon,lat)=>({x:(lon-cx)*unit,z:originY-(mercator?mercatorY(lat):lat*111.32)}),
      toGeo:(x,z)=>[cx+x/unit,mercator?(2*Math.atan(Math.exp((originY-z)/R))-Math.PI/2)/DEG:(originY-z)/111.32],
      heightScale:lat=>mercator?1/Math.cos(Math.max(-80,Math.min(80,lat))*DEG):1
    };
  }
  function createGuard(T){
    const camera=new T.PerspectiveCamera(40,1,.01,1e8),ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),0),point=new T.Vector3();
    function footprint(state,aspect,fov,floorY,lookY){
      camera.aspect=aspect;camera.fov=fov;camera.updateProjectionMatrix();
      const d=state.distance,sp=Math.sin(state.phi);
      camera.position.set(d*sp*Math.sin(state.theta),lookY+d*Math.cos(state.phi),d*sp*Math.cos(state.theta));
      camera.lookAt(0,lookY,0);camera.updateMatrixWorld();plane.constant=-floorY;
      const points=[];
      for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new T.Vector2(x,y),camera);if(!ray.ray.intersectPlane(plane,point))return null;points.push({x:point.x,z:point.z});}
      return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
    }
    function constrain(state,frame,aspect,fov,floorY,lookY){
      const out={...state};out.phi=Math.max(.012,Math.min(1.05,out.phi));out.distance=Math.max(3,Math.min(Math.max(frame.width,frame.depth)*8,out.distance));
      const pad=Math.min(frame.width,frame.depth)*.008,availableX=frame.width-2*pad,availableZ=frame.depth-2*pad;
      const fits=box=>box&&box.maxX-box.minX<availableX&&box.maxZ-box.minZ<availableZ;
      let box=footprint(out,aspect,fov,floorY,lookY);
      if(!fits(box)){
        let low=0,high=out.distance;
        for(let i=0;i<32;i++){const mid=(low+high)/2,test=footprint({...out,distance:mid},aspect,fov,floorY,lookY);if(fits(test))low=mid;else high=mid;}
        out.distance=Math.max(.01,low*.999);box=footprint(out,aspect,fov,floorY,lookY);
      }
      if(!box)return out;
      const loX=-frame.width/2+pad-box.minX,hiX=frame.width/2-pad-box.maxX;
      const loZ=-frame.depth/2+pad-box.minZ,hiZ=frame.depth/2-pad-box.maxZ;
      out.x=loX<=hiX?Math.max(loX,Math.min(hiX,out.x)):0;
      out.z=loZ<=hiZ?Math.max(loZ,Math.min(hiZ,out.z)):0;
      return out;
    }
    return {constrain,footprint};
  }
  return {createFrame,createGuard,mercatorY};
});
