import * as THREE from './vendor/three.module.js';

// Timber, glazing and warm lanterns follow the title's expedition-camp palette.
export function dressFacility(a, model, id) {
  if (['processorOut', 'cannerOut', 'fleet', 'pickup', 'beacon'].includes(id)) return;
  a.m.polarShell ??= a.m.wood.clone();
  a.m.polarFrame ??= a.m.darkWood.clone();
  a.m.polarLED ??= new THREE.MeshStandardMaterial({color:0xffda97,emissive:0xff9a3d,emissiveIntensity:1.8,roughness:.32});
  a.m.polarScreen ??= new THREE.MeshStandardMaterial({color:0x80512c,emissive:0xf98b32,emissiveIntensity:1.1,roughness:.3});
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3()).sub(model.position);
  const g=new THREE.Group();g.name='crafted-environment';
  const w=Math.min(size.x*.9,230),d=Math.min(size.z*.82,165),y=bounds.min.y-model.position.y;
  const x=center.x,z=center.z;
  a.box(g,w+8,12,d+8,'polarFrame',x,y+2,z,3);
  a.box(g,w,3,d,'polarShell',x,y+10,z,2);
  // Visible overlapping planks and rounded beam ends stay inside the footprint.
  for(let row=0;row<6;row++) a.box(g,w*.85,10,8,'polarShell',x,y+20+row*10,z-d*.42,1);
  for(const side of [-1,1]) {
    a.box(g,7,75,12,'polarFrame',x+side*w*.42,y+48,z-d*.42,1);
    a.box(g,9,4,15,'snow',x+side*w*.42,y+87,z-d*.42,1);
  }
  // Amber glazing has physical mullions; no monitor decal or image billboard.
  a.box(g,39,30,5,'polarFrame',x+w*.22,y+50,z+d*.46,3);
  a.box(g,31,21,3,'polarScreen',x+w*.22,y+51,z+d*.46+4,1);
  a.box(g,2,23,2,'polarFrame',x+w*.22,y+51,z+d*.46+6,.3);
  a.box(g,32,2,2,'polarFrame',x+w*.22,y+51,z+d*.46+6,.3);
  for(let i=0;i<5;i++) a.box(g,23,2,3,'polarFrame',x-w*.24,y+34+i*6,z-d*.42+5,.4);
  a.box(g,w*.7,3,5,'snow',x,y+12,z+d*.5+4,1);
  for(let i=0;i<5;i++) {
    const stripe=a.box(g,7,2,13,i%2?'polarFrame':'wood',x-w*.38+i*9,y+12,z+d*.36,0);
    stripe.rotation.y=-.4;
  }
  model.add(a.mergeRigid(g));
}
