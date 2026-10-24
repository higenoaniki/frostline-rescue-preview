import * as T from './vendor/three.module.js';
import {GLTFLoader}from'./vendor/GLTFLoader.js';
import {clone as cloneSkeleton}from'./vendor/SkeletonUtils.js';
import {canonicalizeProductionRig}from'./production-rig.js';
import {mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import {PADS,BUILD_COST,investmentCost,buildAvailable,isSafe}from'./snowfront-state.js';
import {campPerimeter} from './camp-perimeter.js';
import {SnowLandscape,snowHeight} from './snow-landscape.js';
import {hudOverlaps} from './world-labels.js';
import {createGameRenderer} from './webgl-context.js';
import {readDisplayMode} from './display-settings.js';
import {paintedMaterial,softStudioLight} from './painted-material.js';
import {interactionPad} from './interaction-pad.js';

const lerp=(a,b,t)=>a+(b-a)*t;
const names={raw:'獲物を投入',roast:'焼き肉回収',sale:'販売・納品',cash:'売上回収',weapon:'斧を強化',east:'東区画',west:'西区画',smoker:'燻製工房',smoked:'荷箱回収',collector:'回収人',hunter:'自動狩り台',porter:'運搬係'};
const placement={grill:{x:-4,y:3},table:{x:-1.5,y:3.9},trade:{x:3.6,y:16},weapon:{x:-4,y:12},smoker:{x:13,y:4.3},collector:{x:13,y:14.5},hunter:{x:-13,y:3.5},porter:{x:-13,y:14.5}};
export class SnowfrontRenderer{
  constructor(canvas){
    this.canvas=canvas;this.scene=new T.Scene();this.scene.background=new T.Color(0xe7eef3);this.scene.fog=new T.Fog(0xe7eef3,48,105);
    this.renderer=createGameRenderer(canvas,T.WebGLRenderer,{reduced:readDisplayMode()==='low'});
    this.quality=this.renderer.userData.gpuFallback?'low':readDisplayMode();
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.NeutralToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=this.quality!=='low';softStudioLight(this.scene,this.renderer);
    this.effect={enabled:true,render:(scene,camera)=>this.renderer.render(scene,camera)};
    this.camera=new T.OrthographicCamera(-15,15,15,-15,.1,150);this.focus=new T.Vector3(0,0,6);this.visualTime=0;this.frameCount=0;
    this.scene.add(new T.HemisphereLight(0xe8f3ff,0x879b97,2.1));
    this.sun=new T.DirectionalLight(0xffedcf,3.4);this.sun.position.set(-15,30,-8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:38,bottom:-38,near:.5,far:90});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.035;this.scene.add(this.sun);
    this.palette=paintedMaterial();this.catalog=new Map();this.actors=new Map();this.loot=new Map();this.labels=new Map();this.facilities=new Map();this.stock=new Map();this.transfers=[];this.particles=[];
    this.staticRoot=new T.Group();this.camp=new T.Group();this.gates=new T.Group();this.scene.add(this.staticRoot,this.camp,this.gates);
    this.groundMat=paintedMaterial({color:0xf0f3f5,vertexColors:false,roughness:.94});
    const ground=new T.Mesh(new T.PlaneGeometry(160,160),this.groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.outlineParameters={visible:false};this.scene.add(ground);
    ground.rotation.x=0;this.landscape=new SnowLandscape(this.scene,ground);
    this.footRing=new T.Mesh(new T.RingGeometry(.55,.65,48),new T.MeshBasicMaterial({color:0x49c4bd,transparent:true,opacity:.7,depthWrite:false}));this.footRing.rotation.x=-Math.PI/2;this.footRing.userData.outlineParameters={visible:false};this.scene.add(this.footRing);
    this.guide=new T.Mesh(new T.ConeGeometry(.2,.6,3),new T.MeshBasicMaterial({color:0x269ab8}));this.guide.rotation.x=Math.PI/2;this.guide.userData.outlineParameters={visible:false};this.scene.add(this.guide);
    const snow=new Float32Array(96*3);for(let i=0;i<96;i++){snow[i*3]=(Math.sin(i*12.4)*.5)*70;snow[i*3+1]=(i*.29)%15;snow[i*3+2]=Math.cos(i*3.8)*35;}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(snow,3));this.snow=new T.Points(geo,new T.PointsMaterial({color:0xffffff,size:.075,transparent:true,opacity:.8,depthWrite:false}));this.snow.userData.outlineParameters={visible:false};this.scene.add(this.snow);
    this.resize();
  }
  async load(){
    const {scene}=await new GLTFLoader().loadAsync(new URL('../assets/snowfront/snowfront.glb',import.meta.url).href);
    for(const root of scene.children){
      if(!root.userData.asset)continue;
      let skinned=false;root.traverse(n=>{if(n.isBone)n.name=n.name.replace(/[_.]\d+$/,'');if(n.isSkinnedMesh)skinned=true;});
      if(skinned)canonicalizeProductionRig(root);
      root.traverse(n=>{if(n.isMesh){n.material=this.palette;n.castShadow=n.receiveShadow=true;}});this.catalog.set(root.userData.asset.replace('snowfront-',''),root);
    }
    this.player=this.actor('player');this.scene.add(this.player);this.chef=this.actor('chef');this.chef.position.set(-4,0,1.7);this.scene.add(this.chef);
    this.trader=this.actor('merchant');this.scene.add(this.trader);
    for(const [id,model]of [['grill','grill'],['table','table'],['trade','trade'],['weapon','weapon']]){const p=placement[id],mesh=this.model(model);mesh.position.set(p.x,0,p.y);this.facilities.set(id,mesh);this.scene.add(mesh);}
    const prep=this.model('table');prep.position.set(-6.4,0,3.3);prep.scale.setScalar(.8);this.facilities.set('prep',prep);this.scene.add(prep);
    this.grillSteaks=[];for(let i=0;i<3;i++){const mesh=this.model('roast');mesh.position.set(-4+(i-1)*.38,1.12,3);this.grillSteaks.push(mesh);this.scene.add(mesh);}
    this.buildScenery();
  }
  model(name){const source=this.catalog.get(name);if(!source)throw Error('Missing snowfront asset: '+name);return source.clone(true);}
  actor(name){
    const source=this.catalog.get(name);if(!source)throw Error('Missing snowfront actor: '+name);const root=cloneSkeleton(source);
    root.userData.joints={};root.traverse(n=>{if(n.isBone)root.userData.joints[n.name]=n;});
    root.userData.clock=0;root.userData.stack=new T.Group();root.getObjectByName('torso').add(root.userData.stack);root.userData.stack.position.set(0,.38,-.52);
    if(['player','worker','merchant','chef'].includes(name)){
      const axe=this.model('axe');root.getObjectByName('hand-right').add(axe);axe.rotation.x=-.3;axe.visible=name==='player';root.userData.axe=axe;
    }
    return root;
  }
  resize(){
    const w=innerWidth,h=innerHeight,aspect=w/h,span=Math.max(20,12/aspect);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.quality==='low'?1.1:1.7));this.renderer.setSize(w,h,false);
    Object.assign(this.camera,{left:-span*aspect/2,right:span*aspect/2,top:span/2,bottom:-span/2});this.camera.updateProjectionMatrix();
  }
  setQuality(mode){this.quality=this.renderer.userData.gpuFallback?'low':['auto','detail','low'].includes(mode)?mode:'auto';const shadows=this.quality!=='low';this.effect.enabled=shadows;this.renderer.shadowMap.enabled=shadows;this.sun.castShadow=shadows;this.renderer.shadowMap.needsUpdate=true;this.scene.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material])m.needsUpdate=true;}});this.resize();}
  reset(){
    this.landscape.reset();
    for(const mesh of this.actors.values()){this.scene.remove(mesh);if(mesh.userData.health)this.scene.remove(mesh.userData.health);}this.actors.clear();
    for(const mesh of this.loot.values())this.scene.remove(mesh);this.loot.clear();
    for(const {group}of this.stock.values())this.scene.remove(group);this.stock.clear();
    for(const [id,mesh]of this.facilities)if(!['grill','table','trade','weapon','prep'].includes(id)){this.scene.remove(mesh);this.facilities.delete(id);}
    for(const t of this.transfers){this.scene.remove(t.mesh);if(t.bolt){t.mesh.geometry.dispose();t.mesh.material.dispose();}}this.transfers=[];
    for(const p of this.particles){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}this.particles=[];
    this.player.userData.stackKey=null;this.campRevision=null;this.focus.set(0,0,6);if(this.sled){this.scene.remove(this.sled);this.sled=null;}
  }
  mergeStatic(group){
    group.updateMatrixWorld(true);const geos=[];
    group.traverse(n=>{if(n.isMesh){const g=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone();g.applyMatrix4(n.matrixWorld);geos.push(g);}});
    const merged=mergeGeometries(geos);const mesh=new T.Mesh(merged,this.palette);mesh.castShadow=mesh.receiveShadow=true;geos.forEach(g=>g.dispose());return mesh;
  }
  buildScenery(){
    const group=new T.Group();
    for(let i=0;i<30;i++){
      const tree=this.model(i%3===0?'stump':'pine'),side=i%2?1:-1;tree.position.set(side*(19+Math.sin(i*3.2)*4),0,-3-Math.floor(i/2)*2.2);tree.scale.setScalar(.85+(i%4)*.12);group.add(tree);
    }
    for(let i=0;i<18;i++){const rock=this.model('rock');rock.position.set(Math.sin(i*9.3)*23,0,-3-(i%9)*3);rock.rotation.y=i;rock.scale.setScalar(.5+(i%3)*.2);group.add(rock);}
    this.staticRoot.add(this.mergeStatic(group));
    const path=new T.Mesh(new T.PlaneGeometry(65,3.8),paintedMaterial({color:0xdbe5eb,vertexColors:false}));path.rotation.x=-Math.PI/2;path.position.set(0,.012,20);path.receiveShadow=true;path.userData.outlineParameters={visible:false};this.scene.add(path);
  }
  buildCamp(s,options={}){
    for(const group of [this.camp,this.gates])group.traverse(n=>{if(n.isMesh){n.geometry.dispose();if(n.material!==this.palette)n.material.dispose();}});
    this.camp.clear();this.gates.clear();this.gateLeaves=[];this.serviceLeaves=[];
    const layout=campPerimeter({min:s.built.west?-20:-8,max:s.built.east?20:8,...options}),{min,max}=layout;
    this.perimeter=layout;
    const floor=new T.Mesh(new T.BoxGeometry(max-min,.15,17),paintedMaterial({color:0xd9b084,vertexColors:false,roughness:.9}));floor.position.set((min+max)/2,.0,8.5);floor.receiveShadow=true;floor.userData.outlineParameters={visible:false};this.camp.add(floor);
    const pickets=new T.Group();
    const add=(x,y)=>{const p=this.model('picket');p.position.set(x,0,y);pickets.add(p);};
    for(const p of layout.pickets)add(p.x,p.y);
    this.camp.add(this.mergeStatic(pickets));
    const gate=(x,width,service=false)=>{
      for(const side of [-1,1]){
        const pivot=new T.Group();pivot.position.set(x+side*width/2,0,0);this.gates.add(pivot);
        const geometry=new T.BoxGeometry(width/2-.03,1.12,.12),mat=paintedMaterial({color:service?0x6996a0:0xbf6e40,vertexColors:false});
        const panel=new T.Mesh(geometry,mat);panel.position.set(-side*width/4,.58,0);panel.castShadow=true;pivot.add(panel);
        const rail=new T.Mesh(new T.BoxGeometry(width/2,.09,.17),paintedMaterial({color:0xe9bd67,vertexColors:false}));rail.position.copy(panel.position);rail.position.y=1.15;pivot.add(rail);
        (service?this.serviceLeaves:this.gateLeaves).push({pivot,side});
      }
    };
    for(const g of layout.gates)gate(g.x,g.width,g.service);
    this.campRevision=String(s.built.east)+String(s.built.west);
  }
  label(key,text,color=0xffffff){
    let item=this.labels.get(key);
    if(!item){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=176;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
      const mesh=new T.Mesh(new T.PlaneGeometry(2.3,1.45),new T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide}));mesh.userData.outlineParameters={visible:false};mesh.renderOrder=2;this.scene.add(mesh);item={canvas,texture,mesh,text:null};this.labels.set(key,item);
    }
    if(item.text!==text){
      const c=item.canvas.getContext('2d');c.clearRect(0,0,512,176);c.lineWidth=6;c.strokeStyle='#fff';c.fillStyle='rgba(66,80,86,.52)';c.beginPath();c.roundRect(8,8,496,160,20);c.fill();c.stroke();
      const lines=text.split('\n');c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.shadowColor='rgba(35,44,49,.4)';c.shadowBlur=3;lines.forEach((line,i)=>{c.font=`800 ${i===1&&line.length<10?72:60}px system-ui`;c.fillText(line,256,lines.length===1?88:49+i*71,470);});item.texture.needsUpdate=true;item.text=text;
    }
    item.mesh.material.color.setHex(color);return item.mesh;
  }
  updatePads(s){
    const uiBottom=(document.querySelector('.sf-objective')?.getBoundingClientRect().bottom??168)+27;
    const keys=['raw','roast','sale','cash','weapon','east','west','smoker','smoked','collector','hunter','porter'];
    for(const key of keys){
      const p=PADS[key];let visible=true,text=names[key],color=0xffffff;
      if(key==='raw')text+='\n'+s.rawStock;
      if(key==='roast')text+='\n'+s.roastStock;
      if(key==='sale')text='交易所\n'+(s.mission>=4?`荷箱 ${s.delivered}/8`:`焼肉1食 → 6`);
      if(key==='cash'){text+='\n'+s.cashStock;color=0xc4ff9d;}
      if(key==='weapon'){text=s.weapon===3?'斧 Lv.3\nMAX':`斧 Lv.${s.weapon} → ${s.weapon+1}\n${s.paid.weapon||0} / ${investmentCost(s,'weapon')}`;}
      if(Object.hasOwn(BUILD_COST,key)){
        if(s.built[key])visible=false;
        else if(!buildAvailable(s,key))visible=false;
        else{text=`?\n${s.paid[key]||0} / ${BUILD_COST[key]}`;color=0xffecaa;}
      }
      if(key==='smoker'&&s.built.smoker){visible=true;text=`燻製工房\n焼肉 ${s.smokeRaw} / 毛皮 ${s.smokeFur}`;color=0xffffff;}
      if(key==='smoked'){visible=s.built.smoker;text+='\n'+s.crateStock;}
      const anchors={raw:{x:-6.4,y:3.3},roast:{x:-1.5,y:3.9},sale:{x:3.6,y:16},cash:{x:6.7,y:13.5}};
      const a=anchors[key]??placement[key]??p,mesh=this.label(key,text,color);
      const stockCount=key==='raw'?s.rawStock:key==='roast'?s.roastStock:0;
      mesh.position.set(a.x,key==='sale'?3.4:key==='cash'?1.4:stockCount>0?2.25+Math.ceil(Math.min(24,stockCount)/2)*.145:2.8,a.y);mesh.quaternion.copy(this.camera.quaternion);
      const units=(this.camera.right-this.camera.left)/innerWidth;
      mesh.scale.set(124*units/2.3,46*units/1.45,1);
      const screen=mesh.position.clone().project(this.camera),sx=(screen.x+1)*innerWidth/2,sy=(1-screen.y)*innerHeight/2;
      const close=Math.hypot(p.x-s.player.x,p.y-s.player.y)<1.7||(['sale','cash'].includes(key)&&Math.hypot(PADS.sale.x-s.player.x,PADS.sale.y-s.player.y)<1.7);
      mesh.visible=visible&&!close&&sx>70&&sx<innerWidth-70&&sy>uiBottom&&sy<innerHeight-115&&screen.z>-1&&screen.z<1;
      let pad=this.labels.get(key).pad;
      if(!pad){pad=interactionPad(['roast','smoked','cash'].includes(key)?'output':key==='sale'?'market':'input');this.scene.add(pad);this.labels.get(key).pad=pad;}
      pad.position.set(p.x,.11,p.y);pad.visible=visible;
    }
    for(const id of ['smoker','collector','hunter','porter']){
      if(!s.built[id]||this.facilities.has(id))continue;
      const p=placement[id],mesh=this.model(id==='collector'||id==='porter'?'table':id);mesh.position.set(p.x,0,p.y);if(id==='hunter')mesh.rotation.y=Math.PI;mesh.userData.birth=this.visualTime;this.facilities.set(id,mesh);this.scene.add(mesh);
    }
    for(const mesh of this.facilities.values())if(mesh.userData.birth!==undefined){const t=Math.min(1,(this.visualTime-mesh.userData.birth)/.6);mesh.scale.setScalar(t<1?1-Math.cos(t*Math.PI/2)*Math.exp(-t*3):1);}
  }
  pose(root,p,dt,kind='human'){
    root.userData.clock+=dt*(p.moving?(kind==='human'?14:9):1.3);const clock=root.userData.clock,j=root.userData.joints;root.position.set(p.x,0,p.y);
    const desired=Math.PI/2-(p.motion?.angle??p.facing);
    if(p.motion?.spin)root.rotation.y=desired+Math.min(1,p.motion.time/.44)*Math.PI*2;
    else root.rotation.y+=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y))*Math.min(1,dt*15);
    root.position.y=p.moving?Math.abs(Math.sin(clock))*.055:Math.sin(clock)*.012;
    if(kind==='human'){
      for(const side of ['left','right']){
        const swing=p.moving?Math.sin(clock)*(side==='left'?1:-1)*.8:0;
        j['leg-'+side].rotation.x=swing;j['shin-'+side].rotation.x=Math.max(0,-swing)*.55;
        j['arm-'+side].rotation.x=-swing*.55;j['forearm-'+side].rotation.x=-.12;
      }
      j.torso.rotation.z=p.moving?Math.sin(clock)*.025:0;
      if(p.motion){const t=Math.min(1,p.motion.time/.44);j['arm-right'].rotation.x=t<.3?lerp(-.15,-2.3,t/.3):lerp(-2.3,.8,(t-.3)/.7);j['forearm-right'].rotation.x=-.35;j['arm-right'].rotation.z=-.3;}
      else j['arm-right'].rotation.z=.04;
    }else{
      for(let i=0;i<4;i++)j['paw-'+i].rotation.x=p.moving?Math.sin(clock+(i===0||i===3?0:Math.PI))*.48:0;
      j.torso.rotation.x=0;j.head.rotation.x=0;
      if(p.motion){const t=p.motion.time;j.torso.rotation.x=t<.78?-Math.sin(t/.78*Math.PI/2)*.35:Math.sin((t-.78)/.42*Math.PI)*.25;j.head.rotation.x=t<.78?-.2:.35;for(const i of [2,3])j['paw-'+i].rotation.x=t<.78?-t*.9:Math.sin((t-.78)/.42*Math.PI)*.7;}
    }
  }
  stacks(root,bag,cash=0){
    const key=JSON.stringify([bag,cash]);if(root.userData.stackKey===key)return;root.userData.stackKey=key;const stack=root.userData.stack;stack.clear();let y=0;
    for(const type of ['raw','roast','fur','crate'])for(let i=0;i<Math.min(bag[type]||0,22);i++){
      const mesh=this.model(type);mesh.scale.setScalar(1.35);mesh.position.set(0,y,0);mesh.rotation.y=(i%2)*.1;stack.add(mesh);y+=type==='crate'?.61:type==='fur'?.22:.145;
    }
    for(let i=0;i<Math.min(22,Math.ceil(cash/6));i++){const mesh=this.model('cash');mesh.position.set(.68,i*.115,-.04);mesh.scale.setScalar(1.2);stack.add(mesh);}
  }
  pile(id,type,count,p,height=1.2){
    const old=this.stock.get(id);if(old?.count===count)return;
    if(old)this.scene.remove(old.group);const group=new T.Group();const shown=Math.min(24,count);
    const spacing=type==='crate'?.85:.75,step=type==='crate'?.61:type==='fur'?.22:.145;
    for(let i=0;i<shown;i++){const mesh=this.model(type);mesh.scale.setScalar(1.35);mesh.position.set((i%2)*spacing-spacing/2,Math.floor(i/2)*step,0);group.add(mesh);}
    group.position.set(p.x,height,p.y);this.scene.add(group);this.stock.set(id,{group,count});
  }
  health(root,hp,max=100){
    let bar=root.userData.health;
    if(!bar){
      const g=new T.Group(),back=new T.Mesh(new T.PlaneGeometry(1.08,.18),new T.MeshBasicMaterial({color:0x34474c})),fill=new T.Mesh(new T.PlaneGeometry(.96,.09),new T.MeshBasicMaterial({color:0x70d9a7}));fill.position.z=.015;g.add(back,fill);g.userData.outlineParameters={visible:false};g.userData.fill=fill;this.scene.add(g);root.userData.health=g;bar=g;
    }
    bar.position.copy(root.position);bar.position.y+=2.25;bar.quaternion.copy(this.camera.quaternion);bar.scale.setScalar(1.3);if(root===this.player)bar.position.addScaledVector(new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),.9);const ratio=Math.max(0,hp/max);bar.userData.fill.scale.x=ratio;bar.userData.fill.position.x=-(1-ratio)*.48;
  }
  event(e){
    if(e.type==='sell'){this.event({type:'transfer',item:'roast',from:{x:3.6,y:16},to:{x:3.6,y:19.5}});}
    if(e.type==='transfer'||e.type==='pay'||e.type==='pickup'){
      const item=e.type==='pay'?'cash':e.item==='cashStock'?'cash':e.item;
      if(!this.catalog.has(item))return;
      const mesh=this.model(item);mesh.scale.setScalar(.8);this.scene.add(mesh);
      this.transfers.push({mesh,from:e.from??{x:e.x??0,y:e.y??0},to:e.to??{x:e.x??0,y:e.y??0},time:0});
    }
    if(['hit','kill','build','milestone'].includes(e.type)){
      for(let i=0;i<8;i++){
        const mesh=new T.Mesh(new T.BoxGeometry(.07,.07,.07),new T.MeshBasicMaterial({color:e.type==='build'||e.type==='milestone'?0xefc55b:0xf5f6ec}));mesh.position.set(e.x??0,.7,e.y??0);mesh.userData.outlineParameters={visible:false};this.scene.add(mesh);this.particles.push({mesh,time:0,v:new T.Vector3(Math.cos(i*2.4)*2,2.5+(i%3),Math.sin(i*2.4)*2)});
      }
    }
    if(e.type==='bolt'){
      const mesh=new T.Mesh(new T.CylinderGeometry(.025,.025,.8,6),new T.MeshBasicMaterial({color:0xd9a65a}));this.scene.add(mesh);this.transfers.push({mesh,from:e.from,to:e.to,time:0,bolt:true});
    }
  }
  render(s,dt=.016){
    if(!this.player)return;this.visualTime+=dt;this.frameCount++;
    if(this.campRevision!==String(s.built.east)+String(s.built.west))this.buildCamp(s);
    this.pose(this.player,s.player,dt);if(s.player.y<0)this.player.position.y=snowHeight(s.player.x,s.player.y);this.landscape.update(s.player);this.stacks(this.player,s.player.bag,s.player.cash);this.health(this.player,s.player.hp);
    this.player.userData.axe.scale.setScalar(s.weapon===3?1.2:1);
    this.footRing.position.set(s.player.x,this.player.position.y+.12,s.player.y);
    const dx=(this.waypoint?.x??s.player.x)-s.player.x,dy=(this.waypoint?.y??s.player.y)-s.player.y,d=Math.hypot(dx,dy);
    this.guide.visible=d>2&&s.status==='playing'&&!s.finale;
    if(this.guide.visible){this.guide.position.set(s.player.x+dx/d*1.25,.14,s.player.y+dy/d*1.25);this.guide.rotation.set(Math.PI/2,0,-Math.atan2(dx,dy));}
    this.pose(this.chef,{x:-4,y:1.7,facing:Math.PI/2,moving:false},dt);this.chef.userData.joints['arm-right'].rotation.x=-.5+Math.sin(this.visualTime*4)*.2;
    this.pose(this.trader,{x:3.6,y:17.6,facing:Math.PI/2,moving:false},dt);this.trader.userData.joints['arm-right'].rotation.x=-.55+Math.sin(this.visualTime*3)*.14;
    const follow=1-Math.exp(-dt*14);this.focus.x=lerp(this.focus.x,s.player.x,follow);this.focus.z=lerp(this.focus.z,s.player.y-1,follow);
    this.camera.position.copy(this.focus).add(new T.Vector3(21,29,29));this.camera.lookAt(this.focus);
    for(const {pivot,side}of this.gateLeaves||[])pivot.rotation.y=side*s.gate*1.55;
    for(const {pivot,side}of this.serviceLeaves||[])pivot.rotation.y=side*s.serviceGate*1.55;
    this.updatePads(s);
    const live=new Set(['player']);
    const sync=(id,model,p,kind)=>{
      live.add(id);let mesh=this.actors.get(id);if(!mesh){mesh=this.actor(model);this.actors.set(id,mesh);this.scene.add(mesh);}
      this.pose(mesh,p,dt,kind);return mesh;
    };
    for(const enemy of s.enemies){const mesh=sync('enemy-'+enemy.id,enemy.kind,enemy,'beast');if(enemy.hp<enemy.hpMax)this.health(mesh,enemy.hp,enemy.hpMax);}
    for(const b of s.buyers){const mesh=sync('buyer-'+b.id,'merchant',b,'human');this.stacks(mesh,{roast:b.phase==='leave'?2:0});}
    if(s.built.collector){const mesh=sync('collector','worker',s.worker,'human');this.stacks(mesh,{raw:s.worker.load});this.health(mesh,s.worker.hp,80);}
    if(s.built.porter){const mesh=sync('porter','worker',s.porter,'human');this.stacks(mesh,{roast:s.porter.load});}
    for(const [id,mesh]of this.actors)if(!live.has(id)){this.scene.remove(mesh);if(mesh.userData.health)this.scene.remove(mesh.userData.health);this.actors.delete(id);}
    const drops=new Set();for(const d of s.drops){drops.add(d.id);let item=this.loot.get(d.id);if(!item||item.userData.amount!==d.amount){if(item)this.scene.remove(item);item=new T.Group();for(let i=0;i<Math.min(d.amount,5);i++){const mesh=this.model(d.type);mesh.position.set((i%2)*.25,Math.floor(i/2)*.11,0);mesh.rotation.y=i*.25;item.add(mesh);}item.userData.amount=d.amount;this.scene.add(item);this.loot.set(d.id,item);}item.position.set(d.x,.13,d.y);}
    for(const [id,item]of this.loot)if(!drops.has(id)){this.scene.remove(item);this.loot.delete(id);}
    this.pile('raw','raw',s.rawStock,{x:-6.4,y:3.3},1);this.pile('roast','roast',s.roastStock,{x:-1.5,y:3.9});this.pile('sale','roast',s.marketStock,{x:3.1,y:16});this.pile('cash','cash',Math.ceil(s.cashStock/6),{x:6.5,y:15},.15);
    if(s.built.smoker)this.pile('crates','crate',s.crateStock,{x:15.6,y:4.5},.18);
    this.grillSteaks.forEach((mesh,i)=>{mesh.rotation.y=Math.sin(this.visualTime*1.2+i)*.04;mesh.visible=s.rawStock>0||s.roastStock>0;});
    for(const t of [...this.transfers]){t.time+=dt;const p=Math.min(1,t.time/(t.bolt?.2:.4));t.mesh.position.set(lerp(t.from.x,t.to.x,p),t.bolt?1.3:1+Math.sin(p*Math.PI)*1.1,lerp(t.from.y,t.to.y,p));t.mesh.rotation.y+=dt*4;if(p===1){this.scene.remove(t.mesh);if(t.bolt){t.mesh.geometry.dispose();t.mesh.material.dispose();}this.transfers.splice(this.transfers.indexOf(t),1);}}
    for(const p of [...this.particles]){p.time+=dt;p.v.y-=dt*6;p.mesh.position.addScaledVector(p.v,dt);p.mesh.scale.setScalar(1-p.time);if(p.time>=1){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(this.particles.indexOf(p),1);}}
    if(s.finale){if(!this.sled){this.sled=this.model('sled');this.scene.add(this.sled);}this.sled.position.set(s.finale.x,0,s.finale.y);this.sled.rotation.y=-Math.PI/2;}else if(this.sled)this.sled.visible=false;
    const pos=this.snow.geometry.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,(pos.getY(i)-dt*.55+15)%15);}pos.needsUpdate=true;
    for(const {mesh}of this.labels.values())if(mesh.visible){const q=mesh.position.clone().project(this.camera);if(hudOverlaps((q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2))mesh.visible=false;}
    this.effect.render(this.scene,this.camera);
  }
  info(){return{revision:'snowfront-production-v3',frames:this.frameCount,draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,actors:this.actors.size,canvas:[this.canvas.width,this.canvas.height]};}
}
