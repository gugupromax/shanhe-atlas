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
    const tileLimit=4;
    const tiles=new Map();
    const uniforms={
      atlasDetail:{value:null},atlasDetailRect:{value:new THREE.Vector4(0,0,1,1)},atlasDetailReady:{value:0},
      atlasTileMaps:{value:Array(tileLimit).fill(null)},
      atlasTileRects:{value:Array.from({length:tileLimit},()=>new THREE.Vector4(0,0,1,1))},
      atlasTileCount:{value:0}
    };
    let detail=null;
    const tileShader=Array.from({length:tileLimit},(_,slot)=>
      'if (!matched && atlasTileCount > '+slot+'.0) {'+
      ' vec4 rect = atlasTileRects['+slot+'];'+
      ' vec2 tileUv = (vMapUv - rect.xy) / rect.zw;'+
      ' if (all(greaterThanEqual(tileUv, vec2(0.0))) && all(lessThanEqual(tileUv, vec2(1.0)))) {'+
      ' atlasColor = texture2D(atlasTileMaps['+slot+'], tileUv); matched = true; } }'
    ).join('\n');
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader=
        'uniform sampler2D atlasDetail;\nuniform vec4 atlasDetailRect;\nuniform float atlasDetailReady;\n'+
        'uniform sampler2D atlasTileMaps[4];\nuniform vec4 atlasTileRects[4];\nuniform float atlasTileCount;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        '#ifdef USE_MAP\nvec4 atlasColor=texture2D(map,vMapUv);\n'+
        'if(atlasTileCount>0.0){bool matched=false;\n'+tileShader+'\n}'+
        'else if(atlasDetailReady>0.5){vec2 atlasUV=(vMapUv-atlasDetailRect.xy)/atlasDetailRect.zw;'+
        'if(all(greaterThanEqual(atlasUV,vec2(0.0))) && all(lessThanEqual(atlasUV,vec2(1.0)))) atlasColor=texture2D(atlasDetail,atlasUV);}\n'+
        'diffuseColor*=atlasColor;\n#endif');
    };
    material.customProgramCacheKey=()=> 'original-atlas-surface-v2';
    function clearTiles(){
      for(const texture of tiles.values())texture.dispose();
      tiles.clear();
      uniforms.atlasTileMaps.value.fill(null);
      uniforms.atlasTileCount.value=0;
    }
    function clearDetail(){
      detail?.dispose();detail=null;
      uniforms.atlasDetail.value=null;uniforms.atlasDetailReady.value=0;
    }
    return {material,tileLimit,
      base(texture){material.map?.dispose();material.map=texture;material.needsUpdate=true;},
      detail(texture,bounds,coverage){
        clearTiles();clearDetail();detail=texture;
        uniforms.atlasDetail.value=texture;uniforms.atlasDetailRect.value.fromArray(uvRect(bounds,coverage));
        uniforms.atlasDetailReady.value=1;
      },
      detailTiles(entries,coverage){
        clearDetail();
        const active=new Set(entries.map(tile=>tile.image));
        for(const [image,texture] of tiles)if(!active.has(image)){texture.dispose();tiles.delete(image);}
        uniforms.atlasTileMaps.value.fill(null);
        entries.forEach(({image,bounds},slot)=>{
          let texture=tiles.get(image);
          if(!texture){
            texture=new THREE.Texture(image);
            texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
            tiles.set(image,texture);
          }
          uniforms.atlasTileMaps.value[slot]=texture;
          uniforms.atlasTileRects.value[slot].fromArray(uvRect(bounds,coverage));
        });
        uniforms.atlasTileCount.value=entries.length;
      },
      clearDetail(){clearTiles();clearDetail();},
      dispose(){clearTiles();clearDetail();}
    };
  }
  return {uvRect,create};
});
