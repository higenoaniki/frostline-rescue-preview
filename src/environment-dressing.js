import * as THREE from './vendor/three.module.js';

// Modular polar-station kit, attached to the authored animated facility.
export function dressFacility(a, model, id) {
  if (['processorOut', 'cannerOut', 'fleet', 'pickup', 'beacon'].includes(id)) return;
  a.m.polarShell ??= new THREE.MeshStandardMaterial({color:0xc9dce3,metalness:.32,roughness:.37});
  a.m.polarFrame ??= new THREE.MeshStandardMaterial({color:0x203848,metalness:.65,roughness:.32});
  a.m.polarLED ??= new THREE.MeshStandardMaterial({color:0x8cf2ff,emissive:0x36cde8,emissiveIntensity:2.2,roughness:.25});
  a.m.polarScreen ??= new THREE.MeshStandardMaterial({color:0x091f2c,emissive:0x15445b,emissiveIntensity:.4,roughness:.2});
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3()).sub(model.position);
  const g=new THREE.Group();g.name='crafted-environment';
  const w=Math.min(size.x*.9,230),d=Math.min(size.z*.82,165),y=bounds.min.y-model.position.y;
  const x=center.x,z=center.z;
  a.box(g,w+8,12,d+8,'polarFrame',x,y+2,z,3);
  a.box(g,w,3,d,'polarShell',x,y+10,z,2);
  // Insulated service wall and corner extrusions, within the original footprint.
  a.box(g,w*.85,67,7,'polarShell',x,y+46,z-d*.42,3);
  for(const side of [-1,1]) {
    a.box(g,7,75,12,'polarFrame',x+side*w*.42,y+48,z-d*.42,1);
    a.box(g,4,35,3,'polarLED',x+side*w*.42,y+60,z-d*.42+7,1);
  }
  // Flush status console and cooling louvers.
  a.box(g,39,30,5,'polarFrame',x+w*.22,y+50,z+d*.46,3);
  a.box(g,31,21,3,'polarScreen',x+w*.22,y+51,z+d*.46+4,1);
  for(let i=0;i<3;i++) a.box(g,19-i*4,2,1,'polarLED',x+w*.22-3,y+57-i*6,z+d*.46+6,.3);
  for(let i=0;i<5;i++) a.box(g,23,2,3,'polarFrame',x-w*.24,y+34+i*6,z-d*.42+5,.4);
  // Recessed LED strip and industrial safety marks replace storm lanterns.
  a.box(g,w*.7,2,3,'polarLED',x,y+11,z+d*.5+4,.5);
  for(let i=0;i<5;i++) {
    const stripe=a.box(g,7,2,13,i%2?'polarFrame':'orange',x-w*.38+i*9,y+12,z+d*.36,0);
    stripe.rotation.y=-.4;
  }
  model.add(a.mergeRigid(g));
}
