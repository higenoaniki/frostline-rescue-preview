import * as THREE from './vendor/three.module.js';
import { STATIONS, toX, toZ } from './world-config.js';
import { HEATER } from './defense.js';
import { facilityBuilt } from './progression.js';

export class WinterAtmosphere {
  constructor(root) {
    this.positions = new Float32Array(150 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xf0f5ed, size: 2.2, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false, toneMapped: false });
    this.snow = new THREE.Points(this.geometry, material); this.snow.frustumCulled = false; root.add(this.snow);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, '#e1e7e1aa'); gradient.addColorStop(.5, '#c1d1d380'); gradient.addColorStop(1, '#abbfc200');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    this.plumes = [];
    for (const source of ['processorIn', 'weapon', 'forge', 'heat']) for (let i = 0; i < 6; i++) {
      const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: .2, color: 0xdbe8e2 });
      const mesh = new THREE.Sprite(material); root.add(mesh); this.plumes.push({ mesh, source, phase: i / 6 });
    }
  }
  update(state, focus) {
    const time = state.home ? performance.now() / 1000 : state.elapsed;
    for (let i = 0; i < 150; i++) {
      const x = ((i * 397.7 + time * 16) % 1700) - 850;
      const y = 70 + ((i * 137.1 - time * (19 + i % 5) % 650 + 650) % 650);
      const z = ((i * 257.3 + time * 8) % 1600) - 800;
      this.positions.set([focus.x + x, y, focus.z + z], i * 3);
    }
    this.geometry.attributes.position.needsUpdate = true;
    for (const { mesh, source, phase } of this.plumes) {
      const t = (time * .16 + phase) % 1;
      const station = STATIONS[source], heat = source === 'heat';
      mesh.visible = heat || facilityBuilt(state, source);
      const x = heat ? HEATER.x : (station.modelX ?? station.x) - 69;
      const y = heat ? HEATER.y : station.modelY - 28;
      mesh.position.set(toX(x) + t * 90 + Math.sin(time + phase * 8) * 9, (heat ? 220 : 286) + t * 140, toZ(y) - t * 22);
      mesh.scale.setScalar(18 + t * 72); mesh.material.opacity = Math.sin(t * Math.PI) * .23;
      mesh.material.rotation = t * .6;
    }
  }
}
