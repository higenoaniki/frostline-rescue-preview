import {completeStage} from './campaign-catalog.js';

let boundaryAd=null,pending=null;
// Native ad integration belongs at this single boundary, never in the simulation.
export function registerStageBoundaryAd(handler){boundaryAd=typeof handler==='function'?handler:null;}
export async function runStageBoundary({from,to,reason='travel',storage,save=()=>true,navigate,ad=boundaryAd,timeout=8000}={}){
  if(pending)return pending;
  pending=(async()=>{
    if(await save()===false)throw Error('保存できませんでした。通信と端末の空き容量を確認してください。');
    if(reason==='clear'&&storage&&!completeStage(storage,from))throw Error('クリア記録を保存できませんでした。端末の空き容量を確認してください。');
    if(reason==='clear'&&ad){let timer;try{await Promise.race([Promise.resolve().then(()=>ad({from,to,placement:'stage-complete'})),new Promise(resolve=>{timer=setTimeout(resolve,timeout);})]);}catch{}finally{clearTimeout(timer);}}
    await navigate(to);return true;
  })();
  try{return await pending;}finally{pending=null;}
}
