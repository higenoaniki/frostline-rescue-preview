import * as THREE from './vendor/three.module.js';
import { frontierWorkshop } from './frontier-workshop.js';

function furLock(a, parent, material, x, y, z, scale = 1) {
  const geometry = a.cached('sculpted-fur-lock', () => {
    const shape = new THREE.Shape(); shape.moveTo(-8, 8); shape.quadraticCurveTo(0, 15, 9, 7); shape.quadraticCurveTo(12, -2, 4, -18); shape.quadraticCurveTo(2, -9, -5, -9); shape.quadraticCurveTo(-11, -4, -8, 8);
    return new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 2, steps: 1, curveSegments: 5 });
  });
  const lock = a.mesh(parent, geometry, material, x, y, z); lock.scale.setScalar(scale); return lock;
}

export function explorer(a, color = 'red', hat = 'navy') {
  const g = new THREE.Group(), body = new THREE.Group(); body.name = 'torso'; g.add(body);
  g.name = 'frontier-explorer';
  const coat = [new THREE.Vector2(21, 0), new THREE.Vector2(25, 5), new THREE.Vector2(24, 23), new THREE.Vector2(28, 42), new THREE.Vector2(23, 51), new THREE.Vector2(15, 57)];
  const parka = a.mesh(body, a.cached('tailored-parka', () => new THREE.LatheGeometry(coat, 24)), color, 0, 43, 0); parka.scale.z = .76;
  for (const y of [49, 57]) a.box(body, 46, 2, 29, color === 'red' ? 'roofRed' : 'navy', 0, y, 0, 4);
  a.box(body, 43, 10, 34, 'leather', 0, 42, 0, 4);
  a.box(body, 8, 8, 5, 'gold', 0, 42, 19, 1);
  for (const x of [-17, 17]) {
    const strap = a.box(body, 5, 42, 4, 'leather', x, 66, 16, 1); strap.rotation.z = x > 0 ? 0.2 : -0.2;
    a.box(body, 7, 9, 5, 'gold', x, 70, 19, 1);
    a.box(body, 12, 13, 5, color, x * 0.6, 51, 19, 3);
  }
  a.box(body, 3, 38, 3, 'darkWood', 0, 65, 20, 1);
  for (const y of [54, 66, 78]) a.ball(body, 2, 2, 2, 'gold', 0, y, 23);
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2;
    a.ball(body, 7, 6, 6, 'trim', Math.sin(angle) * 23, 98, Math.cos(angle) * 15);
  }
  a.box(body, 9, 23, 5, 'teal', -10, 72, 24, 3);
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 120, 0); head.scale.setScalar(.82); body.add(head);
  a.ball(head, 27, 27, 24, 'skin', 0, 0, 0);
  a.ball(head, 28, 20, 25, 'hair', 0, 15, -4);
  for (const [x, y, z, tilt] of [[-19, 15, 15, -0.6], [-6, 20, 20, -0.45], [7, 22, 19, -0.3], [20, 16, 14, -0.2]]) {
    const lock = a.ball(head, 9, 14, 5, 'hair', x, y, z); lock.rotation.z = tilt;
  }
  for (const side of [-1, 1]) {
    a.ball(head, 5, 7, 4, 'skin', side * 26, -1, 0);
    a.ball(head, 5, 6, 2, 'trim', side * 10, 1, 22);
    a.ball(head, 3, 4.2, 2, 'black', side * 9, 1, 24);
    a.ball(head, 1.2, 1.5, 1, 'cloth', side * 9 - 1, 3, 25);
    a.box(head, 10, 2.3, 3, 'hair', side * 10, 10, 22, 1).rotation.z = side * -0.12;
    a.ball(head, 4, 2, 1, 'rawCut', side * 17, -7, 20);
  }
  a.ball(head, 4, 4.5, 5, 'skin', 0, -5, 24);
  a.tube(head, [[-5, -14, 20], [0, -15, 21], [5, -13, 20]], 0.9, 'hair');
  if (color !== 'red') {
    a.ball(head, 27, 11, 25, hat, 0, 22, -1);
    a.box(head, 43, 5, 27, hat, 0, 22, 15, 3);
  }
  for (const [side, x] of [['left', -13], ['right', 13]]) {
    const leg = new THREE.Group(); leg.name = `leg-${side}`; leg.position.set(x, 52, 0); g.add(leg);
    a.cylinder(leg, 8, 38, 'navy', 0, -17, 0, 10);
    a.box(leg, 17, 17, 26, 'leather', 0, -41, 5, 4);
    a.box(leg, 19, 4, 28, 'black', 0, -50, 5, 1);
    a.box(leg, 18, 5, 21, 'trim', 0, -31, 1, 2);
    for (const y of [-37, -43]) a.box(leg, 12, 2, 3, 'gold', 0, y, 18, .5);
    a.box(leg, 12, 12, 4, 'leather', 0, -19, 9, 3);
    const arm = new THREE.Group(); arm.name = `arm-${side}`; arm.position.set(x * 2.15, 90, 0); body.add(arm);
    a.ball(arm, 10, 17, 10, color, 0, -12, 0);
    a.cylinder(arm, 8, 18, color, 0, -28, 5).rotation.x = -.45;
    a.cylinder(arm, 9, 6, 'trim', 0, -34, 8);
    a.ball(arm, 8, 8, 8, 'leather', 0, -40, 10);
    a.ball(arm, 4, 5, 4, 'leather', x > 0 ? -6 : 6, -38, 14);
    for (const y of [-44, -40, -36]) a.tube(arm, [[-4, y, 13], [0, y, 17], [5, y, 13]], 1.8, 'darkWood');
    if (side === 'right') { const grip = new THREE.Group(); grip.name = 'weapon-grip'; grip.position.set(0, -40, 10); arm.add(grip); }
  }
  const pack = a.item('pack'); pack.position.set(0, 47, -27); pack.scale.setScalar(0.94); body.add(pack);
  const stack = new THREE.Group(); stack.name = 'stack'; stack.position.set(0, 98, -34); body.add(stack);
  const armor = new THREE.Group(); armor.name = 'armor'; armor.position.set(0, 43, 25); body.add(armor);
  g.userData = { torso: body, head, leftLeg: g.getObjectByName('leg-left'), rightLeg: g.getObjectByName('leg-right'), leftArm: body.getObjectByName('arm-left'), rightArm: body.getObjectByName('arm-right'), grip: body.getObjectByName('weapon-grip'), stack, armor, facing: 0, walk: 0 };
  a.mergeColored(body, ['arm-left', 'arm-right', 'stack', 'armor', 'head']); a.mergeColored(head);
  for (const joint of [g.userData.leftLeg, g.userData.rightLeg, g.userData.leftArm, g.userData.rightArm]) a.mergeColored(joint, ['weapon-grip']);
  return g;
}

