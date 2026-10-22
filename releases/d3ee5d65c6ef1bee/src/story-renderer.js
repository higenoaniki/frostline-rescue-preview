import * as T from './vendor/three.module.js';
import {SnowfrontRenderer} from './snowfront-renderer.js';
import {STORY_PADS,STORY_NAMES,storyAvailable,storyCost,storySafe} from './story-state.js';

const mix=(a,b,t)=>a+(b-a)*t;
export class StoryRenderer extends SnowfrontRenderer{
  constructor(canvas,chapter){super(canvas);this.chapter=chapter;}
  buildScenery(){
    const group=new T.Group();
    for(let i=0;i<30;i++){const tree=this.model('pine'),side=i%2?1:-1;let y=-3-Math.floor(i/2)*2.2;if(this.chapter==='pass'&&y< -8&&y> -16)y-=9;tree.position.set(side*(19+Math.sin(i*3.2)*4),0,y);tree.scale.setScalar(.8+(i%4)*.12);group.add(tree);}
    for(let i=0;i<18;i++){const rock=this.model('rock');let y=-3-(i%9)*3;if(this.chapter==='pass'&&y< -8&&y> -16)y-=9;rock.position.set(Math.sin(i*9.3)*23,0,y);rock.rotation.y=i;rock.scale.setScalar(.5+(i%3)*.2);group.add(rock);}
    this.staticRoot.add(this.mergeStatic(group));
  }
  async load(){
    await super.load();
    for(const actor of [this.chef,this.trader,...this.grillSteaks,...this.facilities.values()])this.scene.remove(actor);
    this.facilities.clear();this.storyRoot=new T.Group();this.scene.add(this.storyRoot);this.nodeMeshes=new Map();this.beams=[];this.storyPads=new Map();
    const model=(name,create)=>{const root=create();root.userData.asset='story-'+name;this.catalog.set(name,root);};
    model('wood',()=>{const g=new T.Group();for(let i=0;i<3;i++)this.part(g,new T.CylinderGeometry(.09,.09,.72,12),0xa66f41,(i%2)*.2-.1,Math.floor(i/2)*.18,0).rotation.x=Math.PI/2;for(const z of [-.2,.2])this.part(g,new T.BoxGeometry(.48,.07,.06),0xe2c377,0,.07,z);return g;});
    model('ore',()=>{const g=new T.Group();for(let i=0;i<3;i++)this.part(g,new T.DodecahedronGeometry(.2+(i%2)*.03),i===1?0x68cec3:0x629597,(i-1)*.17,.12,0);return g;});
    this.catalog.set('food',this.catalog.get('roast'));this.catalog.set('kit',this.catalog.get('crate'));
    model('core',()=>{const g=new T.Group();this.part(g,new T.OctahedronGeometry(.32),0x8cfff1,0,.3,0);return g;});
    this.trader=this.actor('merchant');this.scene.add(this.trader);this.runner=this.actor('worker');this.scene.add(this.runner);
    this.sled=this.model('sled');this.scene.add(this.sled);
    this.holster=new T.Group();this.player.getObjectByName('torso').add(this.holster);this.holster.position.set(.42,-.1,-.15);this.holster.rotation.set(0,0,-.15);
  }
  part(group,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,new T.MeshToonMaterial({color,gradientMap:this.gradient}));m.userData.procedural=!!this.buildingWorld;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
  prop(group,name,x,y,scale=1){const m=this.model(name);m.position.set(x,0,y);m.scale.setScalar(scale);group.add(m);return m;}
  buildWorld(s){
    // Retain authored shared mesh resources; dispose only procedural story geometry.
    this.storyRoot.traverse(m=>{if(m.userData.procedural){m.geometry.dispose();m.material.dispose();}});this.storyRoot.clear();this.nodeMeshes.clear();this.beams=[];
    this.buildingWorld=true;
    this.builtSignature=JSON.stringify([s.chapter,s.built]);
    this.buildCamp({built:{east:false,west:false}});
    // Wider staging area for material allocation and a clear entrance aisle.
    this.camp.scale.x=1.8;this.gates.scale.x=1;
    this.prop(this.storyRoot,'grill',-5,3.5);this.prop(this.storyRoot,'table',-2,3.5);this.prop(this.storyRoot,'trade',5,14);this.prop(this.storyRoot,'weapon',-5,14);
    if(s.chapter!=='pass')this.prop(this.storyRoot,'weapon',-9,14,.8);
    if(s.built.forge)this.prop(this.storyRoot,'smoker',9,3.5);
    if(s.built.miner)this.prop(this.storyRoot,'hunter',9,14,.85);
    if(s.built.guard)this.prop(this.storyRoot,'hunter',0,14,.85);
    for(const n of s.nodes){
      if(n.type==='ore'&&!s.built.mine)continue;
      const root=new T.Group();root.position.set(n.x,0,n.y);
      if(n.type==='wood'){this.prop(root,'stump',0,0,1.2);for(let i=0;i<3;i++){const log=this.model('wood');log.scale.setScalar(2);log.position.set((i-1)*.35,.25,0);root.add(log);}}
      else{this.prop(root,'rock',0,0,1.2);const gem=this.model('ore');gem.scale.setScalar(2.8);gem.position.y=.55;root.add(gem);}
      this.storyRoot.add(root);this.nodeMeshes.set(n.id,root);
    }
    if(s.chapter==='pass'){
      const water=this.part(this.storyRoot,new T.BoxGeometry(65,.18,6),0x52bdd3,0,-.01,-12);water.receiveShadow=false;
      for(const side of [-1,1])for(let i=0;i<8;i++)this.prop(this.storyRoot,'rock',side*(3+i*2.8),-9+(i%2)*.3,.75);
      const bridge=new T.Group();this.storyRoot.add(bridge);const length=s.built.bridge?6.5:1.5;
      for(let z=0;z<length;z+=.3)this.part(bridge,new T.BoxGeometry(4.4,.22,.27),0xb78150,0,.2,-9-z);
      for(const x of [-2.1,2.1]){
        for(const z of [-8.8,-12,-15.4]){this.part(bridge,new T.CylinderGeometry(.11,.15,1.6,10),0x895736,x,.7,z);this.part(bridge,new T.SphereGeometry(.2,12,8),0xf2f5f4,x,1.55,z);}
        if(s.built.bridge)this.part(bridge,new T.BoxGeometry(.1,.12,6.5),0xd9a56b,x,1.1,-12.15);
      }
    }
    if(s.chapter==='highland'){
      const mine=new T.Group();mine.position.set(0,0,-19);this.storyRoot.add(mine);
      for(let i=0;i<10;i++)this.prop(mine,'rock',(i%5-2)*1.25,-Math.floor(i/5),1.5+(i%3)*.3);
      this.part(mine,new T.BoxGeometry(3.4,3,.2),0x273a3c,0,1.3,.8);
      for(const x of [-1.7,1.7])this.part(mine,new T.CylinderGeometry(.18,.22,3.5,12),0xb78c57,x,1.6,1);
      this.part(mine,new T.BoxGeometry(4,.4,.4),0xc69a61,0,3.3,1);
      for(const x of [-.5,.5])this.part(mine,new T.BoxGeometry(.07,.07,5),0x71838a,x,.05,2.2);
    }
    if(s.chapter==='beacon')for(const id of ['relayA','relayB','relayC']){
      const p=STORY_PADS[id],g=new T.Group();g.position.set(p.x,0,p.y-2.5);this.storyRoot.add(g);
      const tall=id==='relayC'?6:2.6;
      this.part(g,new T.CylinderGeometry(1.15,1.3,.22,12),0x95a6ab,0,.1,0);
      this.part(g,new T.CylinderGeometry(id==='relayC'?.7:.25,id==='relayC'?1:.45,tall,16),0xf1e3bd,0,tall/2,0);
      if(id==='relayC'){
        for(const y of [1.4,3,4.6])this.part(g,new T.CylinderGeometry(1-y*.05,1-y*.05,.12,16),0xcdbb97,0,y,0);
        for(const y of [1.6,3.3,4.8]){
          this.part(g,new T.BoxGeometry(.42,.68,.13),0x83775d,.18,y,.8-y*.025);
          this.part(g,new T.BoxGeometry(.28,.5,.15),0x507c8b,.18,y,.83-y*.025);
          this.part(g,new T.BoxGeometry(.045,.5,.17),0xf7d08a,.18,y,.86-y*.025);
        }
        for(let i=0;i<4;i++)this.part(g,new T.BoxGeometry(1.6-i*.15,.15,.45),0xbac4c5,0,.12+i*.15,1.6-i*.3);
        this.part(g,new T.BoxGeometry(.6,1.15,.2),0x9e7956,0,.7,.95);
        this.part(g,new T.BoxGeometry(.05,.07,.06),0xf1cf78,.18,.7,1.08);
      }
      this.part(g,new T.CylinderGeometry(.95,1,.2,16),0x507b85,0,tall,0);
      const glass=this.part(g,new T.CylinderGeometry(.52,.52,.88,12),0xb5e6e4,0,tall+.5,0);glass.material.transparent=true;glass.material.opacity=.4;glass.castShadow=false;
      const light=this.part(g,new T.SphereGeometry(.32,16,12),s.built[id]?0xffd86c:0x6c8c98,0,tall+.45,0);light.castShadow=false;
      light.material.emissive.setHex(s.built[id]?0xffbb32:0x000000);light.material.emissiveIntensity=.8;
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;this.part(g,new T.CylinderGeometry(.035,.035,.95,8),0xc8aa71,Math.cos(angle)*.55,tall+.48,Math.sin(angle)*.55);}
      this.part(g,new T.ConeGeometry(.87,.7,16),0xbc6459,0,tall+1.15,0);
      this.part(g,new T.ConeGeometry(.72,.55,16),0xf5f8f6,0,tall+1.27,0);
      const beam=this.part(g,new T.ConeGeometry(id==='relayC'?3:1.5,8,24,true),0xffe6a3,0,tall+3,0);beam.castShadow=false;beam.receiveShadow=false;beam.material.transparent=true;beam.material.opacity=s.built[id]?.1:0;beam.material.depthWrite=false;beam.userData.outlineParameters={visible:false};this.beams.push(beam);
    }
    this.buildingWorld=false;
    const sky=s.chapter==='highland'?0xc9d6e2:s.chapter==='beacon'?0xb9d9e4:0xe7eef3;this.scene.background.setHex(sky);this.scene.fog.color.setHex(sky);
    this.groundMat.color.setHex(s.chapter==='beacon'?0xe2eef3:0xf0f3f5);
  }
  labelAt(key,text,p,height=2.2){
    const mesh=this.label('story-'+key,text),units=(this.camera.right-this.camera.left)/innerWidth;
    mesh.position.set(p.x,height,p.y);mesh.quaternion.copy(this.camera.quaternion);mesh.scale.set(132*units/2.3,48*units/1.45,1);
    const projected=mesh.position.clone().project(this.camera),y=(1-projected.y)*innerHeight/2,x=(projected.x+1)*innerWidth/2;
    const hudBottom=document.querySelector('.sf-objective')?.getBoundingClientRect().bottom??190;
    const rect={left:x-66,right:x+66,top:y-24,bottom:y+24};
    const blocked=[...document.querySelectorAll('.sf-hud,.sf-objective,.sf-bag,.sf-tools,.sf-context:not([hidden]),.story-repair:not([hidden])')].some(el=>{const r=el.getBoundingClientRect();return rect.left<r.right&&rect.right>r.left&&rect.top<r.bottom&&rect.bottom>r.top;});
    const overlaps=(this.labelRects||[]).some(r=>rect.left<r.right+5&&rect.right>r.left-5&&rect.top<r.bottom+4&&rect.bottom>r.top-4);
    const close=Math.hypot(p.x-this.player.position.x,p.y-this.player.position.z)<9||this.waypoint&&Math.hypot(p.x-this.waypoint.x,p.y-this.waypoint.y)<1.5;
    mesh.visible=close&&!blocked&&!overlaps&&y>hudBottom+26&&y<innerHeight-115&&x>64&&x<innerWidth-64;if(mesh.visible)this.labelRects.push(rect);return mesh;
  }
  event(e){
    if(e.type==='sell'){super.event({type:'transfer',item:'cash',from:{x:5,y:14},to:{x:e.x,y:e.y}});return;}
    super.event({...e,item:{foodStock:'food',kitStock:'kit'}[e.item]??e.item});
  }
  releaseHealth(root){const bar=root?.userData.health;if(!bar)return;this.scene.remove(bar);bar.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});delete root.userData.health;}
  render(s,dt=.016){
    if(!this.player)return;this.visualTime+=dt;this.frameCount++;this.labelRects=[];
    if(this.builtSignature!==JSON.stringify([s.chapter,s.built]))this.buildWorld(s);
    this.pose(this.player,s.player,dt);this.stacks(this.player,{raw:s.player.bag.raw,roast:s.player.bag.food,crate:s.player.bag.kit},s.player.cash);
    // Distinct real 3D cargo for non-food materials; shared authored backpack rig.
    const extraKey=JSON.stringify([s.player.bag.wood,s.player.bag.ore]);
    if(this.extraKey!==extraKey){if(this.extra)this.player.getObjectByName('torso').remove(this.extra);this.extra=new T.Group();this.extra.position.set(-.4,.35,-.55);this.player.getObjectByName('torso').add(this.extra);let h=0;for(const type of ['wood','ore'])for(let i=0;i<Math.min(s.player.bag[type],12);i++){const m=this.model(type);m.position.y=h;h+=.16;this.extra.add(m);}this.extraKey=extraKey;}
    const axe=this.player.userData.axe,hand=this.player.getObjectByName('hand-right');
    if(s.player.motion){if(axe.parent!==hand){hand.add(axe);axe.position.set(0,0,0);axe.rotation.set(-.3,0,0);}}else if(axe.parent!==this.holster){this.holster.add(axe);axe.position.set(0,0,0);axe.rotation.set(.1,0,Math.PI*.08);}
    this.health(this.player,s.player.hp);this.footRing.position.set(s.player.x,.13,s.player.y);
    const follow=1-Math.exp(-dt*14);this.focus.x=mix(this.focus.x,s.player.x,follow);this.focus.z=mix(this.focus.z,s.player.y-1,follow);this.camera.position.copy(this.focus).add(new T.Vector3(21,29,29));this.camera.lookAt(this.focus);
    const open=Math.hypot(s.player.x,s.player.y)<2.6||s.survivors.some(p=>p.following&&Math.hypot(p.x,p.y)<2.6);
    for(const {pivot,side}of this.gateLeaves||[])pivot.rotation.y=mix(pivot.rotation.y,open?side*1.55:0,Math.min(1,dt*14));
    this.pose(this.trader,{x:5,y:15.5,facing:Math.PI/2,moving:false},dt);
    this.runner.visible=!!s.built.miner;this.runner.userData.axe.visible=true;this.pose(this.runner,{x:9,y:-18,facing:Math.PI,moving:false,motion:{time:this.visualTime%.9}},dt);
    const live=new Set();const actor=(id,name,p,kind)=>{live.add(id);let m=this.actors.get(id);if(!m){m=this.actor(name);this.actors.set(id,m);this.scene.add(m);}this.pose(m,p,dt,kind);return m;};
    for(const e of s.enemies){
      const m=actor('enemy-'+e.id,e.kind,e,'beast');m.scale.setScalar(e.boss?1.65:1);
      if(e.boss&&!m.userData.crown){const crown=new T.Group();for(let i=0;i<3;i++){const shard=this.model('core');shard.scale.setScalar(.7);shard.position.set((i-1)*.25,.4+(i===1?.15:0),.1);crown.add(shard);}m.userData.joints.head.add(crown);m.userData.crown=crown;}
      if(e.hp<e.hpMax||e.boss){this.health(m,e.hp,e.hpMax);if(e.boss)m.userData.health.position.y=3.7;}
    }
    if(s.built.guard){const m=actor('guard','worker',{x:s.convoy.x-.9,y:s.convoy.y-.4,facing:s.guardMotion?.angle??-Math.PI/2,moving:s.convoy.started,motion:s.guardMotion},'human');m.userData.axe.visible=!!s.guardMotion;}
    if(s.chapter==='pass')for(const p of s.survivors){const m=actor('survivor-'+p.id,'worker',p,'human');if(!p.home)this.labelAt('survivor-'+p.id,p.following?'同行中':'救助隊',p,2.7);else this.labels.get('story-survivor-'+p.id)?.mesh&&(this.labels.get('story-survivor-'+p.id).mesh.visible=false);}
    for(const[id,m]of this.actors)if(!live.has(id)){this.scene.remove(m);this.releaseHealth(m);this.actors.delete(id);}
    for(const n of s.nodes){const m=this.nodeMeshes.get(n.id);if(m){m.visible=n.remaining>0;m.scale.setScalar(n.remaining>0?1:0);}}
    const used=new Set();for(const d of s.drops){used.add(d.id);let m=this.loot.get(d.id);if(!m){m=this.model(d.type);m.scale.setScalar(1.35);this.loot.set(d.id,m);this.scene.add(m);}m.position.set(d.x,.2,d.y);}
    for(const[id,m]of this.loot)if(!used.has(id)){this.scene.remove(m);this.loot.delete(id);}
    this.pile('food','food',s.foodStock,{x:-2,y:3.5});this.pile('kits','kit',s.kitStock,{x:12,y:3.5});
    const visible=new Set();
    for(const [id,p]of Object.entries(STORY_PADS)){
      let text,anchor={...p};
      if(id==='cook')text=`食料加工\n生肉 ${s.rawStock}`;
      if(id==='food')text=`食料回収\n${s.foodStock}`;
      if(id==='trade')text=s.chapter==='pass'?`救助隊の補給\n食料 ${s.foodDelivered}/6`:s.chapter==='highland'?`灯台への荷箱\n${s.delivered}/8`:'補給隊\n余剰物資を換金';
      if(id==='forge'&&s.built.forge)text=`補強材工房\n木材 ${s.forgeWood} / 鉱石 ${s.forgeOre}`;
      if(id==='output'&&s.built.forge)text=`補強材回収\n${s.kitStock}`;
      if(storyAvailable(s,id)){const cost=storyCost(s,id),paid=s.paid[id]||{};text=(['weapon','armor'].includes(id)?STORY_NAMES[id]:'未開拓の投資枠')+'\n'+Object.entries(cost).map(([k,v])=>`${{cash:'金',wood:'木',ore:'鉱',kit:'箱',core:'核'}[k]}${paid[k]||0}/${v}`).join(' ');}
      if(id==='bridge'&&s.chapter==='highland'&&!s.built.mine)text=`未開拓の投資枠\n木 ${s.paid.mine?.wood||0}/12 金 ${s.paid.mine?.cash||0}/36`;
      if(s.built[id]&&id.startsWith('relay'))text=STORY_NAMES[id]+'\n点灯済';
      let pad=this.storyPads.get(id);
      if(!pad){const points=[[-1.1,0,-.85],[1.1,0,-.85],[1.1,0,.85],[-1.1,0,.85]].map(p=>new T.Vector3(...p));pad=new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xf9ffff}));pad.position.set(p.x,.13,p.y);pad.userData.outlineParameters={visible:false};this.scene.add(pad);this.storyPads.set(id,pad);}
      pad.visible=!!text&&!s.built[id];pad.material.color.setHex(storyAvailable(s,id)?0xf0d276:0xf9ffff);
      if(text){visible.add('story-'+id);if(['cook','food','forge','output','trade','weapon','armor','miner','guard'].includes(id))anchor.y-=2;if(id.startsWith('relay'))anchor.y-=3.3;this.labelAt(id,text,anchor,2.8);}
    }
    for(const[key,item]of this.labels)if(key.startsWith('story-')&&!key.startsWith('story-survivor-')&&!visible.has(key))item.mesh.visible=false;
    this.sled.visible=s.chapter==='beacon';this.sled.position.set(s.convoy.x,0,s.convoy.y);if(this.sled.visible)this.health(this.sled,s.convoy.hp,180);
    this.guide.visible=!!this.waypoint&&Math.hypot(this.waypoint.x-s.player.x,this.waypoint.y-s.player.y)>2;
    if(this.guide.visible){const dx=this.waypoint.x-s.player.x,dy=this.waypoint.y-s.player.y,d=Math.hypot(dx,dy);this.guide.position.set(s.player.x+dx/d*1.4,.15,s.player.y+dy/d*1.4);this.guide.rotation.set(Math.PI/2,0,-Math.atan2(dx,dy));}
    for(const beam of this.beams)beam.rotation.y=this.visualTime*.2;
    for(const t of [...this.transfers]){t.time+=dt;const progress=Math.min(1,t.time/(t.bolt?.2:.4));t.mesh.position.set(mix(t.from.x,t.to.x,progress),1+Math.sin(progress*Math.PI),mix(t.from.y,t.to.y,progress));if(progress===1){this.scene.remove(t.mesh);if(t.bolt){t.mesh.geometry.dispose();t.mesh.material.dispose();}this.transfers.splice(this.transfers.indexOf(t),1);}}
    for(const p of [...this.particles]){p.time+=dt;p.v.y-=dt*6;p.mesh.position.addScaledVector(p.v,dt);p.mesh.scale.setScalar(Math.max(0,1-p.time));if(p.time>=1){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(this.particles.indexOf(p),1);}}
    const snow=this.snow.geometry.attributes.position;for(let i=0;i<snow.count;i++)snow.setY(i,(snow.getY(i)-dt*.6+15)%15);snow.needsUpdate=true;
    this.effect.render(this.scene,this.camera);
  }
  reset(){for(const m of this.actors.values())this.releaseHealth(m);this.releaseHealth(this.sled);super.reset();this.sled=this.model('sled');this.scene.add(this.sled);this.builtSignature=null;this.extraKey=null;}
}
