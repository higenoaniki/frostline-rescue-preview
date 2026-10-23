export function advanceSimulation(step,seconds,input){
  if(!Number.isFinite(seconds)||seconds<=0)return;
  let left=Math.min(.2,seconds);
  while(left>1e-8){const dt=Math.min(.05,left);step(dt,input);left-=dt;}
}
