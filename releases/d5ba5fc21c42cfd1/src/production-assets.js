import {GLTFLoader} from './vendor/GLTFLoader.js';
import {Group,TextureLoader,SRGBColorSpace} from './vendor/three.module.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {canonicalizeProductionRig} from './production-rig.js';
import {createActorClips} from './actor-animation.js';

let loading;
let collectorTexture;
export function loadProductionAssets(){
  loading??=(async()=>{
    const loader=new GLTFLoader(),loaded=await loader.loadAsync(new URL('../assets/production/explorer.glb',import.meta.url).href);
    const root=loaded.scene.getObjectByName('production-explorer');
    if(!root||root.userData.materialWorkflow!=='authored-pbr')throw Error('Missing authored production character');
    canonicalizeProductionRig(root);
    root.userData.artRevision='production-v19';
    const clips=createActorClips(JSON.parse(root.userData.motionLibrary)),props=new Map();
    await Promise.all(['item-axe','item-axe3','item-goods','heater','axe-cover'].map(async name=>{
      const gltf=await loader.loadAsync(new URL(`../assets/production/${name}.glb`,import.meta.url).href);
      const prop=gltf.scene.getObjectByName(name);
      if(!prop||prop.userData.materialWorkflow!=='authored-pbr')throw Error(`Missing production prop ${name}`);
      props.set(name,prop);
    }));
    collectorTexture=await new TextureLoader().loadAsync(new URL('../assets/production/worker-parka-color.jpg',import.meta.url).href);
    collectorTexture.flipY=false;collectorTexture.colorSpace=SRGBColorSpace;collectorTexture.anisotropy=8;
    for(const model of [root,...props.values()])model.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=node.receiveShadow=true;
      for(const mat of Array.isArray(node.material)?node.material:[node.material]){
        mat.userData={...mat.userData,pipeline:'authored-production-pbr'};
        for(const key of ['map','normalMap','roughnessMap','aoMap'])if(mat[key])mat[key].anisotropy=8;
      }
    });
    return{character:root,clips,props};
  })();return loading;
}

export function productionPerson(template,worker=false,cover=null){
  const root=cloneSkeleton(template),joint=name=>root.getObjectByName(name);
  root.userData.artRevision='production-v19';root.userData.skinning='native-four-weight';
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
