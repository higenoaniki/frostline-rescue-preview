export const WORLD = { width: 2000, height: 5450 };
const FIELD_EXTENSION = 2000;
export const SAFE = { x: 250, y: 1180 + FIELD_EXTENSION, w: 1500, h: 2200 };
export const HUNTING = { x: 150, y: 160, w: WORLD.width - 300, h: SAFE.y - 320 };

export function enemyRules(stage) {
  stage = Math.min(stage, 16);
  return {
    maxEnemies: Math.min(40, 18 + stage * 2),
    nearEnemies: Math.min(14, 7 + stage),
    enemyHp: 6,
    enemyDamage: 4.8 + stage * 1.05,
    enemySpeed: 74 + Math.min(stage, 16) * 3.6,
    detectionRange: 780,
    eliteRatio: stage < 3 ? 0 : Math.min(0.4, 0.12 + (stage - 3) * 0.025),
    bruteRatio: stage < 6 ? 0 : Math.min(0.25, 0.12 + (stage - 6) * 0.015),
    enemyFenceDamage: 2 + stage * 0.4,
    fenceRaid: stage >= 4,
    raidDelay: 100,
    raiders: Math.min(4, 1 + Math.floor(Math.max(0, stage - 4) / 2)),
    fenceHp: stage < 4 ? 140 : 550 + stage * 80,
    spawnDelay: Math.max(0.25, 0.65 - stage * 0.055)
  };
}

export function enemySpawnPoint(band, random = Math.random) {
  const [min, max] = band === 'near' ? [SAFE.y - 950, SAFE.y - 230] : band === 'middle' ? [1100, SAFE.y - 1000] : [HUNTING.y, 1000];
  return { x: HUNTING.x + random() * HUNTING.w, y: min + random() * (max - min) };
}

// The pad is walkable; the building sits behind it, clear of the delivery lane.
const baseStations = {
  processorIn: { id: 'processorIn', x: 430, y: 1830, w: 210, h: 110, title: '肉加工', modelY: 1580 },
  processorOut: { id: 'processorOut', x: 660, y: 1820, w: 190, h: 110, title: '加工肉回収', modelX: 690, modelY: 1530 },
  cannerIn: { id: 'cannerIn', x: 430, y: 2430, w: 210, h: 110, title: '保存食生産', modelY: 2180 },
  cannerOut: { id: 'cannerOut', x: 730, y: 2440, w: 210, h: 110, title: '保存食回収', modelY: 2180 },
  market: { id: 'market', x: 1430, y: 1630, w: 250, h: 120, title: '出荷場', modelY: 1410 },
  weapon: { id: 'weapon', x: 1250, y: 2130, w: 210, h: 110, title: '武器', modelY: 1970 },
  armor: { id: 'armor', x: 1540, y: 2130, w: 210, h: 110, title: '防具', modelY: 1970 },
  conveyor: { id: 'conveyor', x: 750, y: 2840, w: 210, h: 110, title: 'コンベア', modelY: 2690 },
  machine: { id: 'machine', x: 430, y: 2840, w: 210, h: 110, title: '生産速度', modelY: 2690 },
  delivery: { id: 'delivery', x: 1250, y: 2520, w: 210, h: 110, title: '自動配送', modelY: 2380 },
  fleet: { id: 'fleet', x: 1540, y: 2520, w: 210, h: 110, title: 'ドローン増機', modelY: 2380 },
  pickup: { id: 'pickup', x: 1250, y: 2940, w: 210, h: 110, title: '回収人', modelY: 2810 },
  hunter: { id: 'hunter', x: 1540, y: 2940, w: 210, h: 110, title: '自動狩り', modelY: 2810 },
  forge: { id: 'forge', x: 430, y: 3230, w: 210, h: 110, title: '素材工房', modelY: 3080 },
  beacon: { id: 'beacon', x: 750, y: 3230, w: 210, h: 110, title: '補給通信台', modelY: 3080 }
};
export const STATIONS = Object.fromEntries(Object.entries(baseStations).map(([id, zone]) => [id, { ...zone, y: zone.y + FIELD_EXTENSION, modelY: zone.modelY + FIELD_EXTENSION }]));

// The entire belt stays west of the gate corridor.
export const CONVEYOR_PATH = [
  { x: STATIONS.processorOut.modelX, y: STATIONS.processorOut.modelY },
  { x: 690, y: SAFE.y + 190 },
  { x: 295, y: SAFE.y + 190 },
  { x: 295, y: STATIONS.cannerIn.modelY - 115 },
  { x: STATIONS.cannerIn.x, y: STATIONS.cannerIn.modelY - 115 },
  { x: STATIONS.cannerIn.x, y: STATIONS.cannerIn.modelY }
];
export const corridor = { x: 1000, halfWidth: 100 };
export function beltPoint(progress) {
  const lengths = CONVEYOR_PATH.slice(1).map((p, i) => Math.hypot(p.x - CONVEYOR_PATH[i].x, p.y - CONVEYOR_PATH[i].y));
  let remaining = Math.min(1, Math.max(0, progress)) * lengths.reduce((sum, length) => sum + length, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const a = CONVEYOR_PATH[i], b = CONVEYOR_PATH[i + 1], t = remaining / lengths[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.x - a.x, b.y - a.y) };
    }
    remaining -= lengths[i];
  }
}

export const toX = (x) => x - WORLD.width / 2;
export const toZ = (y) => y - WORLD.height / 2;
