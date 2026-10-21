const percentile = (values, fraction) => values.length ? [...values].sort((a,b) => a-b)[Math.floor((values.length-1)*fraction)] : 0;

export class FrameBudget {
  constructor(maxRatio = 1.5) { this.maxRatio = maxRatio; this.ratio = maxRatio; this.mode = 'auto'; this.window = []; this.windowMs = 0; this.cooldown = 0; this.fastSeconds = 0; this.degraded = false; }
  setMode(mode) {
    if (!['auto','detail','low'].includes(mode)) throw new Error('Unknown display mode');
    this.mode = mode; this.ratio = mode === 'low' ? Math.min(1,this.maxRatio) : this.maxRatio;
    this.degraded = false; this.window = []; this.windowMs = 0; this.cooldown = 0; this.fastSeconds = 0;
  }
  observe(frameMs) {
    if (this.mode !== 'auto' || frameMs <= 0 || frameMs > 250) return false;
    this.window.push(frameMs); this.windowMs += frameMs; this.cooldown = Math.max(0,this.cooldown-frameMs/1000);
    const elapsed = this.windowMs/1000;
    if (elapsed < 2 || this.window.length < 24) return false;
    const p90 = percentile(this.window,.9); this.window = []; this.windowMs = 0;
    const previous = this.ratio;
    if (p90 > 23 && this.cooldown <= 0) {
      this.ratio = Math.max(Math.min(.75,this.maxRatio),Math.round((this.ratio-.25)*100)/100);
      this.degraded = this.ratio < this.maxRatio; this.cooldown = 5; this.fastSeconds = 0;
    } else if (p90 < 18) {
      this.fastSeconds += elapsed;
      if (this.fastSeconds >= 15 && this.cooldown <= 0) { this.ratio = Math.min(this.maxRatio,this.ratio+.25); this.degraded = this.ratio < this.maxRatio; this.fastSeconds = 0; this.cooldown = 5; }
    } else this.fastSeconds = 0;
    return previous !== this.ratio;
  }
}

export class FrameMeasurement {
  constructor() { this.samples=[];this.totalMs=0;this.active=false;this.revision='keyart-v17'; }
  start(device='unspecified') { this.samples=[];this.totalMs=0;this.device=device;this.active=true;this.startedAt=new Date().toISOString(); }
  record(frameMs, info) {
    if (!this.active || !Number.isFinite(frameMs) || frameMs <= 0) return;
    this.samples.push(frameMs);this.totalMs+=frameMs;this.info={...info};
    if (this.totalMs>=60000)this.active=false;
  }
  stop() { this.active=false;return this.report(); }
  report() {
    const total=this.totalMs, count=this.samples.length;
    return {revision:this.revision,device:this.device??'unspecified',deviceSource:'user-selected',startedAt:this.startedAt??null,activeSeconds:Math.round(total/100)/10,frames:count,averageFps:total?Math.round(count/total*10000)/10:0,p95FrameMs:Math.round(percentile(this.samples,.95)*10)/10,over33ms:this.samples.filter(n=>n>33.34).length,render:this.info??null};
  }
}
