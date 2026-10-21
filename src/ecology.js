import { SAFE, HUNTING } from './world-config.js';
export const HUNTING_FOCUS = { x: 730, y: SAFE.y - 340 };
export const inNearHabitat = enemy => Math.hypot(enemy.x - HUNTING_FOCUS.x, enemy.y - HUNTING_FOCUS.y) < 520;
export function habitatPoint(player, enemies, random = Math.random) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = random() * Math.PI * 2, radius = 150 + random() * 330;
    const point = {
      x: Math.max(HUNTING.x + 35, Math.min(HUNTING.x + HUNTING.w - 35, HUNTING_FOCUS.x + Math.cos(angle) * radius)),
      y: Math.max(SAFE.y - 790, Math.min(SAFE.y - 125, HUNTING_FOCUS.y + Math.sin(angle) * radius))
    };
    if (Math.hypot(player.x - point.x, player.y - point.y) >= 200 && enemies.every(e => Math.hypot(e.x - point.x, e.y - point.y) > 85)) return point;
  }
  return null;
}
