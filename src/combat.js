import { enemyRules, SAFE } from './world-config.js';
import { ARMOR_REDUCTION, requiredWorkLevel, facilityAvailable } from './progression.js';
import { huntingMode } from './harvest-balance.js';

export const armorDamage = (amount, level) => Math.max(1, amount * (1 - ARMOR_REDUCTION[Math.min(4, Math.max(1, level))]));
export const HUNTER_POSITION = { x: 730, y: SAFE.y + 140 };
export const BOSS_POSITION = { x: 1000, y: 610 };
export const resetHunter = () => ({ cooldown: 0, motion: null, mode: 'hunting' });
export function enemyStats(stage, elite = false) {
  const rules = enemyRules(stage);
  if (elite === 'boss') return { kind: 'boss', elite: true, boss: true, r: 76, hp: 260, hpMax: 260, armor: 2, speed: 112, damage: 34, fenceDamage: 0, attackRange: 155, detectionRange: 1100, value: 8, cooldown: 1, attackMotion: null, hurt: 0, wobble: 0, wander: 0, spawnGrace: 1 };
  const brute = elite === 'brute'; elite = Boolean(elite);
  const hp = brute ? 24 + Math.min(12, Math.floor(Math.max(0, stage - 6) / 3) * 4) : elite ? 12 + Math.min(6, Math.floor(Math.max(0, stage - 3) / 3) * 3) : 6;
  return {
    kind: brute ? 'brute' : elite ? 'alpha' : 'normal', elite, r: brute ? 52 : elite ? 44 : 32,
    hp, hpMax: hp, armor: brute ? 2 : 0,
    speed: rules.enemySpeed * (brute ? 0.72 : elite ? 0.9 : 1),
    damage: rules.enemyDamage * (elite ? 1.65 : 1),
    fenceDamage: rules.enemyFenceDamage * (elite ? 1.6 : 1),
    attackRange: elite ? 88 : 74, detectionRange: rules.detectionRange,
    value: elite ? 6 : 3, cooldown: 0.7, attackMotion: null,
    hurt: 0, wobble: 0, wander: 0, spawnGrace: 0.5
  };
}
export function updateHunter(state, enemies, dt, damage, drops = []) {
  const h = state.hunter, level = state.upgrades.hunter;
  if (!level || !facilityAvailable(state, 'hunter')) return;
  h.mode = huntingMode(state, drops);
  h.cooldown = Math.max(0, h.cooldown - dt);
  if (h.motion) {
    h.motion.time += dt;
    if (!h.motion.hit && h.motion.time >= 0.35) {
      h.motion.hit = true;
      const target = h.motion.target;
      if (enemies.includes(target) && Math.hypot(target.x - HUNTER_POSITION.x, target.y - HUNTER_POSITION.y) <= 960) {
        damage(target, 6 + (level - 1) * 3, Math.atan2(target.y - HUNTER_POSITION.y, target.x - HUNTER_POSITION.x), true);
      }
    }
    if (h.motion.time >= 0.55) h.motion = null;
    return;
  }
  if (h.cooldown > 0) return;
  const proofNeeded = state.stage === 5 && (state.work.autoKills - (state.progressBaseline?.autoKills || 0)) < 1;
  const threat = e => ['fence', 'heater', 'player', 'worker'].includes(e.attackMotion?.target) || e.y > SAFE.y + 30
    || state.player.y < SAFE.y && Math.hypot(e.x - state.player.x, e.y - state.player.y) < 220;
  const target = enemies.filter(e => (h.mode !== 'guard' || proofNeeded || threat(e)) && Math.hypot(e.x - HUNTER_POSITION.x, e.y - HUNTER_POSITION.y) < 900)
    .sort((a, b) => Math.hypot(a.x - HUNTER_POSITION.x, a.y - HUNTER_POSITION.y) - Math.hypot(b.x - HUNTER_POSITION.x, b.y - HUNTER_POSITION.y))[0];
  if (target) { h.motion = { target, time: 0, hit: false }; h.cooldown = 1.15 / (1 + (level - 1) * 0.32); }
}
export function countKill(state, enemy, automatic) {
  state.work.kills = (state.work.kills || 0) + 1;
  if (automatic) {
    if (state.upgrades.hunter >= requiredWorkLevel(state.stage, 'hunter')) state.work.autoKills++;
  } else {
    if (state.upgrades.weapon >= 2) state.work.armedKills++;
    if (state.upgrades.armor >= 2) state.work.armoredKills++;
  }
  if (enemy.elite) state.work.eliteKills++;
}
