import * as T from './vendor/three.module.js';

// Preserve the authored vertex palette and offline contact shading instead of quantizing every surface into toon bands.
export function paintedMaterial({color=0xffffff,vertexColors=true,roughness=.73}={}){
  const material=new T.MeshStandardMaterial({color,vertexColors,roughness,metalness:.025});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPaintPoint;\n'+(vertexColors?'attribute vec3 _surface;\nvarying vec3 vPaintSurface;\n':'')+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaintPoint = position;'+(vertexColors?'\nvPaintSurface = _surface;':''));
    shader.fragmentShader='varying vec3 vPaintPoint;\n'+(vertexColors?'varying vec3 vPaintSurface;\n':'')+shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      ${vertexColors?'roughnessFactor = vPaintSurface.x;':''}
      float weave = sin(vPaintPoint.x*185.0)*sin(vPaintPoint.y*185.0);
      roughnessFactor = clamp(roughnessFactor+weave*.015,.3,.95);
    `);
    if(vertexColors)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vPaintSurface.y;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vPaintSurface.z*.035;');
  };
  material.customProgramCacheKey=()=> 'painted-physical-v3-'+vertexColors;return material;
}
export function ensurePaintSurface(geometry){
  if(geometry.hasAttribute('_surface'))return;
  const count=geometry.attributes.position.count,values=new Float32Array(count*3);for(let i=0;i<count;i++)values.set([.8,.02,0],i*3);geometry.setAttribute('_surface',new T.BufferAttribute(values,3));
}
export function softStudioLight(scene,renderer){
  renderer.shadowMap.type=T.PCFShadowMap;
  const fill=new T.DirectionalLight(0xc8e6f6,.65);fill.position.set(10,12,16);scene.add(fill);
  return fill;
}
