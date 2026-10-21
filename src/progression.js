export const PLAYER_SPEED = 430;
export const SALE_PRICE = 4;
export const STORAGE_LIMIT = 72;
export const WEAPON_DAMAGE = [0, 2, 3, 6];
export const ARMOR_REDUCTION = [0, 0, 0.24, 0.42, 0.55];
export const CAMPAIGN_LENGTH = 12;

export const UPGRADE_SPECS = {
  weapon: { levelKey: 'weapon', label: '武器', base: 22, step: 22, max: 3 },
  armor: { levelKey: 'armor', label: '防具', base: 26, step: 24, max: 4 },
  conveyor: { levelKey: 'conveyor', label: 'コンベア', base: 84, step: 56, max: 2 },
  hunter: { levelKey: 'hunter', label: '自動狩り', base: 126, step: 84, max: 3 },
  pickup: { levelKey: 'pickup', label: '回収人', base: 98, step: 70, max: 3 },
  delivery: { levelKey: 'delivery', label: '自動配送', base: 98, step: 70, max: 3 },
  fleet: { levelKey: 'fleet', label: '出荷ドローン', base: 36, step: 48, max: 4 },
  machine: { levelKey: 'processor', label: '生産速度', base: 40, step: 32, max: 3 },
  forge: { levelKey: 'forge', label: '素材工房', base: 64, step: 0, max: 1 },
  beacon: { levelKey: 'beacon', label: '補給通信台', base: 180, step: 0, max: 1 }
};
export const resetUpgrades = () => ({ weapon: 1, armor: 1, processor: 1, conveyor: 0, hunter: 0, pickup: 0, delivery: 0, fleet: 1, forge: 0, beacon: 0 });
export const resetPaid = () => Object.fromEntries(Object.keys(UPGRADE_SPECS).map(id => [id, 0]));
export const resetBuilt = () => Object.fromEntries(Object.keys(UPGRADE_SPECS).map(id => [id, false]));
export const upgradeLevel = (state, id) => state.upgrades[UPGRADE_SPECS[id].levelKey];
export const upgradeCost = (state, id) => UPGRADE_SPECS[id].base + upgradeLevel(state, id) * UPGRADE_SPECS[id].step;
export const upgradeCap = (stage, id) => {
  if (id === 'weapon') return stage < 5 ? 2 : 3;
  if (id === 'armor') return stage < 8 ? 2 : stage < 11 ? 3 : 4;
  if (id === 'conveyor') return stage < 9 ? 1 : 2;
  if (['hunter', 'pickup', 'delivery'].includes(id)) return stage < 9 ? 1 : stage < 12 ? 2 : 3;
  if (id === 'fleet') return stage < 8 ? 2 : stage < 9 ? 3 : 4;
  if (id === 'machine') return stage < 9 ? 2 : 3;
  return UPGRADE_SPECS[id].max;
};
const work = (metric, label, target) => ({ metric, label, target });
const level = (id, target) => ({ metric: 'level', id, label: UPGRADE_SPECS[id].label, target });
const persistent = (id, label, target = 1) => ({ metric: 'state', id, label, target });
const supply = (id, label, target) => ({ metric: 'project', id, label, target });
const finalSupplies = [supply('goods', '補給台に保存食を確保', 18), supply('fur', '補給台に毛皮を確保', 4), supply('ore', '補給台に鉱石を確保', 4)];
const baseFacilities = ['processorIn', 'processorOut', 'cannerIn', 'cannerOut', 'market'];
const stages = [
  { title: '最初の生産と出荷', facilities: [], goals: [work('manualCuts', '加工肉を保存食施設へ搬入', 18), work('produced', '保存食を作る', 18), work('shipped', '保存食を出荷場へ届ける', 18), work('dispatches', 'ドローンで発送する', 3)] },
  { title: '斧で狩りを効率化', facilities: ['weapon'], goals: [level('weapon', 2), work('armedKills', '強化した斧で討伐', 6), work('produced', '保存食を作る', 24), work('shipped', '保存食を出荷場へ届ける', 24)] },
  { title: '毛皮と加工肉で防寒装備', facilities: ['weapon', 'armor', 'forge'], goals: [level('armor', 2), level('forge', 1), work('furCollected', '上位敵から毛皮を集める', 3), work('liningCrafts', '工房で防寒装備を製作', 1), work('shipped', '保存食を出荷する', 20)] },
  { title: '搬送を効率化', facilities: ['weapon', 'armor', 'forge', 'conveyor'], goals: [level('conveyor', 1), work('rawDelivered', '肉を加工施設へ搬入', 16), work('produced', '保存食を作る', 20), work('shipped', '保存食を出荷する', 20)] },
  { title: '狩場の戦力を増やす', facilities: ['weapon', 'armor', 'forge', 'conveyor', 'hunter'], goals: [level('weapon', 3), level('hunter', 1), work('autoKills', '自動狩りの初討伐', 1), work('kills', '自分と自動狩りで討伐', 8), work('shipped', '保存食を出荷する', 24)] },
  { title: '鉄甲獣と貫通刃', facilities: ['weapon', 'armor', 'forge', 'conveyor', 'hunter', 'pickup'], goals: [level('pickup', 1), work('oreCollected', '鉄甲獣から鉱石を集める', 3), work('bladeCrafts', '工房で貫通刃を製作', 1), work('rawDelivered', '肉を加工施設へ搬入', 20), work('shipped', '保存食を出荷する', 24)] },
  { title: '出荷の手間を減らす', facilities: ['weapon', 'armor', 'forge', 'conveyor', 'hunter', 'pickup', 'delivery', 'fleet'], goals: [level('fleet', 2), level('delivery', 1), work('kills', '探索して敵を討伐', 10), work('shipped', '保存食を出荷する', 30)] },
  { title: '生産と防衛を強化', facilities: ['weapon', 'armor', 'forge', 'conveyor', 'hunter', 'pickup', 'delivery', 'fleet', 'machine'], goals: [level('armor', 3), level('machine', 2), work('eliteKills', '上位敵を討伐', 4), work('produced', '保存食を作る', 32), work('shipped', '保存食を出荷する', 32)] },
  { title: '避難所への補給路', facilities: Object.keys(UPGRADE_SPECS), goals: [level('beacon', 1), work('eliteKills', '補給路の上位敵を討伐', 3), work('shipped', '保存食を出荷する', 18)] },
  { title: '北の氷原の主', facilities: Object.keys(UPGRADE_SPECS), goals: [persistent('bossDefeated', '氷冠獣を討伐'), persistent('crest', '氷核を回収'), persistent('returned', '氷核を持って拠点へ帰還')] },
  { title: '越冬物資を確保', facilities: Object.keys(UPGRADE_SPECS), goals: finalSupplies },
  { title: '最後の補給便', facilities: Object.keys(UPGRADE_SPECS), goals: [persistent('bossDefeated', '氷冠獣を討伐'), persistent('crest', '氷核を回収'), persistent('returned', '氷核を持って拠点へ帰還'), ...finalSupplies, persistent('arrived', '最終補給便を届ける')] }
];
export function stagePlan(stage) {
  const plan = stages[Math.max(0, Math.min(CAMPAIGN_LENGTH - 1, stage - 1))];
  return { ...plan, facilities: [...baseFacilities, ...plan.facilities] };
}
export const facilityVisible = (stage, id) => stagePlan(stage).facilities.includes(id);
export const facilityBuilt = (state, id) => baseFacilities.includes(id) || state.built?.[id] === true;
export const plotName = id => `区画 ${String(Object.keys(UPGRADE_SPECS).indexOf(id) + 1).padStart(2, '0')}`;
export const facilityName = (state, id) => facilityBuilt(state, id) ? UPGRADE_SPECS[id]?.label : plotName(id);
export const facilityAvailable = (state, id) => facilityBuilt(state, id) || facilityVisible(state.stage, id) && (id !== 'hunter' || state.upgrades.weapon >= 3) && (id !== 'pickup' || state.upgrades.hunter > 0);
export const requiredWorkLevel = (stage, id) => stagePlan(stage).goals.find(g => g.metric === 'level' && g.id === id)?.target ?? 1;
export function goalValue(state, goal) {
  if (goal.metric === 'project') return state.expedition?.supplies[goal.id] || 0;
  if (goal.metric === 'state') return Number(state.expedition?.[goal.id] || 0);
  return goal.metric === 'level' ? upgradeLevel(state, goal.id) : Math.max(0, (state.work[goal.metric] ?? 0) - (state.progressBaseline?.[goal.metric] ?? 0));
}
export const goalsComplete = state => !state.campaignComplete && stagePlan(state.stage).goals.every(g => goalValue(state, g) >= g.target);
export function objectiveRows(state) {
  const related = { armedKills: 'weapon', armoredKills: 'armor', autoKills: 'hunter', liningCrafts: 'forge', bladeCrafts: 'forge' };
  const rows = [];
  for (const goal of stagePlan(state.stage).goals) {
    const id = goal.metric === 'level' ? goal.id : goal.metric === 'project' || goal.id === 'arrived' ? 'beacon' : related[goal.metric];
    if (id && !facilityBuilt(state, id)) {
      const label = `${plotName(id)} に投資して建設`;
      if (!rows.some(row => row.label === label)) rows.push({ label, value: 0, target: 1, done: false, id });
      continue;
    }
    const value = Math.min(goalValue(state, goal), goal.target);
    rows.push({ label: goal.metric === 'level' ? `${goal.label}を Lv${goal.target} にする` : goal.label, value, target: goal.target, done: value >= goal.target, id });
  }
  return rows;
}
export function objectiveTitle(state) {
  if (state.campaignComplete) return '越冬補給 完了';
  const hidden = objectiveRows(state).find(row => row.id && !facilityBuilt(state, row.id));
  return hidden ? `${plotName(hidden.id)} を開拓する` : stagePlan(state.stage).title;
}
export function goalText(state) {
  const rows = objectiveRows(state);
  return `達成 ${rows.filter(row => row.done).length}/${rows.length} · ` + rows.map(row => `${row.done ? '完了 ' : ''}${row.label} ${row.value}/${row.target}`).join(' · ');
}
export const resetWork = () => Object.fromEntries(['produced', 'shipped', 'armedKills', 'armoredKills', 'eliteKills', 'manualCuts', 'autoCuts', 'autoKills', 'autoRaw', 'autoSales', 'upgradedProduced', 'dispatches', 'kills', 'rawDelivered', 'furCollected', 'oreCollected', 'liningCrafts', 'bladeCrafts'].map(key => [key, 0]));
