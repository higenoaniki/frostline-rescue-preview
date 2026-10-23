import {chapterFor,storySaveKey} from './chapters.js';
export function chapterPrelude(id,{onOpen=()=>{},onClose=()=>{}}={}){
  if(location.pathname.startsWith('/review/')||new URLSearchParams(location.search).has('qa-boot'))return;
  const key=storySaveKey(id)+'-seen';try{if(localStorage.getItem(key)==='1')return;}catch{}
  const chapter=chapterFor(id),dialog=document.createElement('dialog');dialog.className='chapter-prelude';dialog.dataset.gameUi='';dialog.setAttribute('aria-label',chapter.title);
  const image=document.createElement('img');image.src=new URL('../assets/title/key-art-story-v1.jpg',import.meta.url);image.alt='雪原の補給隊';
  const number=document.createElement('small');number.textContent=`CHAPTER ${chapter.number}`;
  const title=document.createElement('h2');title.textContent=chapter.title;
  const text=document.createElement('p');text.textContent=chapter.story;
  const button=document.createElement('button');button.type='button';button.textContent='遠征を続ける';
  dialog.append(image,number,title,text,button);document.body.append(dialog);
  const close=()=>{dialog.close();try{localStorage.setItem(key,'1');}catch{}onClose();dialog.remove();};button.onclick=close;dialog.addEventListener('cancel',e=>e.preventDefault());onOpen();dialog.showModal();
}
