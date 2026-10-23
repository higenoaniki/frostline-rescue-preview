// Decode once and let the audio renderer loop the PCM, without JS timers or media seeks.
export class MusicLoop {
  constructor(context,output,url,fetcher=globalThis.fetch){
    Object.assign(this,{context,output,url,fetcher});this.buffer=null;this.loading=null;this.source=null;this.offset=0;this.wanted=false;this.error=null;
  }
  load(){
    if(this.buffer)return Promise.resolve(this.buffer);
    if(this.loading)return this.loading;
    const fetcher=this.fetcher;
    this.loading=Promise.resolve().then(()=>fetcher(this.url)).then(r=>{if(!r.ok)throw Error('Music unavailable');return r.arrayBuffer();})
      .then(bytes=>this.context.decodeAudioData(bytes)).then(buffer=>{if(!(buffer.duration>0))throw Error('Empty music buffer');this.buffer=buffer;this.error=null;if(this.wanted)this.start();return buffer;})
      .catch(e=>{this.error=e;return null;}).finally(()=>{this.loading=null;});return this.loading;
  }
  get position(){return this.buffer?(this.offset+(this.source?Math.max(0,this.context.currentTime-this.startedAt):0))%this.buffer.duration:0;}
  get playing(){return !!this.source;}
  setPlaying(wanted){this.wanted=!!wanted;if(!wanted){this.pause();return;}if(this.buffer)this.start();else this.load();}
  start(){
    if(this.source||!this.wanted||!this.buffer||this.context.state!=='running')return;
    const c=this.context,source=c.createBufferSource(),gate=c.createGain(),now=c.currentTime;
    source.buffer=this.buffer;source.loop=true;source.loopStart=0;source.loopEnd=this.buffer.duration;
    gate.gain.setValueAtTime(0,now);gate.gain.linearRampToValueAtTime(1,now+.008);
    source.connect(gate);gate.connect(this.output);this.source=source;this.gate=gate;this.startedAt=now;
    source.onended=()=>{source.disconnect();gate.disconnect();if(this.source===source)this.source=null;};
    source.start(now,this.offset);
  }
  pause(){
    const source=this.source;if(!source)return;this.offset=this.position;this.source=null;
    const now=this.context.currentTime,gain=this.gate.gain;gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(0,now+.008);source.stop(now+.010);
  }
}
