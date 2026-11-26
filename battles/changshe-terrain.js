/* Changshe campaign renderer. Present-day DEMs and approximate literary locations. */
(function () {
  'use strict';
  window.createChangsheTerrain=function(canvas, labels, config){
    const T=window.THREE;
    const renderer=new T.WebGLRenderer({canvas,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.45));
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(41,1,.02,26000);
    scene.background=new T.Color('#c8d4c8');
    const light=new T.DirectionalLight('#fff2d6',2.15);
    light.position.set(-170,260,100);
    scene.add(light,new T.HemisphereLight('#fff3d8','#697a68',1.45));
    const project=(lon,lat)=>[(lon-113)*92,(33.6-lat)*111];
    function createGrid(data,stride,multiplier){
      const {width,height,bounds}=data,[west,south,east,north]=bounds;
      const raw=atob(data.data),bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0)),heights=new DataView(bytes.buffer);
      const value=(x,y)=>heights.getInt16((y*width+x)*2,true);
      function elevation(lon,lat){
        const x=T.MathUtils.clamp((lon-west)/(east-west)*(width-1),0,width-1);
        const y=T.MathUtils.clamp((north-lat)/(north-south)*(height-1),0,height-1);
        const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1);
        return T.MathUtils.lerp(T.MathUtils.lerp(value(x0,y0),value(x1,y0),x-x0),
          T.MathUtils.lerp(value(x0,y1),value(x1,y1),x-x0),y-y0);
      }
      const columns=Math.ceil((width-1)/stride)+1, rows=Math.ceil((height-1)/stride)+1;
      const geo=new T.PlaneGeometry(1,1,columns-1,rows-1).rotateX(-Math.PI/2);
      const points=geo.attributes.position,colors=[],color=new T.Color();
      const water=new T.Color('#7398a4'),lowland=new T.Color('#aab788'),upland=new T.Color('#a08b6c'),snow=new T.Color('#e7dec7');
      for(let i=0;i<points.count;i++){
        const x=Math.min(width-1,(i%columns)*stride),y=Math.min(height-1,Math.floor(i/columns)*stride);
        const lon=west+(east-west)*x/(width-1),lat=north-(north-south)*y/(height-1),h=value(x,y);
        const [xx,zz]=project(lon,lat);
        points.setXYZ(i,xx,Math.max(0,h)/1000*multiplier,zz);
        if(h<0)color.copy(water);
        else if(h>2500)color.copy(upland).lerp(snow,Math.min(1,(h-2500)/4100));
        else color.copy(lowland).lerp(upland,h/2500);
        colors.push(color.r,color.g,color.b);
      }
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
      const model=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
      scene.add(model);
      return {model,elevation:(lon,lat)=>Math.max(0,elevation(lon,lat))/1000*multiplier};
    }
    const local=createGrid(window.changsheTerrainGrid,1,6);
    const fronts=new Map(config.fronts.map(front=>[front.id,front]));
    const markerGroup=new T.Group();
    scene.add(markerGroup);
    // The novel's river crossing is a geographic cue. Its path is schematic.
    const riverTrace=[[113.83,34.21],[113.86,34.16],[113.90,34.12],[113.88,34.08],[113.91,34.02],[113.94,33.96],[113.91,33.89]];
    const stream=new T.CatmullRomCurve3(riverTrace.map(geo=>{
      const [x,z]=project(...geo);
      return new T.Vector3(x,local.elevation(...geo)+.035,z);
    }));
    const waterShape=new T.TubeGeometry(stream,56,.085,5,false);
    markerGroup.add(new T.Mesh(waterShape,new T.MeshBasicMaterial({color:'#5b8990'})));
    const riverLabel=label('清潩水（示意）','terrain-city');
    const westRiver=config.situation?.westRiver;
    const westLabel=label('浊潩水（示意）','terrain-city');
    const westLabelPoint=westRiver&&raisedPoint(westRiver[2],.25);
    if(westRiver){
      const branch=new T.CatmullRomCurve3(westRiver.map(geo=>raisedPoint(geo,.045)));
      markerGroup.add(new T.Mesh(new T.TubeGeometry(branch,49,.075,5,false),
        new T.MeshBasicMaterial({color:'#688a90'})));
    }
    const pontoonGroup=new T.Group();
    markerGroup.add(pontoonGroup);
    const deck=new T.BoxGeometry();
    const deckColor=new T.MeshBasicMaterial({color:'#e8d3a3'});
    const crossings=config.situation?.crossings??[];
    for(const [index,crossing] of crossings.entries()){
      const pontoon=new T.Mesh(deck,deckColor);
      pontoon.position.copy(raisedPoint(crossing,.15));
      pontoon.scale.set(index===3?2.55:.74,.1,index===3?.26:.13);
      pontoonGroup.add(pontoon);
    }
    const crossingTag=label('浮桥已拆','terrain-dispersal');
    const crossingPoint=crossings[3]&&raisedPoint(crossings[3],.6);
    const riverGeo=[113.88,34.08], [riverX,riverZ]=project(...riverGeo);
    function label(text,className){
      const element=document.createElement('span');
      element.className='terrain-tag '+className;element.textContent=text;labels.append(element);return element;
    }
    const box=new T.BoxGeometry(),head=new T.SphereGeometry(.1,7,5),roof=new T.ConeGeometry(1,1,4);
    const cloth={friendly:new T.MeshStandardMaterial({color:'#a74635'}),opposing:new T.MeshStandardMaterial({color:'#285c66'})};
    const dark=new T.MeshStandardMaterial({color:'#342b27'}), wood=new T.MeshStandardMaterial({color:'#a78155'});
    const stone=new T.MeshStandardMaterial({color:'#ac9170'}),tile=new T.MeshStandardMaterial({color:'#49554b'});
    function mesh(parent,g,mat,x,y,z,w,h,d){
      const item=new T.Mesh(g,mat);
      item.position.set(x,y,z);item.scale.set(w,h,d);parent.add(item);
      return item;
    }
    function town(front){
      const model=new T.Group();
      // These buildings are symbols at approximate points, never reconstructed monuments.
      if(!front.landmarkOnly&&front.id!=='hills'&&front.id!=='ford'){
        const width=front.id==='changshe'?3.15:2.15, depth=width*.68;
        mesh(model,box,stone,0,.33,-depth/2,width,.66,.16);
        for(const x of [-width*.31,width*.31])mesh(model,box,stone,x,.33,depth/2,width*.38,.66,.17);
        mesh(model,box,wood,0,.58,depth/2,.52,.25,.42);
        mesh(model,roof,tile,0,.81,depth/2,.51,.33,.42).rotation.y=Math.PI/4;
        for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2]){
          mesh(model,box,stone,x,.48,z,.33,.96,.33);
          mesh(model,roof,tile,x,1.07,z,.34,.28,.34).rotation.y=Math.PI/4;
        }
        for(const x of [-width/2,width/2])mesh(model,box,stone,x,.36,0,.13,.72,depth);
        for(const [x,z] of [[-width*.24,-.25],[width*.23,.3],[.06,-.3]]){
          mesh(model,box,wood,x,.32,z,.48,.64,.32);
          mesh(model,roof,tile,x,.77,z,.46,.29,.32).rotation.y=Math.PI/4;
        }
      }
      if(front.id==='jin-camp'){
        for(const x of [-.6,.6])mesh(model,box,wood,x,.37,0,.12,.74,.8);
        mesh(model,box,wood,0,.77,0,1.45,.14,.9);
        mesh(model,box,cloth.opposing,0,1.15,-.42,1.34,.54,.05);
      }
      markerGroup.add(model);
      const city=label(front.name,'terrain-city');
      const [x,z]=project(...front.geo);
      model.position.set(x,local.elevation(...front.geo)+.09,z);
      return {model,city};
    }
    const locations=new Map(config.fronts.map(front=>[front.id,town(front)]));
    const shaftGeometry=new T.CylinderGeometry(1,1,1,6);
    function makeUnit(group){
      const model=new T.Group(), mounted=window.atlasBattleUnits[group.type].mounted;
      const shape=window.atlasBattleFormations[group.formation], runners=[];
      for(let row=0;row<shape.rows;row++)for(let col=0;col<shape.columns;col++){
        const x=(col-(shape.columns-1)/2)*.29,z=(row-(shape.rows-1)/2)*.28,lift=mounted?.18:0;
        const soldier=['xu','river-jin'].includes(group.id)?new T.Group():model;
        if(soldier!==model){
          model.add(soldier);
          runners.push(soldier);
        }
        if(mounted){
          mesh(soldier,box,wood,x,.12,z,.19,.18,.26);
          mesh(soldier,head,wood,x,.23,z+.13,.64,.95,.70);
          for(const dx of [-.06,.06])mesh(soldier,box,dark,x+dx,.055,z-.02,.055,.12,.15);
        }else mesh(soldier,box,dark,x,.095,z,.12,.18,.11);
        mesh(soldier,box,cloth[group.side],x,.22+lift,z,.17,.16,.13);
        mesh(soldier,head,dark,x,.34+lift,z,.62,.74,.62);
        mesh(soldier,box,wood,x+.10,.26+lift,z,.026,.39,.026);
      }
      const standard=new T.Group();
      mesh(standard,box,wood,-1.05,.38,0,.045,.77,.045);
      mesh(standard,box,cloth[group.side],-.84,.64,0,.39,.29,.035);
      model.add(standard);
      markerGroup.add(model);
      const text=label('','terrain-unit '+group.side);
      text.dataset.unit=group.id;
      const leader=document.createElement('span');
      leader.className='terrain-unit-leader';leader.hidden=true;
      leader.setAttribute('aria-hidden','true');labels.append(leader);
      text._leader=leader;
      const caption=document.createElement('span');
      caption.className='unit-caption';
      const scale=document.createElement('span');
      scale.className='unit-strength-scale';
      const fill=document.createElement('span');
      fill.className='unit-strength-fill';
      scale.append(fill);text.append(caption,scale);
      const route=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),
        new T.LineDashedMaterial({color:group.side==='friendly'?'#9d572d':'#33585c',dashSize:1.5,gapSize:.9}));
      route.frustumCulled=false;markerGroup.add(route);
      const arrowColor=group.side==='friendly'?'#ffd889':'#99dfdf';
      const arrow=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),1,arrowColor);
      const shaft=new T.Mesh(shaftGeometry,new T.MeshBasicMaterial({color:arrowColor}));
      arrow.add(shaft);
      arrow.traverse(part=>{if(part.material){
        part.material.depthTest=false;
        part.material.depthWrite=false;
        part.renderOrder=2;
      }});
      markerGroup.add(arrow);
      return {model,text,caption,scale,fill,route,arrow,shaft,runners,standard};
    }
    const heading=new T.Vector3();
    const cityHighlights=new Set(['赵玖与岳飞议战','诸将赴县衙','岳飞受命调度','交战中','两路宋军接战','金军赴长葛设伏','援军到场，金军援部受阻','宋军会师','宋军沿河布防','宋军过河，浮桥已拆','解围']);
    for(const status of ['援军集结，待命','杜充按兵不动','杜充私约不战','杜岩密报抵达','挞懒脱身，鹘拔鲁战死','赵玖拟经此返东京','北追联络点'])cityHighlights.add(status);
    const unitStatus={marching:'行军',fighting:'接战',withdrawing:'撤离',isolated:'受阻',holding:'守住阵地',routed:'阵溃',charge:'冲阵',rout:'阵溃',disordered:'阵形未收拢',withdraw:'沿河撤离'};
    const models=new Map(config.groups.map(group=>[group.id,makeUnit(group)]));
    const situation=config.situation;
    const tactical=new T.Group();
    markerGroup.add(tactical);
    function raisedPoint(geo,lift){
      const [x,z]=project(...geo);
      return new T.Vector3(x,local.elevation(...geo)+lift,z);
    }
    const routesMaterial=new T.MeshBasicMaterial({color:'#3e8190',depthWrite:false});
    const arrowMaterial=new T.MeshBasicMaterial({color:'#a6e4de',depthWrite:false});
    const arrowhead=new T.ConeGeometry(2.0,4.2,3);
    const up=new T.Vector3(0,1,0);
    const dispersal=(situation?.dispersal??[]).map(({points,label:caption})=>{
      const curve=new T.CatmullRomCurve3(points.map(geo=>raisedPoint(geo,1.2)));
      const trail=new T.Mesh(new T.TubeGeometry(curve,26,.55,5,false),routesMaterial);
      tactical.add(trail);
      const arrows=Array.from({length:3},()=>{
        const arrow=new T.Mesh(arrowhead,arrowMaterial);
        tactical.add(arrow);
        return arrow;
      });
      const tag=label(caption,'terrain-dispersal');
      return {trail,curve,arrows,tag,tip:curve.getPointAt(1)};
    });
    const reliefBanner=new T.Group();
    tactical.add(reliefBanner);
    const bannerPole=new T.MeshBasicMaterial({color:'#59462b'});
    const bannerCloth=new T.MeshBasicMaterial({color:'#ffd285'});
    mesh(reliefBanner,box,bannerPole,0,1.65,0,.08,3.3,.08);
    mesh(reliefBanner,box,bannerCloth,.71,2.85,0,1.35,.82,.07);
    const bannerTag=label('赵玖已亮旗','terrain-relief-banner');
    const advancingFlags=[
      {id:'emperor',name:'龙纛',flag:reliefBanner,tag:bannerTag},
      ...[['han','韩','韩字旗'],['yue','岳','岳字旗']].map(([id,glyph,name])=>{
        const flag=new T.Group();
        tactical.add(flag);
        const tag=label(name,'terrain-advance-flag');
        const field=new T.MeshBasicMaterial({color:id==='han'?'#a73f32':'#7d332e'});
        mesh(flag,box,bannerPole,0,1.4,0,.08,2.8,.08);
        mesh(flag,box,field,.52,2.37,0,.98,.76,.08);
        const face=document.createElement('canvas');
        face.width=64;face.height=56;
        const pen=face.getContext('2d');
        pen.fillStyle='#fff0d1';pen.font='bold 44px SimSun, serif';
        pen.textAlign='center';pen.textBaseline='middle';
        pen.fillText(glyph,32,28);
        const texture=new T.CanvasTexture(face);
        const material=new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide});
        mesh(flag,new T.PlaneGeometry(),material,.52,2.37,.051,.86,.72,1);
        return {id,name,flag,tag};
      })
    ];
    const siegeMarks=new T.Group();
    tactical.add(siegeMarks);
    const siegeMaterial=new T.MeshBasicMaterial({color:'#e49361',depthWrite:false});
    const siegeGlow=new T.MeshBasicMaterial({color:'#75453b',depthWrite:false});
    if(situation){
      const center=raisedPoint(fronts.get(situation.siege).geo,.45);
      siegeMarks.position.copy(center);
      const base=new T.RingGeometry(4.55,4.98,48).rotateX(-Math.PI/2);
      siegeMarks.add(new T.Mesh(base,siegeGlow));
      for(let i=0;i<12;i++){
        const sector=new T.RingGeometry(4.45,5.08,6,1,i*Math.PI/6+.055,.40).rotateX(-Math.PI/2);
        const segment=new T.Mesh(sector,siegeMaterial);
        segment.position.y=.15;
        siegeMarks.add(segment);
      }
    }
    // These are schematic routes shown together before the army reaches Yanling.
    const openingRoutes=new T.Group();
    tactical.add(openingRoutes);
    const openingLine=(points,color,radius)=>{
      const curve=new T.CatmullRomCurve3(points.map(geo=>raisedPoint(geo,1.5)));
      const geometry=new T.TubeGeometry(curve,40,radius,6,false);
      const material=new T.MeshBasicMaterial({color,depthTest:false});
      const line=new T.Mesh(geometry,material);line.renderOrder=4;openingRoutes.add(line);
    };
    openingLine([[112.53,32.99],[113.02,33.09],[114.02,33.39],[114.18,34.1]],'#ffe49a',.35);
    const decoyPath=new T.LineCurve3(raisedPoint([112.53,32.99],1.7),raisedPoint([112.48,32.76],1.7));
    const decoyMaterial=new T.MeshBasicMaterial({color:'#f5af92',depthTest:false});
    for(let i=0;i<8;i+=2){
      const a=decoyPath.getPoint(i/8),b=decoyPath.getPoint((i+1)/8);
      const curve=new T.LineCurve3(a,b);
      const line=new T.Mesh(new T.TubeGeometry(curve,2,.38,6,false),decoyMaterial);
      line.renderOrder=4;openingRoutes.add(line);
    }
    const routeArrows=[
      {curve:new T.CatmullRomCurve3([[112.53,32.99],[113.02,33.09],[114.02,33.39],[114.18,34.1]].map(geo=>raisedPoint(geo,1.5))),t:.43,color:'#ffe49a'},
      {curve:decoyPath,t:.90,color:'#f5af92'}
    ];
    for(const item of routeArrows){
      const arrow=new T.Mesh(new T.ConeGeometry(1.0,3.2,3),new T.MeshBasicMaterial({color:item.color,depthTest:false}));
      item.curve.getPointAt(item.t,arrow.position);
      arrow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),item.curve.getTangentAt(item.t));
      arrow.renderOrder=5;openingRoutes.add(arrow);
    }
    const storyMaterial=new T.MeshBasicMaterial({color:'#7d4e24',depthTest:false});
    const storyEdge=new T.MeshBasicMaterial({color:'#ffdf94',depthTest:false});
    const storyRoutes=(config.storyRoutes??[]).map(route=>{
      const curve=new T.CatmullRomCurve3(route.via.map(id=>raisedPoint(fronts.get(id).geo,.8)));
      const drawing=new T.Group();
      for(const [radius,material,order] of [[.42,storyEdge,3],[.24,storyMaterial,4]]){
        const line=new T.Mesh(new T.TubeGeometry(curve,40,radius,6,false),material);
        line.renderOrder=order;
        drawing.add(line);
      }
      const arrow=new T.Mesh(new T.ConeGeometry(1.1,3.1,3),storyMaterial);
      curve.getPointAt(.90,arrow.position);
      arrow.quaternion.setFromUnitVectors(up,curve.getTangentAt(.90));
      arrow.renderOrder=5;
      drawing.add(arrow);
      tactical.add(drawing);
      return {...route,drawing,caption:label(route.label,'terrain-story-route'),position:curve.getPointAt(.45)};
    });
    const planFronts=new Set(storyRoutes.filter(route=>route.after===config.finishAt).flatMap(route=>route.via));
    const routeLabels=[
      {geo:[113.38,33.22],planned:'实线 · 赵玖拟东向绕行',active:'实线 · 赵玖东向绕行',text:label('','terrain-route-label')},
      {geo:[112.48,32.78],planned:'虚线 · 宋军拟向南佯动',active:'虚线 · 宋军向南佯动',text:label('','terrain-route-label')},
      {geo:[112.63,32.84],planned:'拔离速金骑待机截击佯动部队',active:'拔离速金骑截击佯动部队',text:label('','terrain-danger')}
    ];
    const dangerFlags=[
      {geo:[112.71,33.00],text:label('金骑向南侧击 · 位置示意','terrain-danger')},
      {geo:[113.55,33.30],text:label('沿途有零散金骑 · 方位示意','terrain-danger')}
    ];
    const nanyangSiege=siegeMarks.clone();
    nanyangSiege.position.copy(raisedPoint(fronts.get('nanyang').geo,.45));
    tactical.add(nanyangSiege);
    function localGeo(frontId,x,y){
      const front=fronts.get(frontId);
      return [front.geo[0]+(x-front.x)*.012,front.geo[1]-(y-front.y)*.010];
    }
    function groupGeo(group,time){
      if(!group.route)return localGeo(group.front,group.x,group.y);
      const r=group.route, a=localGeo(group.front,r.x,r.y),b=localGeo(r.front,r.toX,r.toY);
      const t=T.MathUtils.clamp((time-r.start)/(r.end-r.start),0,1);
      return [T.MathUtils.lerp(a[0],b[0],t),T.MathUtils.lerp(a[1],b[1],t)];
    }
    const point=new T.Vector3();
    const captions=[];
    const overlays=['map-brief','situation-status','toggle-details'].map(id=>document.getElementById(id));
    function place(element,x,y,z,priority=0){
      point.set(x,y,z).project(camera);
      element.hidden=point.z>1||Math.abs(point.x)>1.04||Math.abs(point.y)>1.04;
      if(!element.hidden)captions.push({element,x:(point.x*.5+.5)*width,y:(.5-point.y*.5)*height,priority});
    }
    function layOutCaptions(){
      // Keep active locations and units anchored. Lift nearby captions before hiding them.
      const placed=[];
      const layer=labels.getBoundingClientRect();
      for(const overlay of overlays){
        if(!overlay?.offsetWidth)continue;
        const box=overlay.getBoundingClientRect();
        placed.push({left:box.left-layer.left,right:box.right-layer.left,top:box.top-layer.top,bottom:box.bottom-layer.top});
      }
      if(openingRoutes.visible){
        const routePoints=[[112.53,32.99],[113.02,33.09],[112.48,32.76]].map(geo=>{
          const p=raisedPoint(geo,1.5).project(camera);
          return {x:(p.x*.5+.5)*width,y:(.5-p.y*.5)*height};
        });
        for(const target of routePoints.slice(1)){
          const start=routePoints[0];
          placed.push({left:Math.min(start.x,target.x)-12,right:Math.max(start.x,target.x)+12,
            top:Math.min(start.y,target.y)-12,bottom:Math.max(start.y,target.y)+12});
        }
      }
      captions.sort((a,b)=>b.priority-a.priority);
      for(const {element,x,y,priority} of captions){
        const w=element.offsetWidth,h=element.offsetHeight;
        let chosen=null;
        for(const horizontal of [0,-110,110,-220,220]){
          const left=Math.min(width-w-4,Math.max(4,x-w/2+horizontal));
          let bottom=y;
          while(placed.some(box=>left<box.right+4&&left+w+4>box.left&&bottom>box.top-3&&bottom-h<box.bottom+3)){
            bottom-=h+4;
          }
          if(bottom>=h+4&&(priority>=2||y-bottom<=2*(h+4))){chosen={left,bottom};break;}
        }
        element.hidden=!chosen;
        if(element._leader)element._leader.hidden=true;
        if(!chosen)continue;
        const {left,bottom}=chosen;
        element.style.left=(left+w/2)+'px';
        element.style.top=bottom+'px';
        if(element._leader&&element._anchor&&openingRoutes.visible&&['emperor','decoy','balisu','wuzhu'].includes(element.dataset.unit)){
          const start=element._anchor;
          const endX=Math.max(left,Math.min(start.x,left+w));
          const endY=Math.max(bottom-h,Math.min(start.y,bottom));
          const dx=endX-start.x,dy=endY-start.y,length=Math.hypot(dx,dy);
          if(length>5){
            const leader=element._leader;
            leader.style.left=start.x+'px';leader.style.top=start.y+'px';
            leader.style.width=length+'px';leader.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
            leader.hidden=false;
          }
        }
        placed.push({left,right:left+w,top:bottom-h,bottom});
      }
      captions.length=0;
    }
    let lastSnapshot,lastView,lastKey='',zoom=1,yaw=0,pitch=.96,drag=null,width=0,height=0;
    let flowStart=0,flowFrame=0,flowActive=false;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    function drawPressure(snapshot,tacticalView){
      const siege=snapshot.fronts.find(front=>front.id===situation?.siege);
      const relieved=siege?.status==='解围';
      const breaking=snapshot.groups.find(group=>group.id==='han')?.route||snapshot.log.at(-1)?.id==='joint';
      const advance=snapshot.log.at(-1)?.id==='joint'||snapshot.log.at(-1)?.id==='standards-advance';
      const onBridge=snapshot.log.some(event=>event.id==='cross-emperor');
      const across=snapshot.log.some(event=>event.id==='west-bank');
      const bannerVisible=onBridge&&!relieved;
      for(const {id,name,flag,tag} of advancingFlags){
        const visible=id==='emperor'?bannerVisible:advance;
        flag.visible=visible;
        tag.hidden=!visible;
        if(!visible)continue;
        const unit=snapshot.groups.find(item=>item.id===id);
        flag.position.copy(raisedPoint(groupGeo(unit,snapshot.time),.15));
        flag.rotation.z=advance?Math.sin(snapshot.time*6)*.045:0;
        tag.textContent=advance?name:across?'龙纛已过桥':'龙纛过桥';
        tag.dataset.position=flag.position.toArray().map(value=>value.toFixed(3)).join(',');
        place(tag,flag.position.x+.5,flag.position.y+3.4,flag.position.z,5);
      }
      const spreading=tacticalView&&snapshot.log.some(event=>event.id==='detour')&&!snapshot.log.some(event=>event.id==='march-yue');
      if(spreading!==flowActive){
        flowActive=spreading;
        flowStart=performance.now();
      }
      const elapsed=performance.now()-flowStart;
      siegeMarks.visible=Boolean(siege&&!relieved);
      if(siegeMarks.visible){
        // Opening faces the east bank once the garrison is on the move.
        siegeMarks.children.forEach((sector,i)=>{
          sector.visible=!breaking||(i>0&&i!==1&&i!==2&&i!==12);
        });
      }
      for(const {trail,curve,arrows,tag,tip} of dispersal){
        trail.visible=spreading;
        tag.hidden=!spreading;
        if(!spreading){
          for(const arrow of arrows)arrow.visible=false;
          continue;
        }
        place(tag,tip.x,tip.y+2,tip.z,2);
        arrows.forEach((arrow,i)=>{
          const moving=reducedMotion.matches?0:Math.min(elapsed,4600)/2200;
          const t=.12+.82*((i/3+moving)%1);
          arrow.visible=true;
          curve.getPointAt(t,arrow.position);
          arrow.quaternion.setFromUnitVectors(up,curve.getTangentAt(t));
        });
      }
      if(spreading&&!reducedMotion.matches&&elapsed<4600&&!flowFrame){
        flowFrame=requestAnimationFrame(()=>{
          flowFrame=0;
          render(lastSnapshot,lastView);
        });
      }
    }
    function render(snapshot,view){
      lastSnapshot=snapshot;lastView=view;
      const key=view.kind+':'+view.id+':'+(view.center??'');
      const overview=view.kind==='all', tacticalView=view.kind==='situation';
      if(key!==lastKey){lastKey=key;zoom=1;yaw=0;pitch=.98;}
      if(canvas.clientWidth!==width||canvas.clientHeight!==height){
        width=canvas.clientWidth;height=canvas.clientHeight;
        if(width&&height)renderer.setSize(width,height,false);
      }
      if(!width||!height)return;
      const group=view.kind==='unit'?snapshot.groups.find(unit=>unit.id===view.id):null;
      const focus=view.center??(overview?[113.37,33.40]:tacticalView?situation.center:group?groupGeo(group,snapshot.time):fronts.get(view.id).geo);
      const [x,z]=project(...focus),base=view.distance??(overview?235:tacticalView?situation.distance:group?16:31);
      const distance=base/zoom,ground=local.elevation(...focus);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      camera.position.set(x+Math.sin(yaw)*Math.cos(pitch)*distance,ground+Math.sin(pitch)*distance,z+Math.cos(yaw)*Math.cos(pitch)*distance);
      camera.lookAt(x,ground,z);camera.updateMatrixWorld();
      drawPressure(snapshot,tacticalView);
      const done=new Set(snapshot.log.map(event=>event.id));
      const reachedCrossings=snapshot.log.some(event=>event.id==='march-yue');
      const dismantled=snapshot.log.some(event=>event.id==='bridge-down');
      const warOver=snapshot.log.some(event=>event.id===(config.finishAt??'relief'));
      const planning=warOver&&planFronts.size>0;
      const reachedYanling=snapshot.log.some(event=>event.id==='meeting');
      const nightMarch=done.has('departure')&&!reachedYanling;
      nanyangSiege.visible=!reachedYanling;
      openingRoutes.visible=overview&&(!done.has('briefing')||nightMarch);
      for(const {after,until,drawing,caption,position} of storyRoutes){
        drawing.visible=done.has(after)&&!done.has(until);
        caption.hidden=!drawing.visible;
        if(drawing.visible)place(caption,position.x,position.y+1.7,position.z,5);
      }
      for(const route of routeLabels){
        route.text.hidden=!openingRoutes.visible;
        route.text.textContent=snapshot.log.some(event=>event.id==='departure')?route.active:route.planned;
        if(openingRoutes.visible){const position=raisedPoint(route.geo,2);place(route.text,position.x,position.y,position.z,5);}
      }
      for(const danger of dangerFlags){
        danger.text.hidden=!nightMarch;
        if(nightMarch){const position=raisedPoint(danger.geo,1);place(danger.text,position.x,position.y,position.z,3);}
      }
      pontoonGroup.visible=reachedCrossings&&!dismantled;
      crossingTag.hidden=true;

      riverLabel.hidden=westLabel.hidden=warOver;
      if(!warOver){
        place(riverLabel,riverX,local.elevation(...riverGeo)+.2,riverZ);
        if(westLabelPoint)place(westLabel,westLabelPoint.x,westLabelPoint.y,westLabelPoint.z);
      }
      if(crossingPoint&&dismantled&&!warOver)place(crossingTag,crossingPoint.x,crossingPoint.y,crossingPoint.z,3);
      for(const front of snapshot.fronts){
        const {model,city}=locations.get(front.id);
        if(front.reveal&&!done.has(front.reveal)){model.visible=false;city.hidden=true;continue;}
        model.visible=true;
        if(front.hiddenView||(planning&&!planFronts.has(front.id))){city.hidden=true;continue;}
        const highlighted=cityHighlights.has(front.status);
        city.classList.toggle('highlighted',highlighted);
        const nanyangUnderSiege=front.id==='nanyang'&&nanyangSiege.visible;
        city.classList.toggle('besieged',nanyangUnderSiege||(front.id===situation?.siege&&siegeMarks.visible));
        const caption=front.status==='援军到场，金军援部受阻'?'援军到场':warOver&&front.id==='changshe'?'岳飞留镇五河':front.status;
        const title=front.name+(nanyangUnderSiege?(front.status==='杜岩密报抵达'?' · 杜岩抵达':' · 金军围城'):highlighted||front.id==='changshe'?' · '+caption:'');
        if(city.textContent!==title)city.textContent=title;
        model.scale.setScalar(overview?1.65:1);
        const lift=nanyangUnderSiege?5:1.6;
        place(city,model.position.x,model.position.y+lift,model.position.z,view.id===front.id?4:highlighted||nanyangUnderSiege||front.id==='changshe'?2:1);
      }
      for(const entry of snapshot.groups){
        const {model,text,caption:captionNode,scale,fill,route,arrow,shaft,runners,standard}=models.get(entry.id);
        const motion=entry.route?.motion;
        const present=(!entry.reveal||snapshot.log.some(event=>event.id===entry.reveal))&&(!entry.displayUntil||!snapshot.log.some(event=>event.id===entry.displayUntil));
        model.visible=present;
        text.hidden=!present||motion==='standard'||planning;
        text._leader.hidden=true;
        arrow.visible=false;
        route.visible=false;
        if(!present)continue;
        const geo=groupGeo(entry,snapshot.time),[xx,zz]=project(...geo),elevation=local.elevation(...geo);
        const fighting=entry.status==='fighting';
        const scattering=motion==='rout'?Math.min(1,(snapshot.time-entry.route.start)*.48):
          motion==='disordered'?Math.max(0,1-(snapshot.time-entry.route.start)/(entry.route.end-entry.route.start)):Number(entry.status==='routed');
        const bounce=fighting||motion==='charge'?Math.sin(snapshot.time*12)*.12:0;
        runners.forEach((soldier,index)=>{
          const fan=(index%5)-2;
          soldier.position.set(fan*.40*scattering,0,((index*7)%11-5)*.17*scattering);
          soldier.rotation.y=fan*.18*scattering;
        });
        standard.rotation.z=entry.id==='xu'?scattering*1.25:0;
        model.position.set(xx,elevation+.13+Math.abs(bounce),zz+bounce);
        point.copy(model.position).project(camera);
        text._anchor={x:(point.x*.5+.5)*width,y:(.5-point.y*.5)*height};
        model.rotation.x=bounce*.55;
        model.scale.setScalar(overview?2.5:1);
        if(entry.route){
          const r=entry.route,dest=localGeo(r.front,r.toX,r.toY),[dx,dz]=project(...dest);
          heading.set(dx-xx,0,dz-zz);
          const distance=heading.length();
          if(distance>.2&&motion!=='rout'&&motion!=='standard'){
            arrow.visible=true;
            arrow.position.set(xx,elevation+(overview?2.5:1),zz);
            arrow.setDirection(heading.normalize());
            const length=Math.min(distance,overview?17:5);
            const tip=Math.min(length*.5,overview?5:1.6), body=length-tip;
            arrow.setLength(length,tip,Math.min(length*.6,overview?4:1.3));
            shaft.position.y=body/2;
            shaft.scale.set(overview?.43:.14,body,overview?.43:.14);
          }
          model.rotation.y=Math.atan2(dx-xx,dz-zz);
          route.geometry.attributes.position.setXYZ(0,xx,elevation+.4,zz);
          route.geometry.attributes.position.setXYZ(1,dx,local.elevation(...dest)+.4,dz);
          route.geometry.attributes.position.needsUpdate=true;route.computeLineDistances();
        }
        route.visible=Boolean(entry.route)&&motion!=='rout'&&motion!=='standard';
        text.classList.toggle('engaged',fighting);
        text.classList.toggle('marching',Boolean(entry.route));
        const nightDetour=entry.id==='emperor'&&entry.route&&!reachedYanling;
        const status=nightDetour?'夜间绕行':unitStatus[motion??entry.status];
        const strength=config.strengthFor?.(entry,snapshot.log);
        const caption='⚑ '+entry.name+(strength?' · '+strength:'')+(status?' · '+status:'');
        if(captionNode.textContent!==caption)captionNode.textContent=caption;
        const strengthValue=config.strengthScale?.(entry,snapshot.log);
        scale.classList.toggle('unknown',strengthValue==null);
        scale.setAttribute('aria-label',strengthValue==null?'兵力未拆分或待核':`兵力示意：${strengthValue}人，上限8万人`);
        fill.style.width=strengthValue==null?'0%':(100*Math.min(strengthValue,80000)/80000)+'%';
        text.dataset.position=geo.map(v=>v.toFixed(4)).join(',');
        const labelLift=entry.route?(overview?10:3):(overview?3.2:1.3);
        if(!text.hidden)place(text,xx,elevation+labelLift,zz,entry.route?4:entry.id==='jin'?6:entry.id==='balisu'?5:entry.id==='wuzhu'||entry.id==='yanling-total'||entry.id==='han'?3:fighting||scattering?2:1);
      }
      layOutCaptions();
      renderer.render(scene,camera);
    }
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.0014),.68,3.2);
      if(lastSnapshot)render(lastSnapshot,lastView);
    },{passive:false});
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{
      if(!drag)return;
      yaw-=(e.clientX-drag.x)*.005;
      pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.005,.32,1.5);
      drag={x:e.clientX,y:e.clientY};
      if(lastSnapshot)render(lastSnapshot,lastView);
    });
    canvas.addEventListener('lostpointercapture',()=>{drag=null;});
    new ResizeObserver(()=>{if(lastSnapshot)render(lastSnapshot,lastView);}).observe(canvas);
    return {render};
  };
})();
