import { UPGRADE_SPECS, upgradeCost, upgradeCap, upgradeLevel, facilityAvailable } from './progression.js';

export const resetInvestment = () => ({ id: null, timer: 0 });
export function startInvestment(state, id) {
  if (state.paused || state.gameOver || state.stageClear || !UPGRADE_SPECS[id] || !facilityAvailable(state, id) || upgradeLevel(state, id) >= upgradeCap(state.stage, id)) return false;
  state.investment = { id, timer: 0 }; return true;
}
export function updateInvestment(state, dt, eligible, { transfer, buy }) {
  const session = state.investment, id = session.id;
  if (!id) return;
  if (state.paused || state.gameOver || state.stageClear || !eligible(id) || !facilityAvailable(state, id) || upgradeLevel(state, id) >= upgradeCap(state.stage, id) || state.player.moving || state.player.cash <= 0) {
    state.investment = resetInvestment(); return;
  }
  session.timer += dt;
  while (session.timer >= 0.04 && state.investment.id) {
    session.timer -= 0.04;
    const cost = upgradeCost(state, id);
    const amount = Math.min(Math.max(5, Math.ceil(cost / 10)), state.player.cash, cost - state.upgradePaid[id]);
    state.player.cash -= amount; state.upgradePaid[id] += amount;
    if (amount) transfer(id);
    if (state.upgradePaid[id] >= cost) {
      state.upgradePaid[id] = 0; buy(id); state.investment = resetInvestment();
    } else if (state.player.cash <= 0) state.investment = resetInvestment();
  }
}
