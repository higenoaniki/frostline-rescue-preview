import{buttonIcon,icon}from'./icons.js';
export function stageUrl(current,stage){const url=new URL(current);if(stage==='snowfront')url.searchParams.set('stage','snowfront');else url.searchParams.delete('stage');return url.href;}
export function bindStageTravel(button,{current='camp',onOpen=()=>{},onClose=()=>{},beforeTravel=()=>{}}={}){
  buttonIcon(button,'navigation','遠征マップ');
  const dialog=document.createElement('dialog');dialog.className='stage-travel';dialog.dataset.gameUi='';dialog.setAttribute('aria-label','遠征マップ');
  dialog.innerHTML='<header><h2>遠征マップ</h2><button type="button" class="travel-close" aria-label="閉じる"></button></header><div class="travel-list"></div>';
  buttonIcon(dialog.querySelector('.travel-close'),'close','閉じる');
  for(const stage of [{id:'camp',number:'01–02',title:'越冬の補給基地',subtitle:'進行中の遠征へ戻る',symbol:'home'},{id:'snowfront',number:'03',title:'雪原交易路',subtitle:'雪原狩猟・交易・区画開拓',symbol:'snow'}]){
    const item=document.createElement('button');item.type='button';item.className='travel-stage';item.disabled=current===stage.id;
    const emblem=document.createElement('span');emblem.className='travel-emblem';emblem.append(icon(stage.symbol,30));item.append(emblem);
    const copy=document.createElement('span'),number=document.createElement('small'),title=document.createElement('b'),subtitle=document.createElement('span');number.textContent=stage.number;title.textContent=stage.title;subtitle.textContent=current===stage.id?'遠征中':stage.subtitle;copy.append(number,title,subtitle);item.append(copy);dialog.querySelector('.travel-list').append(item);
    item.onclick=()=>{beforeTravel();location.assign(stageUrl(location.href,stage.id));};
  }
  document.body.append(dialog);button.onclick=()=>{onOpen();dialog.showModal();};dialog.querySelector('.travel-close').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
  return dialog;
}
