import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { SculptedArtModels as ArtModels } from './sculpted-art.js';
import { WORLD, SAFE, STATIONS, CONVEYOR_PATH, beltPoint, toX, toZ } from './world-config.js';
import { UPGRADE_SPECS, upgradeCost, upgradeLevel, upgradeCap, facilityAvailable, facilityBuilt, plotName, stagePlan, goalValue } from './progression.js';
import { HUNTER_POSITION, BOSS_POSITION } from './combat.js';
import { SERVICE_GATE } from './automation.js';
import { renderProfile } from './render-profile.js';
import { HatchetEquipment } from './axe-equipment.js';
import { missionTarget } from './navigation.js';
import { REFUGE_POSITION, FINAL_SUPPLIES } from './expedition.js';
import { SnowTracks } from './snow-tracks.js';
import { dressFacility } from './environment-dressing.js';
import { CinematicPipeline } from './cinematic-pipeline.js';
import { BELT_DECK_HEIGHT, beltObstacles, insideRect } from './walkways.js';
import { HEATER, BREACH } from './defense.js';
import { regionFor } from './regions.js';
import { lantern } from './premium-art.js';
import { bakeModelShadow } from './baked-shadow.js';
import { SWING_START, SWING_END } from './melee.js';
import { lootAmount } from './harvest-balance.js';
import { buildFieldSurface, buildCampSurface, fieldHeight, surfaceHeight } from './field-art.js';
import { WinterAtmosphere } from './winter-atmosphere.js';
import { beastAttackTime } from './actor-animation.js';
import { updateFacilityMotion, facilityJoints } from './facility-animation.js';
import { FrameBudget, FrameMeasurement } from './frame-budget.js';
import { MotionDiagnostics } from './motion-diagnostics.js';
import { buildAlpineLandscape, iceOutcrop } from './alpine-landscape.js';
import { applyPhysicalLighting } from './physical-lighting.js';
import {GeometryBudget,geometryTierLimit} from './geometry-budget.js';
import {loadGeometryDetail,releaseGeometryDetailsAbove} from './production-assets.js';
import {OutlineEffect} from './vendor/OutlineEffect.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class ThreeGameRenderer {
  constructor(canvas,{artFactory=null,toon=false}={}) {
    this.toon=toon;
    const mobile=window.Capacitor?.isNativePlatform?.()===true||navigator.userAgentData?.mobile===true||/Android|iPhone|iPad/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
    this.profile = renderProfile({
      mobile,
      lowMemory: navigator.deviceMemory > 0 && navigator.deviceMemory <= 4,
      reduced: new URLSearchParams(location.search).get('quality') === 'low'
    });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.profile.antialias, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0xc8e6ed);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.budget = new FrameBudget(Math.min(window.devicePixelRatio || 1,this.profile.maxPixelRatio));
    this.measurement = new FrameMeasurement();
    this.measurement.revision='adaptive-natural-v22';
    this.geometryBudget=new GeometryBudget(geometryTierLimit({mobile,memory:navigator.deviceMemory}));
    this.motionDiagnostics = new MotionDiagnostics();
    let mode = 'auto';
    try { mode = localStorage.getItem('frostline-display-v1') || 'auto'; } catch {}
    if (new URLSearchParams(location.search).get('quality') === 'low') mode = 'low';
    this.budget.setMode(['auto','detail','low'].includes(mode) ? mode : 'auto');
    this.renderer.shadowMap.enabled = this.profile.shadows && this.budget.mode !== 'low';
    if(toon){
      const outline=new OutlineEffect(this.renderer,{defaultThickness:.0017,defaultColor:[.25,.29,.32],defaultAlpha:.65});
      this.finish={resize(){},render:(scene,camera,detail)=>{outline.enabled=detail;outline.render(scene,camera);}};
    }else this.finish = new CinematicPipeline(this.renderer, this.profile.antialias);
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0xc8e6ed, 3000, 5600);
    this.lightingReady=toon?Promise.resolve():applyPhysicalLighting(this.renderer,this.scene);
    this.camera = new THREE.OrthographicCamera(-600, 600, 900, -900, 1, 6000);
    this.art = artFactory?artFactory(this.profile):new ArtModels(this.profile); this.root = new THREE.Group(); this.scene.add(this.root);
    this.enemyMeshes = new Map(); this.enemyPool = []; this.dropMeshes = new Map(); this.particleMeshes = new Map();
    this.dropBadges = new Map(); this.badgeMaterials = new Map();
    this.stations = new Map(); this.flyingItems = []; this.lastTransferId = 0;
    this.lastElapsed = 0; this.lastRunId = -1; this.focus = new THREE.Vector3(0, 0, 300);
    this.raycaster = new THREE.Raycaster(); this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hemi = new THREE.HemisphereLight(0xc6e3f2, 0x5c5146, .32); this.scene.add(this.hemi);
    this.fillLight = new THREE.DirectionalLight(0xaed7ef, .2); this.fillLight.position.set(800, 650, -1200); this.scene.add(this.fillLight);
    this.sun = new THREE.DirectionalLight(0xffdfba, 3.1);
    this.sun.position.set(-650, 1550, 700); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.profile.shadowResolution,this.profile.shadowResolution);
    Object.assign(this.sun.shadow.camera, { left: -1000, right: 1000, top: 1000, bottom: -1000, near: 100, far: 3500 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 2;
    this.scene.add(this.sun, this.sun.target); this.buildWorld();
    if(toon){this.renderer.toneMapping=THREE.NeutralToneMapping;this.renderer.toneMappingExposure=1;this.hemi.color.set(0xf3f8ff);this.hemi.groundColor.set(0xb5bec9);this.hemi.intensity=1.2;this.sun.color.set(0xfffaf1);this.sun.intensity=1.7;this.fillLight.intensity=0;}
    this.snowTracks = new SnowTracks(this.root);
    this.player = this.art.humanoid(); this.player.scale.setScalar(1.16);
    this.playerFlash = this.player.userData.flash;
    this.root.add(this.player);
    this.slashGeometry = new THREE.BufferGeometry(); this.slashGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 6 * 3), 3)); this.slashGeometry.setDrawRange(0, 0);
    this.slashTrail = new THREE.Mesh(this.slashGeometry, new THREE.MeshBasicMaterial({ color: 0xffe6a6, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.slashTrail.frustumCulled = false; this.root.add(this.slashTrail); this.slashSamples = [];
    this.hp = this.healthBar(70, 8); this.root.add(this.hp);
    this.selection = this.makeRing(38, 42, 0x65e0c2); this.root.add(this.selection);
    this.arrow = this.makeArrow(); this.root.add(this.arrow);
    this.freights = [];
    this.drones = new Map(['delivery'].map((id) => {
      const model = this.art.drone('teal'); this.root.add(model); return [id, model];
    }));
    this.worker = this.art.humanoid('orange', 'teal'); this.root.add(this.worker);
    this.workerHp = this.healthBar(70, 8); this.root.add(this.workerHp);
    this.workerLabel = this.makeLabel('', 150, 45); this.root.add(this.workerLabel.mesh);
    this.tower = this.art.hunterTower(); this.tower.position.set(toX(HUNTER_POSITION.x), 32, toZ(HUNTER_POSITION.y)); this.root.add(this.tower);
    this.hunterLabel = this.makeLabel('', 190, 42, false, true); this.root.add(this.hunterLabel.mesh);
    this.bullet = new THREE.Group();
    this.art.cylinder(this.bullet, 4, 44, 'gold', 0, 0, 0).rotation.x = Math.PI / 2;
    this.art.ball(this.bullet, 6, 6, 12, 'steel', 0, 0, 23); this.root.add(this.bullet);
    this.buildConveyor();
    this.heater = this.art.mergeRigid(this.art.heater()); this.heater.position.set(toX(HEATER.x), 32, toZ(HEATER.y)); this.root.add(this.heater);
    this.heaterLabel = this.makeLabel('熱源', 150, 45, false, true); this.root.add(this.heaterLabel.mesh);
    this.warmLight = new THREE.PointLight(0xffac48, 16000, 350, 2); this.warmLight.position.set(toX(HEATER.x), 120, toZ(HEATER.y)); this.root.add(this.warmLight);
    this.finalDrone = this.art.drone('red'); this.finalDrone.scale.setScalar(1.3); this.root.add(this.finalDrone);
    this.bossHp = this.healthBar(140, 10); this.root.add(this.bossHp);
    this.bossLabel = this.makeLabel('氷冠獣', 180, 48, false, true); this.root.add(this.bossLabel.mesh);
    this.atmosphere = new WinterAtmosphere(this.root);
    this.buildContactShadows();
  }

  buildWorld() {
    const a = this.art, terrain = new THREE.Group();
    a.box(terrain, WORLD.width + 500, 80, WORLD.height + 500, 'stone', 0, -56, 0, 40);
    terrain.add(buildFieldSurface(a));
    if(!this.toon)terrain.add(buildAlpineLandscape(a));
    a.box(terrain, SAFE.w + 40, 24, SAFE.h + 40, 'stoneDark', 0, 7, toZ(SAFE.y + SAFE.h / 2), 16);
    terrain.add(buildCampSurface(a));
    for (let i = 0; i < 26; i++) {
      if(this.toon)continue;
      const side = i % 2 ? 1 : -1, y = SAFE.y + 130 + Math.floor(i / 2) * 158;
      if (beltObstacles(65).some(r => insideRect({ x: side * 710 + WORLD.width / 2, y }, r))) continue;
      a.ball(terrain, 39 + i % 3 * 11, 10, 52, 'snow', side * 710, 39, toZ(y));
    }
    for (let i = 0; i < 34; i++) {
      const rock = a.rock();
      rock.position.set(toX(i % 2 ? 1980 : 20), 4, toZ(220 + Math.floor(i / 2) * 325));
      rock.rotation.y = i * .72; rock.scale.set(1.5 + i % 3 * .2, 1.4 + i % 4 * .3, 1.6); terrain.add(rock);
    }
    for (let i = 0; i < 45; i += 1) {
      const tree = a.tree(), x = i < 9 ? 115 + i * 214 : i % 2 ? 115 : 1890;
      const y = i < 9 ? 90 + (i % 3) * 75 : 340 + Math.floor((i - 9) / 2) * (WORLD.height - 520) / 18;
      tree.position.set(toX(x), 0, toZ(y)); tree.scale.setScalar(0.8 + (i % 4) * 0.17); terrain.add(tree);
    }
    for (let i = 0; i < 24; i += 1) {
      const x = i < 8 ? 130 + i * 248 : i % 2 ? 95 : 1905;
      const y = i < 8 ? 210 + (i % 3) * 180 : 680 + Math.floor((i - 8) / 2) * (WORLD.height - 900) / 8;
      a.ball(terrain, 48 + i % 4 * 12, 29, 39, 'stone', toX(x), 14, toZ(y));
      a.ball(terrain, 43 + i % 4 * 12, 16, 35, 'snow', toX(x), 32, toZ(y));
    }
    for (let i = 0; i < 15; i += 1) a.ball(terrain, 45, 4, 19, 'stoneDark', Math.sin(i * 0.5) * 110, 3, toZ(SAFE.y - 180 - i * 150));
    const arena = new THREE.Group(); arena.position.set(toX(BOSS_POSITION.x), 0, toZ(BOSS_POSITION.y));
    a.ball(arena, 440, 8, 350, 'glass', 0, 0, 0);
    for (let i = 0; i < 11; i++) {
      const angle = Math.PI + i / 10 * Math.PI, x = Math.cos(angle) * 420, z = Math.sin(angle) * 360;
      a.ball(arena, 68, 28, 50, 'snow', x, 18, z);
      iceOutcrop(a,arena,x,z,105+i%3*19,125+i%3*32,angle);
    }
    terrain.add(arena);
    const refuge = new THREE.Group(); refuge.position.set(toX(REFUGE_POSITION.x), 0, toZ(REFUGE_POSITION.y));
    this.refugeWindows = a.m.glass.clone();
    a.box(refuge, 820, 28, 690, 'snow', 0, 7, 0, 30);
    for (const x of [-125, 125]) {
      const house = a.refuge(); house.scale.setScalar(.8); house.position.set(x, 16, -85); refuge.add(house);
      a.box(refuge, 25, 21, 2, this.refugeWindows, x + 32, 88, -23, 1);
    }
    a.box(refuge, 120, 5, 95, 'blue', 0, 28, 0, 4);
    a.box(refuge, 67, 3, 7, 'trim', 0, 33, 0, 1); a.box(refuge, 7, 3, 54, 'trim', 0, 33, 0, 1);
    this.root.add(this.batch(refuge));
    this.root.add(this.batch(terrain, 800));
    const highland = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const x = i % 2 ? 1810 : 190, y = 250 + Math.floor(i / 2) * 390;
      for (let j = 0; j < 3; j++) {
        iceOutcrop(a,highland,toX(x+j*28),toZ(y+j*38),65+j*22,80+j*45,i*.73+j);
      }
    }
    this.highlandScenery = this.batch(highland, 800); this.root.add(this.highlandScenery);
    this.fence = new THREE.Group();
    const left = SAFE.x, right = SAFE.x + SAFE.w, top = SAFE.y, bottom = SAFE.y + SAFE.h, center = SAFE.x + SAFE.w / 2;
    this.fenceLine(left, top, SERVICE_GATE.x - 38, top); this.fenceLine(SERVICE_GATE.x + 38, top, center - 150, top);
    this.fenceLine(center + 150, top, BREACH.x - 95, top); this.fenceLine(BREACH.x + 95, top, right, top);
    this.fenceLine(left, bottom, right, bottom); this.fenceLine(left, top, left, bottom); this.fenceLine(right, top, right, bottom);
    this.root.add(this.batch(this.fence, 800));
    this.fence = new THREE.Group(); this.fenceLine(BREACH.x - 95, top, BREACH.x + 95, top);
    this.breachFence = this.batch(this.fence); this.root.add(this.breachFence);
    this.brokenTimbers = new THREE.Group();
    for (let i = 0; i < 5; i++) { const log = a.cylinder(this.brokenTimbers, 10, 75, 'wood', toX(BREACH.x - 65 + i * 31), 42, toZ(SAFE.y + (i % 2 ? 35 : -30))); log.rotation.z = 1.1 + i * .1; log.rotation.y = i; }
    this.root.add(this.brokenTimbers);
    this.serviceDoor = new THREE.Group();
    a.box(this.serviceDoor, 66, 72, 16, 'wood', 0, 42, 0, 3);
    a.box(this.serviceDoor, 68, 6, 20, 'snow', 0, 81, 0, 2);
    this.serviceDoor.position.set(toX(SERVICE_GATE.x), 30, toZ(SAFE.y)); this.root.add(this.serviceDoor);
    this.gatePanels = [-1, 1].map((side) => {
      const g = a.gatePanel();
      g.userData.side = side; this.root.add(g); return g;
    });
    for (const [id, zone] of Object.entries(STATIONS)) this.buildStation(id, zone);
  }

  batch(group, cellSize = 0) {
    // Merge only rigid scenery; joints and inventories remain independent meshes.
    group.updateMatrixWorld(true); const cells = new Map();
    group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      let cell = 'global';
      if (cellSize) {
        geometry.computeBoundingBox(); const box = geometry.boundingBox, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        if (size.x < cellSize && size.z < cellSize) cell = `${Math.floor(center.x / cellSize)}:${Math.floor(center.z / cellSize)}`;
      }
      if (!cells.has(cell)) cells.set(cell, new Map());
      const buckets = cells.get(cell);
      if (!buckets.has(mesh.material)) buckets.set(mesh.material, []);
      buckets.get(mesh.material).push(geometry);
    });
    const out = new THREE.Group();
    for (const buckets of cells.values()) for (const [material, geometries] of buckets) {
      const merged = mergeGeometries(geometries);
      if (!merged) throw new Error('Could not merge scenery geometry');
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; out.add(mesh);
      geometries.forEach((g) => g.dispose());
    }
    return out;
  }

  clearInventory(group) {
    if (group.userData.batched) group.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    group.clear(); group.userData.batched = false;
  }

  batchInventory(group) {
    if (!group.children.length) return;
    this.art.mergeRigid(group); group.userData.batched = true;
  }

  fenceLine(x1, y1, x2, y2) {
    const a = this.art, dx = x2 - x1, dz = y2 - y1, length = Math.hypot(dx, dz);
    const g = new THREE.Group(); g.position.set(toX((x1 + x2) / 2), 30, toZ((y1 + y2) / 2)); g.rotation.y = Math.atan2(dx, dz);
    const n = Math.ceil(length / 96);
    for (let i = 0; i < n; i++) {
      const panel = a.fencePanel(); panel.position.z = -length / 2 + (i + .5) * length / n; panel.scale.z = length / n / 96; g.add(panel);
    }
    const postCount = length < 42 ? 0 : Math.ceil(length / 192), inset = Math.min(16, length / 2);
    for (let i = 0; i <= postCount; i++) {
      const z = postCount ? -length / 2 + inset + i * (length - inset * 2) / postCount : 0, post = a.fencePost();
      post.position.z = z; post.scale.z = Math.min(1, length / 32); g.add(post);
      if (i % 2 === 0&&!this.toon) lantern(a, g, 17, 126, z);
    }
    this.fence.add(g);
  }

  buildStation(id, zone) {
    const group = new THREE.Group(); this.root.add(group);
    const factories = { processorIn: () => this.art.processor(), processorOut: () => this.art.rack(), cannerIn: () => this.art.processor(true), cannerOut: () => this.art.rack(), market: () => this.art.dispatchDepot(), weapon: () => this.art.bench(), armor: () => this.art.armorStand(), conveyor: () => this.art.upgradeWorkshop('conveyor'), machine: () => this.art.upgradeWorkshop('machine'), delivery: () => this.art.upgradeWorkshop('delivery'), pickup: () => this.art.workerOffice(), hunter: () => this.art.upgradeWorkshop('hunter'), fleet: () => this.art.upgradeWorkshop('fleet'), forge: () => this.art.forge(), beacon: () => this.art.beacon() };
    let model = factories[id]();
    model = this.art.mergeRigid(model, facilityJoints); model.position.set(toX(zone.modelX ?? zone.x), 32, toZ(zone.modelY)); group.add(model);
    if(!this.toon)dressFacility(this.art, model, id);
    const color = ['processorIn', 'processorOut'].includes(id) ? 0xd96861 : ['cannerIn', 'cannerOut'].includes(id) ? 0x479f89 : id === 'market' || id === 'beacon' ? 0xe0aa37 : 0x5898b7;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const pad = this.art.box(group, zone.w - 20, 3, zone.h - 10, material, toX(zone.x), 34, toZ(zone.y), 16);
    const inner = this.art.box(group, zone.w - 30, 4, zone.h - 20, 'snow', toX(zone.x), 35, toZ(zone.y), 13);
    inner.castShadow = pad.castShadow = false;
    const label = this.makeLabel('', 190, 60, true); label.mesh.position.set(toX(zone.x), 39, toZ(zone.y + zone.h / 2 + 42)); group.add(label.mesh);
    const foundation = new THREE.Group();
    const cx = toX(zone.modelX ?? zone.x), cz = toZ(zone.modelY);
    for (const z of [-55, 55]) this.art.box(foundation, 190, 4, 5, 'trim', cx, 35, cz + z, 1);
    for (const x of [-95, 95]) this.art.box(foundation, 5, 4, 110, 'trim', cx + x, 35, cz, 1);
    group.add(foundation);
    const stock = new THREE.Group(); group.add(stock);
    let progress = null;
    if (UPGRADE_SPECS[id]) {
      this.art.box(group, zone.w - 40, 3, 8, 'stoneDark', toX(zone.x), 40, toZ(zone.y + zone.h / 2 - 14), 2);
      progress = this.art.box(group, zone.w - 40, 4, 8, 'gold', toX(zone.x), 42, toZ(zone.y + zone.h / 2 - 14), 2);
    }
    const shadow = bakeModelShadow(model); group.add(shadow);
    this.stations.set(id, { group, model, baseScale: model.scale.clone(), foundation, pad, label, stock, progress, color, shadow, signature: '' });
  }

  makeLabel(text, w = 180, h = 58, floor = false, single = false) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    if (floor) mesh.rotation.x = -Math.PI / 2;
    const label = { mesh, canvas, map, text: null, floor, single }; this.writeLabel(label, text); return label;
  }

  writeLabel(label, text, color = null) {
    if (label.text === text && label.color === color) return; label.text = text; label.color = color;
    const c = label.canvas.getContext('2d'); c.clearRect(0, 0, 512, 192);
    const [title, value = ''] = text.split('\n');
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#35575b';
    if (label.single) {
      c.font = '900 90px system-ui, sans-serif';
      if (color) { c.fillStyle = color; c.strokeStyle = '#25454e'; c.lineWidth = 12; c.lineJoin = 'round'; c.strokeText(title, 256, 96, 470); }
      c.fillText(title, 256, 96, 470); label.map.needsUpdate = true; return;
    }
    if (label.floor && title) {
      c.fillStyle = this.toon?'#34434ce8':'#142d40'; c.beginPath(); c.roundRect(9, 9, 494, 174, 12); c.fill();
      c.strokeStyle = '#b5c9c6'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = '#65d7e9'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 99); c.lineTo(482, 99); c.stroke();
      c.fillStyle = '#f3f2e9';
    }
    c.font = `${label.floor ? this.toon?'800 62px':'750 54px' : '800 48px'} system-ui, sans-serif`; c.fillText(title, 256, 60, 465);
    c.fillStyle = label.floor ? this.toon?'#ffffff':'#8fe6f2' : '#287b6b'; c.font = `${label.floor ? this.toon?'850 72px':'850 56px' : '900 49px'} system-ui, sans-serif`; c.fillText(value, 256, 137, 465);
    label.map.needsUpdate = true;
  }

  makeRing(inner, outer, color) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; return mesh;
  }

  makeArrow() {
    const g = new THREE.Group(); this.art.box(g, 16, 35, 10, 'teal', 0, 15, 0, 3);
    const cone = this.art.mesh(g, new THREE.ConeGeometry(23, 28, 3), 'teal', 0, -12, 0); cone.rotation.z = Math.PI;
    return g;
  }

  healthBar(w, h) {
    const g = new THREE.Group();
    this.art.box(g, w + 4, h + 4, 2, new THREE.MeshBasicMaterial({ color: 0x274953 }), 0, 0, 0, 2);
    const fill = this.art.box(g, w, h, 3, new THREE.MeshBasicMaterial({ color: 0x68da8e }), 0, 0, 2, 2);
    g.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.depthTest = false; mesh.material.depthWrite = false;
      mesh.castShadow = false; mesh.renderOrder = 10;
    });
    g.userData.fill = fill; g.userData.width = w; return g;
  }

  resize(width, height, dpr) {
    this.width = width; this.height = height;
    this.renderer.setPixelRatio(Math.min(dpr, this.budget.ratio)); this.renderer.setSize(width, height, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.finish.resize(size.x, size.y);
    const aspect = width / height, viewHeight = this.toon?Math.max(1100,850/aspect):940;
    this.camera.left = -viewHeight * aspect / 2; this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2; this.camera.bottom = -viewHeight / 2; this.camera.updateProjectionMatrix();
  }

  setDisplayMode(mode) {
    this.budget.setMode(mode);
    try { localStorage.setItem('frostline-display-v1',mode); } catch {}
    this.applyDisplayBudget();
    if(mode==='low')this.setGeometryDetail(0);
  }

  async setGeometryDetail(tier){
    const request=(this.geometryRequest??0)+1;this.geometryRequest=request;
    try{
      const parts=tier===0?null:await loadGeometryDetail(tier);
      if(request!==this.geometryRequest)return;
      this.player.setGeometryDetail(tier,parts);this.geometryBudget.settle(tier);
      if(tier===0&&this.budget.mode==='low'||this.geometryBudget.ceiling<2)releaseGeometryDetailsAbove(Math.min(tier,this.geometryBudget.ceiling));
    }catch{
      if(request===this.geometryRequest)this.geometryBudget.fail();
    }
  }

  applyDisplayBudget() {
    this.renderer.shadowMap.enabled = this.profile.shadows && this.budget.mode !== 'low';
    this.resize(this.width,this.height,window.devicePixelRatio || 1);
  }

  renderInfo() {
    const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return {calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,width:size.x,height:size.y,ratio:this.renderer.getPixelRatio(),mode:this.budget.mode,shadows:this.renderer.shadowMap.enabled,geometryTier:this.player.userData.geometryTier,geometryPending:this.geometryBudget.pending,geometryCeiling:this.geometryBudget.ceiling};
  }

  motionReport() {
    const rig = this.player.userData;
    return { revision: 'walk-observation-v1', capturedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      viewport: { width: this.width, height: this.height }, render: this.renderInfo(),
      motion: this.motionDiagnostics.report(),
      current: { mode: rig.animation.mode, movingAttack: rig.animation.movingAttack, clock: rig.animation.clock,
        hip: rig.leftLeg.rotation.x, knee: rig.leftShin.rotation.x,
        actionWeights: Object.fromEntries([...rig.animation.actions].map(([name, action]) => [name, action.getEffectiveWeight()])) } };
  }

  observeFrame(time, active) {
    const frameMs=this.frameTime===undefined?0:time-this.frameTime;this.frameTime=time;
    const continuing=this.frameActive;this.frameActive=active;
    if (!active || !continuing) return;
    const tier=this.geometryBudget.observe(frameMs,{allowIncrease:!this.budget.degraded,low:this.budget.mode==='low'});
    if(tier!==null)this.setGeometryDetail(tier);
    if (this.budget.observe(frameMs)) this.applyDisplayBudget();
    this.measurement.record(frameMs,this.renderInfo());
  }

  screenToWorld(x, y) {
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return { x: 1000, y: SAFE.y + 400 };
    return { x: hit.x + WORLD.width / 2, y: hit.z + WORLD.height / 2 };
  }

  screenDirectionToWorld(x, y) {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const down = new THREE.Vector3(this.camera.position.x - this.focus.x, 0, this.camera.position.z - this.focus.z).normalize();
    return { x: x * right.x + y * down.x, y: x * right.z + y * down.z };
  }

  worldDirectionToScreen(x, y) {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const down = new THREE.Vector3(this.camera.position.x - this.focus.x, 0, this.camera.position.z - this.focus.z).normalize();
    return { x: x * right.x + y * right.z, y: x * down.x + y * down.z };
  }

  render(state, enemies, drops, particles, floaters = []) {
    const dt = clamp(state.elapsed - this.lastElapsed, 0, 0.1); this.lastElapsed = state.elapsed;
    if (state.runId !== this.lastRunId) {
      this.lastRunId = state.runId; this.lastTransferId = 0;
      this.impact = 0; this.slashSamples = []; this.slashGeometry.setDrawRange(0, 0);
      this.flyingItems.forEach((f) => this.root.remove(f.mesh)); this.flyingItems = [];
      const focus = state.endingView ? state.expedition?.flight ?? REFUGE_POSITION : state.player;
      this.focus.set(toX(focus.x), state.endingView ? 120 : 0, toZ(focus.y));
      this.player.userData.facing = state.player.facing || 0;
      this.freights.forEach(f => { delete f.mesh.userData.flightHeight; });
      this.drones.forEach((mesh) => { delete mesh.userData.flightHeight; });
    }
    const region = regionFor(state.region);
    if (this.region !== region.id) {
      this.region = region.id; this.renderer.setClearColor(this.toon?0xe7eef3:region.sky); this.scene.fog.color.set(this.toon?0xe7eef3:region.sky); this.sun.color.set(this.toon?0xfffaf1:region.sun); this.renderer.toneMappingExposure = this.toon?1:region.exposure;
      this.hemi.intensity = this.toon?1.2:region.id === 'highland' ? .27 : .32;
      this.highlandScenery.visible = region.id === 'highland';
    }
    this.updateCamera(state, dt);
    this.breachFence.visible = state.fenceHp > 0; this.brokenTimbers.visible = state.fenceHp <= 0;
    this.heaterLabel.mesh.visible = !state.home;
    this.warmLight.intensity = state.defense?.hp <= 0 ? 0 : 16000;
    this.writeLabel(this.heaterLabel, `熱源 ${Math.ceil((state.defense?.hp ?? 600) / 6)}%`);
    this.heaterLabel.mesh.position.set(toX(HEATER.x), 215, toZ(HEATER.y)); this.heaterLabel.mesh.quaternion.copy(this.camera.quaternion);
    this.gatePanels.forEach((g) => g.position.set(g.userData.side * (75 + (state.gateOpen || 0) * 130), 30, toZ(SAFE.y)));
    this.updatePlayer(state, dt); this.snowTracks.update(state); this.updateEnemies(enemies, dt); this.updateStations(state); this.updateFreight(state, dt);
    this.updateDrones(state, dt);
    this.updateWorker(state, dt); this.updateConveyor(state); this.updateHunter(state);
    this.updateFinalFlight(state, dt); this.updateContactShadows(state, enemies);
    this.updateDrops(drops, state.elapsed); this.updateTransfers(state, dt); this.updateParticles(particles); this.updateFloaters(floaters);
    this.updateArrow(state); this.renderer.info.reset();
    this.atmosphere.update(state, this.focus);
    if (this.refugeCompleted !== !!state.campaignComplete) {
      this.refugeCompleted = !!state.campaignComplete;
      this.refugeWindows.color.set(state.campaignComplete ? 0xffd792 : 0x9fdbdf);
      this.refugeWindows.emissive.set(state.campaignComplete ? 0xe9872c : 0x000000);
      this.refugeWindows.emissiveIntensity = state.campaignComplete ? 1.2 : 0;
    }
    this.finish.render(this.scene, this.camera, this.budget.mode !== 'low' && !this.budget.degraded);
  }

  updateCamera(state, dt) {
    if (state.home) {
      const time = performance.now() / 1000;
      this.focus.set(toX(780), 40, toZ(SAFE.y + 850));
      this.camera.position.copy(this.focus).add(new THREE.Vector3(1050 + Math.sin(time * .07) * 80, 1250, 1150));
      this.camera.lookAt(this.focus.x, 80, this.focus.z); this.camera.updateMatrixWorld();
      this.sun.position.copy(this.focus).add(new THREE.Vector3(-650, 1550, 700)); this.sun.target.position.copy(this.focus); return;
    }
    const follow = state.endingView ? state.expedition?.flight ?? REFUGE_POSITION : state.expedition?.flight && !state.expedition.arrived ? state.expedition.flight : state.player;
    const target = new THREE.Vector3(toX(follow.x), follow === state.player ? 0 : 120, toZ(follow.y)); this.focus.lerp(target, 1 - Math.exp(-dt * (this.toon?12:7)));
    this.camera.position.copy(this.focus).add(new THREE.Vector3(900, 1150, 1250));
    this.camera.lookAt(this.focus.x, this.focus.y + 35, this.focus.z); this.camera.updateMatrixWorld();
    if (this.impact > 0) { this.camera.position.x += Math.sin(state.elapsed * 65) * this.impact * 35; this.impact = Math.max(0, this.impact - dt); }
    this.sun.position.copy(this.focus).add(new THREE.Vector3(-650, 1550, 700)); this.sun.target.position.copy(this.focus);
  }

  animateWalk(mesh, amount, dt) {
    const rig = mesh.userData; rig.walk += dt * (amount > 0.1 ? 14 : 2);
    rig.animation.locomotion(amount, dt);
    rig.stack.rotation.z = Math.sin(rig.walk * 0.65) * amount * 0.035;
  }

  updatePlayer(state, dt) {
    const p = state.player, mesh = this.player, rig = mesh.userData; mesh.position.set(toX(p.x), surfaceHeight(p.x, p.y), toZ(p.y));
    const facing = p.attackMotion ? Math.PI / 2 - p.attackMotion.angle : p.facing || 0;
    rig.facing = lerpAngle(rig.facing, facing, Math.min(1, dt * 24)); mesh.rotation.y = rig.facing;
    this.animateWalk(mesh, p.moving ? 1 : 0, dt);
    if (rig.weaponLevel !== state.upgrades.weapon) {
      if (rig.weapon) rig.weapon.removeFromParent();
      rig.weaponLevel = state.upgrades.weapon; rig.weapon = this.art.item(rig.weaponLevel === 3 ? 'axe3' : 'axe');
      rig.weapon.scale.setScalar(1);
      rig.holster.add(rig.weapon);
    }
    if (rig.armorLevel !== state.upgrades.armor) {
      rig.armorLevel = state.upgrades.armor; rig.armor.clear();
      if (rig.armorLevel > 1) { const armor = this.art.item('armor'); armor.scale.setScalar(0.85 + rig.armorLevel * 0.04); rig.armor.add(armor); }
    }
    if (p.attackMotion) {
      rig.animation.sample('attack', p.attackMotion.time / p.attackMotion.duration * .44, p.moving);
    }
    rig.equipment ??= new HatchetEquipment(rig);
    rig.equipment.update(p.attackMotion,dt,state.runId);
    this.updateSlashTrail(p);
    mesh.visible = true; this.playerFlash.forEach(material=>material.emissiveIntensity=p.hurtFlash*.35);
    const sig = `${p.raw}:${p.cuts}:${p.goods}`;
    if (this.stackSignature !== sig) {
      this.stackSignature = sig; this.clearInventory(rig.stack); let y = 0;
      for (const [type, count, step] of [['raw', p.raw, 16], ['cuts', p.cuts, 14], ['goods', p.goods, 25]]) {
        for (let i = 0; i < Math.min(count, 32); i += 1) {
          const item = this.art.item(type); item.position.set(Math.sin(i * 0.8) * 2, y, 0); rig.stack.add(item); y += step;
        }
      }
      this.batchInventory(rig.stack);
    }
    const pct = clamp(p.hp / p.hpMax, 0, 1);
    const side = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(76);
    this.hp.position.set(toX(p.x) + side.x, mesh.position.y + 178, toZ(p.y) + side.z); this.hp.quaternion.copy(this.camera.quaternion);
    this.hp.userData.fill.scale.x = Math.max(0.001, pct); this.hp.userData.fill.position.x = -(1 - pct) * 35;
    this.hp.userData.fill.material.color.set(pct < 0.3 ? 0xed6159 : 0x68da8e);
    this.selection.position.set(toX(p.x), mesh.position.y + 2, toZ(p.y));
    this.motionDiagnostics.record({ runId: state.runId, x: p.x, y: p.y, dt, inputMoving: p.moving,
      cameraX: this.focus.x, cameraZ: this.focus.z, mode: rig.animation.mode, clock: rig.animation.clock,
      hip: rig.leftLeg.rotation.x, knee: rig.leftShin.rotation.x,
      matrixAutoUpdate: rig.leftLeg.matrixAutoUpdate && rig.leftShin.matrixAutoUpdate });
  }

  updateSlashTrail(player) {
    const motion = player.attackMotion, active = motion && motion.time >= SWING_START && motion.time <= SWING_END + .05;
    if (!active) { this.slashSamples = []; this.slashGeometry.setDrawRange(0, 0); this.lastSlashMotion = motion; return; }
    if (this.lastSlashMotion !== motion) { this.slashSamples = []; this.lastSlashMotion = motion; }
    this.player.updateWorldMatrix(true, true);
    const weapon = this.player.userData.weapon;
    const pair = [new THREE.Vector3(10, 21, 0), new THREE.Vector3(20, 34, 0)].map(v => weapon.localToWorld(v));
    this.slashSamples.push(pair); if (this.slashSamples.length > 12) this.slashSamples.shift();
    const position = this.slashGeometry.attributes.position; let index = 0;
    for (let i = 1; i < this.slashSamples.length; i++) {
      const a = this.slashSamples[i - 1], b = this.slashSamples[i];
      for (const point of [a[0], a[1], b[0], a[1], b[1], b[0]]) position.setXYZ(index++, point.x, point.y, point.z);
    }
    position.needsUpdate = true; this.slashGeometry.setDrawRange(0, index);
  }

  updateEnemies(enemies, dt) {
    const living = new Set(enemies);
    for (const [enemy, mesh] of this.enemyMeshes) if (!living.has(enemy)) {
      this.root.remove(mesh); this.enemyMeshes.delete(enemy); this.enemyPool.push(mesh);
    }
    for (const enemy of enemies) {
      let mesh = this.enemyMeshes.get(enemy);
      if (!mesh) {
        const index = this.enemyPool.findIndex(m => m.userData.kind === enemy.kind);
        mesh = index >= 0 ? this.enemyPool.splice(index, 1)[0] : this.art.creature(enemy.kind);
        this.enemyMeshes.set(enemy, mesh); this.root.add(mesh); mesh.userData.prev = { x: enemy.x, y: enemy.y };
      }
      const rig = mesh.userData, dx = enemy.x - rig.prev.x, dy = enemy.y - rig.prev.y, walking = Math.hypot(dx, dy) > 0.1;
      const facing = enemy.attackMotion ? Math.PI / 2 - enemy.attackMotion.angle : walking ? Math.atan2(dx, dy) : rig.facing;
      rig.facing = lerpAngle(rig.facing, facing, clamp(dt * 8, 0, 1)); mesh.rotation.y = rig.facing;
      mesh.position.set(toX(enemy.x), surfaceHeight(enemy.x, enemy.y), toZ(enemy.y)); mesh.scale.setScalar((enemy.r || 32) / (enemy.boss ? 46 : 32)); rig.walk += dt * (walking ? 8 : 1);
      const m = enemy.attackMotion;
      if (m) rig.animation.sample('attack', beastAttackTime(m));
      else rig.animation.locomotion(walking ? 1 : 0, dt);
      mesh.visible = true; rig.flash.forEach(material=>material.emissiveIntensity=enemy.hurt*.16);
      rig.prev.x = enemy.x; rig.prev.y = enemy.y;
    }
    const boss = enemies.find(e => e.boss);
    this.bossHp.visible = this.bossLabel.mesh.visible = !!boss;
    if (boss) {
      this.bossHp.position.set(toX(boss.x), 230, toZ(boss.y)); this.bossHp.quaternion.copy(this.camera.quaternion);
      this.bossHp.userData.fill.scale.x = Math.max(0.001, boss.hp / boss.hpMax);
      this.bossHp.userData.fill.position.x = -(1 - boss.hp / boss.hpMax) * 70;
      this.bossLabel.mesh.position.set(toX(boss.x), 261, toZ(boss.y)); this.bossLabel.mesh.quaternion.copy(this.camera.quaternion);
    }
  }

  updateStations(state) {
    const p = state.player;
    for (const [id, station] of this.stations) {
      station.group.visible = facilityAvailable(state, id); if (!station.group.visible) continue;
      const built = facilityBuilt(state, id);
      station.model.visible = built; station.shadow.visible = built; station.foundation.visible = !built;
      const born = state.builtAt?.[id], age = born === undefined ? 1 : clamp((state.elapsed - born) / 0.55, 0, 1);
      station.model.scale.copy(station.baseScale).multiplyScalar(age === 1 ? 1 : Math.max(0.01, 1 - Math.pow(1 - age, 3) + Math.sin(age * Math.PI) * 0.12));
      const zone = STATIONS[id], near = Math.abs(p.x - zone.x) < zone.w / 2 && Math.abs(p.y - zone.y) < zone.h / 2;
      station.pad.material.color.set(near ? 0x66daa2 : built ? station.color : 0x8e9d9b); let text = zone.title;
      updateFacilityMotion(station, id, state);
      if (id === 'processorIn') text = `肉加工\n肉 ${state.processor.rawStored}`;
      else if (id === 'processorOut') text = `加工肉回収\n加工肉 ${state.processor.cutsStored}`;
      else if (id === 'cannerIn') text = `保存食生産\n加工肉 ${state.canner.cutsStored}`;
      else if (id === 'cannerOut') text = `保存食回収\n保存食 ${state.canner.goodsStored}`;
      else if (id === 'market') {
        const loading = state.shipping.flights.filter(f => f.phase === 'loading').length;
        const busy = state.shipping.flights.filter(f => ['outbound', 'return'].includes(f.phase)).length;
        text = `出荷場\n${loading ? `積込 ${loading}機` : busy ? `運航中 ${busy}機` : `待機商品 ${state.shipping.queued}`}`;
      }
      else {
        const level = upgradeLevel(state, id), cost = upgradeCost(state, id), maxed = level >= upgradeCap(state.stage, id);
        text = `${built ? `${zone.title} Lv.${level}` : plotName(id)}\n${maxed ? 'MAX' : `現金 ${state.upgradePaid[id]} / ${cost}`}`;
        const pct = maxed ? 1 : state.upgradePaid[id] / cost;
        station.progress.scale.x = Math.max(0.001, pct);
        station.progress.position.x = toX(zone.x) - (1 - pct) * (zone.w - 40) / 2;
      }
      this.writeLabel(station.label, text);
      const type = id === 'processorIn' ? 'raw' : ['processorOut', 'cannerIn'].includes(id) ? 'cuts' : 'goods';
      const count = Math.min(18, id === 'processorOut' ? state.processor.cutsStored : id === 'processorIn' ? state.processor.rawStored : id === 'cannerOut' ? state.canner.goodsStored : id === 'cannerIn' ? state.canner.cutsStored : id === 'market' ? Math.min(6, state.shipping.queued) : 0);
      const supplies = id === 'beacon' && built && !state.expedition.flight ? Object.keys(FINAL_SUPPLIES).flatMap(key => Array(state.expedition.supplies[key]).fill(key)) : [];
      const signature = id === 'beacon' ? supplies.join(':') : String(count);
      if (station.signature !== signature) {
        station.signature = signature; this.clearInventory(station.stock);
        for (let i = 0; i < (id === 'beacon' ? supplies.length : count); i += 1) {
          const item = this.art.item(id === 'beacon' ? supplies[i] : type);
          if (id === 'beacon') { item.scale.setScalar(.62); item.position.set(toX(zone.x) + (i % 3 - 1) * 34, 48 + Math.floor(i / 3) * 16, toZ(zone.modelY + 50)); }
          else if (id === 'processorOut' || id === 'cannerOut') { item.scale.setScalar(.94); item.position.set(toX(zone.modelX ?? zone.x) + (i % 3 - 1) * 54, [50, 93, 137][Math.floor(i / 6)], toZ(zone.modelY) + (Math.floor(i / 3) % 2 ? 16 : -16)); }
          else item.position.set(toX(zone.modelX ?? zone.x) - 58 + (i % 3) * 55, 55 + Math.floor(i / 3) * 30, toZ(zone.modelY));
          station.stock.add(item);
        }
        this.batchInventory(station.stock);
      }
    }
  }

  buildContactShadows() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d'), gradient = c.createRadialGradient(32, 32, 5, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(31,54,65,.35)'); gradient.addColorStop(0.55, 'rgba(31,54,65,.16)'); gradient.addColorStop(1, 'rgba(31,54,65,0)');
    c.fillStyle = gradient; c.fillRect(0, 0, 64, 64);
    this.contacts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 80);
    this.contacts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.contacts.frustumCulled = false; this.root.add(this.contacts);
    this.contactDummy = new THREE.Object3D();
  }

  updateContactShadows(state, enemies) {
    const entries = [state.player, ...enemies];
    if (state.upgrades.pickup) entries.push(state.automation.worker);
    let i = 0;
    const place = (x, y, w, d) => {
      const inside = x >= SAFE.x && x <= SAFE.x + SAFE.w && y >= SAFE.y && y <= SAFE.y + SAFE.h;
      const dummy = this.contactDummy; dummy.position.set(toX(x), inside ? 38 : fieldHeight(x, y) + 1, toZ(y)); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(w, d, 1); dummy.updateMatrix(); this.contacts.setMatrixAt(i++, dummy.matrix);
    };
    for (const e of entries) place(e.x, e.y, e.boss ? 270 : e.r ? e.r * 3.2 : 80, e.boss ? 340 : e.r ? e.r * 4 : 90);
    for (const [id, s] of this.stations) if (facilityAvailable(state, id) && facilityBuilt(state, id)) { const z = STATIONS[id]; place(z.modelX ?? z.x, z.modelY, ['processorIn', 'cannerIn', 'market', 'forge'].includes(id) ? 270 : 210, 170); }
    this.contacts.count = i; this.contacts.instanceMatrix.needsUpdate = true;
  }

  updateFinalFlight(state, dt) {
    const f = state.expedition?.flight, mesh = this.finalDrone;
    mesh.visible = !!f; if (!mesh.visible) return;
    const height = f.phase === 'loading' ? 210 + f.timer * 60 : f.phase === 'landing' ? 340 - Math.min(1, f.timer / 1.5) * 195 : f.phase === 'arrived' ? 145 : 340;
    mesh.position.set(toX(f.x), height, toZ(f.y));
    mesh.rotation.y = f.phase === 'loading' ? 0 : Math.atan2(WORLD.width + 480 - f.x, SAFE.y - 600 - f.y);
    if (f.phase !== 'arrived') mesh.userData.rotors.forEach((r, i) => r.rotation.y += dt * 50 * (i % 2 ? 1 : -1));
    if (!mesh.userData.loaded) {
      mesh.userData.loaded = true;
      const types = ['core', ...Object.entries(FINAL_SUPPLIES).flatMap(([key, count]) => Array(count).fill(key))];
      for (let i = 0; i < types.length; i++) {
        const item = this.art.item(types[i]); item.scale.setScalar(.52); item.position.set((i % 3 - 1) * 31, Math.floor(i / 6) * 10, Math.floor(i / 3) % 2 * 24 - 12); mesh.userData.cargo.add(item);
      }
      this.batchInventory(mesh.userData.cargo);
    }
  }

  updateDrones(state, dt) {
    for (const [id, mesh] of this.drones) {
      const d = state.automation.drones[id];
      mesh.visible = facilityAvailable(state, id) && state.upgrades[id] > 0;
      if (!mesh.visible) continue;
      const height = d.phase === 'idle' ? 150 : 190 + Math.sin(state.elapsed * 5) * 5;
      mesh.userData.flightHeight ??= height;
      mesh.userData.flightHeight += (height - mesh.userData.flightHeight) * Math.min(1, dt * 8);
      mesh.position.set(toX(d.x), mesh.userData.flightHeight, toZ(d.y));
      if (d.target) mesh.rotation.y = lerpAngle(mesh.rotation.y, Math.atan2(d.target.x - d.x, d.target.y - d.y), Math.min(1, dt * 10));
      mesh.userData.rotors.forEach((rotor, i) => { rotor.rotation.y += dt * (d.phase === 'idle' ? 12 : 44) * (i % 2 ? 1 : -1); });
      if (mesh.userData.signature !== d.cargo) {
        mesh.userData.signature = d.cargo; this.clearInventory(mesh.userData.cargo);
        for (let i = 0; i < d.cargo; i += 1) {
          const item = this.art.item('goods'); item.scale.setScalar(0.65);
          item.position.set((i % 3 - 1) * 35, Math.floor(i / 6) * 18, (Math.floor(i / 3) % 2 - 0.5) * 26); mesh.userData.cargo.add(item);
        }
        this.batchInventory(mesh.userData.cargo);
      }
    }
  }

  buildConveyor() {
    const a = this.art, g = new THREE.Group();
    this.beltLength = 0;
    for (let i = 1; i < CONVEYOR_PATH.length; i++) {
      const start = CONVEYOR_PATH[i - 1], end = CONVEYOR_PATH[i];
      const length = Math.hypot(end.x - start.x, end.y - start.y), segment = new THREE.Group();
      this.beltLength += length;
      segment.position.set(toX((start.x + end.x) / 2), 0, toZ((start.y + end.y) / 2));
      segment.rotation.y = -Math.atan2(end.y - start.y, end.x - start.x);
      a.box(segment, length, 14, 66, 'black', 0, BELT_DECK_HEIGHT - 8, 0, 3);
      for (const z of [-37, 37]) {
        a.box(segment, length, 17, 7, 'teal', 0, BELT_DECK_HEIGHT - 4, z, 2);
        a.box(segment, length, 3, 9, 'steel', 0, BELT_DECK_HEIGHT + 6, z, 1);
      }
      const supports = Math.max(1, Math.ceil(length / 180));
      for (let j = 0; j <= supports; j++) for (const z of [-29, 29]) {
        const x = -length / 2 + j * length / supports;
        a.box(segment, 10, 57, 10, 'steel', x, 61, z, 1);
        a.box(segment, 24, 5, 21, 'black', x, 34, z, 2);
        a.ball(segment, 2, 2, 2, 'gold', x, 82, z + Math.sign(z) * 6);
      }
      const count = Math.ceil(length / 55);
      for (let j = 0; j <= count; j++) {
        const x = -length / 2 + j * length / count;
        a.cylinder(segment, 5, 64, 'steel', x, BELT_DECK_HEIGHT - 3, 0).rotation.x = Math.PI / 2;
      }
      g.add(segment);
    }
    this.conveyorMesh = this.batch(g); this.root.add(this.conveyorMesh);
    this.beltSlats = Array.from({ length: Math.ceil(this.beltLength / 40) }, () => new THREE.Object3D());
    const template = a.box(new THREE.Group(), 61, 2, 7, 'stoneDark', 0, 0, 0, 1);
    this.beltSlatMesh = new THREE.InstancedMesh(template.geometry, template.material, this.beltSlats.length);
    this.beltSlatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.beltSlatMesh.frustumCulled = false; this.root.add(this.beltSlatMesh);
    this.beltItems = new Map();
  }

  updateConveyor(state) {
    const active = state.upgrades.conveyor > 0;
    this.conveyorMesh.visible = active;
    this.beltSlatMesh.visible = active;
    this.beltSlats.forEach((slat, i) => {
      slat.visible = active;
      const p = beltPoint((i / this.beltSlats.length + state.elapsed * state.upgrades.conveyor * 42 / this.beltLength) % 1);
      slat.position.set(toX(p.x), BELT_DECK_HEIGHT, toZ(p.y)); slat.rotation.y = p.angle;
      slat.updateMatrix(); this.beltSlatMesh.setMatrixAt(i, slat.matrix);
    });
    this.beltSlatMesh.instanceMatrix.needsUpdate = true;
    const living = new Set(state.conveyor.items);
    for (const [item, mesh] of this.beltItems) if (!living.has(item)) { this.root.remove(mesh); this.beltItems.delete(item); }
    for (const item of state.conveyor.items) {
      let mesh = this.beltItems.get(item);
      if (!mesh) { mesh = this.art.item('cuts'); this.root.add(mesh); this.beltItems.set(item, mesh); }
      const p = beltPoint(item.progress);
      mesh.position.set(toX(p.x), BELT_DECK_HEIGHT + 3, toZ(p.y)); mesh.rotation.y = p.angle;
    }
  }

  updateWorker(state, dt) {
    const w = state.automation.worker, mesh = this.worker, rig = mesh.userData, visible = facilityAvailable(state, 'pickup') && state.upgrades.pickup > 0;
    mesh.visible = this.workerHp.visible = this.workerLabel.mesh.visible = visible;
    if (!visible) { this.serviceDoor.position.x = toX(SERVICE_GATE.x); return; }
    const safe = w.y >= SAFE.y;
    mesh.position.set(toX(w.x), surfaceHeight(w.x, w.y), toZ(w.y));
    const waypoint = w.route[0];
    if (waypoint) rig.facing = lerpAngle(rig.facing, Math.atan2(waypoint.x - w.x, waypoint.y - w.y), Math.min(1, dt * 12));
    mesh.rotation.y = rig.facing; mesh.rotation.z = w.hp <= 0 ? Math.PI / 2 : 0;
    this.animateWalk(mesh, w.moving ? 1 : 0, dt);
    if (rig.cargo !== w.cargo) {
      rig.cargo = w.cargo; this.clearInventory(rig.stack);
      for (let i = 0; i < w.cargo; i++) { const item = this.art.item('raw'); item.position.y = i * 16; rig.stack.add(item); }
      this.batchInventory(rig.stack);
    }
    const pct = clamp(w.hp / w.hpMax, 0, 1);
    this.workerHp.position.set(toX(w.x) + 44, mesh.position.y + 70, toZ(w.y) + 18); this.workerHp.quaternion.copy(this.camera.quaternion);
    this.workerHp.userData.fill.scale.x = Math.max(0.001, pct); this.workerHp.userData.fill.position.x = -(1 - pct) * 35;
    this.workerHp.userData.fill.material.color.set(pct < 0.3 ? 0xed6159 : 0x68da8e);
    this.writeLabel(this.workerLabel, w.hp <= 0 ? `救助 ${Math.round(w.rescue / 1.5 * 100)}%\nHP 0` : `回収人\nHP ${Math.ceil(w.hp)}/${w.hpMax}`);
    this.workerLabel.mesh.position.set(toX(w.x), mesh.position.y + 160, toZ(w.y)); this.workerLabel.mesh.quaternion.copy(this.camera.quaternion);
    const nearGate = Math.abs(w.x - SERVICE_GATE.x) < 70 && Math.abs(w.y - SAFE.y) < 140;
    this.serviceDoor.position.x = toX(SERVICE_GATE.x) + (nearGate ? 75 : 0);
  }

  updateHunter(state) {
    const visible = state.upgrades.hunter > 0, h = state.hunter;
    this.tower.visible = visible; this.bullet.visible = visible && h.motion && h.motion.time < 0.35;
    this.hunterLabel.mesh.visible = visible;
    this.writeLabel(this.hunterLabel, h.mode === 'guard' ? '在庫十分 · 防衛中' : '自動狩り');
    this.hunterLabel.mesh.position.set(toX(HUNTER_POSITION.x), 245, toZ(HUNTER_POSITION.y)); this.hunterLabel.mesh.quaternion.copy(this.camera.quaternion);
    if (!h.motion) return;
    const target = h.motion.target, dx = target.x - HUNTER_POSITION.x, dy = target.y - HUNTER_POSITION.y;
    this.tower.userData.turret.rotation.y = Math.atan2(dx, dy);
    this.tower.userData.turret.position.z = h.motion.time < 0.45 ? -Math.sin(h.motion.time / 0.45 * Math.PI) * 8 : 0;
    const t = clamp(h.motion.time / 0.35, 0, 1);
    this.bullet.position.set(toX(HUNTER_POSITION.x + dx * t), 174 + (50 - 174) * t, toZ(HUNTER_POSITION.y + dy * t));
    this.bullet.rotation.y = Math.atan2(dx, dy);
  }

  updateFreight(state, dt) {
    for (let i = 0; i < state.shipping.flights.length; i++) {
      const f = state.shipping.flights[i];
      if (!this.freights[i]) {
        const mesh = this.art.drone('blue'); mesh.scale.setScalar(1.2); this.root.add(mesh);
        const label = this.makeLabel('', 105, 40); this.root.add(label.mesh);
        this.freights[i] = { mesh, label };
      }
      const { mesh, label } = this.freights[i]; mesh.visible = label.mesh.visible = true;
      const height = ['idle', 'loading'].includes(f.phase) ? 245 : 320 + i * 35;
      mesh.userData.flightHeight ??= height;
      mesh.userData.flightHeight += (height - mesh.userData.flightHeight) * Math.min(1, dt * 6);
      mesh.position.set(toX(f.x), mesh.userData.flightHeight, toZ(f.y));
      const dx = f.phase === 'outbound' ? WORLD.width + 400 - f.x : STATIONS.market.x - f.x;
      const dy = f.phase === 'outbound' ? SAFE.y - 340 - f.y : STATIONS.market.modelY - f.y;
      if (Math.hypot(dx, dy) > 1) mesh.rotation.y = lerpAngle(mesh.rotation.y, Math.atan2(dx, dy), Math.min(1, dt * 8));
      mesh.userData.rotors.forEach((rotor, j) => { rotor.rotation.y += dt * (f.phase === 'idle' ? 8 : f.phase === 'loading' ? 20 : 44) * (j % 2 ? 1 : -1); });
      if (mesh.userData.signature !== f.cargo) {
        mesh.userData.signature = f.cargo; this.clearInventory(mesh.userData.cargo);
        for (let j = 0; j < f.cargo; j++) {
          const item = this.art.item('goods'); item.scale.setScalar(0.8);
          item.position.set((j % 3 - 1) * 35, 0, (Math.floor(j / 3) - 0.5) * 30); mesh.userData.cargo.add(item);
        }
        this.batchInventory(mesh.userData.cargo);
      }
      const phase = { idle: '商品待ち', loading: `積込 ${f.cargo}/6`, outbound: '出荷中', return: '帰還中' }[f.phase];
      this.writeLabel(label, `#${i + 1}\n${phase}`);
      label.mesh.position.set(toX(f.x), mesh.userData.flightHeight + 95, toZ(f.y)); label.mesh.quaternion.copy(this.camera.quaternion);
    }
    for (let i = state.shipping.flights.length; i < this.freights.length; i++) { this.freights[i].mesh.visible = this.freights[i].label.mesh.visible = false; }
  }

  updateDrops(drops, time) {
    const living = new Set(drops);
    for (const [drop, mesh] of this.dropMeshes) if (!living.has(drop)) { this.clearInventory(mesh); this.root.remove(mesh); this.dropMeshes.delete(drop); }
    for (const [drop, badge] of this.dropBadges) if (!living.has(drop) || lootAmount(drop) <= 1) { this.root.remove(badge); this.dropBadges.delete(drop); }
    const quantities = new Set(drops.map(lootAmount).filter(n => n > 1));
    for (const [quantity, material] of this.badgeMaterials) if (!quantities.has(quantity)) { material.map.dispose(); material.dispose(); this.badgeMaterials.delete(quantity); }
    for (const drop of drops) {
      let mesh = this.dropMeshes.get(drop);
      if (!mesh) { mesh = new THREE.Group(); this.dropMeshes.set(drop, mesh); this.root.add(mesh); }
      const amount = lootAmount(drop), shown = Math.min(4, Math.ceil(amount / 2));
      if (mesh.userData.amount !== amount) {
        mesh.userData.amount = amount; mesh.clear();
        mesh.add(this.art.lootPile(drop.type || 'raw', amount));
      }
      const ground = surfaceHeight(drop.x, drop.y);
      mesh.position.set(toX(drop.x), ground + 6, toZ(drop.y));
      if (amount > 1) {
        if (!this.badgeMaterials.has(amount)) {
          const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 48; const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#244d4b'; ctx.fillRect(0, 0, 128, 48); ctx.fillStyle = '#fff5dc'; ctx.font = '800 32px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`×${amount}`, 64, 25, 118);
          this.badgeMaterials.set(amount, new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false }));
        }
        let badge = this.dropBadges.get(drop);
        if (!badge) { badge = new THREE.Sprite(this.badgeMaterials.get(amount)); this.root.add(badge); this.dropBadges.set(drop, badge); }
        badge.material = this.badgeMaterials.get(amount); badge.position.set(toX(drop.x), ground + 43 + shown * 12, toZ(drop.y)); badge.scale.set(52, 20, 1);
      }
    }
  }

  updateTransfers(state, dt) {
    for (const event of state.transfers || []) {
      if (event.id <= this.lastTransferId) continue; this.lastTransferId = event.id;
      const mesh = this.art.item(event.type); this.root.add(mesh); this.flyingItems.push({ mesh, event, time: 0 });
    }
    for (let i = this.flyingItems.length - 1; i >= 0; i -= 1) {
      const f = this.flyingItems[i]; f.time += dt; const t = clamp(f.time / 0.4, 0, 1), { from, to } = f.event;
      f.mesh.position.set(toX(THREE.MathUtils.lerp(from.x, to.x, t)), THREE.MathUtils.lerp(from.h || 100, to.h || 65, t) + Math.sin(t * Math.PI) * 95, toZ(THREE.MathUtils.lerp(from.y, to.y, t)));
      f.mesh.rotation.y = t * Math.PI;
      if (t >= 1) { this.root.remove(f.mesh); this.flyingItems.splice(i, 1); }
    }
  }

  updateParticles(particles) {
    const living = new Set(particles);
    for (const [p, mesh] of this.particleMeshes) if (!living.has(p)) { this.root.remove(mesh); mesh.material.dispose(); this.particleMeshes.delete(p); }
    for (const p of particles) {
      let mesh = this.particleMeshes.get(p);
      if (!mesh) {
        mesh = new THREE.Mesh(this.art.cached('spark', () => new THREE.SphereGeometry(1, 6, 4)), new THREE.MeshBasicMaterial({ color: p.color || 0xffcf8a }));
        this.particleMeshes.set(p, mesh); this.root.add(mesh);
      }
      mesh.position.set(toX(p.x), 40 + p.life * 45, toZ(p.y)); mesh.scale.setScalar((p.r || 3) * Math.min(1, p.life * 4));
    }
  }

  updateFloaters(floaters) {
    this.floatLabels ||= new Map(); const living = new Set(floaters);
    for (const [f, label] of this.floatLabels) if (!living.has(f)) {
      this.root.remove(label.mesh); label.mesh.geometry.dispose(); label.mesh.material.dispose(); label.map.dispose(); this.floatLabels.delete(f);
    }
    for (const f of floaters) {
      let label = this.floatLabels.get(f);
      if (!label) {
        label = this.makeLabel('', f.text.includes('HIT') ? 160 : 80, f.text.includes('HIT') ? 56 : 36, false, true);
        label.mesh.material.depthTest = false; label.mesh.renderOrder = 15;
        this.floatLabels.set(f, label); this.root.add(label.mesh);
      }
      this.writeLabel(label, f.text, f.color || '#ffffff');
      label.mesh.position.set(toX(f.x), 150, toZ(f.y)); label.mesh.quaternion.copy(this.camera.quaternion); label.mesh.material.opacity = Math.min(1, f.life * 2);
    }
  }

  updateArrow(state) {
    const p = state.player, target = missionTarget(state);
    this.arrow.visible = !state.gameOver && !state.stageClear && !state.campaignComplete && !state.expedition?.flight;
    this.arrow.position.set(toX(target.x), 150 + Math.sin(state.elapsed * 3) * 8, toZ(target.y)); this.arrow.quaternion.copy(this.camera.quaternion);
  }
}
