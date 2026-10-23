// Probe one detail step at a time. A failed frame-time probe lowers the session
// ceiling, so a busy scene cannot repeatedly trigger an expensive upgrade.
export function geometryTierLimit({mobile=false,memory}={}){
  const known=Number.isFinite(memory)&&memory>0;
  return known?(memory<=4?1:2):(mobile?1:2);
}

export class GeometryBudget {
  constructor(maxTier=2){this.maxTier=maxTier;this.ceiling=maxTier;this.tier=0;this.pending=false;this.warmup=3000;this.samples=[];this.elapsed=0;this.fastMs=0;}
  resetWindow(){this.samples=[];this.elapsed=0;this.fastMs=0;}
  settle(tier){this.tier=tier;this.pending=false;this.warmup=2500;this.resetWindow();}
  fail(){this.ceiling=this.tier;this.pending=false;this.resetWindow();}
  observe(frameMs,{allowIncrease=true,low=false}={}){
    if(low){this.resetWindow();if(this.tier>0){this.pending=true;return 0;}return null;}
    if(!Number.isFinite(frameMs)||frameMs<=0||this.pending&&this.tier===0)return null;
    this.warmup=Math.max(0,this.warmup-frameMs);if(this.warmup>0)return null;
    this.samples.push(Math.min(frameMs,1000));this.elapsed+=frameMs;
    if(this.elapsed<2000||this.samples.length<24)return null;
    const sorted=this.samples.sort((a,b)=>a-b),p95=sorted[Math.floor((sorted.length-1)*.95)],elapsed=this.elapsed;
    this.samples=[];this.elapsed=0;
    if(p95>22&&this.tier>0){this.ceiling=this.tier-1;this.pending=true;this.fastMs=0;return this.tier-1;}
    if(this.pending)return null;
    this.fastMs=allowIncrease&&p95<18.7?this.fastMs+elapsed:0;
    if(this.fastMs>=8000&&this.tier<this.ceiling){this.pending=true;this.fastMs=0;return this.tier+1;}
    return null;
  }
}
