import { AUDIO_CUES, AUDIO_VOICE_LIMIT, MUSIC_URL, sampleUrl, audioVolume, readAudioSettings } from './audio-catalog.js';
export class GameAudio {
  constructor(environment = {}) {
    try { this.storage = environment.storage ?? globalThis.localStorage; } catch {}
    Object.assign(this, readAudioSettings(this.storage));
    this.environment = environment; this.context = null;
    this.buffers = new Map(); this.loading = new Map(); this.last = new Map();
    this.voices = new Set(); this.variants = new Map();
    this.hidden = false; this.paused = false; this.duckUntil = 0;
    this.footDistance = 0; this.position = null; this.unlocked = false;
  }
  unlock() {
    if (this.muted || this.hidden) return;
    try {
      if (!this.context) {
        const factory = this.environment.contextFactory || (() => new (window.AudioContext || window.webkitAudioContext)());
        const c = this.context = factory();
        this.master = c.createGain(); this.effectsBus = c.createGain(); this.musicBus = c.createGain();
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -8; limiter.knee.value = 12; limiter.ratio.value = 5;
        limiter.attack.value = 0.003; limiter.release.value = 0.2;
        this.master.gain.value = 0.85;
        this.master.connect(limiter); limiter.connect(c.destination);
        this.effectsBus.connect(this.master); this.musicBus.connect(this.master);
        const mediaFactory = this.environment.mediaFactory || (() => new Audio());
        this.musicElement = mediaFactory();
        this.musicElement.loop = true; this.musicElement.preload = 'none'; this.musicElement.src = MUSIC_URL;
        this.musicElement.addEventListener('error', () => {});
        this.musicSource = c.createMediaElementSource(this.musicElement); this.musicSource.connect(this.musicBus);
        this.musicBus.gain.value = 0; this.effectsBus.gain.value = this.effects;
      }
      this.unlocked = true;
      // Start in the gesture itself, before any asynchronous sample download.
      this.context.resume().catch(() => {}); this.syncMusic();
      for (const cue of Object.values(AUDIO_CUES)) for (const file of cue.files) this.load(file);
    } catch { /* Unsupported/blocked audio must not stop the game. */ }
  }
  load(file) {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file));
    if (this.loading.has(file)) return this.loading.get(file);
    if (!this.context) return Promise.resolve(null);
    const fetcher = this.environment.fetcher || globalThis.fetch;
    const loading = Promise.resolve().then(() => fetcher(sampleUrl(file)))
      .then(response => { if (!response.ok) throw new Error('Audio unavailable'); return response.arrayBuffer(); })
      .then(bytes => this.context.decodeAudioData(bytes))
      .then(buffer => { this.buffers.set(file, buffer); return buffer; })
      .catch(() => null).finally(() => this.loading.delete(file));
    this.loading.set(file, loading); return loading;
  }
  syncMusic() {
    const c = this.context;
    if (!c || !this.musicElement) return;
    const stopped = this.muted || this.hidden || this.paused;
    const target = stopped ? 0 : this.music * (c.currentTime < this.duckUntil ? 0.25 : 1);
    this.musicBus.gain.setTargetAtTime(target, c.currentTime, 0.35);
    this.effectsBus.gain.setTargetAtTime(this.muted || this.hidden ? 0 : this.effects, c.currentTime, 0.03);
    if (stopped || this.music === 0) this.musicElement.pause();
    else if (this.unlocked && this.musicElement.paused) this.musicElement.play().catch(() => {});
  }
  setActivity({ paused = false, hidden = false } = {}) {
    const changed = paused !== this.paused || hidden !== this.hidden;
    this.paused = paused; this.hidden = hidden;
    if (changed) {
      this.position = null; this.footDistance = 0;
      if (hidden) { this.stopVoices(); this.musicElement?.pause(); this.context?.suspend().catch(() => {}); }
      else if (this.unlocked && !this.muted && this.context?.state === 'suspended') this.context.resume().catch(() => {});
      if (paused && !hidden) for (const voice of [...this.voices]) {
        if (voice.priority < 3) { try { voice.source.stop(); } catch {} voice.cleanup(); }
      }
      this.syncMusic();
    }
  }
  update(player, inSafe) {
    if (!this.paused && !this.hidden && player?.moving && this.position) {
      const step = Math.hypot(player.x - this.position.x, player.y - this.position.y);
      if (step < 120) this.footDistance += step;
      if (this.footDistance >= 132) { this.play(inSafe ? 'stepStone' : 'stepSnow'); this.footDistance %= 132; }
    } else this.footDistance = 0;
    this.position = player ? { x: player.x, y: player.y } : null;
    if (this.context && this.duckUntil && this.context.currentTime >= this.duckUntil) { this.duckUntil = 0; this.syncMusic(); }
  }
  setVolume(bus, value) {
    if (!['music', 'effects'].includes(bus)) return;
    this[bus] = audioVolume(value, this[bus]); this.save(); this.syncMusic();
  }
  save() {
    try {
      this.storage?.setItem('frostline-sound', this.muted ? 'off' : 'on');
      this.storage?.setItem('frostline-audio-v2', JSON.stringify({ music: this.music, effects: this.effects }));
    } catch {}
  }
  toggle() {
    this.muted = !this.muted; this.save();
    if (this.muted) this.stopVoices(); else this.unlock();
    this.syncMusic(); return this.muted;
  }
  stopVoices() { for (const voice of [...this.voices]) { try { voice.source.stop(); } catch {} voice.cleanup(); } }
  play(name) {
    const c = this.context, cue = AUDIO_CUES[name];
    if (!cue || this.muted || this.hidden || !c || c.state !== 'running' || this.effects === 0) return false;
    if (this.paused && cue.priority < 3) return false;
    const now = c.currentTime;
    if (now - (this.last.get(name) ?? -100) < cue.cooldown) return false;
    const variant = (this.variants.get(name) ?? 0) % cue.files.length;
    const file = cue.files[variant], buffer = this.buffers.get(file);
    if (!buffer) { this.load(file); return false; }
    if (this.voices.size >= AUDIO_VOICE_LIMIT) {
      const disposable = [...this.voices].find(voice => voice.priority < cue.priority);
      if (!disposable) return false;
      disposable.source.stop(); disposable.cleanup();
    }
    this.last.set(name, now); this.variants.set(name, variant + 1);
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; source.playbackRate.value = cue.priority >= 3 ? 1 : 0.97 + (variant % 3) * 0.025;
    gain.gain.value = cue.gain; source.connect(gain); gain.connect(this.effectsBus);
    const voice = { source, priority: cue.priority, cleanup: () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); } };
    source.onended = voice.cleanup; this.voices.add(voice); source.start(now);
    if (cue.priority >= 3) { this.duckUntil = now + buffer.duration + 0.4; this.syncMusic(); }
    return true;
  }
}
