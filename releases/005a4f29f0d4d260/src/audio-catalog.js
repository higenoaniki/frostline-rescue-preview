export const AUDIO_DEFAULTS = Object.freeze({ music: 0.55, effects: 0.8 });
export const AUDIO_VOICE_LIMIT = 16;
export const MUSIC_URL = new URL('../assets/audio/winter-drive-v3.wav', import.meta.url).href;
const cue = (files, gain, cooldown, priority = 1) => ({ files, gain, cooldown, priority });
export const AUDIO_CUES = Object.freeze({
  stepSnow: cue(['snow-1', 'snow-2', 'snow-3'], 0.22, 0.24, 0), stepStone: cue(['stone-1', 'stone-2'], 0.18, 0.24, 0),
  swing: cue(['swing'], 0.44, 0.28), hit: cue(['axe-impact-1', 'axe-impact-2'], 0.65, 0.09), hurt: cue(['hurt'], 0.65, 0.28, 2),
  pickup: cue(['pickup'], 0.32, 0.18, 0), sell: cue(['sell'], 0.42, 0.65), deposit: cue(['deposit'], 0.3, 0.3, 0), gate: cue(['gate'], 0.22, 1.6, 0),
  build: cue(['build'], 0.57, 0.35, 2), milestone: cue(['milestone'], 0.65, 2, 3), launch: cue(['launch'], 0.6, 2, 3),
  victory: cue(['victory'], 0.65, 3, 3), failure: cue(['failure'], 0.55, 3, 3)
});
export const sampleUrl = name => new URL(`../assets/audio/${name}.wav`, import.meta.url).href;
export function audioVolume(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
export function readAudioSettings(storage) {
  let muted = false, stored;
  try { muted = storage?.getItem('frostline-sound') === 'off'; stored = JSON.parse(storage?.getItem('frostline-audio-v2') || '{}'); } catch {}
  return { muted, music: audioVolume(stored?.music, AUDIO_DEFAULTS.music), effects: audioVolume(stored?.effects, AUDIO_DEFAULTS.effects) };
}
