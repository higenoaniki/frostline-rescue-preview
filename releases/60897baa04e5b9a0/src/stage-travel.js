import{buttonIcon,icon}from'./icons.js';
import{STAGES,JOURNEYS,stageFor,completedStages,stageUnlocked}from'./campaign-catalog.js';
export function stageUrl(current,stage){const url=new URL(current);url.searchParams.delete('view');url.searchParams.delete('locked');if(STAGES.some(c=>c.id===stage)&&stage!=='camp'){url.searchParams.set('stage',stage);url.searchParams.delete('play');}else{url.searchParams.delete('stage');url.searchParams.set('play','1');}return url.href;}
export function menuUrl(current,view='menu'){const url=new URL(current);url.searchParams.delete('stage');url.searchParams.delete('play');url.searchParams.set('view',view);return url.href;}
export function bindStageTravel(button,{current='camp',onOpen=()=>{},onClose=()=>{},beforeTravel=()=>{}}={}){
  buttonIcon(button,'navigation','遠征マップ');
  const dialog=document.createElement('dialog');dialog.className='stage-travel';dialog.dataset.gameUi='';dialog.setAttribute('aria-label','遠征マップ');
  dialog.innerHTML='<header><h2>章・ステージを選ぶ</h2><button type="button" class="travel-close" aria-label="閉じる"></button></header><div class="travel-chapters" role="tablist" aria-label="章"></div><p class="travel-story"></p><div class="travel-list"></div>';
  buttonIcon(dialog.querySelector('.travel-close'),'close','閉じる');
  let completed=[];try{completed=completedStages(localStorage);}catch{}
  function render(chapter){
  dialog.querySelector('.travel-story').textContent=JOURNEYS.find(c=>c.id===chapter).subtitle;
  dialog.querySelector('.travel-list').replaceChildren();
  for(const tab of dialog.querySelectorAll('[role=tab]'))tab.setAttribute('aria-selected',String(tab.dataset.chapter===chapter));
  for(const stage of STAGES.filter(s=>s.journey===chapter)){
    const item=document.createElement('button');item.type='button';item.className='travel-stage';item.disabled=current===stage.id||!stageUnlocked(localStorage,stage.id);
    const emblem=document.createElement('span');emblem.className='travel-emblem';emblem.append(icon(stage.symbol,30));item.append(emblem);
    const copy=document.createElement('span'),number=document.createElement('small'),title=document.createElement('b'),subtitle=document.createElement('span');number.textContent=`${stage.chapter}-${stage.local}${completed.includes(stage.id)?' · CLEAR':''}`;title.textContent=stage.title;subtitle.textContent=current===stage.id?'プレイ中':!stageUnlocked(localStorage,stage.id)?'前のステージをクリアして解放':stage.subtitle;copy.append(number,title,subtitle);item.append(copy);dialog.querySelector('.travel-list').append(item);
    item.onclick=()=>{beforeTravel();location.assign(stageUrl(location.href,stage.id));};
  }}
  for(const c of JOURNEYS){const tab=document.createElement('button');tab.type='button';tab.role='tab';tab.dataset.chapter=c.id;tab.textContent=`第${c.number}章`;tab.onclick=()=>render(c.id);dialog.querySelector('.travel-chapters').append(tab);}render(stageFor(current).journey);
  document.body.append(dialog);button.onclick=()=>{onOpen();dialog.showModal();};dialog.querySelector('.travel-close').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
  return dialog;
}
