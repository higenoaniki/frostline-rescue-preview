export const SWING_DURATION = 0.44;
export const SWING_START = 0.12;
export const SWING_END = 0.30;
export const SWING_HALF_ANGLE = 1.45;
export const MELEE_REACH = 116;
export const AXE_GRIP_Y = -12;
export const swingProgress = time => Math.min(1, Math.max(0, (time - SWING_START) / (SWING_END - SWING_START)));
export const swingOffset = time => -SWING_HALF_ANGLE + swingProgress(time) * SWING_HALF_ANGLE * 2;

export function sweptTargets(player, enemies, motion, previousTime) {
  if (motion.time < SWING_START || previousTime > SWING_END || motion.hit && !motion.hits) return [];
  motion.hits ??= new Set();
  const first = swingOffset(Math.max(SWING_START, previousTime)), last = swingOffset(Math.min(SWING_END, motion.time));
  return enemies.filter(enemy => {
    if (motion.hits.has(enemy)) return false;
    const dx = enemy.x - player.x, dy = enemy.y - player.y, distance = Math.hypot(dx, dy);
    if (distance > player.range + (enemy.r || 32)) return false;
    const angle = Math.atan2(Math.sin(Math.atan2(dy, dx) - motion.angle), Math.cos(Math.atan2(dy, dx) - motion.angle));
    const padding = Math.asin(Math.min(.7, (enemy.r || 32) / Math.max(1, distance)));
    if (angle + padding < first || angle - padding > last) return false;
    motion.hits.add(enemy); return true;
  });
}
