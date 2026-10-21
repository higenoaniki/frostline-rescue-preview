import { SWING_DURATION, AXE_GRIP_Y } from './melee.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
// Time, hand target in torso coordinates, desired shaft direction at each key.
export const HATCHET_FRAMES=[
  [0,   28,72,-3,   0,1,0],
  [.06, 34,112,4,   .1,.9,-.2],
  [.12, 33,140,-9,  .2,.7,-.7],
  [.20, 26,111,40,  .25,-1,.35],
  [.30, -1,94,25,  -.2,-.8,.2],
  [.37, 28,96,8,    0,1,0],
  [.44, 26,98,22,   0,.5,.9]
];

export function axePose(time,duration=SWING_DURATION,drawFromHolster=true) {
  const frames=HATCHET_FRAMES,t=clamp(time/Math.max(.001,duration),0,1)*SWING_DURATION;
  const index=Math.min(frames.length-2,Math.max(0,frames.findIndex((f,i)=>i<frames.length-1&&t<=frames[i+1][0])));
  const a=index===0&&!drawFromHolster?[0,...frames.at(-1).slice(1)]:frames[index];
  const b=frames[index+1],f=smooth(clamp((t-a[0])/(b[0]-a[0]),0,1));
  const values=a.slice(1).map((v,i)=>v+(b[i+1]-v)*f);
  const draw=drawFromHolster?smooth(clamp(t/.065,0,1)):1;
  return {hand:values.slice(0,3),shaft:values.slice(3),draw,gripY:18+(AXE_GRIP_Y-18)*draw,index,blend:f};
}
