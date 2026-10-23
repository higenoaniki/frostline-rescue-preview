import { STORAGE_LIMIT, requiredWorkLevel } from './progression.js';

export const resetProcessor = () => ({ rawStored: 0, cutsStored: 0, timer: 0, speed: 1.25 });
export const resetCanner = () => ({ cutsStored: 0, goodsStored: 0, timer: 0 });
export const resetConveyor = () => ({ timer: 0, items: [], sequence: 0 });

export function updateProduction(state, dt) {
  const p = state.processor, c = state.canner, belt = state.conveyor;
  const speed = 2.5 + (state.upgrades.processor - 1) * 1.1;
  if (p.rawStored > 0 && p.cutsStored < STORAGE_LIMIT) {
    p.timer += dt * speed;
    while (p.timer >= 1.8 && p.rawStored > 0 && p.cutsStored < STORAGE_LIMIT) {
      p.timer -= 1.8; p.rawStored--; p.cutsStored++;
    }
  } else p.timer = 0;
  if (state.upgrades.conveyor > 0) {
    for (const item of belt.items) item.progress = Math.min(1, item.progress + dt / 2.2);
    for (let i = belt.items.length - 1; i >= 0; i--) {
      if (belt.items[i].progress < 1 || c.cutsStored >= STORAGE_LIMIT) continue;
      c.cutsStored++; belt.items.splice(i, 1);
      if (state.upgrades.conveyor >= requiredWorkLevel(state.stage, 'conveyor')) state.work.autoCuts++;
    }
    if (p.cutsStored > 0 && c.cutsStored + belt.items.length < STORAGE_LIMIT) {
      belt.timer += dt * state.upgrades.conveyor;
      while (belt.timer >= 0.8 && p.cutsStored > 0 && c.cutsStored + belt.items.length < STORAGE_LIMIT) {
        belt.timer -= 0.8; p.cutsStored--;
        belt.items.push({ id: ++belt.sequence, progress: 0 });
      }
    } else belt.timer = 0;
  }
  if (c.cutsStored > 0 && c.goodsStored < STORAGE_LIMIT) {
    c.timer += dt * speed;
    while (c.timer >= 1.6 && c.cutsStored > 0 && c.goodsStored < STORAGE_LIMIT) {
      c.timer -= 1.6; c.cutsStored--; c.goodsStored++; state.work.produced++;
      if (state.upgrades.processor >= Math.max(2, requiredWorkLevel(state.stage, 'machine'))) state.work.upgradedProduced++;
    }
  } else c.timer = 0;
}
