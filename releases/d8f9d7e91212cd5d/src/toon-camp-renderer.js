import * as T from './vendor/three.module.js';
import {ThreeGameRenderer} from './scene-renderer.js';
import {ToonCampArt} from './toon-camp-art.js';
import {toX,toZ,SAFE,STATIONS} from './world-config.js';
import {surfaceHeight} from './field-art.js';
import {facilityAvailable} from './progression.js';
import {SERVICE_GATE} from './automation.js';
import {hudOverlaps} from './world-labels.js';
import {screenToWorldInput} from './player-movement.js';

export class ToonCampRenderer extends ThreeGameRenderer{
  constructor(canvas){
    super(canvas,{toon:true,artFactory:profile=>new ToonCampArt(profile)});
    this.measurement.revision='camp-toon-v1';this.slashTrail.visible=false;
    this.geometryBudget.ceiling=0;this.labelHeights=new Map();
  }
  setGeometryDetail(){return Promise.resolve();}
  screenDirectionToWorld(x,y){return screenToWorldInput(x,y);}
  observeFrame(time,active){
    const ms=this.frameTime===undefined?0:time-this.frameTime;this.frameTime=time;
    const continuing=this.frameActive;this.frameActive=active;if(!active||!continuing)return;
    if(this.budget.observe(ms))this.applyDisplayBudget();this.measurement.record(ms,this.renderInfo());
  }
  motionReport(){
    const n=this.player.userData.native;
    return{revision:'camp-toon-v1',capturedAt:new Date().toISOString(),userAgent:navigator.userAgent,render:this.renderInfo(),
      motion:this.motionDiagnostics.report(),current:{clock:n.userData.clock,hip:n.userData.joints['leg-left'].rotation.x,knee:n.userData.joints['shin-left'].rotation.x}};
  }
  updatePlayer(state,dt){
    const p=state.player,mesh=this.player,n=mesh.userData.native,m=p.attackMotion;
    mesh.position.set(toX(p.x),surfaceHeight(p.x,p.y),toZ(p.y));
    mesh.rotation.set(0,0,0);
    this.art.pose(n,{x:0,y:0,moving:p.moving,facing:Math.PI/2-p.facing,motion:m?{...m,time:m.time/m.duration*.44}:null},dt);
    n.userData.axe.scale.setScalar(state.upgrades.weapon===3?1.2:1);
    if(state.upgrades.armor>1&&!n.userData.armor){const armor=this.art.prop('item-armor');armor.scale.setScalar(.013);armor.position.set(0,.1,.27);n.getObjectByName('torso').add(armor);n.userData.armor=armor;}
    if(n.userData.armor)n.userData.armor.visible=state.upgrades.armor>1;
    this.art.stacks(n,{raw:p.raw,roast:p.cuts,crate:p.goods},p.cash);
    const ratio=Math.max(0,p.hp/p.hpMax),side=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).multiplyScalar(56);
    this.hp.position.set(toX(p.x)+side.x,mesh.position.y+155,toZ(p.y)+side.z);this.hp.quaternion.copy(this.camera.quaternion);
    this.hp.userData.fill.scale.x=Math.max(.001,ratio);this.hp.userData.fill.position.x=-(1-ratio)*35;this.hp.userData.fill.material.color.set(ratio<.3?0xed6159:0x68da8e);
    this.selection.position.set(toX(p.x),mesh.position.y+2,toZ(p.y));
    this.motionDiagnostics.record({runId:state.runId,x:p.x,y:p.y,dt,inputMoving:p.moving,cameraX:this.focus.x,cameraZ:this.focus.z,mode:m?'attack':p.moving?'walk':'idle',clock:n.userData.clock,hip:n.userData.joints['leg-left'].rotation.x,knee:n.userData.joints['shin-left'].rotation.x,matrixAutoUpdate:true});
  }
  updateEnemies(enemies,dt){
    const living=new Set(enemies);
    for(const [e,mesh]of this.enemyMeshes)if(!living.has(e)){this.root.remove(mesh);this.enemyMeshes.delete(e);this.enemyPool.push(mesh);}
    for(const e of enemies){
      let mesh=this.enemyMeshes.get(e);
      if(!mesh){const index=this.enemyPool.findIndex(m=>m.userData.kind===e.kind);mesh=index<0?this.art.creature(e.kind):this.enemyPool.splice(index,1)[0];this.enemyMeshes.set(e,mesh);this.root.add(mesh);mesh.userData.prev={x:e.x,y:e.y};}
      const prev=mesh.userData.prev,dx=e.x-prev.x,dy=e.y-prev.y,moving=Math.hypot(dx,dy)>.1,m=e.attackMotion;
      mesh.position.set(toX(e.x),surfaceHeight(e.x,e.y),toZ(e.y));mesh.scale.setScalar((e.r||32)/(e.boss?46:32));
      const n=mesh.userData.native,facing=m?.angle??(moving?Math.atan2(dy,dx):n.userData.lastFacing??0);n.userData.lastFacing=facing;
      // Match the visible raised-paw impact to the campaign's actual windup.
      const time=m?(m.time<(m.windup??.46)?m.time/(m.windup??.46)*.78:.78+(m.time-(m.windup??.46))/Math.max(.01,m.duration-(m.windup??.46))*.42):0;
      this.art.pose(n,{x:0,y:0,moving,facing,motion:m?{angle:m.angle,time}:null},dt,'beast');prev.x=e.x;prev.y=e.y;
    }
    const boss=enemies.find(e=>e.boss);this.bossHp.visible=this.bossLabel.mesh.visible=!!boss;
    if(boss){this.bossHp.position.set(toX(boss.x),235,toZ(boss.y));this.bossHp.quaternion.copy(this.camera.quaternion);this.bossHp.userData.fill.scale.x=Math.max(.001,boss.hp/boss.hpMax);this.bossHp.userData.fill.position.x=-(1-boss.hp/boss.hpMax)*70;this.bossLabel.mesh.position.set(toX(boss.x),270,toZ(boss.y));this.bossLabel.mesh.quaternion.copy(this.camera.quaternion);}
  }
  updateWorker(state,dt){
    const w=state.automation.worker,mesh=this.worker,n=mesh.userData.native,visible=facilityAvailable(state,'pickup')&&state.upgrades.pickup>0;
    mesh.visible=this.workerHp.visible=this.workerLabel.mesh.visible=visible;
    if(!visible){this.serviceDoor.position.x=toX(SERVICE_GATE.x);return;}
    mesh.position.set(toX(w.x),surfaceHeight(w.x,w.y),toZ(w.y));mesh.rotation.z=w.hp<=0?Math.PI/2:0;
    const waypoint=w.route[0],facing=waypoint?Math.atan2(waypoint.y-w.y,waypoint.x-w.x):n.userData.lastFacing??0;n.userData.lastFacing=facing;
    this.art.pose(n,{x:0,y:0,moving:w.moving,facing},dt);this.art.stacks(n,{raw:w.cargo});
    const ratio=Math.max(0,w.hp/w.hpMax);this.workerHp.position.set(toX(w.x)+44,mesh.position.y+155,toZ(w.y)+18);this.workerHp.quaternion.copy(this.camera.quaternion);this.workerHp.userData.fill.scale.x=Math.max(.001,ratio);this.workerHp.userData.fill.position.x=-(1-ratio)*35;
    this.writeLabel(this.workerLabel,w.hp<=0?'回収人 救助中':`回収人\nHP ${Math.ceil(w.hp)}/${w.hpMax}`);this.workerLabel.mesh.position.set(toX(w.x),mesh.position.y+195,toZ(w.y));this.workerLabel.mesh.quaternion.copy(this.camera.quaternion);
    this.serviceDoor.position.x=toX(SERVICE_GATE.x)+(Math.abs(w.x-SERVICE_GATE.x)<70&&Math.abs(w.y-SAFE.y)<140?75:0);
  }
  updateStations(state){
    super.updateStations(state);
    const units=(this.camera.right-this.camera.left)/this.width,top=(document.querySelector('.journey-top')?.getBoundingClientRect().bottom??document.querySelector('#shippingPanel')?.getBoundingClientRect().bottom??55)+28,bottom=(document.querySelector('.journey-bottom')?.getBoundingClientRect().top??document.querySelector('#bagPanel')?.getBoundingClientRect().top??this.height-70)-28;
    for(const [id,station]of this.stations){
      const z=STATIONS[id],label=station.label.mesh;
      if(!this.labelHeights.has(id))this.labelHeights.set(id,new T.Box3().setFromObject(station.model).max.y+40);
      label.position.set(toX(z.modelX??z.x),this.labelHeights.get(id),toZ(z.modelY));label.quaternion.copy(this.camera.quaternion);label.scale.set(124*units/190,46*units/60,1);label.material.depthTest=false;
      const point=label.position.clone().project(this.camera),x=(point.x+1)*this.width/2,y=(1-point.y)*this.height/2;
      label.visible=station.group.visible&&x>70&&x<this.width-70&&y>top&&y<bottom&&!hudOverlaps(x,y,124,46);
    }
  }
}
