import * as T from './vendor/three.module.js';

const maps=new Map();
export function softenSnowMaterial(material){
  const before=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){before.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb = mix(diffuse, diffuseColor.rgb, 0.22);\n#endif');};
  material.customProgramCacheKey=()=>`soft-snow-v2:${before.toString()}`;return material;
}
export function snowSurfaceMap(x=16,y=x){
  const key=`${x}:${y}`;if(maps.has(key))return maps.get(key);
  const map=new T.TextureLoader().load(new URL('../assets/snowfront/snow-surface-v2.jpg',import.meta.url).href);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(x,y);map.anisotropy=4;maps.set(key,map);return map;
}
export function snowHeight(x,z){
  if(z>=-.3||z>=-15&&z<=-9)return .002;
  const edge=Math.min(1,Math.abs(x)/7);
  return .004+edge*(.055+.035*Math.sin(x*.7+z*.32)+.025*Math.cos(z*.81-x*.3));
}
export function snowGroundGeometry(){
  const geometry=new T.PlaneGeometry(160,160,112,112);geometry.rotateX(-Math.PI/2);
  const p=geometry.attributes.position,colors=new Float32Array(p.count*3),white=new T.Color(0xf9fcff),packed=new T.Color(0xc7dee6);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);p.setY(i,snowHeight(x,z));
    const trail=z<0?Math.max(0,1-Math.abs(x-Math.sin(z*.16)*.5)/1.8):0;
    white.clone().lerp(packed,trail*.28).toArray(colors,i*3);
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
function bankGeometry(width,depth,height){
  const g=new T.PlaneGeometry(width,depth,18,10);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),rim=Math.max(0,1-(x/(width/2))**2)*Math.max(0,1-(z/(depth/2))**2);p.setY(i,.004+height*Math.pow(rim,.7)*(1+.1*Math.sin(x*2+z)));}
  g.computeVertexNormals();return g;
}
export class SnowLandscape{
  constructor(scene,ground){
    this.scene=scene;this.ground=ground;ground.geometry.dispose();ground.geometry=snowGroundGeometry();
    ground.material.map=snowSurfaceMap();ground.material.vertexColors=true;softenSnowMaterial(ground.material);ground.material.needsUpdate=true;
    this.root=new T.Group();scene.add(this.root);this.steps=0;this.last=null;
    const bankMat=softenSnowMaterial(new T.MeshStandardMaterial({color:0xf1f7fb,map:snowSurfaceMap(2),roughness:.94}));
    const bankGeo=bankGeometry(7,14,1.3);
    for(let i=0;i<14;i++){const bank=new T.Mesh(bankGeo,bankMat);bank.position.set((i%2?1:-1)*(28+Math.sin(i*5)*2),0,-33+Math.floor(i/2)*8);bank.rotation.y=(i%3-.7)*.16;bank.castShadow=bank.receiveShadow=true;bank.userData.outlineParameters={visible:false};this.root.add(bank);}
    const iceMat=new T.MeshStandardMaterial({color:0xb5d6df,roughness:.42});
    for(let i=0;i<10;i++){
      const ridge=new T.Mesh(bankGeometry(4.5,8,2.1),iceMat);ridge.position.set((i%2?1:-1)*(32+i%3),-.4,-29+Math.floor(i/2)*9);ridge.receiveShadow=true;this.root.add(ridge);
      const cap=new T.Mesh(bankGeometry(4.8,8.4,2),bankMat);cap.position.copy(ridge.position);cap.position.y+=.24;cap.receiveShadow=true;cap.userData.outlineParameters={visible:false};this.root.add(cap);
    }
    const outline=new T.Shape();outline.moveTo(-.09,-.17);outline.quadraticCurveTo(-.16,.12,-.06,.23);outline.quadraticCurveTo(.1,.3,.12,.12);outline.lineTo(.09,-.17);outline.closePath();
    const footprint=new T.ShapeGeometry(outline,6);footprint.rotateX(-Math.PI/2);
    this.footprints=new T.InstancedMesh(footprint,new T.MeshBasicMaterial({color:0x7d9fae,transparent:true,opacity:.22,depthWrite:false}),96);
    this.footprints.count=0;this.footprints.frustumCulled=false;this.footprints.userData.outlineParameters={visible:false};scene.add(this.footprints);this.dummy=new T.Object3D();
  }
  update(p){
    if(!p.moving||p.y>=0){this.last=null;return;}
    if(this.last&&Math.hypot(this.last.x-p.x,this.last.y-p.y)<.62)return;
    const side=this.steps%2?1:-1,offset=.16*side,x=p.x-Math.sin(p.facing)*offset,z=p.y+Math.cos(p.facing)*offset;
    this.last={x:p.x,y:p.y};this.dummy.position.set(x,snowHeight(x,z)+.012,z);this.dummy.rotation.set(0,-p.facing+Math.PI/2,0);this.dummy.updateMatrix();
    this.footprints.setMatrixAt(this.steps%96,this.dummy.matrix);this.steps++;this.footprints.count=Math.min(96,this.steps);this.footprints.instanceMatrix.needsUpdate=true;
  }
  reset(){this.last=null;this.steps=0;this.footprints.count=0;}
}
