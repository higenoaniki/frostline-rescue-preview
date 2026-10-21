import { stagePlan, goalValue, facilityAvailable } from './progression.js';
import { canCraft } from './crafting.js';
import { STATIONS, SAFE } from './world-config.js';
import { HUNTING_FOCUS } from './ecology.js';
import { BOSS_POSITION } from './combat.js';
import { FINAL_SUPPLIES } from './expedition.js';
import { HEATER } from './defense.js';

export function missionTarget(state) {
  const player = state.player;
  if (state.fenceHp <= 0 || state.defense?.hp < 240) return HEATER;
  if (!state.campaignComplete && state.stage >= 10 && (!state.expedition?.bossDefeated || !state.expedition?.crest)) return BOSS_POSITION;
  if (state.stage === 10 && state.expedition?.crest) return { x: 1000, y: SAFE.y + 260 };
  if (!state.campaignComplete && state.stage >= 11 && state.upgrades.beacon) {
    if (state.stage === 12 || Object.keys(FINAL_SUPPLIES).some(k => (state.expedition?.supplies[k] || 0) < FINAL_SUPPLIES[k] && (k === 'goods' ? player : state.materials)?.[k] > 0)) return STATIONS.beacon;
    if ((state.expedition?.supplies.goods || 0) < FINAL_SUPPLIES.goods && state.canner.goodsStored > 0) return STATIONS.cannerOut;
  }
  const pending = stagePlan(state.stage).goals.filter(goal => goalValue(state, goal) < goal.target);
  if (pending.some(goal => ['liningCrafts', 'bladeCrafts'].includes(goal.metric)) && !state.upgrades.forge && player.cash > 0 && facilityAvailable(state, 'forge')) return STATIONS.forge;
  if (pending.some(goal => goal.metric === 'liningCrafts') && canCraft(state, 'lining')) return STATIONS.forge;
  if (pending.some(goal => goal.metric === 'bladeCrafts') && canCraft(state, 'blade')) return STATIONS.forge;
  if (player.goods > 0) return STATIONS.market;
  if (player.raw > 0) return STATIONS.processorIn;
  const build = pending.find(goal => goal.metric === 'level' && facilityAvailable(state, goal.id));
  if (build && player.cash > 0) return STATIONS[build.id];
  if (player.cuts > 0) return STATIONS.cannerIn;
  if (state.canner.goodsStored > 0 && !state.upgrades.delivery) return STATIONS.cannerOut;
  if (state.processor.cutsStored > 0 && !state.upgrades.conveyor) return STATIONS.processorOut;
  if (pending.some(goal => ['furCollected', 'oreCollected', 'kills', 'eliteKills', 'armedKills'].includes(goal.metric))) return HUNTING_FOCUS;
  return { x: 1000, y: SAFE.y + 20 };
}
