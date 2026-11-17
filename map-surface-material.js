/* Mercator registration of the original atlas artwork on the measured terrain. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JiangshanSurfaceMaterial=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const y=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  function uvRect(bounds,coverage){
    const [w,s,e,n]=bounds,[cw,cs,ce,cn]=coverage,depth=y(cn)-y(cs);
    return [(w-cw)/(ce-cw),(y(s)-y(cs))/depth,(e-w)/(ce-cw),(y(n)-y(s))/depth];
  }
  function create(THREE){
    const material=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});
    const uniforms={atlasDetail:{value:null},atlasDetailRect:{value:new THREE.Vector4(0,0,1,1)},atlasDetailReady:{value:0}};
    let detail=null;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader='uniform sampler2D atlasDetail;\nuniform vec4 atlasDetailRect;\nuniform float atlasDetailReady;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
        vec4 atlasColor=texture2D(map,vMapUv);
        vec2 atlasUV=(vMapUv-atlasDetailRect.xy)/atlasDetailRect.zw;
        if(atlasDetailReady>0.5 && atlasUV.x>=0.0 && atlasUV.x<=1.0 && atlasUV.y>=0.0 && atlasUV.y<=1.0) atlasColor=texture2D(atlasDetail,atlasUV);
        diffuseColor*=atlasColor;
        #endif`);
    };
    material.customProgramCacheKey=()=> 'original-atlas-surface-v1';
    return {material,
      base(texture){material.map?.dispose();material.map=texture;material.needsUpdate=true;},
      detail(texture,bounds,coverage){detail?.dispose();detail=texture;uniforms.atlasDetail.value=texture;uniforms.atlasDetailRect.value.fromArray(uvRect(bounds,coverage));uniforms.atlasDetailReady.value=1;},
      clearDetail(){detail?.dispose();detail=null;uniforms.atlasDetail.value=null;uniforms.atlasDetailReady.value=0;},
      dispose(){detail?.dispose();detail=null;}
    };
  }
  return {uvRect,create};
});
