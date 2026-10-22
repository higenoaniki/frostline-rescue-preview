import { STATIONS, SAFE } from './world-config.js';
import { STORAGE_LIMIT, facilityAvailable, requiredWorkLevel } from './progression.js';
import { walkingRoute } from './walkways.js';
import { lootAmount, takeLoot } from './harvest-balance.js';

const dock = id => ({ x: STATIONS[id].modelX ?? STATIONS[id].x, y: STATIONS[id].modelY });
export const SERVICE_GATE = { x: 800, y: SAFE.y };
export function resetAutomation() {
  return {
    drones: { delivery: { ...dock('delivery'), h: 190, phase: 'idle', cargo: 0, target: null } },
    worker: { x: STATIONS.pickup.x + 65, y: STATIONS.pickup.y + 55, hp: 120, hpMax: 120, phase: 'idle', cargo: 0, target: null, route: [], hurt: 0, rescue: 0, moving: false }
  };
}
export function travel(actor, target, dt, speed) {
  const dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy);
  actor.moving = distance > 1;
  if (distance <= speed * dt) { actor.x = target.x; actor.y = target.y; return true; }
  actor.x += dx / distance * speed * dt; actor.y += dy / distance * speed * dt; return false;
}
const inside = p => p.x >= SAFE.x && p.x <= SAFE.x + SAFE.w && p.y >= SAFE.y && p.y <= SAFE.y + SAFE.h;
function routeOutside(worker, target, state) {
  const exit = { x: SERVICE_GATE.x, y: SAFE.y + 55 };
  const approach = walkingRoute(worker, exit, state);
  if (inside(worker) && !approach.length) { worker.route = []; worker.phase = 'idle'; worker.target = null; return; }
  worker.route = inside(worker)
    ? [...approach, { x: SERVICE_GATE.x, y: SAFE.y - 90 }, target]
    : [target];
}
export function returnHome(worker, state = { upgrades: {}, built: {} }) {
  worker.phase = 'unloading'; worker.target = null;
  const entrance = { x: SERVICE_GATE.x, y: SAFE.y + 55 }, destination = { x: STATIONS.processorIn.x, y: STATIONS.processorIn.y };
  worker.route = inside(worker) ? walkingRoute(worker, destination, state) : [
    { x: SERVICE_GATE.x, y: SAFE.y - 90 }, entrance, ...walkingRoute(entrance, destination, state)
  ];
}
export function updateWorker(state, drops, dt, transfer) {
  if (!state.upgrades.pickup || !facilityAvailable(state, 'pickup')) return;
  const w = state.automation.worker, level = state.upgrades.pickup;
  w.hurt = Math.max(0, w.hurt - dt * 4); w.moving = false;
  if (w.hp <= 0) {
    w.phase = 'down';
    w.rescue = Math.hypot(w.x - state.player.x, w.y - state.player.y) < 95 && state.player.hp > 0 ? w.rescue + dt : 0;
    if (w.rescue >= 1.5) { w.hp = w.hpMax * 0.5; w.rescue = 0; returnHome(w, state); }
    return;
  }
  if (inside(w)) w.hp = Math.min(w.hpMax, w.hp + 22 * dt);
  if (!inside(w) && w.hp < w.hpMax * 0.3 && w.phase !== 'unloading') returnHome(w, state);
  const layout = `${state.upgrades.conveyor}:${Object.values(state.built || {}).join('')}`;
  if (w.layout !== layout) {
    w.layout = layout;
    if (w.phase === 'collecting' && w.target) routeOutside(w, w.target, state);
    else if (w.phase === 'unloading') returnHome(w, state);
  }
  if (w.phase === 'idle') {
    if (w.hp < w.hpMax * 0.8 || state.processor.rawStored >= STORAGE_LIMIT) return;
    const target = drops.filter(d => (!d.type || d.type === 'raw') && d.y > SAFE.y - 1050).reduce((best, d) => !best || Math.hypot(d.x - w.x, d.y - w.y) < Math.hypot(best.x - w.x, best.y - w.y) ? d : best, null);
    if (target) { w.phase = 'collecting'; w.target = target; routeOutside(w, target, state); }
  }
  if (w.phase === 'collecting' && !drops.includes(w.target)) returnHome(w, state);
  const waypoint = w.route[0];
  if (waypoint && travel(w, waypoint, dt, 300 + level * 50)) w.route.shift();
  if (w.route.length) return;
  if (w.phase === 'collecting') {
    const nearby = drops.filter(d => (!d.type || d.type === 'raw') && Math.hypot(d.x - w.x, d.y - w.y) < 130);
    let room = Math.max(0, 4 + level * 4 - w.cargo);
    for (const drop of nearby) {
      if (!room) break;
      const count = takeLoot(drop, Math.min(room, lootAmount(drop))); w.cargo += count; room -= count;
      transfer('raw', drop, w, 'worker-load'); if (drop.amount <= 0) drops.splice(drops.indexOf(drop), 1);
    }
    returnHome(w, state);
  } else if (w.phase === 'unloading') {
    if (Math.hypot(w.x - STATIONS.processorIn.x, w.y - STATIONS.processorIn.y) > 15) { returnHome(w, state); return; }
    const count = Math.min(w.cargo, STORAGE_LIMIT - state.processor.rawStored);
    state.processor.rawStored += count; w.cargo -= count;
    state.work.rawDelivered = (state.work.rawDelivered || 0) + count;
    if (level >= requiredWorkLevel(state.stage, 'pickup')) state.work.autoRaw += count;
    if (count) transfer('raw', w, dock('processorIn'), 'worker-deposit');
    if (!w.cargo) w.phase = 'idle';
  }
}
export function updateAutomation(state, drops, dt, { transfer, sell }) {
  updateWorker(state, drops, dt, transfer);
  const level = state.upgrades.delivery;
  if (!level || !facilityAvailable(state, 'delivery')) return;
  const d = state.automation.drones.delivery, speed = 330 + level * 100, capacity = level * 4;
  if (d.phase === 'idle' && state.canner.goodsStored > 0) { d.target = dock('cannerOut'); d.phase = 'loading'; }
  if (d.phase === 'loading' && travel(d, d.target, dt, speed)) {
    d.cargo = Math.min(capacity, state.canner.goodsStored); state.canner.goodsStored -= d.cargo;
    if (d.cargo) transfer('goods', dock('cannerOut'), d, 'drone-load');
    d.target = dock('market'); d.phase = 'unloading';
  } else if (d.phase === 'unloading' && travel(d, d.target, dt, speed)) {
    sell(d.cargo, d, true); d.cargo = 0; d.target = dock('delivery'); d.phase = 'return';
  } else if (d.phase === 'return' && travel(d, d.target, dt, speed)) {
    d.phase = 'idle'; d.target = null;
  }
}
