import { goalsComplete, stagePlan, CAMPAIGN_LENGTH } from './progression.js';
import { enemyRules } from './world-config.js';

export function advanceObjective(state) {
  if (state.gameOver || state.player.hp <= 0 || state.defense?.hp <= 0 || !goalsComplete(state)) return null;
  const completed = state.stage, title = stagePlan(completed).title, reward = 0;
  if (state.stage >= CAMPAIGN_LENGTH) {
    state.campaignComplete = true;
    return { completed, title: '越冬補給 完了', reward, final: true };
  }
  state.stage++;
  state.progressBaseline = { ...state.work };
  const wasRaiding = state.rules?.fenceRaid;
  state.rules = enemyRules(state.stage);
  if (!wasRaiding && state.rules.fenceRaid) state.phaseStartedAt = state.elapsed;
  const previousMax = state.fenceHpMax;
  state.fenceHpMax = Math.max(previousMax, state.rules.fenceHp);
  state.fenceHp = Math.min(state.fenceHpMax, state.fenceHp + state.fenceHpMax - previousMax);
  state.player.cash += reward;
  state.stageCash += reward;
  return { completed, title, reward };
}
