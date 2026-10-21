import { STATIONS, WORLD, SAFE } from './world-config.js';

export const FINAL_SUPPLIES = { goods: 18, fur: 4, ore: 4 };
export const REFUGE_POSITION = { x: WORLD.width + 480, y: SAFE.y - 600 };
export const resetExpedition = () => ({ bossDefeated: false, crest: false, returned: false, arrived: false, supplies: { goods: 0, fur: 0, ore: 0 }, flight: null });
export const suppliesReady = state => Object.entries(FINAL_SUPPLIES).every(([key, amount]) => (state.expedition?.supplies[key] || 0) >= amount);
export function depositSupply(state, key) {
  if (state.stage < 11 || !state.upgrades.beacon || !FINAL_SUPPLIES[key] || state.campaignComplete || state.expedition?.flight) return false;
  state.expedition ??= resetExpedition();
  const stock = key === 'goods' ? state.player : state.materials;
  if (stock[key] <= 0 || state.expedition.supplies[key] >= FINAL_SUPPLIES[key]) return false;
  stock[key]--; state.expedition.supplies[key]++; return true;
}
export function canLaunch(state) {
  return state.stage === 12 && !state.gameOver && !state.campaignComplete && state.upgrades.beacon > 0
    && state.player.hp > 0 && !(state.defense?.hp <= 0)
    && state.expedition?.bossDefeated && state.expedition.crest && state.expedition.returned && suppliesReady(state) && !state.expedition.flight;
}
export function launchExpedition(state) {
  if (!canLaunch(state)) return false;
  state.expedition.flight = { x: STATIONS.beacon.x, y: STATIONS.beacon.modelY, phase: 'loading', timer: 0 };
  return true;
}
export function updateExpedition(state, dt) {
  const flight = state.expedition?.flight;
  if (!flight || state.expedition.arrived || state.gameOver || state.paused || state.player.hp <= 0 || state.defense?.hp <= 0) return;
  if (flight.phase === 'loading') {
    flight.timer += dt;
    if (flight.timer >= 1.2) flight.phase = 'outbound';
    return;
  }
  if (flight.phase === 'landing') {
    flight.timer += dt;
    if (flight.timer >= 1.5) { flight.timer = 1.5; flight.phase = 'arrived'; state.expedition.arrived = true; }
    return;
  }
  const target = REFUGE_POSITION;
  const dx = target.x - flight.x, dy = target.y - flight.y, distance = Math.hypot(dx, dy);
  if (distance <= dt * 680) {
    flight.x = target.x; flight.y = target.y; flight.phase = 'landing'; flight.timer = 0;
  } else { flight.x += dx / distance * 680 * dt; flight.y += dy / distance * 680 * dt; }
}
