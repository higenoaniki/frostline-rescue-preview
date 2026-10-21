import { WORLD, SAFE, STATIONS } from './world-config.js';

export const FREIGHT_CAPACITY = 6;
export const LOADING_SECONDS = 1.5;
export const freightDock = (index = 0) => ({ x: STATIONS.market.x + (index % 2 ? 180 : -180), y: STATIONS.market.modelY - 160 + Math.floor(index / 2) * 140 });
export const newFlight = index => ({ ...freightDock(index), index, phase: 'idle', cargo: 0, timer: 0 });
export const resetShipping = () => ({ queued: 0, dispatched: 0, flights: [newFlight(0)] });

export function shippingStatus(state) {
  const ships = state.shipping, flights = ships.flights;
  const outbound = flights.filter(f => f.phase === 'outbound').length, returning = flights.filter(f => f.phase === 'return').length;
  const loading = flights.find(f => f.phase === 'loading');
  const loadingCount = flights.filter(f => f.phase === 'loading').length;
  const idle = flights.filter(f => f.phase === 'idle').length, phases = [];
  if (idle) phases.push(`商品待ち ${idle}機`);
  if (loading) phases.push(`積込 ${loadingCount}機 ${Math.max(0, LOADING_SECONDS - loading.timer).toFixed(1)}秒`);
  if (outbound) phases.push(`出荷 ${outbound}機`);
  if (returning) phases.push(`帰還 ${returning}機`);
  return `待機商品 ${ships.queued} · ${phases.join(' · ')} · 全${flights.length}機`;
}
export function updateShipping(state, dt) {
  const shipping = state.shipping, count = state.upgrades?.fleet ?? 1;
  while (shipping.flights.length < count) shipping.flights.push(newFlight(shipping.flights.length));
  for (const f of shipping.flights) {
    if (f.phase === 'idle') {
      if (!shipping.queued) continue;
      f.phase = 'loading'; f.timer = 0;
    }
    if (f.phase === 'loading') {
      const amount = Math.min(FREIGHT_CAPACITY - f.cargo, shipping.queued);
      f.cargo += amount; shipping.queued -= amount; f.timer += dt;
      if (f.timer < LOADING_SECONDS) continue;
      f.phase = 'outbound'; f.timer = 0;
    }
    const target = f.phase === 'outbound' ? { x: WORLD.width + 400, y: SAFE.y - 340 - f.index * 75 } : freightDock(f.index);
    const dx = target.x - f.x, dy = target.y - f.y, distance = Math.hypot(dx, dy), step = dt * 620;
    if (distance > step) { f.x += dx / distance * step; f.y += dy / distance * step; continue; }
    f.x = target.x; f.y = target.y;
    if (f.phase === 'outbound') {
      shipping.dispatched += f.cargo; state.work.dispatches++;
      f.cargo = 0; f.phase = 'return';
    } else { f.phase = 'idle'; f.timer = 0; }
  }
}
