import {ShaderChunk} from './vendor/three.module.js';

export const FACE_PIPELINE='continuous-face-v4';
export const isFaceMaterial=material=>material?.userData?.facePipeline===FACE_PIPELINE;

export function faceMaterial(source){
  const material=source.clone(),blink={value:0};
  material.vertexColors=false;
  material.roughness=.78;
  material.metalness=0;
  material.userData.faceBlink=blink;
  material.customProgramCacheKey=()=>FACE_PIPELINE;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uFaceBlink=blink;
    shader.fragmentShader='uniform float uFaceBlink;\n'+shader.fragmentShader.replace(
      '#include <map_fragment>',ShaderChunk.map_fragment.replace(
        'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
        'vec4 sampledDiffuseColor = mix(texture2D(map,vMapUv),texture2D(map,vMapUv+vec2(.5,0.0)),uFaceBlink);'
      )
    );
  };
  return material;
}

// Body palettes must never erase authored facial UVs or their native material.
export function productionMaterials(mesh,palette){
  const map=m=>isFaceMaterial(m)?m:palette;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(map):map(mesh.material);
}

export function bindCharacterFace(root){
  const copies=new Map();
  root.traverse(node=>{
    if(!node.isMesh)return;
    const own=material=>{
      if(!isFaceMaterial(material))return material;
      if(!copies.has(material))copies.set(material,faceMaterial(material));
      return copies.get(material);
    };
    node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
  });
  root.userData.faceMaterials=[...copies.values()];
}

export function setFaceBlink(root,value){
  const amount=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  for(const material of root.userData.faceMaterials??[])material.userData.faceBlink.value=amount;
}

export function setCharacterOpacity(root,opacity){
  const amount=Math.max(0,Math.min(1,opacity));
  if(root.userData.material)root.userData.material.opacity=amount;
  for(const material of root.userData.faceMaterials??[]){material.transparent=true;material.opacity=amount;}
}
