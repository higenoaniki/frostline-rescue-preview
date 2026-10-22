import * as THREE from './vendor/three.module.js';
import { lantern, crate } from './premium-art.js';

export function frontierWorkshop(a, canner = false) {
  const g = new THREE.Group(); g.name = canner ? 'pressure-cannery' : 'frontier-smokehouse';
  a.box(g, 218, 13, 122, 'stoneDark', 0, 7, 0, 5);
  for (let i = 0; i < 9; i++) a.box(g, 22, 6, 116, 'wood', -96 + i * 24, 16, 0, 1);
  for (const x of [-94, 94]) {
    a.box(g, 13, 153, 13, 'darkWood', x, 91, -40, 2);
    a.box(g, 19, 13, 19, 'steel', x, 28, -40, 2);
    const brace = a.box(g, 9, 72, 10, 'wood', x * .8, 147, -40, 1); brace.rotation.z = Math.sign(x) * -.6;
  }
  for (let row = 0; row < 7; row++) a.box(g, 180, 17, 9, row % 2 ? 'wood' : 'darkWood', 0, 37 + row * 18, -48, 2);
  a.box(g, 214, 14, 16, 'darkWood', 0, 168, -40, 2);
  for (const side of [-1, 1]) {
    const roof = new THREE.Group(); roof.position.set(side * 55, 192, -12); roof.rotation.z = side * -.48; g.add(roof);
    a.box(roof, 127, 10, 135, 'darkWood', 0, 0, 0, 2);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
      a.box(roof, 25, 5, 21, canner ? 'roofTeal' : 'roofRed', -51 + row * 25, 7 + row * .4, -53 + col * 22, 2);
    }
    a.box(roof, 127, 8, 23, 'snow', 0, 14, -51, 5);
    a.box(roof, 127, 8, 10, 'wood', 0, -2, 68, 1);
    for (const z of [-47, 39]) a.box(roof, 127, 3, 4, 'steel', 0, 11, z, .7);
  }
  a.box(g, 22, 12, 140, 'darkWood', 0, 224, -12, 3);
  a.box(g, 23, 8, 143, 'snow', 0, 233, -12, 4);
  const chimneyX = canner ? 77 : -67;
  for (let row = 0; row < 10; row++) {
    a.box(g, 32, 19, 32, row % 2 ? 'stone' : 'stoneDark', chimneyX, 120 + row * 16, -33, 2);
    a.box(g, 15, 16, 3, 'stone', chimneyX + (row % 2 ? -6 : 6), 120 + row * 16, -15, 1);
  }
  a.box(g, 43, 8, 43, 'steel', chimneyX, 278, -33, 2);
  a.box(g, 45, 9, 45, 'snow', chimneyX, 286, -33, 4);
  if (canner) {
    a.cylinder(g, 44, 16, 'black', -27, 31, 9);
    a.cylinder(g, 37, 85, 'steel', -27, 79, 9);
    a.ball(g, 37, 19, 37, 'steel', -27, 125, 9);
    for (const y of [40, 115]) {
      a.cylinder(g, 40, 6, 'black', -27, y, 9);
      for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; a.ball(g, 2.5, 2, 2.5, 'gold', -27 + Math.cos(t) * 38, y + 4, 9 + Math.sin(t) * 38); }
    }
    a.cylinder(g, 5, 23, 'steel', -27, 152, 9);
    a.cylinder(g, 15, 4, 'red', -27, 164, 9);
    for (const x of [-39, -27, -15]) a.cylinder(g, 2, 17, 'steel', x, 157, 9);
    a.box(g, 58, 66, 62, 'roofTeal', 61, 55, 8, 7);
    a.box(g, 42, 29, 4, 'black', 61, 66, 41, 2);
    for (const x of [48, 61, 74]) a.ball(g, 3, 3, 3, 'green', x, 57, 45);
    a.tube(g, [[-27, 140, -14], [-27, 166, -14], [60, 166, -14], [60, 87, 8]], 5, 'steel');
    for (const x of [-45, -27, -9]) a.box(g, 9, 22, 3, 'fire', x, 29, 45, 2);
  } else {
    a.box(g, 98, 63, 76, 'stoneDark', -44, 51, 7, 4);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) a.box(g, 29, 13, 7, (row + col) % 2 ? 'stone' : 'stoneDark', -75 + col * 31 + row % 2 * 4, 28 + row * 15, 48, 1);
    const arch = new THREE.Shape(); arch.moveTo(-25, 0); arch.lineTo(-25, 25); arch.bezierCurveTo(-25, 57, 25, 57, 25, 25); arch.lineTo(25, 0); arch.closePath();
    a.mesh(g, new THREE.ExtrudeGeometry(arch, { depth: 6, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2, steps: 1 }), 'black', -44, 20, 50);
    a.ball(g, 17, 20, 3, 'fire', -44, 40, 58);
    for (const x of [-56, -44, -32]) a.box(g, 3, 36, 4, 'steel', x, 38, 61, .7);
    a.box(g, 111, 9, 85, 'steel', -44, 87, 10, 3);
    a.box(g, 90, 6, 47, 'wood', -44, 95, 22, 2);
    for (const x of [-65, -25]) { const meat = a.item('cuts'); meat.scale.setScalar(.7); meat.position.set(x, 100, 24); g.add(meat); }
    a.box(g, 45, 63, 54, 'roofRed', 62, 53, 3, 6);
    a.cylinder(g, 14, 44, 'steel', 62, 80, 27).rotation.x = Math.PI / 2;
    a.cylinder(g, 16, 5, 'black', 62, 80, 51).rotation.x = Math.PI / 2;
    for (const [x, y] of [[-6, -5], [5, -5], [0, 5]]) a.cylinder(g, 3, 6, 'steel', 62 + x, 80 + y, 55).rotation.x = Math.PI / 2;
    const hopper = [new THREE.Vector2(12, 0), new THREE.Vector2(13, 12), new THREE.Vector2(29, 32), new THREE.Vector2(28, 36), new THREE.Vector2(25, 35), new THREE.Vector2(10, 13)];
    a.mesh(g, new THREE.LatheGeometry(hopper, 24), 'steel', 62, 93, 2);
    a.box(g, 55, 4, 24, 'steel', 62, 63, 56, 3);
  }
  const wheel = new THREE.Group(); wheel.name = 'wheel'; wheel.position.set(101, 79, 5); wheel.rotation.y = Math.PI / 2; g.add(wheel);
  a.mesh(wheel, a.cached('factory-wheel', () => new THREE.TorusGeometry(23, 3.5, 8, 24)), 'black');
  a.mesh(wheel, a.cached('factory-wheel-rim', () => new THREE.TorusGeometry(19, 1.6, 6, 24)), 'steel');
  for (let i = 0; i < 6; i++) a.box(wheel, 3, 40, 4, 'steel', 0, 0, 0, .7).rotation.z = i * Math.PI / 6;
  a.ball(wheel, 6, 6, 5, 'gold'); a.mergeColored(wheel);
  const gauge = new THREE.Group(); gauge.position.set(canner ? -27 : 62, canner ? 91 : 56, canner ? 48 : 34); g.add(gauge);
  a.cylinder(gauge, 12, 5, 'black').rotation.x = Math.PI / 2;
  a.cylinder(gauge, 10, 6, 'trim', 0, 0, 1).rotation.x = Math.PI / 2;
  a.box(gauge, 1.5, 13, 2, 'red', 2, 2, 5, .3).rotation.z = -.5;
  lantern(a, g, -97, 147, 24);
  crate(a, g, 69, 19, -36, .7);
  return g;
}
