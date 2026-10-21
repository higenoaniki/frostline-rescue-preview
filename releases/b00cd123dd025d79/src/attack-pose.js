import { SWING_DURATION, swingProgress } from './melee.js';

export function axePose(time, duration = SWING_DURATION) {
  const t = Math.min(1, Math.max(0, time / duration));
  const progress = swingProgress(t * SWING_DURATION), wind = Math.min(1, t / (.12 / SWING_DURATION));
  const recovery = t > .30 / SWING_DURATION ? Math.max(0, (1 - t) / (1 - .30 / SWING_DURATION)) : 1;
  return {
    armX: -.2 + (-.95 + progress * .65) * wind * recovery,
    armY: (1.8 - progress * 3.6) * wind * recovery,
    armZ: (-.45 + progress * .7) * wind * recovery,
    bodyY: (-.55 + progress * 1.1) * wind * recovery,
    wristX: .22 + Math.sin(progress * Math.PI) * 1.2,
    wristY: -Math.PI / 2
  };
}