export function frostBeast(a, kind = 'normal') {
  if (typeof kind === 'boolean') kind = kind ? 'alpha' : 'normal';
  const boss = kind === 'boss', brute = kind === 'brute', elite = kind !== 'normal';
  const fur = boss ? 'furLight' : brute ? 'alphaFur' : elite ? 'alphaFur' : 'fur';
  const accent = boss ? 'blue' : brute ? 'stoneDark' : elite ? 'fur' : 'furLight';
  const g = new THREE.Group(), torso = new THREE.Group(); torso.name = 'torso'; g.add(torso);
  a.ball(torso, 33, 29, 50, fur, 0, 42, -5);
  a.ball(torso, 38, 35, 29, fur, 0, 49, 23);
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const pelt = furLock(a, torso, i % 3 ? fur : accent, side * (29 + Math.sin(i) * 3), 42 + (i % 2) * 8, -34 + i * 14, .95);
    pelt.rotation.y = side * Math.PI / 2; pelt.rotation.z = side * -.25;
  }
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 55, 48); torso.add(head);
  a.ball(head, 28, 25, 24, fur, 0, 1, 0);
  a.ball(head, 20, 13, 22, elite ? fur : 'furLight', 0, -13, 17);
  a.ball(head, 10, 6, 5, 'black', 0, -9, 36);
  for (const side of [-1, 1]) {
    a.ball(head, 3, 2.5, 2, 'black', side * 6, -8, 40);
    const ear = a.ball(head, 8, 14, 6, fur, side * 22, 19, -7); ear.rotation.z = side * -0.6;
    a.ball(head, 4, 7, 3, 'rawCut', side * 24, 20, -2);
    a.ball(head, 5, 4, 2, 'black', side * 18, 6, 20);
    a.ball(head, 3, 3, 2, 'gold', side * 18, 6, 22);
    a.box(head, 13, 5, 5, accent, side * 18, 13, 19, 2).rotation.z = side * -0.25;
    a.tube(head, [[side * 15, -20, 27], [side * 24, -18, 41], [side * 21, 4, 44], [side * 14, 15, 37]], elite ? 5 : 4, 'horn');
    for (const i of [0, 1, 2]) { const lock = furLock(a, head, fur, side * (26 - i * 3), -7 - i * 8, 3 + i * 5, .6); lock.rotation.y = side * .7; }
  }
  a.box(head, 16, 2, 5, 'black', 0, -23, 31, 1);
  const legs = [];
  for (const [i, z] of [-36, 30].entries()) for (const x of [-24, 24]) {
    const leg = new THREE.Group(); leg.position.set(x, 34, z); g.add(leg); legs.push(leg);
    a.ball(leg, 12, 17, 12, fur, 0, -8, 0);
    a.ball(leg, 13, 8, 17, accent, 0, -26, 4);
    for (const toe of [-7, 0, 7]) a.ball(leg, 2.5, 3, 6, 'black', toe, -28, 18);
    leg.userData.phase = i + (x < 0 ? 0 : 1); a.mergeColored(leg);
  }
  a.tube(torso, [[0, 42, -50], [0, 53, -64], [0, 59, -70]], 4, fur);
  for (let i = 0; i < 6; i++) {
    const tuft = furLock(a, torso, accent, 0, 72, -35 + i * 12, .7); tuft.rotation.x = -1.4;
    if (boss || elite && i % 2 === 0) {
      const spike = a.mesh(torso, a.cached(`spine:${boss}`, () => new THREE.ConeGeometry(boss ? 7 : 5, boss ? 33 : 18, 5)), boss ? 'glass' : 'horn', 0, boss ? 91 : 86, -35 + i * 12); spike.rotation.x = -0.3;
    }
  }
  if (brute) for (const z of [-24, 5, 32]) {
    a.box(torso, 62, 9, 17, 'steel', 0, 76, z, 4);
    for (const side of [-1, 1]) { a.box(torso, 7, 33, 17, 'steel', side * 35, 58, z, 3); a.ball(torso, 3, 3, 3, 'gold', side * 39, 65, z); }
  }
  if (boss) for (const side of [-1, 1]) a.tube(head, [[side * 21, 20, -9], [side * 31, 40, -8], [side * 17, 61, 6]], 6, 'glass');
  g.userData = { torso, head, legs, walk: 0, facing: 0, kind };
  a.mergeColored(torso, ['head']); a.mergeColored(head); return g;
}

