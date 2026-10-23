import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {canonicalizeProductionRig} from './production-rig.js';
import {SnowfrontRenderer} from './snowfront-renderer.js';
import {LIFE_STAGES,LIFE_PADS,LIFE_DEPOT,LIFE_ITEMS,RECIPES,FACILITY_NAMES,CONVEYOR_ROUTE,plotLetter,facilityOrder} from './life-config.js';
import {lifeOutputPad} from './life-state.js';
import {conveyorPosition} from './life-logistics.js';

const lerp=(a,b,t)=>a+(b-a)*t;
export class LifeRenderer extends SnowfrontRenderer{
  constructor(canvas,stage){
    super(canvas);this.stage=stage;this.theme=LIFE_STAGES[stage].theme;this.scene.remove(this.landscape.root,this.landscape.footprints,this.snow,this.landscape.ground);
    this.landscape.root.traverse(m=>m.geometry?.dispose());this.landscape.footprints.geometry.dispose();this.landscape.footprints.material.dispose();this.landscape.ground.geometry.dispose();
    this.world=new T.Group();this.scene.add(this.world);this.buildings=new T.Group();this.scene.add(this.buildings);this.nodes=new Map();this.pads=new Map();this.wheels=[];this.waveTime=0;
    const sky=this.theme==='coast'?0xbce6ed:0xc7e4d2;this.scene.background.setHex(sky);this.scene.fog.color.setHex(sky);this.scene.fog.near=70;this.scene.fog.far=145;
    this.sun.color.setHex(0xfff5dd);this.sun.intensity=1.8;
    const fill=new T.DirectionalLight(0xfff9ee,.65);fill.position.set(12,16,18);this.scene.add(fill);
    this.beltParcels=new T.Group();this.scene.add(this.beltParcels);this.fishingLines=new Map();
  }
  async load(){
    const {scene}=await new GLTFLoader().loadAsync(new URL('../assets/journey/journey.glb',import.meta.url).href);
    for(const root of scene.children){if(!root.userData.asset)continue;let skinned=false;root.traverse(n=>{if(n.isBone)n.name=n.name.replace(/[_.]\d+$/,'');if(n.isSkinnedMesh)skinned=true;});if(skinned)canonicalizeProductionRig(root);root.traverse(n=>{if(n.isMesh){n.material=this.palette;n.castShadow=n.receiveShadow=true;}});this.catalog.set(root.userData.asset.replace('journey-',''),root);}
    for(const role of ['player','worker','merchant','sister'])this.catalog.set(role,this.catalog.get(this.theme+'-'+role));
    this.catalog.set('axe',this.catalog.get(this.theme==='coast'?'rod':'hoe'));
    this.player=this.actor('player');this.scene.add(this.player);this.worker=this.actor('worker');this.worker.userData.axe.visible=false;this.scene.add(this.worker);this.trader=this.actor('merchant');this.trader.userData.axe.visible=false;this.scene.add(this.trader);
    this.sister=this.actor('sister');this.sister.scale.setScalar(.78);this.scene.add(this.sister);
    this.fisher=this.actor('worker');this.harvester=this.actor('worker');this.scene.add(this.fisher,this.harvester);
    this.holster=new T.Group();this.holster.position.set(.4,-.1,-.2);this.holster.rotation.z=-.5;this.player.getObjectByName('torso').add(this.holster);this.makeEnvironment();
    for(const actor of [this.worker,this.fisher,this.harvester]){actor.userData.material=this.palette.clone();actor.userData.material.transparent=true;actor.traverse(n=>{if(n.isMesh)n.material=actor.userData.material;});}
  }
  material(color){return new T.MeshToonMaterial({color,gradientMap:this.gradient});}
  part(root,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,this.material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.owned=true;root.add(m);return m;}
  prop(root,name,x,z,scale=1){const m=this.model(name);m.position.set(x,0,z);m.scale.setScalar(scale);root.add(m);return m;}
  instances(root,geometry,color,poses){const m=new T.InstancedMesh(geometry,this.material(color),poses.length),o=new T.Object3D();poses.forEach((p,i)=>{o.position.set(p.x,p.y??0,p.z);o.rotation.set(0,p.angle??0,0);o.scale.set(p.sx??1,p.sy??1,p.sz??1);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=m.receiveShadow=true;m.userData.owned=true;root.add(m);return m;}
  surface(kind){
    const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=kind==='grass'?'#91b97a':'#d5d7c6';x.fillRect(0,0,256,256);
    for(let i=0;i<1900;i++){const a=(Math.sin(i*12.9898)*43758.5453)%1,b=(Math.cos(i*7.31)*18273.1)%1;x.fillStyle=kind==='grass'?(i%2?'#779c6524':'#c5d6a52b'):(i%2?'#8e9e8b1a':'#fff8df38');x.fillRect(Math.abs(a)*256,Math.abs(b)*256,kind==='grass'?1:2,kind==='grass'?3:1);}
    if(kind==='stone'){x.strokeStyle='#899a8e55';x.lineWidth=2;for(let y=0;y<256;y+=64)for(let z=-64;z<256;z+=64){const offset=y%128?32:0;x.strokeRect(z+offset+3,y+3,58,58);x.fillStyle='#fffdf13c';x.fillRect(z+offset+5,y+5,54,2);}}
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='grass'?24:20,kind==='grass'?24:14);t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());return t;
  }
  groundPad(key,p,color=0xffffff){
    let pad=this.pads.get(key);if(!pad){pad=new T.Mesh(new T.RingGeometry(1.02,1.09,4,1,Math.PI/4),new T.MeshBasicMaterial({color,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));pad.rotation.x=-Math.PI/2;pad.position.set(p.x,.12,p.y);pad.userData.outlineParameters={visible:false};this.scene.add(pad);this.pads.set(key,pad);}pad.visible=true;return pad;
  }
  makeEnvironment(){
    const coast=this.theme==='coast';
    const land=this.part(this.world,new T.PlaneGeometry(90,coast?60:100),0xffffff,0,.015,coast?26:0);land.rotation.x=-Math.PI/2;land.castShadow=false;land.material.map=this.surface('grass');land.material.needsUpdate=true;
    const walk=this.part(this.world,new T.PlaneGeometry(coast?6.1:3.4,coast?26:40),coast?0xffffff:0xcebd92,0,.028,coast?8:1);walk.rotation.x=-Math.PI/2;walk.castShadow=false;if(coast){walk.material.map=this.surface('stone');walk.material.map.repeat.set(4,16);walk.material.needsUpdate=true;for(const z of [0,5,12,15.3]){const cross=this.part(this.world,new T.PlaneGeometry(30,2.5),0xffffff,0,.03,z);cross.rotation.x=-Math.PI/2;cross.castShadow=false;cross.material.map=this.surface('stone');cross.material.map.repeat.set(18,2);cross.material.needsUpdate=true;}}
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
    this.prop(this.world,'packing',LIFE_DEPOT.x,LIFE_DEPOT.y+1.9,.85);
    const curbs=[],tufts=[],flowers=[];
    for(let i=0;i<38;i++){const z=-18+i;for(const side of [-1,1]){curbs.push({x:side*3.1,y:.085,z,sx:.18,sy:.17,sz:.88});if(!coast||z>1)for(let j=0;j<3;j++)tufts.push({x:side*(13.9+j*.22),y:.10,z:z+.19*j,sx:.12,sy:.18+(i%3)*.045,sz:.13,angle:i*.8});}}
    if(!coast){this.instances(this.world,new T.BoxGeometry(1,1,1),0xd1d5bb,curbs);for(let i=0;i<90;i++)flowers.push({x:(i%2?1:-1)*(13.6+Math.sin(i)*.5),y:.22,z:-16+(i%30)*1.07,sx:.10,sy:.07,sz:.1});}
    if(tufts.length)this.instances(this.world,new T.ConeGeometry(1,1,3),0x639460,tufts);
    if(flowers.length)this.instances(this.world,new T.SphereGeometry(1,6,4),0xf1d379,flowers);
    const ropes=[];if(coast)for(const x of [-9,-3,3,9])for(const side of [-1,1])for(let z=-5;z> -15;z-=3){const points=[new T.Vector3(x+side*1.34,.83,z),new T.Vector3(x+side*1.34,.69,z-1.5),new T.Vector3(x+side*1.34,.83,z-3)];const curve=new T.CatmullRomCurve3(points);const rope=this.part(this.world,new T.TubeGeometry(curve,8,.025,5,false),0xe4d7b5);ropes.push(rope);}
    this.groundPad('market',LIFE_PADS.market,0xfff2c1);this.groundPad('depot',LIFE_DEPOT,0xc8e5db);if(!coast)this.groundPad('well',LIFE_PADS.water,0xc8edf1);
  }
  buildFacilities(s){
    this.buildings.traverse(m=>{if(m.userData.owned){m.geometry.dispose();m.material.dispose();}});this.buildings.clear();this.wheels=[];
    for(const [id,built]of Object.entries(s.built)){
      if(!built)continue;const p=LIFE_PADS[id],asset={kitchen:'oven',bakery:'oven',mill:'mill',preserve:'preserve',processor:'processor',dryer:'dryer',canner:'canner',packing:'packing'}[id];
      if(asset){this.part(this.buildings,new T.BoxGeometry(3.4,.12,3.25),0xe5deca,p.x,.08,p.y+2.4);const model=this.prop(this.buildings,asset,p.x,p.y+2.4,1);if(id==='mill'){const wheel=this.prop(this.buildings,'wheel',p.x-1.6,p.y+2.4,1);wheel.position.y=1.2;wheel.rotation.y=Math.PI/2;this.wheels.push(wheel);}this.prop(this.buildings,'packing',lifeOutputPad(id).x,p.y+1.3,.42);}
      if(id==='crew'||id==='harvester'||id==='porter')this.prop(this.buildings,'packing',p.x,p.y+2,.65);
      if(id==='tool')this.prop(this.buildings,'processor',p.x,p.y+1.9,.65);
      if(id==='community'){for(const [i,x]of [-5,0,5].entries()){const h=this.prop(this.buildings,'house',x,22,1.15);h.rotation.y=(i-1)*.12;}for(let i=0;i<7;i++)this.part(this.buildings,new T.ConeGeometry(.15,.35,3),[0xe5b948,0xd38370,0x5d9b9b][i%3],(i-3)*.8,3.3,19);}
    }
    if(s.built.line){
      for(let i=1;i<CONVEYOR_ROUTE.length;i++){const a=CONVEYOR_ROUTE[i-1],b=CONVEYOR_ROUTE[i],d=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.x-a.x,b.y-a.y);for(let n=0;n<=d;n+=.36){const x=lerp(a.x,b.x,n/d),z=lerp(a.y,b.y,n/d),deck=this.part(this.buildings,new T.BoxGeometry(.72,.12,.32),0x527a80,x,1,z);deck.rotation.y=angle;if(Math.round(n/.36)%5===0)for(const side of [-1,1])this.part(this.buildings,new T.CylinderGeometry(.045,.045,.94,8),0xa0b2ad,x+Math.cos(angle)*side*.3,.48,z-Math.sin(angle)*side*.3);}for(const side of [-1,1]){const rail=this.part(this.buildings,new T.BoxGeometry(.06,.14,d),0xc3cec5,(a.x+b.x)/2+Math.cos(angle)*side*.4,1.12,(a.y+b.y)/2-Math.sin(angle)*side*.4);rail.rotation.y=angle;}}
    }
    if(s.built.irrigation){for(const x of [-7,7]){const canal=this.part(this.buildings,new T.PlaneGeometry(.36,19),0x68b5c2,x,.048,-6.5);canal.rotation.x=-Math.PI/2;canal.castShadow=false;}const bridge=this.part(this.buildings,new T.PlaneGeometry(15,.4),0x68b5c2,0,.05,1.6);bridge.rotation.x=-Math.PI/2;bridge.castShadow=false;}
    if(s.built.mill){const canal=this.part(this.buildings,new T.PlaneGeometry(10,.75),0x68b5c2,-13.2,.055,7.4);canal.rotation.x=-Math.PI/2;canal.castShadow=false;for(const z of [6.95,7.85])this.part(this.buildings,new T.BoxGeometry(10,.18,.13),0xc9c9ae,-13.2,.08,z);}
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
  workPose(root,p,type,time,dt){
    this.pose(root,{...p,motion:null},dt);const j=root.userData.joints;j.torso.rotation.x=0;j['arm-left'].rotation.z=0;
    const tool=root.userData.axe;if(!tool)return;
    if(type==='fishing'){
      const period=p===this.currentPlayer?(this.currentTool===2?.8:1.25):2.8,phase=(time%period)/period;
      const cast=phase<.28?Math.sin(phase/.28*Math.PI):0;
      j['arm-right'].rotation.x=-.72-cast*.95;j['forearm-right'].rotation.x=-.42+cast*.22;j['arm-left'].rotation.x=-.75;
      j['forearm-left'].rotation.x=-.9+Math.sin(phase*Math.PI*10)*.22;j['forearm-left'].rotation.z=Math.cos(phase*Math.PI*10)*.12;
      j.torso.rotation.x=.06+cast*.08;j.head.rotation.x=.09;tool.rotation.set(.75-cast*.4,0,.05);tool.visible=true;
      let line=this.fishingLines.get(root.uuid);if(!line){line=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:13},()=>new T.Vector3())),new T.LineBasicMaterial({color:0xe9f1d9,transparent:true,opacity:.85}));line.userData.outlineParameters={visible:false};const bobber=this.part(this.scene,new T.SphereGeometry(.07,8,6),0xdf7060);this.scene.add(line);line.userData.bobber=bobber;this.fishingLines.set(root.uuid,line);}
      root.updateMatrixWorld(true);const tip=tool.localToWorld(new T.Vector3(0,1.65,.25)),end=new T.Vector3(p.x+2.1,-.12,p.y-.4),positions=line.geometry.attributes.position;
      for(let i=0;i<13;i++){const a=i/12;positions.setXYZ(i,lerp(tip.x,end.x,a),lerp(tip.y,end.y,a)-Math.sin(a*Math.PI)*.20,lerp(tip.z,end.z,a));}positions.needsUpdate=true;line.visible=true;line.userData.bobber.visible=true;line.userData.bobber.position.copy(end);line.userData.bobber.position.y+=Math.sin(this.visualTime*6)*.035;
    }else if(type==='harvest'){
      const swing=Math.sin(time/.75*Math.PI*2);j['arm-right'].rotation.x=-1.2+swing*.95;j['forearm-right'].rotation.x=-.5;j['arm-left'].rotation.x=-.6+swing*.2;j.torso.rotation.x=.12+Math.max(0,swing)*.18;tool.rotation.set(.5,0,0);tool.visible=true;
    }else{j.head.rotation.x=0;if(root!==this.player)tool.visible=false;}
  }
  workerCargo(root,w){
    const key=`${w.item}:${w.load}`;if(root.userData.cargoKey===key)return;root.userData.cargoKey=key;root.userData.stack.clear();if(!w.item)return;
    for(let i=0;i<Math.min(8,w.load);i++){const item=this.model(w.item);item.position.set((i%2-.5)*.2,Math.floor(i/2)*.2,0);item.scale.setScalar(.9);root.userData.stack.add(item);}
  }
  blink(root){
    const t=(this.visualTime+root.id*.17)%4.3,value=t<.17?Math.sin(t/.17*Math.PI):0;
    root.traverse(n=>{const i=n.morphTargetDictionary?.Blink;if(i!==undefined)n.morphTargetInfluences[i]=value;});
  }
  render(s,dt=.016){
    if(!this.player)return;this.visualTime+=dt;this.frameCount++;if(this.signature!==JSON.stringify(s.built))this.buildFacilities(s);this.syncNodes(s);
    for(const line of this.fishingLines.values()){line.visible=false;line.userData.bobber.visible=false;}
    const tool=this.player.userData.axe,hand=this.player.getObjectByName('hand-right'),working=s.work&&['fishing','harvest'].includes(s.work.type);
    if(working&&tool.parent!==hand){hand.add(tool);tool.position.set(0,0,0);}
    this.currentPlayer=s.player;this.currentTool=s.tool;this.workPose(this.player,s.player,s.work?.type,s.actionTime,dt);this.player.position.y=this.theme==='coast'&&s.player.y< -2.3?.18:.04;
    if(working){if(tool.parent!==hand){hand.add(tool);tool.position.set(0,0,0);}}
    else if(tool.parent!==this.holster){this.holster.add(tool);tool.position.set(0,0,0);tool.rotation.set(.1,0,.2);}tool.visible=true;
    const stack=this.player.userData.stack,key=JSON.stringify(s.player.bag);if(this.stackKey!==key){stack.clear();let h=0;for(const [type,count]of Object.entries(s.player.bag)){if(type==='water')continue;for(let i=0;i<Math.min(8,count);i++){const item=this.model(type);item.scale.setScalar(1.1);item.position.set(0,h,0);h+=['meal','basket','flour'].includes(type)?.30:.14;stack.add(item);}}this.stackKey=key;}
    this.footRing.position.set(s.player.x,this.player.position.y+.025,s.player.y);this.health(this.player,s.player.energy);this.player.userData.health.userData.fill.material.color.setHex(s.player.energy<20?0xe7a759:0xdcc76c);
    if(!this.player.userData.health.userData.caption){const c=document.createElement('canvas');c.width=128;c.height=40;const x=c.getContext('2d');x.fillStyle='#34474c';x.font='700 27px system-ui';x.textAlign='center';x.fillText('体力',64,31);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const text=new T.Mesh(new T.PlaneGeometry(.6,.2),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));text.position.set(0,.22,.02);this.player.userData.health.add(text);this.player.userData.health.userData.caption=text;}
    const follow=1-Math.exp(-dt*14);this.focus.x=lerp(this.focus.x,s.player.x,follow);this.focus.z=lerp(this.focus.z,s.player.y-1,follow);this.camera.position.copy(this.focus).add(new T.Vector3(21,29,29));this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
    this.pose(this.trader,{x:1.7,y:17.3,facing:-Math.PI*.7,moving:false},dt);
    for(const [root,w,built]of [[this.worker,s.worker,s.built.porter],[this.fisher,s.fisher,s.built.crew],[this.harvester,s.harvester,s.built.harvester]]){
      root.visible=!!built;if(!built)continue;this.workPose(root,w,s.automationEnabled?(w.phase==='fishing'?'fishing':w.phase==='harvest'?'harvest':null):null,w.timer,dt);root.position.y=this.theme==='coast'&&w.y< -2.3?.18:.04;this.workerCargo(root,w);
      root.userData.material.opacity=Math.hypot(w.x-s.player.x,w.y-s.player.y)<1.4?.4:1;
    }
    this.pose(this.sister,{x:-1.7,y:16.8,facing:-Math.PI*.35,moving:false},dt);this.sister.userData.joints['arm-right'].rotation.x=-.35+Math.sin(this.visualTime*2)*.10;
    for(const root of [this.player,this.sister,this.trader,this.worker,this.fisher,this.harvester])if(root.visible)this.blink(root);
    for(const l of this.labels.values())l.mesh.visible=false;
    this.groundPad('market',LIFE_PADS.market,0xfff2c1);this.groundPad('depot',LIFE_DEPOT,0xc8e5db);if(this.theme==='farm')this.groundPad('well',LIFE_PADS.water,0xc8edf1);
    for(const id of facilityOrder(LIFE_STAGES[s.stage])){
      const p=LIFE_PADS[id],distance=Math.hypot(s.player.x-p.x,s.player.y-p.y);if(distance>6)continue;
      const built=s.built[id],cost=LIFE_STAGES[s.stage].plots[id];let text=built?FACILITY_NAMES[id]:`区画${plotLetter(LIFE_STAGES[s.stage],id)}\n現金 ${s.paid[id]||0}/${cost}`;
      if(s.machines[id]&&built)text+=`\n完成 ${s.machines[id].stock}`;this.worldLabel(id,text,{x:p.x,y:p.y+2},2.3);
      if(!built)this.groundPad('invest-'+id,p,0xe7b94e);
    }
    for(const[id,pad]of this.pads)if(id.startsWith('invest-')&&s.built[id.slice(7)])pad.visible=false;
    for(const [id,m]of Object.entries(s.machines))if(s.built[id]){this.groundPad('input-'+id,LIFE_PADS[id]);this.groundPad('output-'+id,lifeOutputPad(id),0x93dcb6);this.pile(id,RECIPES[m.recipe].output,m.stock,{x:lifeOutputPad(id).x,y:LIFE_PADS[id].y+1.3},.64);}
    for(const [type,count]of Object.entries(s.store))if(count>0||this.stock.has('store-'+type))this.pile('store-'+type,type,count,{x:LIFE_DEPOT.x+(type==='fish'?-.3:type==='grain'?-.6:.6),y:LIFE_DEPOT.y+1.6},.9);
    while(this.beltParcels.children.length<s.conveyor.length){const item=this.model('fillet');item.scale.setScalar(1.2);this.beltParcels.add(item);}this.beltParcels.children.forEach((item,i)=>{item.visible=i<s.conveyor.length;if(item.visible){const p=conveyorPosition(s.conveyor[i].progress);item.position.set(p.x,1.09,p.y);}});
    if(Math.hypot(s.player.x-LIFE_DEPOT.x,s.player.y-LIFE_DEPOT.y)<5)this.worldLabel('depot','共同倉庫\n'+Object.entries(s.store).filter(([,n])=>n).map(([k,n])=>`${LIFE_ITEMS[k]} ${n}`).join(' · '),{x:LIFE_DEPOT.x,y:LIFE_DEPOT.y+2},2.7);
    if(s.player.energy<40)this.worldLabel('energy',`体力 ${Math.round(s.player.energy)}%\n井戸・市場で休憩`,{x:s.player.x,y:s.player.y},2.9);
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
  info(){return{...super.info(),revision:'journey-v2',costume:this.theme,stage:this.stage};}
}
