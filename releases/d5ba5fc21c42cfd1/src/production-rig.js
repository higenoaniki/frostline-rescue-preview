import {Bone,Skeleton,SkinnedMesh,Vector3} from './vendor/three.module.js';

// Preserve authored vertex weights and rest shape while expressing each bone in
// game axes. Blender bone-tail axes must not distort the existing timed axe IK.
export function canonicalizeProductionRig(root){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),skins=[];
  root.traverse(node=>{if(node.isSkinnedMesh)skins.push(node);});
  if(!skins.length)throw Error('Production character has no skinned meshes');
  const sourceBones=new Map();
  for(const skin of skins)for(const bone of skin.skeleton.bones)sourceBones.set(bone.name,bone);
  const positions=new Map([...sourceBones].map(([name,bone])=>[name,bone.getWorldPosition(new Vector3()).applyMatrix4(inverse)]));
  const bones=new Map([...sourceBones].map(([name])=>{const bone=new Bone();bone.name=name;return[name,bone];}));
  const roots=[];
  for(const [name,source]of sourceBones){
    const bone=bones.get(name),parent=source.parent?.isBone?bones.get(source.parent.name):null;
    bone.position.copy(positions.get(name));
    if(parent){bone.position.sub(positions.get(parent.name));parent.add(bone);}else roots.push(bone);
  }
  const parts=skins.map(skin=>{
    const geometry=skin.geometry.clone().applyMatrix4(inverse.clone().multiply(skin.matrixWorld));
    const mesh=new SkinnedMesh(geometry,skin.material);mesh.name=skin.name;mesh.userData={...skin.userData};
    mesh.castShadow=mesh.receiveShadow=true;
    return{mesh,order:skin.skeleton.bones.map(bone=>bones.get(bone.name))};
  });
  root.clear();root.add(...roots,...parts.map(part=>part.mesh));root.updateWorldMatrix(true,true);
  for(const {mesh,order}of parts){
    mesh.bind(new Skeleton(order),mesh.matrixWorld.clone());mesh.normalizeSkinWeights();
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
    // Arm/axe poses can move outside the rest box. Only two human actors use
    // this bound; never cull their skinned sleeves from a stale bind-pose box.
    mesh.frustumCulled=false;
  }
  root.userData.canonicalRig=true;
  return root;
}
