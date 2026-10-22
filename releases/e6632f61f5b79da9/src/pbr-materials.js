import {TextureLoader,RepeatWrapping,SRGBColorSpace,MeshPhysicalMaterial,Vector2,BufferGeometry,Mesh,Group} from './vendor/three.module.js';

const textures=new Map(),materials=new Map();
const sets=['snow','wood','cloth','leather','metal'];
let loading;
export function loadPbrMaterials(){
  loading??=(async()=>{
    const loader=new TextureLoader();
    await Promise.all(sets.flatMap(set=>(['snow','wood'].includes(set)?['color','normal','roughness']:['normal','roughness']).map(async role=>{
      const file=role==='color'?`${set}-calibrated.jpg`:`${set}-${role}.${role==='normal'?'png':'jpg'}`;
      const texture=await loader.loadAsync(new URL(`../assets/pbr/${file}`,import.meta.url).href);
      // External maps must use the same upper-left UV convention as glTF.
      texture.channel=1;texture.flipY=false;texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=8;
      if(role==='color')texture.colorSpace=SRGBColorSpace;
      textures.set(`${set}-${role}`,texture);
    })));
    const face=await loader.loadAsync(new URL('../assets/pbr/face-color.jpg',import.meta.url).href);
    face.channel=1;face.flipY=false;face.colorSpace=SRGBColorSpace;face.anisotropy=8;textures.set('face-color',face);
  })();return loading;
}

export function pbrMaterial(family){
  if(materials.has(family))return materials.get(family);
  const props={name:`PBR surface ${family}`,vertexColors:true,roughness:.8,metalness:0};
  const set=family===1?'wood':family===2||family===5?'cloth':family===3||family===9?'metal':family===4?'snow':family===8?'leather':null;
  if(set){props.normalMap=textures.get(`${set}-normal`)??null;props.roughnessMap=textures.get(`${set}-roughness`)??null;props.normalScale=new Vector2(.55,.55);}
  if(family===1){props.map=textures.get('wood-color')??null;props.roughness=.9;}
  if(family===2||family===5){props.sheen=.24;props.sheenColor=0x6d7176;props.sheenRoughness=.85;props.roughness=.95;props.normalScale=new Vector2(.35,.35);}
  if(family===3){props.metalness=.95;props.roughness=.65;props.normalScale=new Vector2(.2,.2);}
  if(family===4){props.map=textures.get('snow-color')??null;props.roughness=.95;props.sheen=.15;props.sheenColor=0xe7f1ff;props.normalScale=new Vector2(.22,.22);}
  if(family===6){props.roughness=.43;props.specularIntensity=.4;}
  if(family===7){props.emissive=0xffad52;props.emissiveIntensity=1.8;}
  if(family===8){props.roughness=.85;props.clearcoat=.12;props.clearcoatRoughness=.5;}
  if(family===9){props.roughness=.8;props.normalScale=new Vector2(.15,.15);}
  if(family===10){props.sheen=.4;props.sheenColor=0xa88c72;props.roughness=.47;}
  if(family===11){props.map=textures.get('face-color')??null;props.roughness=.62;props.specularIntensity=.35;}
  if(family===12){props.roughness=.9;props.sheen=.15;props.sheenColor=0xa3b8a8;}
  const material=new MeshPhysicalMaterial(props);material.userData={pipeline:'native-pbr-v18',family};
  materials.set(family,material);return material;
}

// Keep shared vertex buffers and only partition the index buffer. Each material
// uses ordinary Three.js PBR and real TEXCOORD_1, not a per-pixel triplanar shader.
export function partitionSurfaceMesh(mesh){
  const source=mesh.geometry,uv=source.attributes.uv,buckets=new Map();
  const count=source.index?.count??source.attributes.position.count;
  for(let i=0;i<count;i+=3){
    const indices=[0,1,2].map(j=>source.index?source.index.getX(i+j):i+j);
    const family=Math.round(uv.getX(indices[0]));
    if(!buckets.has(family))buckets.set(family,[]);buckets.get(family).push(...indices);
  }
  const group=new Group();group.name=mesh.name;group.userData={...mesh.userData};
  group.position.copy(mesh.position);group.quaternion.copy(mesh.quaternion);group.scale.copy(mesh.scale);
  for(const [family,indices]of buckets){
    const geometry=new BufferGeometry();for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
    geometry.setIndex(indices);geometry.computeBoundingSphere();
    const part=new Mesh(geometry,pbrMaterial(family));part.name=`${mesh.name}-surface-${family}`;part.castShadow=part.receiveShadow=true;group.add(part);
  }
  return group;
}

export function actorMaterials(root,color){
  const copies=new Map();
  root.traverse(node=>{if(!node.isMesh)return;if(!copies.has(node.material)){
    const material=node.material.clone();material.emissive.set(color);material.emissiveIntensity=0;copies.set(node.material,material);
  }node.material=copies.get(node.material);});
  return [...copies.values()];
}

export function terrainPbrMaterial(family){
  const material=pbrMaterial(family).clone();material.vertexColors=false;
  for(const key of ['map','normalMap','roughnessMap'])if(material[key]){material[key]=material[key].clone();material[key].channel=0;material[key].flipY=true;}
  return material;
}
