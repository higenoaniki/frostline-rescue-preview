const melodies = { pickup: [780], hit: [125], build: [392, 494, 587], milestone: [523, 659, 784], launch: [330, 440, 660], victory: [523, 659, 784, 1047, 784, 1047], failure: [294, 247, 196] };
export class GameAudio {
  constructor() {
    this.context = null; this.last = new Map();
    try { this.muted = localStorage.getItem('frostline-sound') === 'off'; } catch { this.muted = false; }
  }
  unlock() {
    if (this.muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try { this.context ??= new Audio(); this.context.resume().catch(() => {}); } catch {}
  }
  toggle() { this.muted = !this.muted; try { localStorage.setItem('frostline-sound', this.muted ? 'off' : 'on'); } catch {} if (!this.muted) this.unlock(); return this.muted; }
  play(name) {
    const c = this.context; if (this.muted || !c || c.state !== 'running' || !melodies[name]) return;
    const now = c.currentTime; if (now - (this.last.get(name) ?? -10) < (name === 'pickup' ? 0.25 : 0.1)) return;
    this.last.set(name, now);
    melodies[name].forEach((frequency, i) => {
      const oscillator = c.createOscillator(), gain = c.createGain(), start = now + i * 0.12;
      oscillator.type = name === 'hit' ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain); gain.connect(c.destination); oscillator.start(start); oscillator.stop(start + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
