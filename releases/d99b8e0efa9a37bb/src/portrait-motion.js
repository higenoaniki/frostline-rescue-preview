export function portraitBlink(time){
  const phase=((time%4.3)+4.3)%4.3;
  if(phase<3.9||phase>4.12)return 0;
  const t=(phase-3.9)/.22;
  return Math.sin(Math.PI*t)**2;
}

export function preparePortraitMorph(geometry){
  const delta=geometry.getAttribute('_blink');
  if(!delta||geometry.morphAttributes.position?.length)return;
  const morph=delta.clone();morph.name='blink';
  geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[morph];
}
