import { Vector3, Quaternion, Matrix4 } from './vendor/three.module.js';
import { AXE_GRIP_Y } from './melee.js';
import { axePose as hatchetPose, HATCHET_FRAMES as frames } from './attack-pose.js';
export { axePose as hatchetPose } from './attack-pose.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const beltHand=frames[0].slice(1,4);
const readyHand=frames.at(-1).slice(1,4);

// Analytic two-link reach preserves the authored shoulder, elbow and wrist lengths.
// The pole bends the elbow outwards, rather than twisting it through the chest.
export class HatchetEquipment {
  constructor(rig) {
    this.rig=rig;
    this.target=new Vector3();this.direction=new Vector3();this.pole=new Vector3();this.elbow=new Vector3();
    this.forearmDirection=new Vector3();this.shaft=new Vector3();this.edge=new Vector3();this.normal=new Vector3();
    this.matrix=new Matrix4();this.orientation=new Quaternion();this.parentRotation=new Quaternion();
    this.identity=new Quaternion();this.upperRest=rig.rightForearm.position.clone();this.lowerRest=rig.hand.position.clone();
    this.upperLength=this.upperRest.length();this.lowerLength=this.lowerRest.length();
    this.upperRest.normalize();this.lowerRest.normalize();
    this.neutralShaft=new Vector3();this.bendNormal=new Vector3();
    this.rolls=[];
    for(const frame of frames){
      this.reach(frame.slice(1,4));
      const cue=new Vector3(...frame.slice(4));
      let roll=Math.atan2(cue.dot(this.bendNormal),cue.dot(this.neutralShaft));
      if(this.rolls.length){const previous=this.rolls.at(-1);roll=previous+Math.atan2(Math.sin(roll-previous),Math.cos(roll-previous));}
      this.rolls.push(roll);
    }
  }
  reach(hand) {
    const r=this.rig;
    this.target.fromArray(hand);this.direction.copy(this.target).sub(r.rightArm.position);
    const distance=clamp(this.direction.length(),Math.abs(this.upperLength-this.lowerLength)+.05,this.upperLength+this.lowerLength-.05);
    this.direction.normalize();
    this.pole.set(1,-.25,-.5).addScaledVector(this.direction,-this.direction.dot(this.pole)).normalize();
    const along=(this.upperLength**2+distance**2-this.lowerLength**2)/(2*distance);
    this.elbow.copy(this.direction).multiplyScalar(along).addScaledVector(this.pole,Math.sqrt(Math.max(0,this.upperLength**2-along**2)));
    this.target.copy(r.rightArm.position).addScaledVector(this.direction,distance);
    this.forearmDirection.copy(this.target).sub(r.rightArm.position).sub(this.elbow).normalize();
    this.bendNormal.crossVectors(this.elbow,this.forearmDirection).normalize();
    this.neutralShaft.crossVectors(this.bendNormal,this.forearmDirection).normalize();
  }
  update(motion,dt=0,runId=null) {
    const r=this.rig,weapon=r.weapon;
    if(this.runId!==runId){this.runId=runId;this.ready=false;this.idleAge=0;this.lastMotion=null;}
    const returning=!motion&&this.ready;
    if(returning)this.idleAge+=Math.max(0,dt);
    const stow=returning?smooth(clamp((this.idleAge-.24)/.18,0,1)):0;
    if(!motion&&(!this.ready||stow===1)) {
      if(weapon.parent!==r.holster)r.holster.add(weapon);
      weapon.rotation.set(0,0,0);weapon.position.set(0,-28,0);
      r.hand.rotation.set(.05,0,0);r.weaponState='holstered';r.gripY=18;r.sheath.visible=true;this.ready=false;
      return;
    }
    let pose;
    if(motion){
      if(this.lastMotion!==motion)this.drawFromHolster=!this.ready;
      this.lastMotion=motion;this.ready=true;this.idleAge=0;
      pose=hatchetPose(motion.time,motion.duration,this.drawFromHolster);r.weaponState='held';
    }else{
      pose={hand:readyHand.map((v,i)=>v+(beltHand[i]-v)*stow),shaft:[0,.5+stow*.5,.9*(1-stow)],draw:1-stow,gripY:AXE_GRIP_Y+(18-AXE_GRIP_Y)*stow};
      r.weaponState=stow>0?'returning':'ready';
    }
    r.sheath.visible=false;
    this.reach(pose.hand);
    r.rightArm.quaternion.setFromUnitVectors(this.upperRest,this.elbow.clone().normalize());
    this.parentRotation.copy(r.rightArm.quaternion).invert();
    r.rightForearm.quaternion.setFromUnitVectors(this.lowerRest,this.forearmDirection.clone().applyQuaternion(this.parentRotation));
    // Interpolate authored roll in the elbow plane. Projecting a changing world
    // direction directly can cross a pole and flip the wrist by 180 degrees.
    let roll;
    if(motion){
      const start=pose.index===0&&!this.drawFromHolster?this.rolls.at(-1):this.rolls[pose.index];
      const delta=Math.atan2(Math.sin(this.rolls[pose.index+1]-start),Math.cos(this.rolls[pose.index+1]-start));
      roll=start+delta*pose.blend;
    }else{
      const start=this.rolls.at(-1),delta=Math.atan2(Math.sin(this.rolls[0]-start),Math.cos(this.rolls[0]-start));
      roll=start+delta*stow;
    }
    this.shaft.copy(this.neutralShaft).multiplyScalar(Math.cos(roll)).addScaledVector(this.bendNormal,Math.sin(roll));
    this.edge.copy(this.forearmDirection);this.normal.crossVectors(this.edge,this.shaft).normalize();
    this.edge.crossVectors(this.shaft,this.normal).normalize();
    this.matrix.makeBasis(this.edge,this.shaft,this.normal);
    this.orientation.setFromRotationMatrix(this.matrix).slerp(this.identity,1-pose.draw);
    this.parentRotation.copy(r.rightArm.quaternion).multiply(r.rightForearm.quaternion).invert();
    r.hand.quaternion.copy(this.parentRotation).multiply(this.orientation);
    if(weapon.parent!==r.grip)r.grip.add(weapon);
    weapon.quaternion.identity();weapon.position.set(0,-pose.gripY*weapon.scale.x,0);
    r.gripY=pose.gripY;r.wristAlignment=Math.abs(this.shaft.dot(this.forearmDirection));
  }
}
