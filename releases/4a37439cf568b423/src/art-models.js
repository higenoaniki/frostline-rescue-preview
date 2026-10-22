import * as THREE from './vendor/three.module.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { mergeCompatibleGeometries } from './geometry-batching.js';
import { explorer, frostBeast, processingWorkshop, winterForge, supplyBeacon, upgradeWorkshop } from './winter-art.js';
import {terrainPbrMaterial} from './pbr-materials.js';

export class ArtModels {
  constructor(profile = { anisotropy: 4 }) {
    this.geometry = new Map();
    this.templates = new Map();
    this.creatures = new Map();
    const loader = new THREE.TextureLoader();
    this.textures = {};
    for (const [name, file] of Object.entries({ wood: 'wood', cloth: 'canvas', steel: 'steel', snow: 'snow' })) {
      if(profile.toon)continue;
      const map = loader.load(new URL(`../assets/generated/${file}-surface-v2.png`, import.meta.url).href);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = profile.anisotropy;
      this.textures[name] = map;
    }
    const mat = (color, texture, props = {}) => new THREE.MeshStandardMaterial({
      color, map: this.textures[texture] || null, roughness: 0.78, ...props
    });
    this.m = {
      snow: mat(0xffffff, 'snow'), wood: mat(0x8b6245, 'wood', {roughness:.86}), darkWood: mat(0x443a32, 'wood', {roughness:.91}),
      cloth: mat(0xffffff, 'cloth'), red: mat(0xe95149, 'cloth'), teal: mat(0x3daba7, 'steel'),
      navy: mat(0x34454f, 'cloth'), leather: mat(0xa35440, 'cloth'), steel: mat(0xc3d3d6, 'steel', { metalness: 0.35, roughness: 0.42 }),
      trim: mat(0xe8f3ec), black: mat(0x27343d), skin: mat(0xffc59e), hair: mat(0x51413e),
      gold: mat(0xf7bf38, null, { metalness: 0.35, roughness: 0.34 }), green: mat(0x60c480),
      paper: mat(0xf6e3b5, 'cloth'), raw: mat(0xdb6b64), rawCut: mat(0xf09c86), rawFat: mat(0xffd7b2),
      fur: mat(0x8bafb5, 'cloth'), furLight: mat(0xd4e3dc, 'cloth'), horn: mat(0xf4dfb2),
      alphaFur: mat(0x566c72, 'cloth'), alphaLight: mat(0x94a1a3, 'cloth'),
      pine: mat(0x379a7e), pineDark: mat(0x287362), orange: mat(0xf3a443), blue: mat(0x4f96c5),
      fire: new THREE.MeshStandardMaterial({ color: 0xffbe57, emissive: 0xff682b, emissiveIntensity: 0.8 }),
      glass: mat(0x9fdbdf, null, { metalness: 0.1, roughness: 0.15 }),
      stone: mat(0xa3bbc4), stoneDark: mat(0x7795a3), floor: mat(0xbed2cd), tile: mat(0xd5e1d8)
    };
    this.m.character = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
    this.m.lamp = new THREE.MeshStandardMaterial({ color: 0xb7f2ff, emissive: 0x46cce8, emissiveIntensity: 1.7, roughness: .22 });
    this.m.roofRed = mat(0x963c36, 'wood', { roughness: .9 });
    this.m.roofTeal = mat(0x275c58, 'wood', { roughness: .87 });
    this.m.edge = mat(0xe4eef2, null, { metalness: .9, roughness: .2 });
    for (const [id, material] of Object.entries(this.m)) {
      if (material.map) { material.bumpMap = material.map; material.bumpScale = id === 'snow' ? .65 : id === 'steel' ? .16 : .4; }
    }
    this.m.character.bumpMap = this.textures.cloth; this.m.character.bumpScale = .15;
    this.m.steel.metalness = .72; this.m.steel.roughness = .3;
    this.m.glass.metalness = .3; this.m.glass.roughness = .12;
    this.m.furLight.color.set(0xe9ede4); this.m.floor.color.set(0xa3b3b3);
    if(profile.toon){
      for(const [name,material]of Object.entries(this.m))this.m[name]=new THREE.MeshToonMaterial({color:material.color,vertexColors:material.vertexColors,emissive:material.emissive,emissiveIntensity:material.emissiveIntensity});
      this.toon=true;return;
    }
    this.m.snow=terrainPbrMaterial(4);
    this.m.snow.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 snowWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        #ifdef USE_MAP
          vMapUv = snowWorld.xz * 0.004;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = snowWorld.xz * 0.012;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = snowWorld.xz * 0.004;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = snowWorld.xz * 0.004;
        #endif`);
    };
  }

  cached(key, factory) {
    if (!this.geometry.has(key)) this.geometry.set(key, factory());
    return this.geometry.get(key);
  }

  mesh(group, geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? this.m[material] : material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  box(g, w, h, d, mat, x = 0, y = 0, z = 0, radius = 3) {
    const geo = this.cached(`b:${w}:${h}:${d}:${radius}`, () => new RoundedBoxGeometry(w, h, d, 2, radius));
    return this.mesh(g, geo, mat, x, y, z);
  }

  ball(g, w, h, d, mat, x = 0, y = 0, z = 0) {
    const geo = this.cached('sphere', () => new THREE.SphereGeometry(1, 16, 12));
    const mesh = this.mesh(g, geo, mat, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }

  cylinder(g, r, h, mat, x = 0, y = 0, z = 0, r2 = r) {
    return this.mesh(g, this.cached(`c:${r}:${r2}:${h}`, () => new THREE.CylinderGeometry(r, r2, h, 16)), mat, x, y, z);
  }

  tube(g, points, radius, mat) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.mesh(g, new THREE.TubeGeometry(curve, 12, radius, 6, false), mat);
  }

  item(type) {
    if (!this.templates.has(type)) this.templates.set(type, this.mergeRigid(this.makeItem(type)));
    return this.templates.get(type).clone(true);
  }

  lootPile(type, amount) {
    const shown = Math.min(4, Math.ceil(amount / 2)), key = `loot:${type}:${shown}`;
    if (!this.templates.has(key)) {
      const pile = new THREE.Group();
      for (let i = 0; i < shown; i++) { const item = this.item(type); item.position.y = i * 12; item.rotation.y = i % 2 * .1; pile.add(item); }
      this.templates.set(key, this.mergeRigid(pile));
    }
    return this.templates.get(key).clone(true);
  }

  mergeRigid(group, keep = []) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map(), prepared = [], merged = [];
    const children = group.children.filter((child) => !keep.includes(child.name));
    try {
      for (const child of children) child.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        prepared.push(geo);
        geo.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        if (!buckets.has(mesh.material)) buckets.set(mesh.material, []);
        buckets.get(mesh.material).push(geo);
      });
      for (const [material, geometries] of buckets) {
        for (const geometry of mergeCompatibleGeometries(geometries)) merged.push({geometry, material});
      }
    } catch (error) {
      merged.forEach(({geometry}) => geometry.dispose());
      throw error;
    } finally {
      prepared.forEach(geometry => geometry.dispose());
    }
    children.forEach(child => group.remove(child));
    for (const {geometry, material} of merged) this.mesh(group, geometry, material);
    return group;
  }

  mergeColored(group, keep = []) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), geometries = [];
    const children = group.children.filter(child => !keep.includes(child.name));
    for (const child of children) child.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geo.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      const color = mesh.material.color, colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometries.push(geo);
    });
    children.forEach(child => group.remove(child));
    const geometry = mergeGeometries(geometries);
    if (geometry) this.mesh(group, geometry, this.m.character);
    geometries.forEach(geo => geo.dispose()); return group;
  }

  makeItem(type) {
    const g = new THREE.Group();
    if (type === 'raw') {
      this.box(g, 50, 12, 33, 'wood', 0, 0, 0, 3);
      const shape = new THREE.Shape(); shape.moveTo(-22, -5); shape.bezierCurveTo(-26, 8, -9, 17, 8, 13); shape.bezierCurveTo(26, 12, 25, 1, 17, -6); shape.bezierCurveTo(5, -15, -17, -16, -22, -5);
      const steak = this.cached('steak-slice', () => new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2, steps: 1, curveSegments: 8 }));
      this.mesh(g, steak, 'rawFat', 0, 10, 0).rotation.x = -Math.PI / 2;
      const meat = this.mesh(g, steak, 'raw', 0, 13, 0); meat.rotation.x = -Math.PI / 2; meat.scale.set(.85, .82, 1);
      this.tube(g, [[-12, 25, -4], [-3, 25, 0], [4, 25, 5], [12, 25, 3]], .8, 'rawFat');
      this.tube(g, [[-2, 25, 0], [3, 25, -5], [9, 25, -6]], .6, 'rawCut');
    } else if (type === 'core') {
      this.cylinder(g, 17, 8, 'steel', 0, 4, 0);
      this.mesh(g, this.cached('core', () => new THREE.OctahedronGeometry(23)), 'glass', 0, 31, 0);
      for (const x of [-13, 13]) this.mesh(g, this.cached('core-small', () => new THREE.OctahedronGeometry(10)), 'blue', x, 15, 0);
      this.box(g, 7, 4, 30, 'gold', 0, 10, 0, 1);
    } else if (type === 'fur') {
      this.box(g, 41, 7, 30, 'leather', 0, 5, 0, 4);
      for (const x of [-12, 0, 12]) this.ball(g, 9, 8, 16, 'furLight', x, 12, 0);
      this.box(g, 6, 18, 33, 'red', 0, 10, 0, 2);
    } else if (type === 'ore') {
      this.mesh(g, new THREE.DodecahedronGeometry(19, 0), 'steel', 0, 17, 0);
      this.mesh(g, new THREE.OctahedronGeometry(11), 'blue', 9, 28, 0);
      this.mesh(g, new THREE.OctahedronGeometry(8), 'gold', -11, 23, 6);
    } else if (type === 'cuts') {
      this.box(g, 49, 6, 32, 'steel', 0, 3, 0, 3);
      for (const x of [-12, 12]) {
        this.box(g, 19, 11, 23, 'rawCut', x, 12, 0, 5);
        this.box(g, 17, 2, 4, 'rawFat', x, 18, 3, 1);
      }
    } else if (type === 'armor') {
      this.box(g, 43, 39, 11, 'leather', 0, 21, 0, 8);
      for (const y of [14, 24, 34]) this.box(g, 31, 8, 5, 'steel', 0, y, 8, 3);
      for (const x of [-13, 13]) for (const y of [14, 34]) this.ball(g, 1.5, 1.5, 1, 'gold', x, y, 11);
      for (const x of [-25, 25]) {
        this.ball(g, 12, 8, 14, 'furLight', x, 39, 0);
        this.box(g, 16, 5, 20, 'steel', x, 44, 0, 3);
      }
      for (const x of [-12, 0, 12]) this.ball(g, 7, 5, 5, 'trim', x, 42, 2);
      this.box(g, 46, 7, 13, 'leather', 0, 6, 0, 2);
    } else if (type === 'goods') {
      this.box(g, 50, 24, 33, 'paper', 0, 12, 0, 7);
      for (const x of [-15, 15]) this.box(g, 5, 25, 35, 'leather', x, 12, 0, 1);
      this.box(g, 50, 25, 4, 'leather', 0, 12, 0, 1);
      this.cylinder(g, 5, 3, 'red', 0, 26, 0);
    } else if (type === 'cash') {
      this.box(g, 45, 13, 29, 'green', 0, 7, 0, 2);
      this.box(g, 10, 15, 30, 'paper', 0, 7, 0, 1);
      for (const y of [3, 6, 9, 12]) this.box(g, 44, 0.7, 28, 'trim', 0, y, 0, 0.2);
    } else if (type.startsWith('axe')) {
      this.cylinder(g, 3.6, 60, 'wood', 0, 12, 0);
      this.cylinder(g, 4.8, 20, 'leather', 0, -6, 0);
      const shape = new THREE.Shape();
      shape.moveTo(-6, -9); shape.lineTo(9, -7); shape.quadraticCurveTo(21, -6, 28, -18);
      shape.quadraticCurveTo(35, -4, 30, 18); shape.quadraticCurveTo(22, 8, 9, 7);
      shape.lineTo(-6, 9); shape.closePath();
      const blade = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelSize: 1.3, bevelThickness: 1, bevelSegments: 2, steps: 1 });
      this.mesh(g, blade, 'steel', 0, 37, -2.5);
      const edge = this.mesh(g, blade, 'edge', 1.5, 37, 3.2); edge.scale.set(.95, .93, .12);
      if (type === 'axe3') {
        const other = this.mesh(g, blade, 'steel', 0, 37, -2.5); other.rotation.y = Math.PI;
        this.cylinder(g, 5, 6, 'gold', 0, 43, 0);
      }
      this.box(g, 10, 15, 8, 'black', 0, 37, 0, 2);
    } else if (type === 'pack') {
      this.box(g, 36, 44, 22, 'leather', 0, 22, 0, 8);
      this.box(g, 29, 15, 7, 'red', 0, 14, 13, 4);
      const roll = this.cylinder(g, 8, 42, 'teal', 0, 49, 0);
      roll.rotation.z = Math.PI / 2;
      for (const x of [-11, 11]) {
        this.box(g, 4, 49, 3, 'darkWood', x, 23, 12, 1);
        this.box(g, 6, 7, 4, 'gold', x, 29, 14, 1);
      }
      this.cylinder(g, 5, 10, 'steel', 22, 19, 1);
    }
    return g;
  }

  humanoid(color = 'red', hat = 'navy') {
    return explorer(this, color, hat);
  }


  creature(kind = 'normal') {
    if (typeof kind === 'boolean') kind = kind ? 'alpha' : 'normal';
    if (!this.creatures.has(kind)) {
      const template = frostBeast(this, kind);
      template.userData.legs.forEach((leg, i) => { leg.name = `beast-leg-${i}`; });
      template.userData = { kind }; this.creatures.set(kind, template);
    }
    const g = this.creatures.get(kind).clone(true);
    const flash = this.m.character.clone(); flash.emissive.set(0xffd693);
    g.traverse(mesh => { if (mesh.isMesh && mesh.material === this.m.character) mesh.material = flash; });
    g.userData = { kind, flash, torso: g.getObjectByName('torso'), head: g.getObjectByName('head'), legs: Array.from({ length: 4 }, (_, i) => g.getObjectByName(`beast-leg-${i}`)), walk: 0, facing: 0 };
    return g;
  }


  crate() {
    const g = new THREE.Group();
    this.box(g, 64, 38, 45, 'wood', 0, 19, 0, 2);
    for (const x of [-26, 26]) this.box(g, 7, 42, 48, 'darkWood', x, 20, 0, 1);
    for (const y of [10, 29]) this.box(g, 67, 5, 49, 'darkWood', 0, y, 0, 1);
    return g;
  }

  processor(canner = false) { return processingWorkshop(this, canner); }
  forge() { return winterForge(this); }
  beacon() { return supplyBeacon(this); }
  upgradeWorkshop(role) { return upgradeWorkshop(this, role); }


  dispatchDepot() {
    const g = new THREE.Group();
    this.box(g, 232, 18, 144, 'steel', 0, 9, 0, 8);
    this.box(g, 205, 5, 124, 'teal', 0, 21, 0, 6);
    for (const x of [-64, 64]) this.box(g, 8, 3, 93, 'trim', x, 25, 0, 2);
    this.box(g, 136, 3, 8, 'trim', 0, 25, 0, 2);
    for (const x of [-90, 90]) this.cylinder(g, 5, 138, 'steel', x, 83, -57);
    this.box(g, 220, 14, 72, 'orange', 0, 156, -37, 4);
    this.box(g, 206, 8, 67, 'trim', 0, 166, -37, 3);
    this.box(g, 190, 9, 12, 'black', 0, 142, -4, 2);
    for (const x of [-80, 80]) this.ball(g, 7, 5, 4, 'green', x, 141, 4);
    this.box(g, 58, 58, 27, 'blue', 78, 54, 52, 6);
    this.box(g, 39, 24, 5, 'black', 78, 63, 69, 3);
    for (const x of [66, 78, 90]) this.box(g, 7, 7, 5, 'green', x, 47, 69, 1);
    this.cylinder(g, 4, 96, 'steel', -89, 83, 47);
    this.ball(g, 9, 9, 9, 'gold', -89, 133, 47);
    const crate = this.crate(); crate.scale.setScalar(0.75); crate.position.set(-77, 25, 4); g.add(crate);
    for (const x of [-104, 104]) for (const z of [-62, 62]) this.cylinder(g, 3, 15, 'gold', x, 32, z);
    for (const x of [-74, -41]) {
      const parcel = this.item('goods'); parcel.position.set(x, 35, -24); parcel.scale.setScalar(0.62); g.add(parcel);
    }
    for (const x of [-88, 88]) this.box(g, 15, 33, 10, 'leather', x, 132, -51, 2).rotation.z = x > 0 ? -0.55 : 0.55;
    return g;
  }

  rack() {
    const g = new THREE.Group();
    for (const x of [-82, 82]) for (const z of [-25, 25]) this.box(g, 9, 100, 9, 'darkWood', x, 50, z, 2);
    for (const y of [14, 57, 101]) this.box(g, 180, 8, 66, 'wood', 0, y, 0, 2);
    for (const x of [-81, 81]) {
      const brace = this.box(g, 8, 107, 7, 'steel', x, 55, -29, 1); brace.rotation.z = x > 0 ? -0.08 : 0.08;
      for (const y of [18, 61, 96]) this.ball(g, 2.5, 2.5, 2, 'gold', x, y, 30);
    }
    this.box(g, 176, 7, 14, 'snow', 0, 108, -23, 3);
    return g;
  }

  bench() {
    const g = new THREE.Group();
    this.box(g, 175, 17, 88, 'wood', 0, 66, 0, 4);
    for (const x of [-68, 68]) for (const z of [-29, 29]) this.box(g, 13, 64, 13, 'darkWood', x, 32, z, 2);
    this.box(g, 60, 18, 37, 'steel', -24, 88, 0, 3);
    this.box(g, 24, 23, 26, 'steel', -24, 72, 0, 2);
    const horn = this.cylinder(g, 13, 35, 'steel', 17, 89, 0, 3); horn.rotation.z = Math.PI / 2;
    this.box(g, 36, 28, 33, 'black', 62, 81, -10, 3);
    this.ball(g, 12, 13, 10, 'fire', 62, 106, -10);
    const axe = this.item('axe'); axe.position.set(-42, 111, 12); axe.rotation.z = -0.7; g.add(axe);
    for (const x of [-72, 72]) this.box(g, 7, 73, 8, 'darkWood', x, 113, -32, 2);
    this.box(g, 150, 30, 8, 'wood', 0, 143, -32, 2);
    const display = this.item('axe3'); display.position.set(38, 131, -23); display.rotation.z = -0.7; display.scale.setScalar(0.62); g.add(display);
    for (const x of [-66, 66]) for (const z of [-27, 27]) this.ball(g, 2, 1, 2, 'steel', x, 76, z);
    return g;
  }

  packStand() {
    const g = this.bench();
    // Backpack stand has a hanging rail, not the smith's tools.
    while (g.children.length > 5) g.remove(g.children[g.children.length - 1]);
    for (const x of [-70, 70]) this.box(g, 8, 132, 8, 'darkWood', x, 91, -25, 2);
    this.box(g, 152, 8, 8, 'wood', 0, 153, -25, 2);
    const pack = this.item('pack'); pack.scale.setScalar(1.8); pack.position.set(0, 75, 0); g.add(pack);
    return g;
  }

  armorStand() {
    const g = new THREE.Group();
    this.box(g, 150, 12, 80, 'wood', 0, 8, 0, 4);
    this.cylinder(g, 7, 100, 'steel', 0, 57, 0);
    const armor = this.item('armor'); armor.scale.setScalar(2.2); armor.position.set(0, 42, 0); g.add(armor);
    for (const x of [-62, 62]) this.box(g, 6, 115, 7, 'darkWood', x, 70, -26, 2);
    this.box(g, 133, 9, 14, 'wood', 0, 129, -26, 2);
    for (const x of [-21, 21]) this.ball(g, 13, 7, 13, 'furLight', x, 132, 4);
    const pack = this.item('pack'); pack.scale.setScalar(0.8); pack.position.set(53, 15, 15); g.add(pack);
    return g;
  }

  hunterTower() {
    const g = new THREE.Group(), turret = new THREE.Group();
    this.box(g, 110, 20, 94, 'stoneDark', 0, 10, 0, 6);
    this.cylinder(g, 27, 91, 'steel', 0, 65, 0);
    this.box(g, 90, 12, 80, 'teal', 0, 114, 0, 5);
    turret.position.y = 130; g.add(turret);
    this.box(turret, 56, 32, 43, 'teal', 0, 8, 0, 7);
    const barrel = this.cylinder(turret, 8, 84, 'steel', 0, 14, 51); barrel.rotation.x = Math.PI / 2;
    this.box(turret, 15, 14, 7, 'black', 0, 14, 95, 2);
    for (const x of [-31, 31]) this.box(turret, 17, 38, 38, 'gold', x, 7, 0, 4);
    g.userData.turret = turret;
    return g;
  }

  workerOffice() {
    const g = new THREE.Group();
    this.box(g, 134, 14, 93, 'wood', 0, 7, 0, 3);
    for (const x of [-52, 52]) this.cylinder(g, 4, 106, 'steel', x, 65, -28);
    this.box(g, 142, 11, 67, 'orange', 0, 123, -18, 5);
    this.box(g, 64, 41, 37, 'teal', 0, 38, -13, 6);
    this.box(g, 18, 7, 42, 'trim', 0, 45, -13, 2);
    this.box(g, 41, 7, 18, 'trim', 0, 45, -13, 2);
    const crate = this.crate(); crate.position.set(39, 14, 23); crate.scale.setScalar(0.55); g.add(crate);
    this.box(g, 126, 83, 9, 'wood', 0, 56, -41, 3);
    this.box(g, 88, 38, 5, 'navy', 0, 76, -34, 3);
    for (const x of [-28, 0, 28]) { this.box(g, 15, 21, 4, 'paper', x, 76, -30, 1); this.box(g, 9, 2, 5, 'red', x, 76, -27, 0.5); }
    this.box(g, 107, 6, 20, 'snow', 0, 130, -37, 3);
    for (const x of [-55, 55]) this.box(g, 9, 27, 9, 'darkWood', x, 103, -27, 1).rotation.z = x > 0 ? -0.5 : 0.5;
    return g;
  }

  droneDock(color = 'teal') {
    const g = new THREE.Group();
    this.box(g, 108, 18, 96, 'steel', 0, 9, 0, 8);
    this.box(g, 91, 5, 78, color, 0, 20, 0, 6);
    for (const x of [-34, 34]) this.box(g, 8, 3, 60, 'trim', x, 24, 0, 1);
    this.box(g, 53, 38, 23, color, 0, 41, -36, 5);
    this.box(g, 38, 20, 4, 'black', 0, 46, -22, 2);
    for (const x of [-11, 0, 11]) this.box(g, 5, 8, 5, 'green', x, 46, -19, 1);
    this.cylinder(g, 4, 51, 'steel', 40, 48, -30);
    this.ball(g, 6, 6, 6, 'gold', 40, 76, -30);
    return g;
  }

  drone(color = 'teal') {
    const g = new THREE.Group(), rotors = [];
    this.box(g, 55, 22, 44, color, 0, 8, 0, 9);
    this.box(g, 32, 7, 31, 'steel', 0, 23, 0, 4);
    this.ball(g, 11, 8, 5, 'glass', 0, 7, 24);
    this.box(g, 112, 7, 70, 'wood', 0, -70, 0, 3);
    for (const x of [-48, 48]) for (const z of [-28, 28]) this.box(g, 3, 78, 3, 'steel', x, -31, z, 1);
    for (const x of [-43, 43]) for (const z of [-34, 34]) {
      const arm = this.box(g, 50, 6, 8, 'steel', x / 2, 12, z / 2, 2); arm.rotation.y = -Math.atan2(z, x);
      this.cylinder(g, 9, 12, 'black', x, 18, z);
      const rotor = new THREE.Group(); rotor.name = `rotor${rotors.length}`; rotor.position.set(x, 26, z);
      this.box(rotor, 48, 3, 8, 'navy', 0, 0, 0, 2);
      this.box(rotor, 8, 3, 48, 'navy', 0, 0, 0, 2); g.add(rotor); rotors.push(rotor);
    }
    const cargo = new THREE.Group(); cargo.name = 'cargo'; cargo.position.y = -66; g.add(cargo);
    this.mergeRigid(g, [...rotors.map((r) => r.name), 'cargo']);
    g.userData = { rotors, cargo }; return g;
  }

  tree() {
    const g = new THREE.Group();
    this.cylinder(g, 8, 176, 'darkWood', 0, 88, 0, 15);
    for (const [layer, [r, h, y]] of [[70, 82, 72], [59, 78, 113], [43, 70, 151], [25, 57, 187]].entries()) {
      const geo = this.cached(`natural-pine:${r}`, () => {
        const shape = new THREE.ConeGeometry(r, h, 16, 3), p = shape.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const angle = Math.atan2(p.getZ(i), p.getX(i)), f = 1 + Math.sin(angle * 5 + layer) * 0.09;
          p.setX(i, p.getX(i) * f + p.getY(i) * 0.055); p.setZ(i, p.getZ(i) * f);
        }
        shape.computeVertexNormals(); return shape;
      });
      const leaves = this.mesh(g, geo, layer % 2 ? 'pine' : 'pineDark', 0, y, 0); leaves.rotation.y = layer * 0.7;
      const cap = this.mesh(g, geo, 'snow', 0, y + 14, 0); cap.scale.set(0.83, 0.85, 0.84); cap.rotation.y = layer * 0.7;
      if (layer < 3) for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3 + layer * 0.7;
        const tuft = this.mesh(g, this.cached('foliage-ball', () => new THREE.SphereGeometry(1, 10, 6)), 'pine', Math.cos(angle) * r * 0.55, y - 22, Math.sin(angle) * r * 0.55);
        tuft.scale.set(r * 0.28, h * 0.14, r * 0.3);
      }
    }
    this.ball(g, 28, 9, 23, 'snow', 0, 8, 0);
    return g;
  }
}
