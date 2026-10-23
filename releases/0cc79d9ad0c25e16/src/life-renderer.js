import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {canonicalizeProductionRig} from './production-rig.js';
import {SnowfrontRenderer} from './snowfront-renderer.js';
import {LIFE_STAGES,LIFE_PADS,LIFE_ITEMS,RECIPES,FACILITY_NAMES,plotLetter,facilityOrder} from './life-config.js';
import {lifeOutputPad} from './life-state.js';

const lerp=(a,b,t)=>a+(b-a)*t;
export class LifeRenderer extends SnowfrontRenderer{
  constructor(canvas,stage){
    super(canvas);this.stage=stage;this.theme=LIFE_STAGES[stage].theme;this.scene.remove(this.landscape.root,this.landscape.footprints,this.snow,this.landscape.ground);
    this.landscape.root.traverse(m=>m.geometry?.dispose());this.landscape.footprints.geometry.dispose();this.landscape.footprints.material.dispose();this.landscape.ground.geometry.dispose();
    this.world=new T.Group();this.scene.add(this.world);this.buildings=new T.Group();this.scene.add(this.buildings);this.nodes=new Map();this.pads=new Map();this.wheels=[];this.waveTime=0;
    const sky=this.theme==='coast'?0xbce6ed:0xc7e4d2;this.scene.background.setHex(sky);this.scene.fog.color.setHex(sky);this.scene.fog.near=70;this.scene.fog.far=145;
    this.sun.color.setHex(0xfff5dd);this.sun.intensity=1.8;
  }
  async load(){
    const {scene}=await new GLTFLoader().loadAsync(new URL('../assets/journey/journey.glb',import.meta.url).href);
    for(const root of scene.children){if(!root.userData.asset)continue;let skinned=false;root.traverse(n=>{if(n.isBone)n.name=n.name.replace(/[_.]\d+$/,'');if(n.isSkinnedMesh)skinned=true;});if(skinned)canonicalizeProductionRig(root);root.traverse(n=>{if(n.isMesh){n.material=this.palette;n.castShadow=n.receiveShadow=true;}});this.catalog.set(root.userData.asset.replace('journey-',''),root);}
    for(const role of ['player','worker','merchant','sister'])this.catalog.set(role,this.catalog.get(this.theme+'-'+role));
    this.catalog.set('axe',this.catalog.get(this.theme==='coast'?'rod':'hoe'));
    this.player=this.actor('player');this.scene.add(this.player);this.worker=this.actor('worker');this.worker.userData.axe.visible=false;this.scene.add(this.worker);this.trader=this.actor('merchant');this.trader.userData.axe.visible=false;this.scene.add(this.trader);
    this.sister=this.actor('sister');this.sister.scale.setScalar(.78);this.scene.add(this.sister);
    this.holster=new T.Group();this.holster.position.set(.4,-.1,-.2);this.holster.rotation.z=-.5;this.player.getObjectByName('torso').add(this.holster);this.makeEnvironment();
  }
  material(color){return new T.MeshToonMaterial({color,gradientMap:this.gradient});}
  part(root,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,this.material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.owned=true;root.add(m);return m;}
  prop(root,name,x,z,scale=1){const m=this.model(name);m.position.set(x,0,z);m.scale.setScalar(scale);root.add(m);return m;}
  instances(root,geometry,color,poses){const m=new T.InstancedMesh(geometry,this.material(color),poses.length),o=new T.Object3D();poses.forEach((p,i)=>{o.position.set(p.x,p.y??0,p.z);o.rotation.set(0,p.angle??0,0);o.scale.set(p.sx??1,p.sy??1,p.sz??1);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=m.receiveShadow=true;m.userData.owned=true;root.add(m);return m;}
  makeEnvironment(){
    const coast=this.theme==='coast';
    const land=this.part(this.world,new T.PlaneGeometry(90,coast?60:100),coast?0xcbdad7:0x8caf72,0,.015,coast?26:0);land.rotation.x=-Math.PI/2;land.castShadow=false;
    const walk=this.part(this.world,new T.PlaneGeometry(3.4,coast?26:40),coast?0xcbd4cc:0xcebd92,0,.028,coast?8:1);walk.rotation.x=-Math.PI/2;walk.castShadow=false;
    if(coast){
      const water=new T.PlaneGeometry(160,160,48,48);water.rotateX(-Math.PI/2);this.water=this.part(this.world,water,0x59c4cb,0,-.20,-5);this.water.castShadow=false;
      this.seaTime={value:0};this.water.material.onBeforeCompile=shader=>{shader.uniforms.uSeaTime=this.seaTime;shader.vertexShader='varying vec2 vSeaXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSeaXZ = position.xz;');shader.fragmentShader='varying vec2 vSeaXZ;\nuniform float uSeaTime;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave = sin(vSeaXZ.y*3.0+sin(vSeaXZ.x*.7+uSeaTime*.4)*.9+uSeaTime*.9);\nfloat crest = smoothstep(.95,1.0,wave)*smoothstep(.1,.8,sin(vSeaXZ.x*.31)*sin(vSeaXZ.y*.23)*.5+.5);\ndiffuseColor.rgb = mix(diffuseColor.rgb*(.96+wave*.035),vec3(.70,.91,.90),crest*.16);');};
      const planks=[],posts=[];for(let x=-15;x<=15;x+=.5)planks.push({x,y:.10,z:-3.5,sx:.47,sy:.13,sz:2.4});
      for(const x of [-9,-3,3,9]){for(let z=-4;z>=-16;z-=.48)planks.push({x,y:.10,z,sx:2.6,sy:.13,sz:.44});for(let z=-5;z>=-16;z-=3)for(const side of [-1,1])posts.push({x:x+side*1.34,y:.4,z});}
      this.instances(this.world,new T.BoxGeometry(1,1,1),0xb79263,planks);this.instances(this.world,new T.CylinderGeometry(.09,.12,1.3,10),0x8d7455,posts);
      const stones=[];for(let x=-14;x<=14;x+=1.1)for(let z=-1;z<=17;z+=1.1)if((Math.abs(x)>1.8&&Math.abs(x)<3.1)||z>14||z<1.1)stones.push({x:x+(Math.round(z)%2)*.3,y:.035,z,sx:.92,sy:.045,sz:.94});this.instances(this.world,new T.BoxGeometry(1,1,1),0xe0e4da,stones);
      for(const x of [-14,14])for(const z of [1,8,15]){this.prop(this.world,'salt',x,z,2.1);const planter=this.part(this.world,new T.CylinderGeometry(.32,.22,.5,12),0xc8886f,x,.25,z-.6);planter.rotation.y=x;for(let i=0;i<3;i++)this.part(this.world,new T.SphereGeometry(.18,10,8),[0x70a26c,0x79aa70,0xddaa64][i],x+(i-1)*.18,.65,z-.6);}
      const foam=[];for(let x=-34;x<35;x+=1.9)foam.push({x,y:-.05,z:-4.3+(Math.sin(x)*.12),sx:1.8,sy:.02,sz:.12});this.instances(this.world,new T.BoxGeometry(1,1,1),0xc4eff0,foam);
      for(let i=0;i<7;i++){const house=this.prop(this.world,'house',(i%2?1:-1)*(19+(i%3)*1.5),3+Math.floor(i/2)*7,1.3);house.rotation.y=i%2?-Math.PI/2:Math.PI/2;}
      this.ship=this.prop(this.world,'boat',13,-10,1.15);this.tradeBoat=this.prop(this.world,'boat',-13,-18,.85);
    }else{
      const river=this.part(this.world,new T.PlaneGeometry(3,85),0x70b6c4,-18,.04,0);river.rotation.x=-Math.PI/2;river.castShadow=false;
      for(let i=0;i<8;i++){const tree=this.prop(this.world,'orchard',(i%2?1:-1)*(19+i%3),-17+Math.floor(i/2)*10,1.1);tree.rotation.y=i;}
      for(let i=0;i<4;i++)this.prop(this.world,'house',i%2?21:-22,6+Math.floor(i/2)*10,1.2);
      this.prop(this.world,'well',0,-3.5,.8);
      const path=[];for(let z=-12;z<=15;z+=3)path.push({x:0,y:.031,z,sx:2.2,sy:.025,sz:2.7});this.instances(this.world,new T.BoxGeometry(1,1,1),0xd7c8a5,path);
    }
    const market=this.prop(this.world,'packing',0,18,1.3);market.rotation.y=Math.PI;
    this.trader.position.set(1.7,0,17.5);
  }
  buildFacilities(s){
    this.buildings.traverse(m=>{if(m.userData.owned){m.geometry.dispose();m.material.dispose();}});this.buildings.clear();this.wheels=[];
    for(const [id,built]of Object.entries(s.built)){
      if(!built)continue;const p=LIFE_PADS[id],asset={kitchen:'oven',bakery:'oven',mill:'mill',preserve:'preserve',processor:'processor',dryer:'dryer',canner:'canner',packing:'packing'}[id];
      if(asset){const model=this.prop(this.buildings,asset,p.x,p.y+2.4,1);if(id==='mill'){const wheel=this.prop(this.buildings,'wheel',p.x-1.6,p.y+2.4,1);wheel.position.y=1.2;wheel.rotation.y=Math.PI/2;this.wheels.push(wheel);}this.prop(this.buildings,'processor',lifeOutputPad(id).x,p.y+1.3,.47);}
      if(id==='crew'||id==='harvester'||id==='porter')this.prop(this.buildings,'packing',p.x,p.y+2,.65);
      if(id==='tool')this.prop(this.buildings,'processor',p.x,p.y+1.9,.65);
      if(id==='community'){for(const [i,x]of [-5,0,5].entries()){const h=this.prop(this.buildings,'house',x,22,1.15);h.rotation.y=(i-1)*.12;}for(let i=0;i<7;i++)this.part(this.buildings,new T.ConeGeometry(.15,.35,3),[0xe5b948,0xd38370,0x5d9b9b][i%3],(i-3)*.8,3.3,19);}
    }
    if(s.built.line){
      for(let z=5;z<14;z+=.42){this.part(this.buildings,new T.BoxGeometry(.7,.12,.37),0x729f9e,-10.5,1.0,z);if(Math.round(z*10)%3===0)this.part(this.buildings,new T.CylinderGeometry(.04,.04,.95,8),0x81918b,-10.5,.48,z);}
      for(const z of [5,12])for(let x=-10.4;x< -6.8;x+=.45)this.part(this.buildings,new T.BoxGeometry(.42,.12,.7),0x729f9e,x,1.0,z);
    }
    if(s.built.irrigation){for(const x of [-7,7]){const canal=this.part(this.buildings,new T.PlaneGeometry(.36,19),0x68b5c2,x,.048,-6.5);canal.rotation.x=-Math.PI/2;canal.castShadow=false;}const bridge=this.part(this.buildings,new T.PlaneGeometry(15,.4),0x68b5c2,0,.05,1.6);bridge.rotation.x=-Math.PI/2;bridge.castShadow=false;}
    this.signature=JSON.stringify(s.built);
  }
  syncNodes(s){
    for(const n of s.nodes){let group=this.nodes.get(n.id);if(!group){group=new T.Group();group.position.set(n.x,0,n.y);this.nodes.set(n.id,group);this.world.add(group);
      if(n.type==='fish'){const fish=this.model('fish');fish.scale.setScalar(1.8);fish.position.set(1.95,-.24,-.9);group.add(fish);group.userData.fish=fish;const spot=new T.Mesh(new T.RingGeometry(.38,.44,32),new T.MeshBasicMaterial({color:0xd1efdd,side:T.DoubleSide}));spot.rotation.x=-Math.PI/2;spot.position.y=.19;group.add(spot);}
      else if(n.type==='grain'){const soil=this.part(group,new T.BoxGeometry(2.6,.08,2.3),0x9e7f59,0,.04,0);group.userData.soil=soil;const plants=new T.Group();for(let i=0;i<8;i++){const m=this.model('grain');m.scale.setScalar(1.5);m.position.set((i%4-1.5)*.5,.1,(Math.floor(i/4)-.5)*1.0);plants.add(m);}group.add(plants);group.userData.crop=plants;}
      else if(n.type==='fruit')group.userData.crop=this.prop(group,'orchard',0,0,.9);
      else{const tray=this.part(group,new T.BoxGeometry(1.7,.12,1.4),n.type==='salt'?0xb6d6d2:0x6c9e8f,0,.05,0);group.userData.tray=tray;const crop=new T.Group();for(let i=0;i<5;i++){const m=this.model(n.type);m.position.set((i%3-1)*.45,.13,Math.floor(i/3)*.4-.2);crop.add(m);}group.add(crop);group.userData.crop=crop;}
    }
    if(group.userData.crop){group.userData.crop.visible=n.type==='fruit'||n.stock>0||n.watered;if(n.type==='grain')group.userData.crop.scale.y=.18+n.growth*.82;if(n.type==='fruit')group.userData.crop.scale.setScalar(.8+.2*n.growth);}
    if(group.userData.soil)group.userData.soil.material.color.setHex(n.watered?0x7e7358:0xaa8e65);
    if(group.userData.fish){const f=group.userData.fish;f.position.x=2.05+Math.sin(this.visualTime*1.7+n.x)*.15;f.rotation.y=Math.PI/2+Math.sin(this.visualTime)*.2;f.position.y=-.25+Math.sin(this.visualTime*3)*.035;}
    }
  }
  worldLabel(key,text,p,height=1.7){
    const mesh=this.label('life-'+key,text),units=(this.camera.right-this.camera.left)/innerWidth;mesh.position.set(p.x,height,p.y);mesh.quaternion.copy(this.camera.quaternion);mesh.scale.set(132*units/2.3,44*units/1.45,1);
    const q=mesh.position.clone().project(this.camera),x=(q.x+1)*innerWidth/2,y=(1-q.y)*innerHeight/2;mesh.visible=x>64&&x<innerWidth-64&&y>78&&y<innerHeight-190;
    if(mesh.visible)mesh.visible=![...document.querySelectorAll('.journey-context:not([hidden])')].some(e=>{const r=e.getBoundingClientRect();return x+66>r.left&&x-66<r.right&&y+22>r.top&&y-22<r.bottom;});return mesh;
  }
  render(s,dt=.016){
    if(!this.player)return;this.visualTime+=dt;this.frameCount++;if(this.signature!==JSON.stringify(s.built))this.buildFacilities(s);this.syncNodes(s);
    this.pose(this.player,{...s.player,motion:null},dt);this.player.position.y=this.theme==='coast'&&s.player.y< -2.3?.18:.04;
    const tool=this.player.userData.axe,hand=this.player.getObjectByName('hand-right'),working=s.work&&['fishing','harvest'].includes(s.work.type);
    if(working){if(tool.parent!==hand){hand.add(tool);tool.position.set(0,0,0);tool.rotation.set(this.theme==='coast'?.95:.5,0,0);}const j=this.player.userData.joints;j['arm-right'].rotation.x=s.work.type==='harvest'?-1.3+Math.sin(s.actionTime/.65*Math.PI)*1.6:-.65+Math.sin(s.actionTime*4)*.12;j['forearm-right'].rotation.x=-.55;j['arm-left'].rotation.x=-.35;j['forearm-left'].rotation.x=-.5;if(s.work.type==='harvest')j.torso.rotation.x=Math.sin(s.actionTime/.65*Math.PI)*.14;}
    else if(tool.parent!==this.holster){this.holster.add(tool);tool.position.set(0,0,0);tool.rotation.set(.1,0,.2);}tool.visible=true;
    const stack=this.player.userData.stack,key=JSON.stringify(s.player.bag);if(this.stackKey!==key){stack.clear();let h=0;for(const [type,count]of Object.entries(s.player.bag)){if(type==='water')continue;for(let i=0;i<Math.min(8,count);i++){const item=this.model(type);item.scale.setScalar(1.1);item.position.set(0,h,0);h+=['meal','basket','flour'].includes(type)?.30:.14;stack.add(item);}}this.stackKey=key;}
    this.footRing.position.set(s.player.x,this.player.position.y+.025,s.player.y);this.health(this.player,100);
    const follow=1-Math.exp(-dt*14);this.focus.x=lerp(this.focus.x,s.player.x,follow);this.focus.z=lerp(this.focus.z,s.player.y-1,follow);this.camera.position.copy(this.focus).add(new T.Vector3(21,29,29));this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
    this.pose(this.trader,{x:1.7,y:17.3,facing:-Math.PI*.7,moving:false},dt);this.worker.visible=!!s.built.porter;this.pose(this.worker,s.worker,dt);this.worker.userData.axe.visible=false;
    this.pose(this.sister,{x:-1.7,y:16.8,facing:-Math.PI*.35,moving:false},dt);this.sister.userData.joints['arm-right'].rotation.x=-.35+Math.sin(this.visualTime*2)*.10;
    for(const l of this.labels.values())l.mesh.visible=false;
    for(const id of facilityOrder(LIFE_STAGES[s.stage])){
      const p=LIFE_PADS[id],distance=Math.hypot(s.player.x-p.x,s.player.y-p.y);if(distance>6)continue;
      const built=s.built[id],cost=LIFE_STAGES[s.stage].plots[id];let text=built?FACILITY_NAMES[id]:`区画${plotLetter(LIFE_STAGES[s.stage],id)}\n現金 ${s.paid[id]||0}/${cost}`;
      if(s.machines[id]&&built)text+=`\n完成 ${s.machines[id].stock}`;this.worldLabel(id,text,{x:p.x,y:p.y+2},2.3);
      if(!built){let pad=this.pads.get(id);if(!pad){pad=new T.Mesh(new T.RingGeometry(.8,.87,40),new T.MeshBasicMaterial({color:0xe7b94e,side:T.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(p.x,.08,p.y);this.scene.add(pad);this.pads.set(id,pad);}pad.visible=true;}
    }
    for(const[id,pad]of this.pads)if(s.built[id])pad.visible=false;
    for(const [id,m]of Object.entries(s.machines))if(s.built[id])this.pile(id,RECIPES[m.recipe].output,m.stock,{x:lifeOutputPad(id).x,y:LIFE_PADS[id].y+1.3},.64);
    const n=s.nodes.filter(n=>Math.hypot(n.x-s.player.x,n.y-s.player.y)<3).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
    if(n&&s.work?.type!=='fishing'&&s.work?.type!=='harvest')this.worldLabel('node',n.type==='fish'?'釣り場\n魚の群れ':`${LIFE_ITEMS[n.type]}\n${n.stock?'収穫できる':n.watered?`成長 ${Math.round(n.growth*100)}%`:'水が必要'}`,{x:n.x,y:n.y-1},n.type==='fruit'?3.2:1.3);
    for(const wheel of this.wheels)wheel.rotation.z+=dt*(s.machines.mill?.time>0?1.4:.35);
    if(this.water){this.seaTime.value=this.visualTime;const p=this.water.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.55+this.visualTime*.9)*.045+Math.cos(p.getZ(i)*.45+this.visualTime*.7)*.035);p.needsUpdate=true;this.ship.visible=!!s.built.crew||!!s.built.ship;this.ship.position.y=Math.sin(this.visualTime)*.05;this.tradeBoat.position.x=-13-Math.sin(this.visualTime*.12)*3;this.tradeBoat.position.y=Math.sin(this.visualTime*1.3)*.06;}
    const target=this.waypoint,d=target?Math.hypot(target.x-s.player.x,target.y-s.player.y):0;this.guide.visible=d>2&&!s.completed;if(this.guide.visible){const dx=target.x-s.player.x,dy=target.y-s.player.y;this.guide.position.set(s.player.x+dx/d*1.4,.25,s.player.y+dy/d*1.4);this.guide.rotation.set(Math.PI/2,0,-Math.atan2(dx,dy));}
    for(const t of [...this.transfers]){t.time+=dt;const a=Math.min(1,t.time/.4);t.mesh.position.set(lerp(t.from.x,t.to.x,a),.8+Math.sin(a*Math.PI),lerp(t.from.y,t.to.y,a));if(a===1){this.scene.remove(t.mesh);this.transfers.splice(this.transfers.indexOf(t),1);}}
    for(const p of [...this.particles]){p.time+=dt;p.v.y-=dt*6;p.mesh.position.addScaledVector(p.v,dt);p.mesh.scale.setScalar(Math.max(0,1-p.time));if(p.time>=1){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(this.particles.indexOf(p),1);}}
    this.effect.render(this.scene,this.camera);
  }
  event(e){if(e.item==='cash')return;if(e.type==='pickup'&&!e.count)return;super.event(e);}
  reset(){this.signature=null;this.stackKey=null;for(const p of this.pads.values())p.visible=false;for(const {group}of this.stock.values())this.scene.remove(group);this.stock.clear();for(const n of this.nodes.values())this.world.remove(n);this.nodes.clear();for(const t of this.transfers)this.scene.remove(t.mesh);this.transfers=[];this.focus.set(0,0,7);}
  info(){return{...super.info(),revision:'journey-v1',costume:this.theme,stage:this.stage};}
}
