import { SAFE } from './world-config.js';

export const BREACH = { x: 1560, y: SAFE.y };
export const HEATER = { x: 1160, y: SAFE.y + 240 };
export const REPAIR_COST = 12;
export const resetDefense = () => ({ hp: 600, hpMax: 600, breach: false, quiet: 0 });
export function updateDefense(state, enemies, dt) {
  state.defense ??= resetDefense();
  state.defense.breach = state.fenceHp <= 0;
  const danger = enemies.some(e => e.y >= SAFE.y - 120 && Math.hypot(e.x - HEATER.x, e.y - HEATER.y) < 600);
  state.defense.quiet = danger ? 0 : state.defense.quiet + dt;
  if (!state.defense.breach && state.defense.quiet >= 8) state.defense.hp = Math.min(state.defense.hpMax, state.defense.hp + dt * 5);
}
export function repairDefense(state) {
  if (state.gameOver || state.player.hp <= 0 || state.player.cash < REPAIR_COST || Math.hypot(state.player.x - HEATER.x, state.player.y - HEATER.y) > 240 || (state.fenceHp >= state.fenceHpMax && state.defense.hp >= state.defense.hpMax)) return false;
  state.player.cash -= REPAIR_COST;
  state.fenceHp = Math.min(state.fenceHpMax, state.fenceHp + state.fenceHpMax * 0.4);
  state.defense.hp = Math.min(state.defense.hpMax, state.defense.hp + state.defense.hpMax * 0.25);
  state.defense.breach = false;
  return true;
}
export const defeatReason = state => state.player.hp <= 0 ? '探索者が倒れました。装備と拠点を引き継いで再挑戦できます。' : state.defense?.hp <= 0 ? '熱源が停止しました。侵入口の迎撃と熱源の応急修理で守り抜こう。' : null;
