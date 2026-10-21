import { STATIONS, CONVEYOR_PATH, SAFE } from './world-config.js';

export const BELT_DECK_HEIGHT = 96;
export const BELT_HALF_WIDTH = 42;
export function beltObstacles(margin = 0) {
  return CONVEYOR_PATH.slice(1).map((b, i) => {
    const a = CONVEYOR_PATH[i], r = BELT_HALF_WIDTH + margin;
    return { left: Math.min(a.x, b.x) - r, right: Math.max(a.x, b.x) + r, top: Math.min(a.y, b.y) - r, bottom: Math.max(a.y, b.y) + r };
  });
}
export function walkingObstacles(state, radius = 26) {
  const obstacles = Object.entries(STATIONS).filter(([id]) => ['processorIn', 'processorOut', 'cannerIn', 'cannerOut', 'market'].includes(id) || state.built?.[id]).map(([id, s]) => {
    const w = ['processorOut', 'cannerOut'].includes(id) ? 94 : ['delivery', 'fleet', 'pickup', 'hunter', 'conveyor', 'machine'].includes(id) ? 72 : 110;
    const h = ['processorOut', 'cannerOut'].includes(id) ? 37 : 59, x = s.modelX ?? s.x;
    return { left: x - w - radius, right: x + w + radius, top: s.modelY - h - radius, bottom: s.modelY + h + radius };
  });
  if (state.upgrades.conveyor) obstacles.push(...beltObstacles(radius));
  if (state.upgrades.hunter) obstacles.push({ left: 675 - radius, right: 785 + radius, top: SAFE.y + 92 - radius, bottom: SAFE.y + 188 + radius });
  obstacles.push({ left: 1105 - radius, right: 1215 + radius, top: SAFE.y + 185 - radius, bottom: SAFE.y + 295 + radius });
  return obstacles;
}
export const insideRect = (p, r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
export function segmentBlocked(a, b, r) {
  let lo = 0, hi = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.left + 0.01, r.right - 0.01], [a.y, b.y - a.y, r.top + 0.01, r.bottom - 0.01]]) {
    if (Math.abs(delta) < 1e-9) { if (start <= min || start >= max) return false; }
    else { const t1 = (min - start) / delta, t2 = (max - start) / delta; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)); }
  }
  return lo < hi && hi > 0 && lo < 1;
}
export function walkingRoute(start, end, state) {
  const obstacles = walkingObstacles(state), nodes = [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  const clear = (a, b) => !obstacles.some(r => segmentBlocked(a, b, r));
  if (obstacles.some(r => insideRect(end, r))) return [];
  const enclosing = obstacles.find(r => insideRect(start, r));
  if (enclosing) {
    const exits = [{ x: enclosing.left - 1, y: start.y }, { x: enclosing.right + 1, y: start.y }, { x: start.x, y: enclosing.top - 1 }, { x: start.x, y: enclosing.bottom + 1 }]
      .filter(p => !obstacles.some(r => insideRect(p, r))).sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
    for (const exit of exits) { const route = walkingRoute(exit, end, state); if (route.length) return [exit, ...route]; }
    return [];
  }
  if (clear(start, end)) return [nodes[1]];
  for (const r of obstacles) for (const x of [r.left, r.right]) for (const y of [r.top, r.bottom]) {
    const p = { x, y };
    if (x > SAFE.x + 26 && x < SAFE.x + SAFE.w - 26 && y > SAFE.y + 26 && y < SAFE.y + SAFE.h - 26 && !obstacles.some(o => insideRect(p, o))) nodes.push(p);
  }
  const costs = nodes.map(() => Infinity), previous = [], visited = new Set(); costs[0] = 0;
  // A visibility graph routes around inflated equipment, including belt corners.
  while (visited.size < nodes.length) {
    let at = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (at < 0 || costs[i] < costs[at])) at = i;
    if (at < 0 || !Number.isFinite(costs[at])) break;
    if (at === 1) { const route = []; for (let i = 1; i !== 0; i = previous[i]) route.unshift(nodes[i]); return route; }
    visited.add(at);
    for (let i = 1; i < nodes.length; i++) if (!visited.has(i) && clear(nodes[at], nodes[i])) {
      const cost = costs[at] + Math.hypot(nodes[i].x - nodes[at].x, nodes[i].y - nodes[at].y);
      if (cost < costs[i]) { costs[i] = cost; previous[i] = at; }
    }
  }
  return [];
}
