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

  // Another consumer generates draw indices only when a visible patch is first needed.
  function meshTiles(width,height,tileSize=Math.max(width,height),step=1){
    const tiles=[];
    let length=0;
    for(let row=0;row<height-1;row+=tileSize){
      for(let col=0;col<width-1;col+=tileSize){
        const lastRow=Math.min(height-1,row+tileSize);
        const lastCol=Math.min(width-1,col+tileSize);
        const count=Math.ceil((lastRow-row)/step)*Math.ceil((lastCol-col)/step)*6;
        tiles.push({row,col,lastRow,lastCol,start:length,count});
        length+=count;
      }
    }
    return tiles;
  }
  function meshIndices(width,height,tileSize=Math.max(width,height),step=1){
    const tiles=meshTiles(width,height,tileSize,step);
    const last=tiles.at(-1);
    const indices=new Uint32Array(last?last.start+last.count:0);
    let i=0;
    for(const tile of tiles){
      for(let row=tile.row;row<tile.lastRow;row+=step){
        const nextRow=Math.min(row+step,tile.lastRow);
        for(let col=tile.col;col<tile.lastCol;col+=step){
          const nextCol=Math.min(col+step,tile.lastCol);
          const a=row*width+col,b=row*width+nextCol,c=nextRow*width+col,d=nextRow*width+nextCol;
          indices[i++]=a;indices[i++]=c;indices[i++]=b;
          indices[i++]=b;indices[i++]=c;indices[i++]=d;
        }
      }
    }
    return {indices,tiles};
  }
  // Positions form a regular rectangular grid in plan. Sum the two upward-facing
  // triangle cross products at their three corners, then normalize as THREE does.
  function gridNormals(width,height,positions,normals=new Float32Array(positions.length)){
    normals.fill(0);
    const stride=width*3;
    function add(i,nx,ny,nz){
      normals[i]+=nx;normals[i+1]+=ny;normals[i+2]+=nz;
    }
    for(let row=0;row<height-1;row++)for(let col=0;col<width-1;col++){
      const a=row*stride+3*col,b=a+3,c=a+stride,d=c+3;
      const dx=positions[b]-positions[a],dz=positions[c+2]-positions[a+2];
      const ny=dx*dz;
      const nxA=dz*(positions[a+1]-positions[b+1]),nzA=dx*(positions[a+1]-positions[c+1]);
      const nxD=dz*(positions[c+1]-positions[d+1]),nzD=dx*(positions[b+1]-positions[d+1]);
      add(a,nxA,ny,nzA);
      add(b,nxA+nxD,2*ny,nzA+nzD);
      add(c,nxA+nxD,2*ny,nzA+nzD);
      add(d,nxD,ny,nzD);
    }
    for(let i=0;i<normals.length;i+=3){
      const nx=normals[i],ny=normals[i+1],nz=normals[i+2];
      const length=Math.sqrt(nx*nx+ny*ny+nz*nz);
      if(length){normals[i]=nx/length;normals[i+1]=ny/length;normals[i+2]=nz/length;}
    }
    return normals;
  }
  return {createFrame,createGuard,mercatorY,meshTiles,meshIndices,gridNormals};
});
