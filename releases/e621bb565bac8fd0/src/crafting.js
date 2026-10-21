import { returnHome } from './automation.js';

export const resetMaterials = () => ({ fur: 0, ore: 0 });
export const resetCrafting = () => ({ lining: 0, blade: 0 });
export const RECIPES = {
  lining: { name: '防寒装備', stage: 3, maximum: 3, costs: { fur: 3, cuts: 4, cash: 18 }, effect: '最大HP +20 / 被ダメージ -10%' },
  blade: { name: '貫通刃', stage: 6, maximum: 3, costs: { ore: 3, cuts: 4, cash: 24 }, effect: '攻撃力 +2 / 鉄甲獣の装甲を貫通' },
  repair: { name: '救護・補修', stage: 6, costs: { fur: 1, ore: 1, goods: 2, cash: 20 }, effect: '自分HP +40 / 回収人HP +75 / 柵HP +180' }
};
export const recipeCap = (state, id) => id === 'lining' ? state.stage < 8 ? 1 : state.stage < 11 ? 2 : 3
  : id === 'blade' ? state.stage < 9 ? 1 : state.stage < 12 ? 2 : 3 : 0;
export function recipeCosts(state, id) {
  const recipe = RECIPES[id];
  if (!recipe) return null;
  return { ...recipe.costs, cash: recipe.costs.cash + (state.crafting?.[id] || 0) * (id === 'blade' ? 20 : 12) };
}
export function canCraft(state, id) {
  const recipe = RECIPES[id], costs = recipeCosts(state, id);
  if (!recipe || state.stage < recipe.stage || !state.upgrades.forge || state.gameOver) return false;
  if (recipe.maximum && (state.crafting?.[id] || 0) >= recipeCap(state, id)) return false;
  if (id === 'repair' && state.player.hp >= state.player.hpMax && state.fenceHp >= state.fenceHpMax && state.automation.worker.hp >= state.automation.worker.hpMax) return false;
  return Object.entries(costs).every(([key, count]) => ((key === 'fur' || key === 'ore' ? state.materials?.[key] : state.player[key]) || 0) >= count);
}
export function craft(state, id) {
  if (!canCraft(state, id)) return false;
  state.materials ??= resetMaterials(); state.crafting ??= resetCrafting();
  for (const [key, amount] of Object.entries(recipeCosts(state, id))) {
    if (key === 'fur' || key === 'ore') state.materials[key] -= amount;
    else state.player[key] -= amount;
  }
  if (id === 'lining') {
    state.crafting.lining++;
    state.player.hpMax = 100 + state.crafting.lining * 20;
    state.player.hp = Math.min(state.player.hpMax, state.player.hp + 20);
    state.work.liningCrafts = (state.work.liningCrafts || 0) + 1;
  } else if (id === 'blade') {
    state.crafting.blade++; state.work.bladeCrafts = (state.work.bladeCrafts || 0) + 1;
  } else {
    state.player.hp = Math.min(state.player.hpMax, state.player.hp + 40);
    state.automation.worker.hp = Math.min(state.automation.worker.hpMax, state.automation.worker.hp + 75);
    if (state.automation.worker.phase === 'down') returnHome(state.automation.worker, state);
    state.fenceHp = Math.min(state.fenceHpMax, state.fenceHp + 180);
  }
  return true;
}
export const playerAttack = state => state.player.attack + (state.crafting?.blade || 0) * 2;
export const incomingDamage = (state, amount) => amount * (1 - (state.crafting?.lining || 0) * 0.1);
