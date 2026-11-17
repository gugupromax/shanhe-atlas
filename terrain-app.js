/* Local-only terrain viewer. All elevations come from data/*.js, not procedural noise. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const embedded=new URLSearchParams(location.search).get('embedded')==='1';
  let fusion=null,fusionState=null,fusionActive=!embedded,fusionLocations=[],fusionLayers={},fusionOverlays={},fusionPaintedKey=null,fusionViewKey='',fusionHeightTimer=null,fusionViewTimer=null,fusionStarted=false;
  let atlasSurface=null,surfaceSceneKey='',surfaceBaseId=-1,surfaceDetailId=-1,surfaceLoads=0,pendingSurfaceDetail=null;
  const passes = [
    ['zhiguan','轵关陉',112.38,35.16,'济源—垣曲一带','看王屋山南侧与黄河以北的山间通道。'],
    ['taihang','太行陉',112.83,35.29,'沁阳—晋城一带','从山前平原向北看，观察进入高地时的陡升。'],
    ['baixing','白陉',113.49,35.67,'辉县—陵川一带','比较南太行山前的陡壁与山内谷地。'],
    ['fukou','滏口陉',114.10,36.40,'峰峰—磁县一带','从邯郸以西的山口向太行内部观察。'],
    ['jingxing','井陉',114.02,38.03,'井陉—鹿泉一带','观察石家庄以西从平原进入山地的通道环境。'],
    ['feihu','飞狐陉',114.67,39.57,'涞源—蔚县一带','观察南北向谷地与两侧山体的夹峙。'],
    ['puyin','蒲阴陉',115.17,39.43,'易县—紫荆关一带','从易县向西北看，比较谷地与相邻山脊。'],
    ['jundu','军都陉',116.07,40.29,'昌平—居庸关一带','观察平原与山间盆地之间的山口。'],
  ];
  const cities = [
    ['太原',112.55,37.87],['石家庄',114.51,38.04],['长治',113.11,36.19],
    ['邯郸',114.49,36.62],['晋城',112.85,35.49],['新乡',113.93,35.30],
    ['保定',115.48,38.87],['北京',116.40,39.90],['蔚县',114.59,39.84],['济源',112.60,35.07],
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routeData=window.TAIHANG_ROUTES;
  const routeGeometry=window.TaihangRouteGeometry;
  const svgNS='http://www.w3.org/2000/svg';
  let selectedRoute=null,routeWorld=[];
  let renderer, scene, camera, terrain, geometry, base, markerGroup, profileLine;
  let dataset, heights, widthKm, depthKm, seaMask, exaggeration = 60;
  const viewportGeometry=window.JiangshanViewport;
  let mapFrame,viewportGuard;
  let labels = [], selected = 'national', loadingToken = 0, dirty = true;
  const historyData=window.JIANGSHAN_HISTORY,timeCore=window.JiangshanTime;
  let historyYear=741,historyToken=0,currentSnapshot=null,selectedEvent=null,timeTimer=null,timeDebounce=null;
  const snapshotPromises=new Map();
  const landLabels=[['青藏高原',88,33],['塔里木盆地',83,40],['准噶尔盆地',86,46],['内蒙古高原',110,43],['东北平原',125,46],['华北平原',116,36],['黄土高原',108,37],['四川盆地',105,30],['云贵高原',103,25],['长江中下游平原',116,30],['喜马拉雅山脉',87,28],['台湾',121,23.7],['海南',109.7,19.2],['南海',115,12]];
  let measuring = false, measureStart = null, profileSamples = null, profileEndpoints = null;
  let theta = .85, phi = .68, distance = 1100;
  let target = {x:0,z:0}, desired = {theta,phi,distance,x:0,z:0};
  const ray = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
  const ndc = typeof THREE !== 'undefined' ? new THREE.Vector2() : null;

  function fail(message) {
    $('load-state').hidden = true;
    $('fatal-message').textContent = message;
    $('fatal').hidden = false;
  }
  $('retry').onclick = () => location.reload();
  $('sources-open').onclick = () => $('sources').showModal();
  $('sources-close').onclick = () => $('sources').close();
  $('sources').addEventListener('click', e => { if(e.target === $('sources')) { const r=e.target.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close(); } });
  passes.forEach((p,i) => {
    const b=document.createElement('button'); b.className='pass-button'; b.id='pass-'+p[0];
    b.setAttribute('aria-pressed','false');
    const r=routeData?.routes.find(r=>r.key===p[0]);
    b.innerHTML=`<span class="ordinal">${String(i+1).padStart(2,'0')}</span><span class="pass-name">${p[1]}<small>${r?r.nodes[0][0]+' → '+r.nodes.at(-1)[0]:p[4]}</small></span><span class="arrow" aria-hidden="true">›</span>`;
    b.onclick=()=>show(p[0]); $('pass-list').append(b);
  });
  $('overview').onclick=()=>show('overview');
  $('national').onclick=()=>show('national');
  $('sidebar-toggle').onclick=()=>setSidebarOpen($('sidebar').hidden);
  $('sidebar').append($('reading-note'),document.querySelector('.route-panel'),document.querySelector('.below-map'));

  function decode(d) {
    const raw=atob(d.data), bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const view=new DataView(bytes.buffer), out=new Float32Array(d.width*d.height);
    if(bytes.length!==out.length*2)throw new Error('本地高程文件长度不正确，请重新解压完整文件夹。');
    for(let i=0;i<out.length;i++)out[i]=view.getInt16(i*2,true);
    return out;
  }
  function elevation(lon,lat) {
    const [w,s,e,n]=dataset.bounds;
    const x=Math.max(0,Math.min(dataset.width-1,(lon-w)/(e-w)*(dataset.width-1)));
    const z=Math.max(0,Math.min(dataset.height-1,(n-lat)/(n-s)*(dataset.height-1)));
    const a=Math.min(dataset.width-2,Math.floor(x)), b=Math.min(dataset.height-2,Math.floor(z));
    const dx=x-a,dz=z-b, i=b*dataset.width+a;
    return heights[i]*(1-dx)*(1-dz)+heights[i+1]*dx*(1-dz)+heights[i+dataset.width]*(1-dx)*dz+heights[i+dataset.width+1]*dx*dz;
  }
  function xyz(lon,lat,offset=0) {
    const p=mapFrame.toWorld(lon,lat);
    return new THREE.Vector3(p.x,(isSeaAt(lon,lat)?0:elevation(lon,lat))/1000*exaggeration*mapFrame.heightScale(lat)+offset,p.z);
  }
  function isSeaAt(lon,lat){if(!seaMask)return false;const [w,s,e,n]=dataset.bounds;const col=Math.max(0,Math.min(dataset.width-1,Math.round((lon-w)/(e-w)*(dataset.width-1)))),row=Math.max(0,Math.min(dataset.height-1,Math.round((n-lat)/(n-s)*(dataset.height-1))));return !!seaMask[row*dataset.width+col];}
  function findSea(){
    if(selected!=='national')return null;const w=dataset.width,h=dataset.height,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
    const add=i=>{if(!mask[i]&&heights[i]<=0){mask[i]=1;queue[end++]=i;}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let r=0;r<h;r++){add(r*w);add(r*w+w-1);}
    while(start<end){const i=queue[start++],x=i%w;if(x>0)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w);}
    return mask;
  }
  function lonlat(v) {
    return mapFrame.toGeo(v.x,v.z);
  }
  if(typeof THREE==='undefined'){
    fail('缺少 vendor/three.min.js，请解压整个文件夹，不要只移动 index.html。');return;
  }
  const palette = [[0,'#879b70'],[500,'#a6ad7f'],[1000,'#b7b389'],[1500,'#c4b69a'],[2200,'#d4c7af'],[3000,'#ece3cc']].map(([h,c])=>[h,new THREE.Color(c)]);
  const nationalPalette=[[0,'#7eaa79'],[500,'#adb983'],[1500,'#c6ba8d'],[3000,'#b7a48a'],[4500,'#c7bca7'],[6000,'#e1dbcd'],[8000,'#fffaf0']].map(([h,c])=>[h,new THREE.Color(c)]);
  function terrainColor(h) {
    const colors=selected==='national'?nationalPalette:palette;
    let i=1;while(i<colors.length-1&&h>colors[i][0])i++;
    const [lo,a]=colors[i-1],[hi,b]=colors[i];
    return a.clone().lerp(b,Math.max(0,Math.min(1,(h-lo)/(hi-lo))));
  }
  function dispose(obj) {
    if(!obj)return;scene.remove(obj);
    obj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];a.forEach(m=>{m.map?.dispose();m.dispose();});}});
  }
  function build(d) {
    atlasSurface?.dispose();atlasSurface=null;
    dispose(terrain);dispose(base);dispose(markerGroup);clearProfile();
    if(embedded)fusionPaintedKey=null;
    dataset=d;heights=decode(d);seaMask=findSea();
    const [w,s,e,n]=d.bounds;
    mapFrame=viewportGeometry.createFrame(d.bounds,selected==='national');widthKm=mapFrame.width;depthKm=mapFrame.depth;
    const xs=Array.from({length:d.width},(_,col)=>mapFrame.toWorld(w+(e-w)*col/(d.width-1),n).x);
    const rowInfo=Array.from({length:d.height},(_,row)=>{const lat=n-(n-s)*row/(d.height-1);return {z:mapFrame.toWorld(w,lat).z,scale:mapFrame.heightScale(lat)};});
    const count=d.width*d.height, positions=new Float32Array(count*3), colors=new Float32Array(count*3),uv=new Float32Array(count*2),seaColor=new THREE.Color('#8eb5bd');
    for(let row=0;row<d.height;row++)for(let col=0;col<d.width;col++) {
      const i=row*d.width+col;
      positions[i*3]=xs[col];
      positions[i*3+1]=(seaMask?.[i]?0:heights[i])/1000*exaggeration*rowInfo[row].scale;
      positions[i*3+2]=rowInfo[row].z;
      const c=seaMask?.[i]?seaColor:terrainColor(heights[i]);colors.set([c.r,c.g,c.b],i*3);uv.set([col/(d.width-1),embedded?.5-rowInfo[row].z/depthKm:1-row/(d.height-1)],i*2);
    }
    const index=new Uint32Array((d.width-1)*(d.height-1)*6);let k=0;
    for(let r=0;r<d.height-1;r++)for(let c=0;c<d.width-1;c++){
      const a=r*d.width+c,b=a+1,f=a+d.width,g=f+1;
      index.set([a,f,b,b,f,g],k);k+=6;
    }
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.computeVertexNormals();
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.computeBoundingBox();
    if(embedded)atlasSurface=window.JiangshanSurfaceMaterial.create(THREE);
    terrain=new THREE.Mesh(geometry,embedded?atlasSurface.material:new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));scene.add(terrain);
    if(embedded)terrain.visible=false;
    buildBase();rebuildMarkers();resetCamera();
    const step=d.gridStepMetresApprox;
    $('data-summary').textContent=`本地真实高程 · 网格约 ${step[0]>=1000?(step[0]/1000).toFixed(1)+' × '+(step[1]/1000).toFixed(1)+' 千米':step[0]+' × '+step[1]+' 米'} · ${d.width} × ${d.height} 点`;
    $('coordinate').textContent='单击山体，查看经纬度与海拔';dirty=true;
  }
  function buildBase() {
    dispose(base);base=null;
  }
  function addLabel(name,lon,lat,type='pass',key=null) {
    const [w,s,e,n]=dataset.bounds;if(lon<w||lon>e||lat<s||lat>n)return;
    const el=document.createElement(key?'button':'span');el.className='map-label '+type;el.textContent=name;
    if(key){el.onclick=()=>show(key);el.setAttribute('aria-label','进入'+name+'局部地形');}
    $('labels').append(el);
    labels.push({el,lon,lat,type,key});
    if(type==='pass'||type==='event') {
      const radius=Math.max(widthKm,depthKm)*(selected==='overview'?.0021:.0033);
      const pin=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color:'#963f2c'}));
      pin.position.copy(xyz(lon,lat,radius));markerGroup.add(pin);
    }
  }
  function rebuildMarkers() {
    dispose(markerGroup);markerGroup=new THREE.Group();scene.add(markerGroup);labels=[];$('labels').replaceChildren();
    const overview=selected==='overview';
    if(selected==='national'){
      if(embedded){rebuildFusionPlaces();rebuildRoutes();return;}
      if(selectedEvent)addLabel(selectedEvent.site||'事件地点',selectedEvent.coord[0],selectedEvent.coord[1],'event');
      landLabels.forEach(p=>addLabel(p[0],p[1],p[2],'region'));
      rebuildRoutes();return;
    }
    passes.forEach(p=>{if(overview&&!selectedRoute)addLabel(p[1],p[2],p[3],'pass',p[0]);});
    const r=routeData?.routes.find(r=>r.key===selectedRoute);
    if(r)r.nodes.forEach((node,i)=>addLabel(`${i+1} ${node[0]}`,node[1],node[2],'waypoint'));
    const names=new Set(r?.nodes.map(n=>n[0])||[]);
    cities.forEach(c=>{if(!names.has(c[0]))addLabel(c[0],c[1],c[2],'city');});
    if(overview&&!selectedRoute){addLabel('晋东高地',112.45,37.3,'region');addLabel('华北平原',115.35,36.9,'region');}
    rebuildRoutes();
  }
  function svgElement(name,attributes){const el=document.createElementNS(svgNS,name);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));return el;}
  function rebuildRoutes(){
    routeWorld=[];$('route-overlay').replaceChildren();
    if(selected==='national'||!routeData||!routeGeometry)return;
    const routes=selectedRoute?routeData.routes.filter(r=>r.key===selectedRoute):routeData.routes;
    for(const r of routes){
      const color=r.status==='disputed'?'#a45b14':selectedRoute?'#923b28':'#315b4b';
      for(const [a,b] of routeGeometry.clippedSegments(r.nodes,dataset.bounds)){
        const density=Math.max(.002,(dataset.bounds[2]-dataset.bounds[0])/(dataset.width-1)*.5);
        const count=Math.min(500,Math.max(8,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/density)));
        const points=Array.from({length:count+1},(_,i)=>xyz(a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count,Math.max(widthKm,depthKm)*.0009));
        const halo=svgElement('path',{fill:'none',stroke:'#fffdf2','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.9});
        const line=svgElement('path',{fill:'none',stroke:color,'stroke-width':selectedRoute?3.5:2.7,'stroke-dasharray':'7 5','stroke-linecap':'round','stroke-linejoin':'round'});
        const group=svgElement('g',{});group.append(halo,line);$('route-overlay').append(group);routeWorld.push({points,halo,line});
      }
      if(selectedRoute){
        const [w,s,e,n]=dataset.bounds;
        for(const [,lon,lat] of r.nodes){
          if(lon<w||lon>e||lat<s||lat>n)continue;
          const dot=svgElement('circle',{r:4,fill:color,stroke:'#fffdf2','stroke-width':2});
          $('route-overlay').append(dot);routeWorld.push({dot,point:xyz(lon,lat,Math.max(widthKm,depthKm)*.0009)});
        }
      }
    }
    for(const label of labels){
      if(label.type!=='waypoint')continue;
      label.leader=svgElement('line',{stroke:'#6b5545','stroke-width':1,opacity:.75});$('route-overlay').append(label.leader);
    }
    dirty=true;
  }
  function updateRoutePanel(){
    const r=routeData?.routes.find(r=>r.key===selectedRoute);
    $('route-full').hidden=!r||selected==='overview';$('route-local').hidden=!r||selected!=='overview';
    $('route-nodes').replaceChildren();$('route-sources').replaceChildren();
    $('route-title').textContent=r?`${r.name} · ${r.status==='disputed'?'有争议的对应说法':'通道走向示意'}`:'八陉通道走向';
    $('route-note').textContent=r?r.note+' 所有节点坐标为人工概略定位，节点间虚线不是实测古道路基。':'虚线只连接资料所述主要地区，不能据此确定古道路基、盘山曲线或真实通行距离。蒲阴陉的对应存在争议，使用橙色虚线。';
    if(!r){$('route-scope').textContent='已标出八条通道的概略走向，点击陉名查看沿线节点。';return;}
    const [w,s,e,n]=dataset.bounds;
    const outside=r.nodes.filter(([,lon,lat])=>lon<w||lon>e||lat<s||lat>n).length;
    $('route-scope').textContent=`${r.period}。${outside?`当前局部有 ${outside} 个节点在范围外，线路在边框处截断；点“看整条通道”查看两端。`:'当前视图已覆盖全部示意节点。'}`;
    r.nodes.forEach((node,i)=>{const li=document.createElement('li');const out=node[1]<w||node[1]>e||node[2]<s||node[2]>n;li.textContent=`${i+1} ${node[0]}${out?'（范围外）':''}`;if(out)li.className='outside';$('route-nodes').append(li);});
    const label=document.createElement('span');label.textContent='依据：';$('route-sources').append(label);
    r.sourceIds.forEach(id=>{const source=routeData.sources[id],a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.title;$('route-sources').append(a);});
  }
  function focusRoute(view='oblique'){
    const route=routeData?.routes.find(r=>r.key===selectedRoute);if(!route)return;
    const pts=route.nodes.map(n=>xyz(n[1],n[2]));
    const minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x));
    const minz=Math.min(...pts.map(p=>p.z)),maxz=Math.max(...pts.map(p=>p.z));
    desired.x=(minx+maxx)/2;desired.z=(minz+maxz)/2;
    const aspect=$('stage').clientWidth/$('stage').clientHeight;
    desired.theta=view==='east'?Math.PI/2:0;desired.phi=view==='top'?.012:.45;
    desired.distance=35;
    const fitCamera=new THREE.PerspectiveCamera(40,aspect,.01,Math.max(widthKm,depthKm)*30);
    for(let i=0;i<60;i++){
      const d=desired.distance;fitCamera.position.set(desired.x+d*Math.sin(desired.phi)*Math.sin(desired.theta),d*Math.cos(desired.phi),desired.z+d*Math.sin(desired.phi)*Math.cos(desired.theta));
      fitCamera.lookAt(desired.x,5,desired.z);fitCamera.updateMatrixWorld();
      if(pts.every(p=>{const q=p.clone().project(fitCamera);return Math.abs(q.x)<.78&&Math.abs(q.y)<.64&&q.z>-1&&q.z<1;}))break;
      desired.distance*=1.1;
    }
    dirty=true;
  }
  function resetCamera(view='map') {
    const span=Math.max(widthKm,depthKm),aspect=$('stage').clientWidth/$('stage').clientHeight;
    desired={theta:view==='east'?Math.PI/2:0,phi:view==='top'?.012:view==='relief'||view==='east'?.8:.08,distance:span,x:0,z:0};
    // Match upstream's 66E..142E / 14N..55N view; fill the canvas rather than fit a slab.
    const fitCamera=new THREE.PerspectiveCamera(40,aspect,.01,span*30);
    const corners=[];
    const bounds=selected==='national'?(view==='wide'?[66,3,142,55]:[66,14,142,55]):dataset.bounds;
    const nw=mapFrame.toWorld(bounds[0],bounds[3]),se=mapFrame.toWorld(bounds[2],bounds[1]),xs=[nw.x,se.x],zs=[nw.z,se.z];
    desired.x=(xs[0]+xs[1])/2;desired.z=(zs[0]+zs[1])/2;
    if(selected==='national')desired.distance=span*.5;
    for(const x of xs)for(const z of zs)for(const y of [-7,dataset.max/1000*exaggeration])corners.push(new THREE.Vector3(x,y,z));
    const fitLookY=groundY(desired.x,desired.z);
    for(let i=0;i<45;i++){
      const d=desired.distance;
      fitCamera.position.set(desired.x+d*Math.sin(desired.phi)*Math.sin(desired.theta),fitLookY+d*Math.cos(desired.phi),desired.z+d*Math.sin(desired.phi)*Math.cos(desired.theta));
      fitCamera.lookAt(desired.x,fitLookY,desired.z);fitCamera.updateMatrixWorld();
      if(corners.every(p=>{const q=p.clone().project(fitCamera);return Math.abs(q.x)<.86&&Math.abs(q.y)<.86&&q.z<1&&q.z>-1;}))break;
      desired.distance*=1.08;
    }
    if(selected==='overview'&&selectedRoute)focusRoute(view);
    constrainDesired();
    distance=desired.distance;theta=desired.theta;phi=desired.phi;target={x:desired.x,z:desired.z};
    camera.near=Math.max(.01,span/20000);camera.far=span*20;camera.updateProjectionMatrix();
    $('top').classList.toggle('selected',view==='top');$('oblique').classList.toggle('selected',view==='relief');$('map-view').classList.toggle('selected',view==='map'||view==='wide');
    $('top').setAttribute('aria-pressed',String(view==='top'));$('oblique').setAttribute('aria-pressed',String(view==='relief'));$('map-view').setAttribute('aria-pressed',String(view==='map'||view==='wide'));dirty=true;
  }
  function loadGrid(key) {
    if(window.TAIHANG_GRIDS?.[key])return Promise.resolve(window.TAIHANG_GRIDS[key]);
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='data/'+key+'.js';
      s.onload=()=>{s.remove();window.TAIHANG_GRIDS?.[key]?resolve(window.TAIHANG_GRIDS[key]):reject(new Error('高程文件内容不完整。'));};
      s.onerror=()=>{s.remove();reject(new Error('找不到 data/'+key+'.js，请保持整个文件夹完整后重新打开。'));};document.head.append(s);
    });
  }
  async function show(key,routeKey=null) {
    if(!renderer)return;const token=++loadingToken;
    $('load-state').textContent='正在读取本地'+(key==='national'?'全国地形':passes.find(p=>p[0]===key)?.[1]||'太行全貌')+'高程…';$('load-state').hidden=false;
    try {
      const d=await loadGrid(key==='national'?'context':key);if(token!==loadingToken)return;
      selected=key;selectedRoute=routeKey||(['national','overview'].includes(key)?null:key);exaggeration=key==='national'?(embedded?20:60):key==='overview'?10:3;
      $('exaggeration').max=key==='national'?120:16;
      document.body.classList.toggle('national-mode',key==='national');
      $('national').classList.toggle('active',key==='national');$('national').setAttribute('aria-pressed',String(key==='national'));
      $('time-panel').hidden=key!=='national';$('history-sidebar').hidden=key!=='national';$('history-notice').hidden=key!=='national';document.querySelector('.polity-toggle').hidden=key!=='national';
      $('national-wide').hidden=key!=='national';$('east').textContent=key==='national'?'从东侧看':'从东麓看';
      $('route-legend').hidden=key==='national'||!$('route-toggle').checked;document.querySelector('.route-panel').hidden=key==='national';
      if(key!=='national'){stopTime();historyToken++;$('taihang-details').open=true;}
      $('legend-ticks').innerHTML=key==='national'?'<span>0</span><span>2,000</span><span>4,000</span><span>8,000</span>':'<span>0</span><span>1,000</span><span>2,000</span><span>3,000</span>';
      $('exaggeration').value=exaggeration;$('height-value').textContent=exaggeration+'×';
      $('overview').classList.toggle('active',key==='overview'&&!selectedRoute);$('overview').setAttribute('aria-pressed',String(key==='overview'&&!selectedRoute));
      passes.forEach(p=>{$('pass-'+p[0]).classList.toggle('active',p[0]===selectedRoute);$('pass-'+p[0]).setAttribute('aria-pressed',String(p[0]===selectedRoute));});
      const p=passes.find(p=>p[0]===key);
      $('view-title').textContent=key==='national'?'全国地形总览':routeKey?passes.find(p=>p[0]===routeKey)[1]+' · 通道全景':p?p[1]+' · 局部地形':'太行全貌';
      $('view-description').textContent=key==='national'?'中国及周边地形参照 · 疆域按历史阶段切换':routeKey?'查看两端与沿线节点 · 走向示意，非实测古道':p?p[4]+' · 标记为概略位置':'东西高差、山脉走向与八陉分布';
      $('reading-note').innerHTML=p?`<strong>观察提示</strong><p>${p[5]} 这是现代地形，未复原古河道或古道；可画一条剖面对照沿途高差。</p>`:'<strong>先看整体，再看险要</strong><p>全貌使用较大的高度放大倍数，帮助辨认山势。进入局部后可切换至 1× 真实比例，对照山谷、坡面与山前平原。</p>';
      build(d);updateRoutePanel();$('load-state').hidden=true;
      if(key==='national'){
        if(embedded){$('load-state').hidden=false;$('load-state').textContent='正在同步原版地图…';fusion?.ready();if(fusionState)applyFusionState(fusionState);}
        else setHistoryYear(historyYear);
      }
      document.querySelector('.workspace').scrollTop=0;
    }catch(e){if(token===loadingToken)fail(e.message);}
  }
  function updateHeight() {
    if(!geometry)return;exaggeration=Number($('exaggeration').value);$('height-value').textContent=exaggeration+'×';
    const a=geometry.attributes.position;for(let i=0;i<a.count;i++){const row=Math.floor(i/dataset.width),lat=dataset.bounds[3]-(dataset.bounds[3]-dataset.bounds[1])*row/(dataset.height-1);a.setY(i,(seaMask?.[i]?0:heights[i])/1000*exaggeration*mapFrame.heightScale(lat));}
    a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();buildBase();rebuildMarkers();
    if(profileEndpoints)drawProfileLine();dirty=true;
  }
  function clearProfile() {
    dispose(profileLine);profileLine=null;profileSamples=null;profileEndpoints=null;measureStart=null;measuring=false;
    $('profile-panel').hidden=true;$('measure-hint').hidden=true;$('profile-toggle').classList.remove('selected');$('profile-toggle').setAttribute('aria-pressed','false');
  }
  function drawProfileLine() {
    dispose(profileLine);const pts=profileSamples.map(s=>xyz(s.lon,s.lat,Math.max(widthKm,depthKm)*.001));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#a33320',depthTest:false}));line.renderOrder=20;
    profileLine=new THREE.Group();profileLine.add(line);scene.add(profileLine);dirty=true;
  }
  function makeProfile(a,b) {
    const lat=(a[1]+b[1])/2*Math.PI/180;
    const length=Math.hypot((b[0]-a[0])*111.32*Math.cos(lat),(b[1]-a[1])*111.32);
    if(length<.05){$('measure-hint').textContent='两点太近，请选择更远的终点';return;}
    profileEndpoints=[a,b];profileSamples=Array.from({length:161},(_,i)=>{
      const t=i/160,lon=a[0]+(b[0]-a[0])*t,lat=a[1]+(b[1]-a[1])*t;
      return {lon,lat,h:elevation(lon,lat)};
    });
    const min=Math.min(...profileSamples.map(s=>s.h)),max=Math.max(...profileSamples.map(s=>s.h));
    const low=Math.floor(Math.min(0,min)/100)*100,high=Math.ceil(Math.max(max+100,200)/100)*100;
    const y=h=>135-(h-low)/(high-low)*110;
    const path=profileSamples.map((s,i)=>`${i?'L':'M'}${50+i/160*760},${y(s.h).toFixed(2)}`).join(' ');
    let grid='';for(let i=0;i<=3;i++){const h=low+(high-low)*i/3,yy=y(h);grid+=`<path d="M50 ${yy}H810" stroke="#d4d8c9"/><text x="42" y="${yy+4}" text-anchor="end" fill="#59675b" font-size="11">${Math.round(h)}</text>`;}
    $('profile-chart').innerHTML=`${grid}<path d="${path} L810 135 H50Z" fill="#cdd5b9"/><path d="${path}" stroke="#963f2c" stroke-width="2" fill="none"/><g fill="#59675b" font-size="11"><text x="50" y="157">起点 · 0 km</text><text x="810" y="157" text-anchor="end">终点 · ${length.toFixed(1)} km</text><text x="4" y="15">米</text></g>`;
    $('profile-stats').textContent=`约 ${length.toFixed(1)} 千米 · 沿线最低 ${Math.round(min)} m / 最高 ${Math.round(max)} m`;
    $('profile-panel').hidden=false;measuring=false;measureStart=null;$('measure-hint').hidden=true;
    $('profile-toggle').classList.remove('selected');$('profile-toggle').setAttribute('aria-pressed','false');drawProfileLine();
  }
  function hitAt(e) {
    const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    ray.setFromCamera(ndc,camera);return ray.intersectObject(terrain,false)[0];
  }
  function handleClick(e) {
    if(!terrain)return;const hit=hitAt(e);if(!hit)return;
    const pos=lonlat(hit.point),h=elevation(...pos);
    $('coordinate').textContent=`${pos[0].toFixed(4)}° E · ${pos[1].toFixed(4)}° N · 海拔约 ${Math.round(h)} 米`;
    if(measuring){if(!measureStart){measureStart=pos;$('measure-hint').textContent='起点已选，请选取剖面终点';}else makeProfile(measureStart,pos);}
  }
  let mobileLayout=null;
  function setSidebarOpen(open){$('sidebar').hidden=!open;document.body.classList.toggle('sidebar-hidden',!open);$('sidebar-toggle').setAttribute('aria-expanded',String(open));$('sidebar-toggle').textContent=open?'收起侧栏':'展开资料';}
  function groundY(x,z){if(!mapFrame)return 0;const [lon,lat]=mapFrame.toGeo(x,z);return (isSeaAt(lon,lat)?0:elevation(lon,lat))/1000*exaggeration*mapFrame.heightScale(lat);}
  function constrainState(state){if(!mapFrame||!viewportGuard)return state;let out={...state};for(let i=0;i<2;i++)out=viewportGuard.constrain(out,mapFrame,camera.aspect,camera.fov,geometry.boundingBox.min.y-.01,groundY(out.x,out.z));return out;}
  function constrainDesired(){desired=constrainState(desired);}
  function resize(){const s=$('stage');renderer.setSize(s.clientWidth,s.clientHeight);camera.aspect=s.clientWidth/s.clientHeight;camera.updateProjectionMatrix();const mobile=innerWidth<700;if(mobile!==mobileLayout){$('events-details').open=!mobile;document.querySelector('.polity-details').open=!mobile;$('map-tools-panel').open=!mobile;setSidebarOpen(!mobile);mobileLayout=mobile;}dirty=true;}
  function stopTime(){if(timeTimer)clearInterval(timeTimer);timeTimer=null;$('time-play').textContent='播放';$('time-play').setAttribute('aria-pressed','false');}
  function loadSnapshot(key){
    if(window.JIANGSHAN_SNAPSHOTS?.[key])return Promise.resolve(window.JIANGSHAN_SNAPSHOTS[key]);
    if(snapshotPromises.has(key))return snapshotPromises.get(key);
    const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='data/history/'+key+'.js';script.onload=()=>{script.remove();const s=window.JIANGSHAN_SNAPSHOTS?.[key];s?resolve(s):reject(new Error('疆域文件内容不完整'));};script.onerror=()=>{script.remove();reject(new Error('找不到 '+script.src.split('/').at(-1)+'，请保留整个文件夹'));};document.head.append(script);});
    snapshotPromises.set(key,promise);promise.catch(()=>snapshotPromises.delete(key));return promise;
  }
  function paintHistory(snapshot){
    if(embedded)return; // The original SVG artwork is the sole map surface in fused mode.
    if(!terrain)return;terrain.material.map?.dispose();terrain.material.map=null;
    if(snapshot&&(embedded||$('polity-toggle').checked)&&selected==='national'){
      const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;
      const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
      const [w,s,e,n]=dataset.bounds;
      if(embedded&&window.JiangshanFusionLayers){
        window.JiangshanFusionLayers.draw(context,{snapshot,layers:fusionLayers,overlays:fusionOverlays,bounds:dataset.bounds,width:canvas.width,height:canvas.height});
      }else for(const polity of snapshot.polities){
        const shape=polity.shape,polygons=shape.type==='Polygon'?[shape.coordinates]:shape.coordinates;
        for(const polygon of polygons){
          context.beginPath();
          for(const ring of polygon){ring.forEach((coord,i)=>{const x=(coord[0]-w)/(e-w)*canvas.width,y=(n-coord[1])/(n-s)*canvas.height;i?context.lineTo(x,y):context.moveTo(x,y);});context.closePath();}
          context.globalAlpha=.50;context.fillStyle=polity.tint||'#b48e64';context.fill('evenodd');
          context.globalAlpha=.80;context.strokeStyle=polity.tint||'#6c5944';context.lineWidth=1.5;context.stroke();
        }
      }
      context.globalAlpha=1;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);terrain.material.map=texture;
    }
    terrain.material.needsUpdate=true;dirty=true;
  }
  function showPolityLegend(snapshot){
    $('polity-list').replaceChildren();$('polity-count').textContent=snapshot?'· '+snapshot.polities.length:'· 无疆域图层';
    for(const polity of snapshot?.polities||[]){const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=polity.tint||'#b48e64';item.append(swatch,document.createTextNode(polity.title));$('polity-list').append(item);}
  }
  function showNearbyEvents(){
    const events=historyData.events.filter(e=>e.year>=-403&&e.year<=2026).map((e,i)=>({...e,index:i})).sort((a,b)=>Math.abs(a.year-historyYear)-Math.abs(b.year-historyYear)||a.year-b.year).slice(0,6).sort((a,b)=>a.year-b.year);
    $('history-events').replaceChildren();
    for(const event of events){const button=document.createElement('button'),date=document.createElement('span'),text=document.createElement('span');button.className='history-event';date.className='event-date';date.textContent=timeCore.yearLabel(event.year);text.textContent=event.title;button.append(date,text);button.classList.toggle('active',event.year===historyYear);button.onclick=()=>{stopTime();setHistoryYear(event.year,event);};$('history-events').append(button);}
  }
  async function setHistoryYear(value,event=null){
    const year=Number(value),frame=timeCore.findFrame(historyData,year);
    if(!frame){$('time-context').textContent='请输入前403年至2026年的整数年份；没有公元0年。';$('time-year').value=historyYear;$('time-range').value=historyYear;return;}
    historyYear=year;selectedEvent=event||historyData.events.find(e=>e.year===year)||null;
    $('time-year').value=year;$('time-range').value=year;$('time-readout').textContent=timeCore.yearLabel(year)+' · '+frame.title;
    $('period-select').value=frame.modern?'modern':frame.key;$('time-retry').hidden=true;
    $('polity-toggle').disabled=!!frame.modern;
    showNearbyEvents();if(selected!=='national')return;
    const token=++historyToken;currentSnapshot=null;paintHistory(null);showPolityLegend(null);rebuildMarkers();
    $('time-context').textContent=frame.modern?'1949年以后：显示现代地形与所收录事件；本版未导入现代疆域。':'正在读取本地疆域快照…';
    if(frame.modern){updateHistoryNote();return;}
    try{
      const snapshot=await loadSnapshot(frame.snapshot);if(token!==historyToken||selected!=='national')return;
      currentSnapshot=snapshot;paintHistory(snapshot);showPolityLegend(snapshot);
      $('time-context').textContent=`${timeCore.yearLabel(frame.from)}—${timeCore.yearLabel(frame.to)} · ${frame.title} · 原项目阶段疆域快照；边界为示意近似。`;
      updateHistoryNote();
    }catch(error){if(token!==historyToken)return;$('time-context').textContent='疆域暂未显示：'+error.message;$('time-retry').hidden=false;}
  }
  function updateHistoryNote(){
    const box=$('reading-note');box.replaceChildren();const strong=document.createElement('strong'),p=document.createElement('p');
    strong.textContent=selectedEvent?'事件地点':'地形与年代';p.textContent=selectedEvent?`${selectedEvent.title} · ${selectedEvent.site||'地点见标记'}。地点为原项目概略定位；本版未绘制进军路线。`:'切换年份会改变政权轮廓和事件，现代山体与海陆底座保持不变。古海岸、河道和湖泊变化留待分区考证。';box.append(strong,p);
  }
  function initHistoryControls(){
    if(!historyData||!timeCore)throw new Error('缺少本地历史索引文件，请保留 data/history.js 和 history-core.js。');
    for(const p of historyData.periods){const option=document.createElement('option');option.value=p.key;option.textContent=p.title+' · '+timeCore.yearLabel(p.from);$('period-select').append(option);}
    const modern=document.createElement('option');modern.value='modern';modern.textContent='现代 · 1949年至今（无疆域层）';$('period-select').append(modern);
    $('period-select').onchange=()=>{stopTime();const p=historyData.periods.find(p=>p.key===$('period-select').value);setHistoryYear(p?p.from:1949);};
    $('time-range').oninput=()=>{stopTime();clearTimeout(timeDebounce);const y=Number($('time-range').value)||1;$('time-year').value=y;$('time-readout').textContent=timeCore.yearLabel(y);$('time-context').textContent='正在切换年代…';timeDebounce=setTimeout(()=>setHistoryYear(y),130);};
    $('time-year').onchange=()=>{stopTime();clearTimeout(timeDebounce);setHistoryYear($('time-year').value);};
    const commitYear=()=>{stopTime();clearTimeout(timeDebounce);setHistoryYear($('time-year').value);};
    $('time-go').onclick=commitYear;$('time-year').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commitYear();}};
    const step=direction=>{clearTimeout(timeDebounce);const years=timeCore.criticalYears(historyData),next=direction>0?years.find(y=>y>historyYear):[...years].reverse().find(y=>y<historyYear);if(next===undefined){stopTime();return;}setHistoryYear(next);};
    $('time-prev').onclick=()=>{stopTime();step(-1);};$('time-next').onclick=()=>{stopTime();step(1);};
    $('time-play').onclick=()=>{if(timeTimer){stopTime();return;}$('time-play').textContent='暂停';$('time-play').setAttribute('aria-pressed','true');timeTimer=setInterval(()=>step(1),1600);};
    $('time-retry').onclick=()=>setHistoryYear(historyYear);$('polity-toggle').onchange=()=>paintHistory(currentSnapshot);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTime();});
  }
  function initFusion(){
    if(!window.JiangshanFusion)throw new Error('缺少本地融合协议文件。');
    const unavailable=document.createElement('div');unavailable.id='fusion-unavailable';unavailable.hidden=true;
    const text=document.createElement('p');text.textContent='当前地点超出已保存的三维高程范围。平面地图中的人物、地点和年份仍然保留，可返回平面继续查看。';
    const back=document.createElement('button');back.textContent='返回平面地图';back.onclick=()=>fusion.send('request-flat',{reason:unavailable.dataset.reason});unavailable.append(text,back);$('stage').append(unavailable);
    fusion=window.JiangshanFusion.createChild(window,{onState:state=>{fusionState=state;fusionActive=state.active;if(dataset)applyFusionState(state);},onSurface:applyOriginalSurface,onSurfaceError:key=>{
      if(key!==fusionState?.sceneKey)return;
      $('fusion-unavailable').hidden=false;$('fusion-unavailable').dataset.reason='surface';$('fusion-unavailable').querySelector('p').textContent='原版地图贴图暂未载入。请返回平面地图继续查看，或重新载入页面。';
    },onConfig:config=>{
      if(Number.isFinite(config.exaggeration)&&config.exaggeration!==exaggeration){clearTimeout(fusionHeightTimer);fusionHeightTimer=setTimeout(()=>{if(!geometry)return;$('exaggeration').value=config.exaggeration;updateHeight();},70);}
      if(config.view&&mapFrame){desired.theta=config.view==='east'?Math.PI/2:0;desired.phi=config.view==='top'?.012:config.view==='relief'||config.view==='east'?.7:.08;constrainDesired();dirty=true;}
    }});
    window.addEventListener('keydown',e=>{
      if(!fusionActive)return;
      if(['Escape','/','ArrowLeft','ArrowRight',' '].includes(e.key)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){
        e.preventDefault();e.stopImmediatePropagation();fusion.send('shortcut',{key:e.key,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey});
      }
    },true);
  }
  function applyOriginalSurface(surface){
    if(!atlasSurface||surface.sceneKey!==fusionState?.sceneKey)return;
    if(surface.quality==='detail'&&surfaceSceneKey!==surface.sceneKey){pendingSurfaceDetail=surface;return;}
    const load=surfaceLoads,image=new Image();
    image.onload=()=>{
      if(load!==surfaceLoads||surface.sceneKey!==fusionState?.sceneKey||surface.renderId<(surface.quality==='base'?surfaceBaseId:surfaceDetailId))return;
      const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);texture.needsUpdate=true;
      if(surface.quality==='base'){atlasSurface.base(texture);surfaceBaseId=surface.renderId;}else{atlasSurface.detail(texture,surface.bounds,dataset.bounds);surfaceDetailId=surface.renderId;}
      surfaceSceneKey=surface.sceneKey;terrain.visible=true;
      document.body.dataset.mapSurface='original-svg';document.body.dataset.surfaceYear=String(historyYear);document.body.dataset.surfaceQuality=surface.quality;
      if(surface.quality==='base')fusion.send('surface-applied',{sceneKey:surface.sceneKey,quality:'base',renderId:surface.renderId});
      $('load-state').hidden=true;dirty=true;
      if(surface.quality==='base'&&pendingSurfaceDetail){const pending=pendingSurfaceDetail;pendingSurfaceDetail=null;applyOriginalSurface(pending);}
    };
    image.onerror=()=>{if(load===surfaceLoads){$('load-state').hidden=false;$('load-state').textContent='原版地图未能载入，请切回平面后重试。';}};
    image.src=surface.url;
  }
  function applyFusionState(state){
    fusionActive=state.active;if(!fusionActive||!mapFrame)return;
    const [w,s,e,n]=dataset.bounds,[lon,lat]=state.center;
    const supported=lon>=w&&lon<=e&&lat>=s&&lat<=n;
    $('fusion-unavailable').hidden=supported;
    $('fusion-unavailable').dataset.reason='coverage';
    $('fusion-unavailable').querySelector('p').textContent='当前地点超出已保存的三维高程范围。平面地图中的人物、地点和年份仍然保留，可返回平面继续查看。';
    $('load-state').hidden=surfaceSceneKey===state.sceneKey;
    if(!$('load-state').hidden)$('load-state').textContent='正在将原版地图铺到真实地形…';
    if(!supported){fusion.applied(state.seq,state.year,false);return;}
    historyYear=state.year;document.body.dataset.fusionYear=String(state.year);document.body.dataset.fusionPerson=state.selection.personKey||'';document.body.dataset.fusionStop=String(state.selection.stopIndex);
    const sceneKey=state.sceneKey||JSON.stringify([state.year,state.layers,state.selection,state.snapshot]);
    if(sceneKey!==fusionPaintedKey){
      if(surfaceSceneKey!==sceneKey){terrain.visible=false;atlasSurface.clearDetail();surfaceLoads++;surfaceBaseId=-1;surfaceDetailId=-1;pendingSurfaceDetail=null;}
      fusionPaintedKey=sceneKey;fusionLocations=state.locations;fusionLayers=state.layers;fusionOverlays=state.overlays;currentSnapshot=state.snapshot;selectedEvent=null;
      if(state.selection.traceCoord&&!fusionLocations.some(p=>p.kind==='selected'))fusionLocations=[{name:'沿革地点',coord:state.selection.traceCoord,kind:'selected'},...fusionLocations];
      $('polity-toggle').checked=state.layers.polities===true;paintHistory(currentSnapshot);rebuildMarkers();
    }
    const viewKey=state.center.map(v=>v.toFixed(7)).join(',')+':'+state.widthKm.toFixed(4);
    if(state.reason!=='child-view'&&viewKey!==fusionViewKey){
      const p=mapFrame.toWorld(lon,lat);desired.x=p.x;desired.z=p.z;
      desired.distance=state.widthKm/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect);
      if(!fusionStarted){desired.theta=0;desired.phi=.7;fusionStarted=true;}
      constrainDesired();theta=desired.theta;phi=desired.phi;distance=desired.distance;target={x:desired.x,z:desired.z};
    }
    fusionViewKey=viewKey;dirty=true;
    requestAnimationFrame(()=>{if(fusionState?.seq===state.seq)fusion.applied(state.seq,state.year,true);});
  }
  function rebuildFusionPlaces(){
    if(!fusionState)return;
    const [w,s,e,n]=dataset.bounds,stop=fusionState.selection.stopIndex;
    const priority=p=>p.kind==='selected'||(p.kind==='journey'&&p.index===stop)?0:p.kind==='journey'?1:p.kind==='event'&&p.year===historyYear?2:p.kind==='city'?3:4;
    const points=[...fusionLocations].filter(p=>p.coord[0]>=w&&p.coord[0]<=e&&p.coord[1]>=s&&p.coord[1]<=n&&(p.kind!=='city'||fusionLayers.settlements===true)&&(p.kind!=='event'||fusionLayers.milestones===true)).sort((a,b)=>priority(a)-priority(b));
    const occupied=new Set();
    for(const p of points){
      const key=p.coord.map(v=>v.toFixed(3)).join(',');if(occupied.has(key))continue;occupied.add(key);
      const active=priority(p)===0,el=document.createElement('button');el.className='map-label fusion-place '+p.kind+(active?' selected':'');
      el.textContent=p.kind==='event'?(p.year<0?'前'+Math.abs(p.year):p.year)+' · 史事':(p.kind==='journey'&&Number.isInteger(p.index)?(p.index+1)+' ':'')+(p.name.length>18?p.name.slice(0,18)+'…':p.name);
      el.title=(Number.isInteger(p.year)?timeCore.yearLabel(p.year)+' · ':'')+p.name+(p.kind==='journey'?' · 跳到此站':p.kind==='event'?' · 查看事件':' · 查看城市沿革');
      el.setAttribute('aria-label',el.title);
      el.onclick=event=>{
        if(event.isTrusted&&performance.now()<(el._fusionSuppressUntil||0))return;
        if(p.kind==='journey')fusion.send('journey-step',{index:p.index,trackIdx:p.trackIdx});
        else if(p.kind==='event')fusion.send('event',{year:p.year,coord:p.coord});
        else fusion.send('trace',{coord:p.coord});
      };
      $('labels').append(el);labels.push({el,lon:p.coord[0],lat:p.coord[1],type:'fusion-'+p.kind,fusionPoint:p,active});
    }
  }
  function emitFusionView(immediate=false){
    if(!embedded||!fusionActive||!mapFrame)return;
    if(fusionViewTimer)cancelAnimationFrame(fusionViewTimer);
    const send=()=>{
      fusionViewTimer=null;
      if(!fusionActive)return;constrainDesired();
      fusion.send('view',{center:mapFrame.toGeo(desired.x,desired.z),widthKm:2*desired.distance*Math.tan(camera.fov*Math.PI/360)*camera.aspect});
    };
    if(immediate)send();else fusionViewTimer=requestAnimationFrame(send);
  }
  function animate(){
    requestAnimationFrame(animate);if(!renderer||!dataset||(embedded&&!fusionActive))return;
    if(dirty)constrainDesired();
    const factor=reducedMotion?1:.18;
    const delta=Math.abs(theta-desired.theta)+Math.abs(phi-desired.phi)+Math.abs(distance-desired.distance)+Math.abs(target.x-desired.x)+Math.abs(target.z-desired.z);
    if(delta>.001){theta+=(desired.theta-theta)*factor;phi+=(desired.phi-phi)*factor;distance+=(desired.distance-distance)*factor;target.x+=(desired.x-target.x)*factor;target.z+=(desired.z-target.z)*factor;dirty=true;}
    if(!dirty)return;dirty=false;
    const constrained=constrainState({theta,phi,distance,x:target.x,z:target.z});theta=constrained.theta;phi=constrained.phi;distance=constrained.distance;target.x=constrained.x;target.z=constrained.z;
    const lookY=groundY(target.x,target.z);
    camera.position.set(target.x+distance*Math.sin(phi)*Math.sin(theta),lookY+distance*Math.cos(phi),target.z+distance*Math.sin(phi)*Math.cos(theta));
    camera.lookAt(target.x,lookY,target.z);camera.updateMatrixWorld();
    renderer.render(scene,camera);
    const s=$('stage');const occupied=[];
    $('route-overlay').setAttribute('viewBox',`0 0 ${s.clientWidth} ${s.clientHeight}`);
    if($('route-toggle').checked)for(const segment of routeWorld){
      if(segment.dot){const p=segment.point.clone().project(camera);segment.dot.setAttribute('cx',(p.x*.5+.5)*s.clientWidth);segment.dot.setAttribute('cy',(-p.y*.5+.5)*s.clientHeight);segment.dot.style.display=p.z>-1&&p.z<1?'':'none';continue;}
      let path='',pen=false;
      for(const point of segment.points){const p=point.clone().project(camera);if(p.z<=-1||p.z>=1){pen=false;continue;}path+=`${pen?'L':'M'}${((p.x*.5+.5)*s.clientWidth).toFixed(1)},${((-p.y*.5+.5)*s.clientHeight).toFixed(1)} `;pen=true;}
      segment.halo.setAttribute('d',path);segment.line.setAttribute('d',path);
    }
    labels.forEach(label=>{
      const offset=label.fusionPoint?2*distance*Math.tan(camera.fov*Math.PI/360)/s.clientHeight*5:Math.max(widthKm,depthKm)*.005;
      const v=xyz(label.lon,label.lat,offset).project(camera),x=(v.x*.5+.5)*s.clientWidth,y=(-v.y*.5+.5)*s.clientHeight;
      let ly=y;
      if(label.type==='pass'||label.type==='waypoint'){
        for(const offset of [0,-25,25,-50,50,-75,75]){
          ly=y+offset;if(!occupied.some(p=>Math.abs(p.x-x)<65&&Math.abs(p.y-ly)<24))break;
        }
      }
      let visible=v.z<1&&v.z>-1&&x>35&&x<s.clientWidth-35&&ly>25&&ly<s.clientHeight-40&&!(label.type==='waypoint'&&!$('route-toggle').checked);
      if(label.type==='city'&&occupied.some(p=>Math.abs(p.x-x)<55&&Math.abs(p.y-y)<25))visible=false;
      if(selected==='national'&&label.type==='region'&&occupied.some(p=>Math.abs(p.x-x)<60&&Math.abs(p.y-y)<18))visible=false;
      if(label.fusionPoint&&!label.active&&occupied.some(p=>Math.abs(p.x-x)<65&&Math.abs(p.y-y)<20))visible=false;
      if(visible)occupied.push({x,y:ly});
      label.el.style.visibility=visible?'visible':'hidden';label.el.style.left=x+'px';label.el.style.top=ly+'px';
      if(label.leader){const anchor=xyz(label.lon,label.lat,Math.max(widthKm,depthKm)*.0009).project(camera);label.leader.style.display=visible?'':'none';label.leader.setAttribute('x1',(anchor.x*.5+.5)*s.clientWidth);label.leader.setAttribute('y1',(-anchor.y*.5+.5)*s.clientHeight);label.leader.setAttribute('x2',x);label.leader.setAttribute('y2',ly-2);}
    });
    // The compass uses the projected geographic north vector, not camera bearing alone.
    const o=new THREE.Vector3(target.x,lookY,target.z).project(camera),n=new THREE.Vector3(target.x,lookY,target.z-10).project(camera);
    const angle=Math.atan2(n.x-o.x,n.y-o.y)*180/Math.PI;
    $('compass-needle').setAttribute('transform',`rotate(${angle},28,28)`);
  }

  try {
    if(typeof THREE==='undefined')throw new Error('缺少 vendor/three.min.js，请解压整个文件夹，不要只移动 index.html。');
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
    if(!viewportGeometry)throw new Error('缺少 viewport-geometry.js，请保留完整文件夹。');
    renderer.setClearColor(embedded?'#d6e0de':'#8eb5bd');renderer.outputColorSpace=THREE.SRGBColorSpace;
    $('canvas-host').append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.1,20000);
    viewportGuard=viewportGeometry.createGuard(THREE);
    if(embedded)initFusion();
    scene.add(new THREE.AmbientLight(embedded?'#ffffff':'#fff5dc',embedded?2.8:1.55));
    const sun=new THREE.DirectionalLight(embedded?'#ffffff':'#fff9e8',embedded?.45:2.0);sun.position.set(-180,300,-180);scene.add(sun);
    resize();new ResizeObserver(resize).observe($('stage'));
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('浏览器的三维绘图连接中断。请关闭其他大型三维页面后，点击重新载入。');});
    let drag=null;const touches=new Map();let pinchDistance=0;
    const canvas=renderer.domElement;
    const inputSurface=embedded?$('stage'):canvas;
    inputSurface.addEventListener('contextmenu',e=>e.preventDefault());
    inputSurface.addEventListener('pointerdown',e=>{
      const label=embedded?e.target.closest('.fusion-place'):null;
      if(embedded&&e.target.closest('button')&&!label)return;
      $('stage').focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button,moved:false,label};
      if(touches.size===2){const a=[...touches.values()];pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
    });
    inputSurface.addEventListener('pointermove',e=>{
      if(!drag)return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(touches.size===2){const a=[...touches.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDistance>0)zoom(pinchDistance/Math.max(d,1));pinchDistance=d;drag.moved=true;return;}
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>4)drag.moved=true;
      if(drag.button===0&&!e.shiftKey){const f=2*distance*Math.tan(camera.fov*Math.PI/360)/$('stage').clientHeight,tiltScale=1/Math.max(.25,Math.cos(phi));desired.x-=f*(dx*Math.cos(theta)+dy*Math.sin(theta)*tiltScale);desired.z+=f*(dx*Math.sin(theta)-dy*Math.cos(theta)*tiltScale);}
      else{desired.theta-=dx*.006;desired.phi=Math.max(.012,Math.min(1.05,desired.phi-dy*.005));}
      drag.x=e.clientX;drag.y=e.clientY;dirty=true;
    });
    inputSurface.addEventListener('pointerup',e=>{touches.delete(e.pointerId);if(drag&&!drag.moved&&e.button===0){if(drag.label){drag.label._fusionSuppressUntil=performance.now()+120;drag.label.click();}else handleClick(e);}else if(drag?.moved)emitFusionView(true);drag=null;pinchDistance=0;});
    inputSurface.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);drag=null;pinchDistance=0;});
    inputSurface.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.0015),e);},{passive:false});
    inputSurface.addEventListener('dblclick',e=>{if(embedded&&!e.target.closest('.fusion-place')){const hit=hitAt(e);if(hit)fusion.send('trace',{coord:lonlat(hit.point)});}});
    $('stage').addEventListener('keydown',e=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','h','H','Escape'];if(!keys.includes(e.key))return;e.preventDefault();
      if(embedded&&e.key.toLowerCase()==='h'){fusion.send('reset-view');return;}
      if(e.key==='ArrowLeft')desired.theta+=.15;if(e.key==='ArrowRight')desired.theta-=.15;
      if(e.key==='ArrowUp')desired.phi=Math.max(.012,desired.phi-.1);if(e.key==='ArrowDown')desired.phi=Math.min(1.05,desired.phi+.1);
      if(e.key==='+'||e.key==='=')zoom(.85);if(e.key==='-')zoom(1.18);if(e.key.toLowerCase()==='h')show('national');if(e.key==='Escape')clearProfile();dirty=true;if(embedded)emitFusionView();
    });
    $('exaggeration').addEventListener('input',updateHeight);
    $('route-toggle').onchange=()=>{$('route-overlay').style.display=$('route-toggle').checked?'':'none';$('route-legend').hidden=!$('route-toggle').checked;dirty=true;};
    $('route-full').onclick=()=>show('overview',selectedRoute);
    $('route-local').onclick=()=>show(selectedRoute);
    $('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
    $('reset-view').onclick=()=>resetCamera();$('map-view').onclick=()=>resetCamera();$('oblique').onclick=()=>resetCamera('relief');$('top').onclick=()=>resetCamera('top');$('east').onclick=()=>resetCamera('east');
    $('national-wide').onclick=()=>resetCamera('wide');
    $('profile-toggle').onclick=()=>{if(measuring){clearProfile();return;}clearProfile();measuring=true;$('measure-hint').textContent='请在山体上选取剖面起点';$('measure-hint').hidden=false;$('profile-toggle').classList.add('selected');$('profile-toggle').setAttribute('aria-pressed','true');$('stage').focus({preventScroll:true});};
    $('profile-close').onclick=clearProfile;
    initHistoryControls();animate();show('national');
  } catch(e) { fail(e.message||'浏览器不支持 WebGL。请用新版 Edge 或 Chrome 打开，并启用浏览器图形加速。'); }
  function zoom(factor,event=null){if(!dataset)return;const before=desired.distance,anchor=event?hitAt(event)?.point:null;desired.distance=Math.max(Math.max(widthKm,depthKm)/240,desired.distance*factor);constrainDesired();if(anchor){const ratio=desired.distance/before;desired.x=anchor.x-(anchor.x-desired.x)*ratio;desired.z=anchor.z-(anchor.z-desired.z)*ratio;constrainDesired();}dirty=true;if(embedded)emitFusionView();}
})();
