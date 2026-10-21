import { GLTFLoader } from './vendor/GLTFLoader.js';
import { BufferAttribute } from './vendor/three.module.js';
import { loadPbrMaterials, partitionSurfaceMesh, actorMaterials } from './pbr-materials.js';
import { ActorAnimation, createActorClips } from './actor-animation.js';

const catalog = new Map();
let loading;
let clips;
export function loadSculptedAssets() {
  loading ??= Promise.all([
    new GLTFLoader().loadAsync(new URL('../assets/sculpted/frostline-art.glb', import.meta.url).href),
    fetch(new URL('../assets/sculpted/motions-v12.json', import.meta.url)).then(response => { if (!response.ok) throw new Error('Animation library failed to load'); return response.json(); }),
    loadPbrMaterials()
  ]).then(([{ scene }, motions]) => {
    clips = createActorClips(motions);
    for (const root of scene.children) {
      const key = (root.userData.asset || root.name).replace(/\.\d+$/, '');
      const replacements=[];
      root.traverse(node => {
        if (node.userData.joint) node.name = node.userData.joint;
        if (node.isMesh) {
          node.castShadow = node.receiveShadow = true;
          // Normalize the attribute layout for the existing static batching path.
          if (!node.geometry.attributes.uv) {
            const positions = node.geometry.attributes.position;
            const uv = new Float32Array(positions.count * 2);
            for (let i = 0; i < positions.count; i++) { uv[i * 2] = positions.getX(i) / 64; uv[i * 2 + 1] = positions.getY(i) / 64; }
            node.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
          }
          if(!node.geometry.attributes.uv1)throw Error('The delivered model is missing PBR detail UVs');
          replacements.push(node);
        }
      });
      for(const node of replacements){const parent=node.parent;parent.add(partitionSurfaceMesh(node));parent.remove(node);}
      catalog.set(key, root);
    }
    document.querySelector('#game')?.setAttribute('data-art', 'pbr-v18');
  });
  return loading;
}

export function sculptedModel(name) {
  const template = catalog.get(name);
  if (!template) throw new Error(`Missing sculpted model: ${name}`);
  const model = template.clone(true);
  model.name = `sculpted-${name}`;
  return model;
}

export function sculptedPerson(worker = false) {
  const g = sculptedModel(worker ? 'worker-character' : 'explorer');
  const joint = name => g.getObjectByName(name);
  const material = actorMaterials(g,0xff9064);
  g.userData = { ...g.userData, torso: joint('torso'), head: joint('head'), leftLeg: joint('leg-left'), rightLeg: joint('leg-right'), leftArm: joint('arm-left'), rightArm: joint('arm-right'), grip: joint('weapon-grip'), stack: joint('stack'), armor: joint('armor'), facing: 0, walk: 0, flash: material };
  g.userData.rightForearm = joint('forearm-right');
  g.userData.hand = joint('hand-right');
  g.userData.holster = joint('weapon-holster');
  g.userData.sheath = joint('blade-sheath');
  g.userData.leftShin = joint('shin-left');
  g.userData.animation = new ActorAnimation(g, clips, 'human');
  return g;
}

export function sculptedBeast(kind) {
  const g = sculptedModel(`beast-${kind}`), material = actorMaterials(g,0xffd693);
  g.userData = { kind, torso: g.getObjectByName('torso'), head: g.getObjectByName('head'), legs: Array.from({ length: 4 }, (_, i) => {
    const leg = g.getObjectByName(`beast-leg-${i}`); leg.userData.phase = Math.floor(i / 2) + i % 2; return leg;
  }), flash: material, facing: 0, walk: 0 };
  g.userData.animation = new ActorAnimation(g, clips, 'beast');
  return g;
}
