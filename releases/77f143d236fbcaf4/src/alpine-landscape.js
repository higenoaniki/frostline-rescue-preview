import * as THREE from './vendor/three.module.js';
import { WORLD, toX, toZ } from './world-config.js';

const outcropMaterial = new THREE.MeshStandardMaterial({ color:0xe5edf0, roughness:.88, vertexColors:true });

export function iceOutcrop(a, parent, x, z, width, height, turn=0) {
  const geometry=a.cached('weathered-ice-outcrop-v16',()=>{
    const shape=new THREE.SphereGeometry(.5,14,10), p=shape.attributes.position;
    const colors=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++) {
      const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
      const strata=Math.sin(py*36)*.028, fracture=Math.sin(px*21+pz*17+py*13)*.065;
      p.setXYZ(i,px*(1+fracture)+strata,py+fracture*.17,pz*(1+fracture));
      const snow=Math.max(0,Math.min(1,(py-.03)*5));
      const color=new THREE.Color(0x879eaa).lerp(new THREE.Color(0xf4f4ec),snow);
      color.multiplyScalar(.94+Math.cos(py*46)*.045);color.toArray(colors,i*3);
    }
    shape.setAttribute('color',new THREE.BufferAttribute(colors,3));shape.computeVertexNormals();return shape;
  });
  const rock=a.mesh(parent,geometry,outcropMaterial,x,height*.44,z);
  rock.scale.set(width,height,width*.85);rock.rotation.y=turn;return rock;
}

export function buildAlpineLandscape(a) {
  const group = new THREE.Group(); group.name = 'alpine-glacier-v16';
  const ice = new THREE.MeshStandardMaterial({ color:0xa9d7e1,roughness:.64,metalness:.08,vertexColors:true });
  const geometry = new THREE.BoxGeometry(1,1,1,4,8,3);
  const p = geometry.attributes.position, colors = new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const fracture=Math.sin(x*29+y*17+z*23)*.028+Math.cos(y*31-z*11)*.018;
    p.setXYZ(i,x+fracture,y+fracture*.35,z+fracture*2);
    const color=new THREE.Color(0x93bac7).lerp(new THREE.Color(0xf1f3eb),Math.max(0,y+.18)*1.5);
    color.multiplyScalar(.9+Math.sin(y*48+x*9)*.08);color.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
  const capGeometry=geometry.clone();capGeometry.deleteAttribute('color');
  for(let i=0;i<28;i++) {
    const x=-450+i*110, y=-410+Math.sin(i*1.3)*80, height=260+Math.sin(i*.7)*85+(i%5)*55;
    const crag=new THREE.Mesh(geometry,ice);
    crag.position.set(toX(x),height*.46-32,toZ(y));crag.scale.set(126+i%3*20,height,170+i%4*35);
    crag.rotation.y=Math.sin(i*3)*.15;crag.castShadow=crag.receiveShadow=true;group.add(crag);
    const cap=a.mesh(group,capGeometry,a.m.snow,toX(x),height-15,toZ(y));
    cap.scale.set(129+i%3*20,35,174+i%4*35);cap.rotation.y=crag.rotation.y;
  }
  // Far woodland is actual repeated 3D foliage, outside the traversable field.
  for(let i=0;i<24;i++) {
    const side=i%2?1:-1, y=180+Math.floor(i/2)*360;
    const tree=a.tree();tree.position.set(side*(WORLD.width/2+95+(i*37)%120),0,toZ(y));
    tree.scale.setScalar(1.15+(i%4)*.17);tree.rotation.y=i*2.4;group.add(tree);
  }
  return group;
}