function deck(a, g, w = 210, d = 112) {
  a.box(g, w, 10, d, 'darkWood', 0, 5, 0, 3);
  for (let i = 0; i < 8; i++) a.box(g, w / 8 - 2, 4, d - 4, 'wood', -w / 2 + w / 16 + i * w / 8, 12, 0, 1);
  for (const x of [-w / 2 + 8, w / 2 - 8]) for (const z of [-d / 2 + 8, d / 2 - 8]) a.ball(g, 2.5, 1, 2.5, 'steel', x, 15, z);
}

function canopy(a, g, color, width = 210, height = 160) {
  for (const x of [-width / 2 + 10, width / 2 - 10]) {
    a.box(g, 9, height, 9, 'darkWood', x, height / 2, -38, 2);
    a.box(g, 14, 9, 14, 'steel', x, 28, -38, 1);
    a.box(g, 14, 9, 14, 'steel', x, height - 24, -38, 1);
  }
  const roof = new THREE.Group(); roof.position.set(0, height, -10); roof.rotation.x = 0.16;
  for (let i = 0; i < 7; i++) {
    const geometry = new THREE.PlaneGeometry(width / 7 + .5, 116, 4, 12), p = geometry.attributes.position;
    for (let v = 0; v < p.count; v++) { const x = p.getX(v), z = p.getY(v); p.setXYZ(v, x, 16 * Math.cos(z / 116 * Math.PI) + Math.cos(x / (width / 7) * Math.PI) * 2, z); }
    geometry.computeVertexNormals();
    const material = a.m[i % 2 ? 'cloth' : color].clone(); material.side = THREE.DoubleSide;
    a.mesh(roof, geometry, material, -width / 2 + width / 14 + i * width / 7, 0, 0);
    a.box(roof, width / 7 - 1, 18, 6, i % 2 ? 'cloth' : color, -width / 2 + width / 14 + i * width / 7, -8, 54, 3);
  }
  a.box(roof, width - 8, 5, 18, 'snow', 0, 6, -45, 3); g.add(roof);
}

export function processingWorkshop(a, canner = false) {
  return frontierWorkshop(a, canner);
}

