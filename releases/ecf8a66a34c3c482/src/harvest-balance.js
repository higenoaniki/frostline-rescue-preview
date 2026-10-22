export const lootAmount = drop => Math.max(1, Math.floor(Number.isFinite(drop.amount) ? drop.amount : 1));
export const isRaw = drop => !drop.type || drop.type === 'raw';
export const groundMeat = drops => drops.reduce((n, d) => n + (isRaw(d) ? lootAmount(d) : 0), 0);
export function harvestLoad(state, drops) {
  const ground = groundMeat(drops);
  return { ground, total: ground + (state.player.raw || 0) + (state.processor?.rawStored || 0) + (state.automation?.worker.cargo || 0) };
}
export function spawnBudget(state, drops) {
  const stock = harvestLoad(state, drops), pressure = Math.min(1, Math.max(stock.ground / 48, stock.total / 96));
  return {
    max: Math.max(12, Math.floor(state.rules.maxEnemies * (1 - pressure * .4))),
    near: Math.max(3, Math.floor(state.rules.nearEnemies * (1 - pressure * .65))),
    delay: state.rules.spawnDelay + .65 + pressure * 2.2
  };
}
export function huntingMode(state, drops) {
  const stock = harvestLoad(state, drops);
  const previous = state.hunter.mode || 'hunting';
  if (stock.ground >= 24 || stock.total >= 48) return 'guard';
  if (stock.ground <= 8 && stock.total <= 20) return 'hunting';
  return previous;
}
export const meatYield = enemy => enemy.boss ? 6 : enemy.elite ? 3 : 2;
export function compactGroundMeat(drops, reserved = null) {
  const bins = new Map(), remove = new Set();
  for (const drop of drops) {
    if (!isRaw(drop) || drop.life > 0 || drop === reserved) continue;
    const key = `${Math.floor(drop.x / 96)}:${Math.floor(drop.y / 96)}`;
    const pile = bins.get(key);
    if (pile) { pile.amount = lootAmount(pile) + lootAmount(drop); remove.add(drop); }
    else { drop.amount = lootAmount(drop); bins.set(key, drop); }
  }
  if (remove.size) drops.splice(0, drops.length, ...drops.filter(d => !remove.has(d)));
}
export function takeLoot(drop, maximum) {
  const amount = Math.min(lootAmount(drop), Math.max(0, maximum));
  drop.amount = lootAmount(drop) - amount;
  return amount;
}
