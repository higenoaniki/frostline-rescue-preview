import {STAGES,JOURNEYS,completedStages,stageUnlocked,stageFor,suggestedStage,hasStageSave} from './campaign-catalog.js';
import {stageUrl,menuUrl} from './stage-travel.js';
import {buttonIcon,icon} from './icons.js';
import {GameAudio} from './game-audio.js';
import {chapterArt} from './chapter-art.js';

const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./journey-menu.css',import.meta.url);document.head.append(style);
document.documentElement.classList.add('journey-home');
const root=document.createElement('section');root.className='journey-home-root';root.dataset.gameUi='';root.setAttribute('aria-label','Frostline Rescue タイトルとステージ選択');document.querySelector('.shell').append(root);
const image=document.createElement('img');image.className='journey-home-art';image.src=chapterArt('winter');image.alt='雪原から始まるユイとアオの旅';root.append(image);
const title=document.createElement('section');title.className='journey-title';title.innerHTML='<div class="journey-title-name"><p>灯りの先の暮らし</p><h1>FROSTLINE<br>RESCUE</h1></div><div class="journey-title-actions"><button id="journeyContinue" class="journey-start" type="button"></button><button id="journeySelect" type="button">章・ステージを選ぶ</button><span>雪を越えて、海へ。やがて、わたしたちの街へ。</span></div>';root.append(title);
const menu=document.createElement('section');menu.className='journey-stage-menu';menu.hidden=true;menu.innerHTML='<header><button id="journeyBack" type="button"></button><div><small>FROSTLINE RESCUE</small><h1>章・ステージ選択</h1></div><span id="journeyTotal"></span></header><nav class="journey-chapter-tabs" role="tablist" aria-label="章"></nav><section class="journey-chapter-heading"><small id="journeyChapterNumber"></small><h2 id="journeyChapterTitle"></h2><p id="journeyChapterStory"></p></section><div class="journey-stage-list"></div><footer>クリア記録と衣装は残ります。各ステージの荷物と設備は現地に保管されます。</footer>';root.append(menu);
const $=id=>root.querySelector('#'+id),audio=new GameAudio();let selected='winter';
let completed=[];try{completed=completedStages(localStorage);}catch{}
let resume;try{const id=localStorage.getItem('frostline-last-stage-v1');if(id&&!completed.includes(id)&&stageUnlocked(localStorage,id)&&hasStageSave(localStorage,id))resume=stageFor(id);}catch{}
if(!resume){const high=Math.max(-1,...completed.map(id=>stageFor(id).index));resume=STAGES[high+1]??suggestedStage(localStorage);}
$('journeyContinue').append(icon('play',22),document.createTextNode(`${resume.index===0&&!hasStageSave(localStorage,'camp')?'旅を始める':'冒険を続ける'} · ${resume.chapter}-${resume.local}`));$('journeyContinue').onclick=()=>{audio.unlock();location.assign(stageUrl(location.href,resume.id));};
buttonIcon($('journeyBack'),'home','タイトルへ');$('journeyBack').onclick=()=>showTitle();$('journeySelect').onclick=()=>{audio.unlock();showMenu(resume.journey);};
function showTitle(){menu.hidden=true;title.hidden=false;image.src=chapterArt('winter');history.replaceState(null,'',menuUrl(location.href,'title'));}
function showMenu(chapter=selected){selected=chapter;title.hidden=true;menu.hidden=false;history.replaceState(null,'',menuUrl(location.href));render();}
function render(){
  const chapter=JOURNEYS.find(c=>c.id===selected);root.dataset.theme=chapter.id;$('journeyTotal').textContent=`${completed.length}/15 CLEAR`;$('journeyChapterNumber').textContent=`CHAPTER ${String(chapter.number).padStart(2,'0')}`;$('journeyChapterTitle').textContent=chapter.title;$('journeyChapterStory').textContent=chapter.subtitle;
  if(!menu.hidden){image.src=chapterArt(chapter.theme);image.alt=chapter.title+'の風景';menu.querySelector('footer').textContent=chapter.number===1?'各拠点の荷物と設備は個別に保管。クリア記録は残ります。':'同じ街を5ステージかけて拡張。道具・設備・荷物を次へ引き継ぎます。';}
  const list=menu.querySelector('.journey-stage-list');list.replaceChildren();for(const tab of menu.querySelectorAll('[role=tab]'))tab.setAttribute('aria-selected',String(tab.dataset.chapter===selected));
  for(const s of STAGES.filter(s=>s.journey===selected)){
    const b=document.createElement('button');b.className='journey-stage-option';b.type='button';const unlocked=stageUnlocked(localStorage,s.id),done=completed.includes(s.id);b.disabled=!unlocked;
    const n=document.createElement('span');n.className='journey-stage-number';n.textContent=`${s.chapter}-${s.local}`;
    const copy=document.createElement('span'),name=document.createElement('b'),summary=document.createElement('small');name.textContent=s.title;summary.textContent=!unlocked?'前のステージをクリアすると解放':done?'CLEAR · この場所へ戻る':hasStageSave(localStorage,s.id)?'つづきから':s.difficulty;copy.append(name,summary);b.append(n,copy,icon(done?'trophy':s.symbol,23));b.onclick=()=>location.assign(stageUrl(location.href,s.id));list.append(b);
  }
}
for(const c of JOURNEYS){const b=document.createElement('button');b.type='button';b.role='tab';b.dataset.chapter=c.id;b.textContent=`${c.number} ${c.title}`;b.onclick=()=>{selected=c.id;render();};menu.querySelector('.journey-chapter-tabs').append(b);}
if(new URLSearchParams(location.search).get('view')==='menu')showMenu(resume.journey);else render();
window.dispatchEvent(new Event('frostline:ready'));