export function winterForge(a) {
  const g = new THREE.Group(); deck(a, g); canopy(a, g, 'blue', 210, 166);
  a.box(g, 77, 65, 68, 'stoneDark', -56, 47, -6, 7);
  a.box(g, 47, 38, 8, 'black', -56, 46, 32, 6);
  a.ball(g, 17, 14, 3, 'fire', -56, 42, 37);
  a.cylinder(g, 13, 94, 'stone', -56, 127, -20);
  a.box(g, 38, 8, 38, 'snow', -56, 178, -20, 3);
  a.box(g, 79, 10, 67, 'wood', 49, 64, 4, 3);
  for (const x of [21, 77]) a.box(g, 9, 53, 49, 'darkWood', x, 34, 4, 2);
  a.box(g, 24, 24, 26, 'steel', 39, 80, 4, 2);
  a.box(g, 67, 14, 34, 'steel', 40, 99, 4, 4);
  a.cylinder(g, 9, 27, 'steel', 79, 99, 4, 2).rotation.z = Math.PI / 2;
  const axe = a.item('axe3'); axe.position.set(40, 120, 12); axe.rotation.z = -1.1; axe.scale.setScalar(0.6); g.add(axe);
  const ore = a.item('ore'); ore.position.set(-93, 14, 25); ore.scale.setScalar(0.65); g.add(ore);
  return g;
}

export function supplyBeacon(a) {
  const g = new THREE.Group(); deck(a, g, 194, 110);
  a.box(g, 75, 53, 47, 'navy', -38, 41, 2, 7);
  a.box(g, 54, 28, 4, 'glass', -38, 49, 29, 3);
  for (const x of [-53, -38, -23]) a.box(g, 7, 6, 5, 'gold', x, 30, 30, 1);
  a.cylinder(g, 7, 117, 'steel', 47, 72, -9);
  const dish = new THREE.Group(); dish.name = 'dish'; dish.position.set(47, 144, -9); dish.rotation.x = -0.5; g.add(dish);
  const shape = [new THREE.Vector2(0,0), new THREE.Vector2(14,3), new THREE.Vector2(30,14), new THREE.Vector2(43,31), new THREE.Vector2(44,33), new THREE.Vector2(42,35), new THREE.Vector2(27,18), new THREE.Vector2(12,7), new THREE.Vector2(0,4)];
  a.mesh(dish, a.cached('dish', () => new THREE.LatheGeometry(shape, 24)), 'steel');
  a.cylinder(dish, 2, 50, 'gold', 0, 28, 0);
  a.ball(dish, 5, 5, 5, 'red', 0, 54, 0);
  a.mergeColored(dish);
  a.cylinder(g, 2.5, 163, 'steel', -79, 92, -37);
  a.box(g, 39, 28, 3, 'red', -60, 157, -37, 2);
  a.box(g, 19, 5, 5, 'trim', -60, 157, -34, 1);
  a.box(g, 5, 19, 5, 'trim', -60, 157, -34, 1);
  return g;
}

export function upgradeWorkshop(a, role) {
  const g = new THREE.Group(); deck(a, g, 138, 100);
  if (role === 'conveyor' || role === 'machine') {
    a.box(g, 87, 38, 58, role === 'conveyor' ? 'blue' : 'red', 0, 33, 0, 5);
    for (const x of [-44, 44]) {
      const wheel = new THREE.Group(); wheel.position.set(x, 50, 2); wheel.rotation.y = Math.PI / 2;
      a.cylinder(wheel, 21, 7, 'steel').rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) { const tooth = a.box(wheel, 9, 8, 8, 'steel', Math.sin(i * Math.PI / 4) * 21, Math.cos(i * Math.PI / 4) * 21, 0, 1); tooth.rotation.z = -i * Math.PI / 4; }
      a.box(wheel, 4, 28, 9, 'black', 0, 0, 0, 1); g.add(wheel);
    }
    a.box(g, 81, 11, 53, 'wood', 0, 70, 0, 2);
    const item = a.item(role === 'conveyor' ? 'cuts' : 'goods'); item.position.set(0, 81, 0); g.add(item);
  } else if (role === 'hunter') {
    a.box(g, 75, 58, 60, 'orange', 0, 43, 0, 5);
    const axe = a.item('axe3'); axe.position.set(0, 104, 12); axe.rotation.z = -0.8; g.add(axe);
    for (const x of [-47, 47]) a.box(g, 17, 8, 70, 'steel', x, 23, 0, 2);
    a.box(g, 10, 58, 4, 'leather', -17, 44, 32, 1);
  } else {
    a.box(g, 102, 8, 76, 'blue', 0, 23, 0, 3);
    for (const x of [-32, 32]) a.box(g, 6, 4, 47, 'trim', x, 29, 0, 1);
    const sample = a.drone(role === 'delivery' ? 'teal' : 'blue'); sample.scale.setScalar(0.55); sample.position.set(0, 77, 0); g.add(sample);
    a.box(g, 69, 21, 18, 'navy', 0, 36, -35, 3);
    for (const x of [-20, 0, 20]) a.ball(g, 3, 3, 2, 'green', x, 38, -24);
  }
  return g;
}
