import * as THREE from './vendor/three.module.js';

export function lantern(a, parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  a.box(g, 17, 4, 17, 'black', 0, -14, 0, 2);
  a.box(g, 13, 22, 13, 'lamp', 0, 0, 0, 2);
  for (const dx of [-8, 8]) for (const dz of [-8, 8]) a.box(g, 2, 25, 2, 'black', dx, 0, dz, .4);
  a.mesh(g, a.cached('lamp-cap', () => new THREE.ConeGeometry(15, 10, 4)), 'black', 0, 17, 0).rotation.y = Math.PI / 4;
  a.mesh(g, a.cached('lamp-ring', () => new THREE.TorusGeometry(5, 1.2, 6, 12)), 'black', 0, 28, 0);
  return g;
}
export function crate(a, g, x, y, z, scale = 1) {
  const c = new THREE.Group(); c.position.set(x, y, z); c.scale.setScalar(scale); g.add(c);
  a.box(c, 40, 35, 35, 'darkWood', 0, 18, 0, 2);
  for (const h of [6, 17, 28]) for (const side of [-1, 1]) a.box(c, 40, 9, 3, 'wood', 0, h, side * 19, 1);
  for (const side of [-1, 1]) a.box(c, 5, 39, 40, 'steel', side * 15, 18, 0, 1);
  for (const h of [4, 32]) for (const side of [-1, 1]) a.ball(c, 1.5, 1.5, 1, 'black', side * 15, h, 21);
  return c;
}
export function detailWorkshop(a, g, canner) {
  lantern(a, g, -93, 126, 42);
  for (const x of [-94, 94]) {
    a.tube(g, [[x, 18, -45], [x, 80, -45], [x * .6, 135, -45]], 2, 'leather');
    a.box(g, 14, 18, 14, 'steel', x, 22, -38, 1);
    for (const y of [22, 124]) a.ball(g, 2, 2, 2, 'gold', x, y, -29);
  }
  for (const z of [-25, 0, 25]) {
    a.box(g, 28, 3, 2, 'black', 68, 37, z, .5);
    a.box(g, 29, 2, 2, 'steel', 68, 41, z, .5);
  }
  const gauge = new THREE.Group(); gauge.position.set(canner ? -31 : 66, canner ? 88 : 77, 43); g.add(gauge);
  a.cylinder(gauge, 12, 5, 'steel').rotation.x = Math.PI / 2;
  a.cylinder(gauge, 9, 6, 'trim', 0, 0, 1).rotation.x = Math.PI / 2;
  a.box(gauge, 1.5, 11, 2, 'red', 2, 2, 5, .3).rotation.z = -.55;
  for (let i = 0; i < 7; i++) { const t = i * Math.PI / 4; a.ball(gauge, .8, .8, .6, 'black', Math.sin(t) * 7, Math.cos(t) * 7, 5); }
  for (const y of [26, 49, 73]) a.box(g, 26, 3, 3, 'steel', 67, y, 26, .5);
  crate(a, g, 79, 15, -42, .65);
  if (canner) {
    for (const y of [37, 91]) a.cylinder(g, 41, 4, 'gold', -30, y, 0);
    for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; a.ball(g, 2, 2, 2, 'steel', -30 + Math.cos(t) * 39, 101, Math.sin(t) * 39); }
  } else {
    a.tube(g, [[68, 59, -20], [89, 70, -20], [89, 112, -20], [53, 112, -20]], 3, 'steel');
    a.box(g, 8, 37, 8, 'wood', -88, 31, 37, 1).rotation.z = .2;
    a.box(g, 8, 37, 8, 'wood', -79, 31, 37, 1).rotation.z = -.15;
  }
}
export function heatGenerator(a) {
  const g = new THREE.Group();
  a.cylinder(g, 58, 12, 'stoneDark', 0, 7, 0);
  a.cylinder(g, 42, 78, 'black', 0, 50, 0);
  a.cylinder(g, 33, 67, 'lamp', 0, 51, 0);
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; a.cylinder(g, 3, 76, 'steel', Math.cos(angle) * 35, 52, Math.sin(angle) * 35); }
  for (const y of [19, 85]) a.cylinder(g, 44, 9, 'steel', 0, y, 0);
  a.mesh(g, a.cached('heater-dome', () => new THREE.ConeGeometry(49, 25, 24)), 'red', 0, 101, 0);
  a.cylinder(g, 10, 50, 'black', 0, 132, 0);
  a.cylinder(g, 14, 5, 'steel', 0, 158, 0);
  for (const side of [-1, 1]) a.tube(g, [[side * 40, 35, 0], [side * 65, 35, 0], [side * 65, 10, 0]], 5, 'steel');
  return g;
}

export function rockFormation(a, g, x, z, seed) {
  const cluster = new THREE.Group(); cluster.position.set(x, 0, z); g.add(cluster);
  for (let j = 0; j < 3; j++) {
    const geo = a.cached(`cliff-rock:${j}`, () => {
      const geometry = new THREE.IcosahedronGeometry(1, 1), p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = 1 + Math.sin(p.getX(i) * 8 + j) * Math.cos(p.getZ(i) * 7) * .14; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
      geometry.computeVertexNormals(); return geometry;
    });
    const h = 80 + (seed + j) % 4 * 26;
    a.mesh(cluster, geo, j % 2 ? 'stone' : 'stoneDark', j * 44 - 44, h * .35, Math.sin(j + seed) * 30).scale.set(75, h, 63);
    a.ball(cluster, 69, 17, 56, 'snow', j * 44 - 44, h * 1.15, Math.sin(j + seed) * 30);
  }
}
