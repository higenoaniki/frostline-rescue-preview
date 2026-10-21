import { Vector3, Quaternion, Matrix4 } from './vendor/three.module.js';
import { AXE_GRIP_Y, SWING_DURATION } from './melee.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const frames=[
  [0,   28,72,-3,   0,1,0],
  [.06, 34,112,4,   .1,.9,-.2],
  [.12, 33,140,-9,  .2,.7,-.7],
  [.20, 36,108,32,  .8,.3,.9],
  [.30, -1,94,25,  -.7,.1,.8],
  [.37, 28,96,8,    0,1,0],
  [.44, 26,98,22,   0,.5,.9]
];
const beltHand=[28,72,-3];
const readyHand=frames.at(-1).slice(1,4);

export function hatchetPose(time,duration=SWING_DURATION,drawFromHolster=true) {
  const t=clamp(time/Math.max(.001,duration),0,1)*SWING_DURATION;
  const index=Math.min(frames.length-2,Math.max(0,frames.findIndex((f,i)=>i<frames.length-1&&t<=frames[i+1][0])));
  const a=index===0&&!drawFromHolster?[0,...frames.at(-1).slice(1)]:frames[index];
  const b=frames[index+1],f=smooth(clamp((t-a[0])/(b[0]-a[0]),0,1));
  const values=a.slice(1).map((v,i)=>v+(b[i+1]-v)*f);
  const draw=drawFromHolster?smooth(clamp(t/.065,0,1)):1;
  return {hand:values.slice(0,3),shaft:values.slice(3),draw,gripY:18+(AXE_GRIP_Y-18)*draw};
}

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
    this.target.fromArray(pose.hand);
    this.direction.copy(this.target).sub(r.rightArm.position);
    const distance=clamp(this.direction.length(),Math.abs(this.upperLength-this.lowerLength)+.05,this.upperLength+this.lowerLength-.05);
    this.direction.normalize();
    this.pole.set(1,-.25,-.5).addScaledVector(this.direction,-this.direction.dot(this.pole)).normalize();
    const along=(this.upperLength**2+distance**2-this.lowerLength**2)/(2*distance);
    this.elbow.copy(this.direction).multiplyScalar(along).addScaledVector(this.pole,Math.sqrt(Math.max(0,this.upperLength**2-along**2)));
    r.rightArm.quaternion.setFromUnitVectors(this.upperRest,this.elbow.clone().normalize());
    this.target.copy(r.rightArm.position).addScaledVector(this.direction,distance);
    this.forearmDirection.copy(this.target).sub(r.rightArm.position).sub(this.elbow).normalize();
    this.parentRotation.copy(r.rightArm.quaternion).invert();
    r.rightForearm.quaternion.setFromUnitVectors(this.lowerRest,this.forearmDirection.clone().applyQuaternion(this.parentRotation));
    // A neutral power grip puts the handle across the palm, not along the forearm.
    this.shaft.fromArray(pose.shaft).addScaledVector(this.forearmDirection,-this.forearmDirection.dot(this.shaft)).normalize();
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
