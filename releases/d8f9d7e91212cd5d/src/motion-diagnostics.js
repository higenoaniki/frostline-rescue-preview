export class MotionDiagnostics {
  constructor(limit = 240) {
    this.limit = limit; this.samples = []; this.previous = null; this.cameraOnlyFrames = 0;
  }
  record(frame) {
    const previous = this.previous; this.previous = { ...frame };
    if (!previous) return;
    if (previous.runId !== frame.runId) { this.samples = []; this.cameraOnlyFrames = 0; return; }
    const distance = Math.hypot(frame.x - previous.x, frame.y - previous.y);
    const cameraDistance = Math.hypot(frame.cameraX - previous.cameraX, frame.cameraZ - previous.cameraZ);
    if (distance <= .02) { if (cameraDistance > .02) this.cameraOnlyFrames++; return; }
    if (!Number.isFinite(distance) || distance > 120) return;
    this.samples.push({ distance, dt: frame.dt, inputMoving: frame.inputMoving, mode: frame.mode,
      clockDelta: frame.clock - previous.clock, hip: frame.hip, knee: frame.knee,
      matrixAutoUpdate: frame.matrixAutoUpdate });
    if (this.samples.length > this.limit) this.samples.shift();
  }
  report() {
    const samples = this.samples;
    const range = key => {
      const values = samples.map(frame => frame[key]).filter(Number.isFinite);
      return values.length ? Math.max(...values) - Math.min(...values) : null;
    };
    const distance = samples.reduce((sum, frame) => sum + frame.distance, 0), hipRange = range('hip'), kneeRange = range('knee');
    const nonfiniteJointSamples = samples.filter(frame => !Number.isFinite(frame.hip) || !Number.isFinite(frame.knee)).length;
    return { samples: samples.length, distance, hipRange, kneeRange,
      observation: nonfiniteJointSamples ? 'invalid-joint-data' : samples.length < 12 || distance < 60 ? 'insufficient-movement-samples'
        : hipRange < .02 && kneeRange < .02 ? 'leg-pose-not-changing' : 'leg-pose-changing',
      movedWithFalseInputFlag: samples.filter(frame => !frame.inputMoving).length,
      movedWithIdleAnimation: samples.filter(frame => frame.mode === 'idle').length,
      movedWithoutAnimationClock: samples.filter(frame => !(frame.clockDelta > 0)).length,
      nonfiniteJointSamples,
      cameraOnlyFrames: this.cameraOnlyFrames, latest: samples.at(-1) ?? null };
  }
}
