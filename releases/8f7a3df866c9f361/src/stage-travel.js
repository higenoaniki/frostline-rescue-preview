import{buttonIcon,icon}from'./icons.js';
import{CHAPTERS,chapterFor,completedChapters}from'./chapters.js';
export function stageUrl(current,stage){const url=new URL(current);if(CHAPTERS.some(c=>c.id===stage)&&stage!=='camp')url.searchParams.set('stage',stage);else url.searchParams.delete('stage');return url.href;}
export function bindStageTravel(button,{current='camp',onOpen=()=>{},onClose=()=>{},beforeTravel=()=>{}}={}){
  buttonIcon(button,'navigation','遠征マップ');
  const dialog=document.createElement('dialog');dialog.className='stage-travel';dialog.dataset.gameUi='';dialog.setAttribute('aria-label','遠征マップ');
  dialog.innerHTML='<header><h2>北をつなぐ、五つの灯り</h2><button type="button" class="travel-close" aria-label="閉じる"></button></header><p class="travel-story"></p><div class="travel-list"></div>';
  dialog.querySelector('.travel-story').textContent=chapterFor(current).story;
  buttonIcon(dialog.querySelector('.travel-close'),'close','閉じる');
  let completed=[];try{completed=completedChapters(localStorage);}catch{}
  for(const stage of CHAPTERS){
    const item=document.createElement('button');item.type='button';item.className='travel-stage';item.disabled=current===stage.id;
    const emblem=document.createElement('span');emblem.className='travel-emblem';emblem.append(icon(stage.symbol,30));item.append(emblem);
    const copy=document.createElement('span'),number=document.createElement('small'),title=document.createElement('b'),subtitle=document.createElement('span');number.textContent=`${stage.number}${completed.includes(stage.id)?' · CLEAR':''}`;title.textContent=stage.title;subtitle.textContent=current===stage.id?'遠征中':stage.subtitle;copy.append(number,title,subtitle);item.append(copy);dialog.querySelector('.travel-list').append(item);
    item.onclick=()=>{beforeTravel();location.assign(stageUrl(location.href,stage.id));};
  }
  document.body.append(dialog);button.onclick=()=>{onOpen();dialog.showModal();};dialog.querySelector('.travel-close').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
  return dialog;
}
