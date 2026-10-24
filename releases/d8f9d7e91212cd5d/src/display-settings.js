import { buttonIcon } from './icons.js';

export function readDisplayMode(storage,search=globalThis.location?.search||''){
  if(new URLSearchParams(search).get('quality')==='low')return 'low';
  try{storage??=globalThis.localStorage;const value=storage?.getItem('frostline-display-v1')||storage?.getItem('frostline-snowfront-quality');if(['auto','detail','low'].includes(value))return value;}catch{}
  return 'auto';
}
export function saveDisplayMode(mode,storage){
  if(!['auto','detail','low'].includes(mode))return;
  try{storage??=globalThis.localStorage;storage?.setItem('frostline-display-v1',mode);storage?.setItem('frostline-snowfront-quality',mode);}catch{}
}

export class DisplaySettings {
  constructor(renderer, { onOpen, onClose }) {
    this.renderer=renderer;this.panel=document.querySelector('#displaySettings');this.onClose=onClose;
    const button=document.querySelector('#settingsButton'), close=document.querySelector('#settingsClose');
    buttonIcon(button,'settings','画質・サウンド・端末計測');buttonIcon(close,'close','閉じる');
    button.onclick=()=>{onOpen();this.panel.hidden=false;this.refresh();close.focus();};
    window.addEventListener('resize',()=>requestAnimationFrame(()=>{if(!this.panel.hidden)this.refresh();}));
    close.onclick=()=>this.close();
    this.panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();this.close();}
      if(event.key==='Tab'){
        const nodes=[...this.panel.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(e=>!e.disabled&&e.getClientRects().length),first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    for(const radio of this.panel.querySelectorAll('[name="displayMode"]'))radio.onchange=()=>{renderer.setDisplayMode(radio.value);this.refresh();};
    document.querySelector('#measureStart').onclick=()=>{renderer.measurement.start(document.querySelector('#deviceModel').value);this.close(true);};
    document.querySelector('#measureStop').onclick=()=>{renderer.measurement.stop();this.refresh();};
    const copyReport=async report=>{
      const output=document.querySelector('#measurementJson');output.value=JSON.stringify(report,null,2);output.hidden=false;
      try{await navigator.clipboard.writeText(output.value);document.querySelector('#measureStatus').textContent='コピー済み';}catch{output.focus();output.select();document.querySelector('#measureStatus').textContent='計測結果';}
    };
    document.querySelector('#measureCopy').onclick=()=>copyReport(renderer.measurement.report());
    document.querySelector('#motionCopy').onclick=()=>copyReport({...renderer.motionReport(),device:document.querySelector('#deviceModel').value,deviceSource:'user-selected'});
  }
  close(resume=false){this.panel.hidden=true;this.onClose(resume);document.querySelector('#settingsButton').focus();}
  refresh(){
    const report=this.renderer.measurement.report(),info=report.render??this.renderer.renderInfo();
    this.panel.querySelector(`[value="${this.renderer.budget.mode}"]`).checked=true;
    document.querySelector('#measureStatus').textContent=this.renderer.measurement.active?'計測中':report.frames?'計測終了':'未計測';
    document.querySelector('#measureFps').textContent=report.frames?`${report.averageFps} FPS`:'--';
    document.querySelector('#measureP95').textContent=report.frames?`${report.p95FrameMs} ms`:'--';
    document.querySelector('#measureDuration').textContent=`${report.activeSeconds} 秒 / ${report.frames} フレーム`;
    document.querySelector('#measureDraws').textContent=`${info.calls} / ${info.triangles.toLocaleString()}`;
    document.querySelector('#measureResolution').textContent=`${info.width} × ${info.height} / DPR ${info.ratio}`;
    document.querySelector('#measureStop').disabled=!this.renderer.measurement.active;
    document.querySelector('#measureCopy').disabled=!report.frames;
  }
}
