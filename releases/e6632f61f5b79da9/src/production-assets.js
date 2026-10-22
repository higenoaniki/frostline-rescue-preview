import {GLTFLoader} from './vendor/GLTFLoader.js';
import {Group,TextureLoader,SRGBColorSpace} from './vendor/three.module.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {canonicalizeProductionRig} from './production-rig.js';
import {createActorClips} from './actor-animation.js';

let loading;
let collectorTexture;
let baseCharacter;
const detailLoads=new Map();
const detailTokens=new Map();
function mobileTextureBudget(character,props,collector){
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1||globalThis.Capacitor?.isNativePlatform?.()===true;
  if(!mobile)return;
  const resized=new Map();
  function resize(texture,limit){
    const source=texture?.image;if(!source||source.width<=limit&&source.height<=limit)return;
    let canvas=resized.get(source);
    if(!canvas){canvas=document.createElement('canvas');const scale=limit/Math.max(source.width,source.height);canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(source,0,0,canvas.width,canvas.height);resized.set(source,canvas);}
    texture.image=canvas;texture.needsUpdate=true;
  }
  for(const root of [character,...props.values()])root.traverse(node=>{
    if(!node.isMesh||node.userData.atlas==='head')return;
    for(const material of Array.isArray(node.material)?node.material:[node.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])resize(material[key],1024);
  });
  resize(collector,1024);
}
export function loadProductionAssets(){
  loading??=(async()=>{
    const loader=new GLTFLoader(),loaded=await loader.loadAsync(new URL('../assets/production/explorer.glb',import.meta.url).href);
    const root=loaded.scene.getObjectByName('production-explorer');
    if(!root||root.userData.materialWorkflow!=='authored-pbr')throw Error('Missing authored production character');
    canonicalizeProductionRig(root);
    root.userData.artRevision='portrait-v21';baseCharacter=root;
    const clips=createActorClips(JSON.parse(root.userData.motionLibrary)),props=new Map();
    await Promise.all(['item-axe','item-axe3','item-goods','heater','axe-cover'].map(async name=>{
      const gltf=await loader.loadAsync(new URL(`../assets/production/${name}.glb`,import.meta.url).href);
      const prop=gltf.scene.getObjectByName(name);
      if(!prop||prop.userData.materialWorkflow!=='authored-pbr')throw Error(`Missing production prop ${name}`);
      props.set(name,prop);
    }));
    collectorTexture=await new TextureLoader().loadAsync(new URL('../assets/production/worker-parka-color.jpg',import.meta.url).href);
    collectorTexture.flipY=false;collectorTexture.colorSpace=SRGBColorSpace;collectorTexture.anisotropy=8;
    mobileTextureBudget(root,props,collectorTexture);
    for(const model of [root,...props.values()])model.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=node.receiveShadow=true;
      for(const mat of Array.isArray(node.material)?node.material:[node.material]){
        mat.userData={...mat.userData,pipeline:'authored-production-pbr'};
        if(node.userData.atlas==='head')mat.aoMapIntensity=.7;
        for(const key of ['map','normalMap','roughnessMap','aoMap'])if(mat[key])mat[key].anisotropy=8;
      }
    });
    return{character:root,clips,props};
  })();return loading;
}

export function productionPerson(template,worker=false,cover=null){
  const root=cloneSkeleton(template),joint=name=>root.getObjectByName(name);
  root.userData.artRevision='portrait-v21';root.userData.skinning='native-four-weight';root.userData.geometryTier=0;
  const coarse=new Map();root.traverse(node=>{if(node.isSkinnedMesh)coarse.set(node.userData.atlas,node.geometry);});
  root.setGeometryDetail=(tier,parts)=>{
    root.traverse(node=>{if(node.isSkinnedMesh)node.geometry=(tier===0?coarse:parts).get(node.userData.atlas);});
    root.userData.geometryTier=tier;
  };
  root.traverse(node=>{
    if(!node.isMesh)return;
    node.material=node.material.clone();node.material.userData={...node.material.userData,pipeline:'authored-production-pbr'};
    if(worker&&node.userData.atlas==='parka'&&collectorTexture)node.material.map=collectorTexture;
  });
  function anchor(name,parent,position){const group=new Group();group.name=name;group.position.fromArray(position);parent.add(group);return group;}
  anchor('weapon-grip',joint('hand-right'),[0,-4,1.5]);
  const holster=anchor('weapon-holster',joint('torso'),[19,92,3]);
  const sheath=anchor('blade-sheath',holster,[0,0,0]);
  if(cover)sheath.add(cover.clone(true));
  anchor('stack',joint('torso'),[0,128,-26]);
  anchor('armor',joint('torso'),[0,82,18]);
  return root;
}

export function prepareGeometryDetail(root,template){
  canonicalizeProductionRig(root,{bounds:false});
  let base;template.traverse(node=>{if(node.isSkinnedMesh&&!base)base=node;});
  const order=new Map(base.skeleton.bones.map((bone,index)=>[bone.name,index])),parts=new Map();
  root.traverse(node=>{
    if(!node.isSkinnedMesh)return;
    const remap=node.skeleton.bones.map(bone=>order.get(bone.name));
    if(remap.some(index=>index===undefined))throw Error('Geometry detail has an incompatible skeleton');
    const indices=node.geometry.attributes.skinIndex;
    for(let i=0;i<indices.count;i++)indices.setXYZW(i,remap[indices.getX(i)],remap[indices.getY(i)],remap[indices.getZ(i)],remap[indices.getW(i)]);
    parts.set(node.userData.atlas,node.geometry);
  });
  return parts;
}

export function loadGeometryDetail(tier){
  if(![1,2].includes(tier))throw Error('Unknown geometry detail tier');
  if(!detailLoads.has(tier)){
    const token=Symbol();detailTokens.set(tier,token);
    detailLoads.set(tier,(async()=>{
    await loadProductionAssets();const loader=new GLTFLoader(),parts=new Map();
    // Sequential decode bounds the transient memory peak on mobile browsers.
    for(const atlas of ['head','gear','parka']){
      if(detailTokens.get(tier)!==token)throw Error('Geometry detail cancelled');
      const {scene}=await loader.loadAsync(new URL(`../assets/production/explorer-lod${tier}-${atlas}.glb`,import.meta.url).href);
      if(detailTokens.get(tier)!==token)throw Error('Geometry detail cancelled');
      const root=scene.getObjectByName('production-explorer');
      if(!root)throw Error('Missing geometry detail root');
      const geometry=prepareGeometryDetail(root,baseCharacter).get(atlas);
      if(!geometry)throw Error('Missing geometry detail surface');parts.set(atlas,geometry);
    }
    return parts;
    })());
  }
  return detailLoads.get(tier);
}

export function releaseGeometryDetailsAbove(tier){
  for(const [level,promise]of detailLoads){
    if(level<=tier)continue;
    detailLoads.delete(level);detailTokens.delete(level);
    promise.then(parts=>{for(const geometry of parts.values())geometry.dispose();},()=>{});
  }
}
