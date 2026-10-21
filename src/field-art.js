import * as THREE from './vendor/three.module.js';
import { WORLD, SAFE, toX, toZ } from './world-config.js';

const smooth = n => { const t = Math.min(1, Math.max(0, n)); return t * t * (3 - 2 * t); };
export const fieldHeight = (x, y) => 6 + Math.sin(x * .012) * Math.sin(y * .009) * 3 + Math.cos(x * .007 + y * .011) * 2
  + smooth((Math.abs(x - WORLD.width / 2) - 780) / 390) * (75 + Math.sin(y * .01) * 28);
export const surfaceHeight = (x, y) => x >= SAFE.x && x <= SAFE.x + SAFE.w && y >= SAFE.y && y <= SAFE.y + SAFE.h ? 32 : fieldHeight(x, y);
export function buildFieldSurface(a) {
  const group = new THREE.Group(), geometry = new THREE.PlaneGeometry(WORLD.width + 550, WORLD.height + 550, 64, 144);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3), snow = new THREE.Color(0xe9f1ed), ice = new THREE.Color(0x80b1bd), packed = new THREE.Color(0xa9b7b1);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + WORLD.width / 2, y = p.getZ(i) + WORLD.height / 2;
    p.setY(i, fieldHeight(x, y));
    const channel = 1050 + Math.sin(y * .0035) * 270, frost = Math.max(0, 1 - Math.abs(x - channel) / 95) * .66;
    const trampled = Math.max(0, 1 - Math.hypot((x - 730) / 1.2, y - (SAFE.y - 340)) / 580) * .52;
    const color = snow.clone().lerp(ice, frost).lerp(packed, trampled);
    color.multiplyScalar(.96 + Math.sin(x * .018 + Math.cos(y * .016)) * .04); color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = a.m.snow.clone(); material.vertexColors = true; material.onBeforeCompile = a.m.snow.onBeforeCompile;
  const ground = new THREE.Mesh(geometry, material); ground.receiveShadow = true; group.add(ground);
  for (let i = 0; i < 155; i++) {
    const x = 180 + ((i * 431) % 1630), y = 200 + ((i * 577) % (SAFE.y - 400)), height = fieldHeight(x, y);
    if (i % 3) {
      for (let j = 0; j < 3; j++) {
        const blade = a.box(group, 2, 12 + j * 4, 2, j % 2 ? 'pineDark' : 'wood', toX(x + j * 4), height + 6 + j * 2, toZ(y), .3); blade.rotation.z = (j - 1) * .32;
      }
    } else {
      const stone = a.mesh(group, a.cached('field-pebble', () => new THREE.IcosahedronGeometry(1, 1)), i % 2 ? 'stoneDark' : 'stone', toX(x), height + 3, toZ(y));
      stone.scale.set(12 + i % 7, 7, 9 + i % 5); a.ball(group, 12, 3, 8, 'snow', toX(x - 2), height + 9, toZ(y));
    }
  }
  return group;
}

export function buildCampSurface(a) {
  const group = new THREE.Group(), geometry = new THREE.PlaneGeometry(SAFE.w, SAFE.h, 40, 58);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 32, toZ(SAFE.y + SAFE.h / 2));
  const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3);
  const white = new THREE.Color(0xecf2e9), compacted = new THREE.Color(0x9daea9);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = z + WORLD.height / 2;
    const traffic = Math.max(1 - Math.abs(x) / 170, ...[3830, 4130, 4430, 4840, 5230].map(line => (1 - Math.abs(y - line) / 110) * .85));
    const wind = Math.sin(x * .019 + z * .006) * Math.cos(z * .012);
    positions.setY(i, 30.2 + Math.max(0, 1 - traffic) * (2 + wind * 1.8));
    white.clone().lerp(compacted, Math.max(0, traffic) * .58).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = a.m.snow.clone(); material.vertexColors = true; material.onBeforeCompile = a.m.snow.onBeforeCompile;
  const ground = new THREE.Mesh(geometry, material); ground.receiveShadow = true; group.add(ground);
  const stone = a.m.floor.clone(); stone.color.set(0x7f9698); stone.roughness = .95;
  // Irregular paving, with snow left in the joints, reads as a lived-in camp.
  for (let i = 0; i < 67; i++) {
    const y = SAFE.y + 48 + i * 32;
    for (const side of [-1, 1]) {
      const tile = a.box(group, 72 + i % 3 * 3, 3, 28, stone, side * 40, 32, toZ(y + side * (i % 2) * 3), 2);
      tile.rotation.y = Math.sin(i * 13 + side) * .025;
    }
  }
  for (const y of [3830, 4130, 4430, 4840, 5230]) for (let i = 0; i < 30; i++) {
    const x = -540 + i * 37;
    if (Math.abs(x) < 90) continue;
    const tile = a.box(group, 33, 2, 60 + i % 3 * 3, stone, x, 32, toZ(y + Math.sin(i) * 4), 2);
    tile.rotation.y = Math.sin(i * 7) * .04;
  }
  return group;
}
