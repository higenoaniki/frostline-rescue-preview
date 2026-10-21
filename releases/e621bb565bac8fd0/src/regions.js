export const REGIONS = [
  { id: 'valley', number: '01', name: '白樺の谷', subtitle: '越冬の補給基地', objectives: 12, sky: 0xb7d3df, sun: 0xffdda9, exposure: 1.0 },
  { id: 'highland', number: '02', name: '星灯りの高地', subtitle: '薄暮の補給作戦', objectives: 12, sky: 0x9eaec1, sun: 0xffc3a0, exposure: 0.92 }
];
export const regionFor = id => REGIONS.find(r => r.id === id) ?? REGIONS[0];
export const regionUnlocked = (id, completed) => id === 'valley' || completed.includes('valley');
export const campaignKey = id => id === 'highland' ? 'frostline-camp-highland-v1' : 'frostline-camp-v1';
export const COMPLETED_KEY = 'frostline-regions-v1';
export function completedRegions(storage) {
  try { const ids = JSON.parse(storage.getItem(COMPLETED_KEY)); return Array.isArray(ids) ? ids.filter(id => REGIONS.some(r => r.id === id)) : []; } catch { return []; }
}
export function markRegionComplete(storage, id) {
  try { const ids = completedRegions(storage); if (!ids.includes(id)) ids.push(id); storage.setItem(COMPLETED_KEY, JSON.stringify(ids)); return true; } catch { return false; }
}
export function regionalEnemy(stats, id) {
  if (id !== 'highland') return stats;
  return { ...stats, hp: Math.ceil(stats.hp * 1.35), hpMax: Math.ceil(stats.hpMax * 1.35), speed: stats.speed * 1.06, damage: stats.damage * 1.15 };
}
