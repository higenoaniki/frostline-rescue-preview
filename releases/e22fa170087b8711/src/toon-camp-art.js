import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {canonicalizeProductionRig} from './production-rig.js';
import {ArtModels} from './art-models.js';
import {SnowfrontRenderer} from './snowfront-renderer.js';

const native=new Map(),props=new Map();
let loading;
const gradient=new T.DataTexture(new Uint8Array([150,185,217,240,255]),5,1,T.RedFormat);
gradient.minFilter=gradient.magFilter=T.NearestFilter;gradient.needsUpdate=true;
const paint=new T.MeshToonMaterial({vertexColors:true,gradientMap:gradient});
export function loadToonCampAssets(){
  return loading??=(async()=>{
    const loader=new GLTFLoader();
    const [{scene:actors},{scene:equipment}]=await Promise.all([
      loader.loadAsync(new URL('../assets/snowfront/snowfront.glb',import.meta.url).href),
      loader.loadAsync(new URL('../assets/sculpted/frostline-art.glb',import.meta.url).href)
    ]);
    for(const root of actors.children){
      if(!root.userData.asset)continue;let skinned=false;
      root.traverse(n=>{if(n.isBone)n.name=n.name.replace(/[_.]\d+$/,'');if(n.isSkinnedMesh)skinned=true;});
      if(skinned)canonicalizeProductionRig(root);
      root.traverse(n=>{if(n.isMesh){n.material=paint;n.castShadow=n.receiveShadow=true;}});
      native.set(root.userData.asset.replace('snowfront-',''),root);
    }
    for(const root of equipment.children){
      const name=root.userData.asset;if(!name||['explorer','worker-character'].includes(name)||name.startsWith('beast-'))continue;
      root.traverse(n=>{if(n.userData.joint)n.name=n.userData.joint;if(n.isMesh){n.material=paint;n.castShadow=n.receiveShadow=true;}});
      props.set(name,root);
    }
    document.querySelector('#game')?.setAttribute('data-art','camp-toon-v1');
  })();
}
export class ToonCampArt extends ArtModels{
  constructor(profile){super({...profile,toon:true});for(const m of Object.values(this.m))m.gradientMap=gradient;this.catalog=native;}
  model(name){const source=native.get(name);if(!source)throw Error('Missing toon model '+name);return source.clone(true);}
  prop(name){const source=props.get(name);if(!source)throw Error('Missing camp equipment '+name);return source.clone(true);}
  sized(name,units){const g=new T.Group(),model=this.model(name);model.scale.setScalar(units);g.add(model);return g;}
  actor(name){return SnowfrontRenderer.prototype.actor.call(this,name);}
  pose(root,p,dt,kind){return SnowfrontRenderer.prototype.pose.call(this,root,p,dt,kind);}
  stacks(root,bag,cash=0){return SnowfrontRenderer.prototype.stacks.call(this,root,bag,cash);}
  humanoid(color='red'){
    const group=new T.Group(),actor=this.actor(color==='red'?'player':'worker');actor.scale.setScalar(58);group.add(actor);
    group.userData={native:actor,flash:[],facing:0,geometryTier:0};return group;
  }
  creature(kind='normal'){
    const group=new T.Group(),actor=this.actor(kind==='alpha'?'wolf':'snowbeast');actor.scale.setScalar(kind==='boss'?75:48);group.add(actor);
    group.userData={native:actor,kind,prev:null};
    if(kind==='brute'||kind==='boss'){
      const armor=this.prop('item-armor');armor.position.set(0,45,0);armor.scale.setScalar(kind==='boss'?2.2:1.5);group.add(armor);
    }
    return group;
  }
  item(type){
    const key={raw:'raw',cuts:'roast',goods:'crate',cash:'cash',fur:'fur',axe:'axe',axe3:'axe'}[type];
    if(!key)return this.prop('item-'+type);
    return this.sized(key,type==='goods'?60:type.startsWith('axe')?70:100);
  }
  processor(canner=false){return this.prop(canner?'canner':'processor');}
  forge(){return this.prop('forge');}
  beacon(){return this.prop('beacon');}
  upgradeWorkshop(role){return this.prop(role);}
  dispatchDepot(){return this.prop('depot');}
  rack(){return this.prop('rack');}
  bench(){return this.prop('weapon');}
  armorStand(){return this.prop('armor');}
  workerOffice(){const g=this.prop('worker');g.scale.setScalar(.65);return g;}
  heater(){return this.prop('heater');}
  gatePanel(){return this.prop('gate-panel');}
  refuge(){return this.prop('refuge');}
  rock(){return this.sized('rock',65);}
  tree(){return this.sized('pine',85);}
  fencePanel(){const g=new T.Group();for(const z of [-40,-20,0,20,40]){const p=this.model('picket');p.scale.setScalar(70);p.position.z=z;g.add(p);}return g;}
  fencePost(){return this.sized('picket',80);}
  hunterTower(){const g=this.prop('hunter-tower');g.userData.turret=g.getObjectByName('turret');return g;}
  droneDock(){const g=this.prop('fleet');g.scale.setScalar(.72);return g;}
  drone(){const g=this.prop('drone');g.userData={rotors:Array.from({length:4},(_,i)=>g.getObjectByName('rotor'+i)),cargo:g.getObjectByName('cargo')};return g;}
}
