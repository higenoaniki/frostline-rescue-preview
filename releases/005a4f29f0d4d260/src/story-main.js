import {newStory,tickStory,saveStory,restoreStory,retryStory,storyMissions,storyTarget,storyMaterialCapacity,storyProvisionCapacity,storySupplyRows,storyConvoyStatus,storyCost,STORY_NAMES,STORY_PADS,repairConvoy} from './story-state.js';
import {ChapterNarrative} from './chapter-narrative.js';
import {StoryRenderer} from './story-renderer.js';
import {chapterFor,storySaveKey,completeChapter} from './chapters.js';
import {bindStageTravel,stageUrl} from './stage-travel.js';
import {bindFloatingStick} from './touch-controls.js';
import {GameAudio} from './game-audio.js';
import {buttonIcon,icon} from './icons.js';
import {CampaignHUD} from './campaign-hud.js';
import {stageFor,nextStageId,completeStage,TRANSFER_POLICY} from './campaign-catalog.js';
import {runStageBoundary} from './stage-transition.js';
import {advanceSimulation} from './simulation-clock.js';
import {screenToWorldInput} from './player-movement.js';

const chapter=chapterFor(new URLSearchParams(location.search).get('stage'));
document.documentElement.classList.add('snowfront-mode','story-mode');
for(const file of ['snowfront.css','story.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./'+file,import.meta.url);document.head.append(link);}
const root=document.createElement('section');root.id='snowfrontRoot';root.className='sf-app';root.setAttribute('aria-label',chapter.title);
root.innerHTML=`<header class="sf-hud" data-game-ui><div class="sf-heading"><span class="sf-stage">${chapter.number}</span><div><small>FROSTLINE RESCUE</small><h1>${chapter.title}</h1></div></div><div class="sf-cash"><span id="coin"></span><b id="money">0</b></div></header>
<section class="sf-objective" data-game-ui><div><span id="flag"></span><b id="goal"></b><small id="index"></small></div><p id="detail"></p><progress id="progress"></progress><ol id="beaconSteps" class="beacon-steps" hidden></ol><div id="supplyLedger" class="supply-ledger" hidden></div><small id="receipt" class="supply-receipt" hidden role="status"></small><span class="sf-next" id="hint"></span></section>
<div class="sf-celebrate" id="celebrate" hidden role="status"><span id="trophy"></span><div><small>MISSION COMPLETE</small><b id="celebrateText"></b></div></div>
<section class="sf-context" id="context" hidden data-game-ui><b id="contextTitle"></b><span id="contextDetail"></span><span id="contextStock"></span></section>
<div class="sf-tools" data-game-ui><button id="map" type="button"></button><button id="journal" type="button"></button><button id="settings" type="button"></button><button id="sound" type="button"></button><button id="pause" type="button"></button></div>
<footer class="sf-bag story-bag" data-game-ui><div id="bag"></div><span id="capacity"></span></footer>
<button id="repair" class="story-repair" hidden data-game-ui>橇を修理 · 木4 / 金12</button>
<div class="joystick" id="stick" aria-hidden="true"><span id="thumb"></span></div>
<dialog id="intro" class="sf-dialog story-intro" data-game-ui><img src="${new URL('../assets/title/key-art-story-v1.jpg',import.meta.url)}" alt="雪原の補給隊"><small>第1章 · STAGE ${Number(chapter.number)}/5</small><h2>${chapter.title}</h2><p>${chapter.story}</p><button id="start" type="button">遠征を始める</button></dialog>
<dialog id="outcome" class="sf-dialog" data-game-ui><div id="outcomeIcon"></div><small id="kicker"></small><h2 id="outcomeTitle"></h2><p id="outcomeText"></p><button id="next" type="button"></button><button id="continue" class="sf-secondary" type="button"></button><button id="outcomeMap" class="sf-secondary" type="button">遠征マップ</button></dialog>
<dialog id="options" class="sf-dialog sf-settings" data-game-ui><header><h2>設定</h2><button id="closeOptions" type="button"></button></header><label>画質<select id="quality"><option value="auto">自動</option><option value="detail">標準</option><option value="low">軽量</option></select></label><label>肉の自動回収<input id="pickupFood" type="checkbox"></label><label>BGM<input id="music" type="range" min="0" max="100" step="5"></label><label>効果音<input id="effects" type="range" min="0" max="100" step="5"></label><button id="restart" class="sf-secondary" type="button">この章を最初から</button></dialog>
<dialog id="confirm" class="sf-dialog" data-game-ui><h2>この章をやり直す？</h2><p>この章の施設・所持品だけが最初に戻ります。他の章の進捗は残ります。</p><button id="restartYes" type="button">最初から始める</button><button id="restartNo" class="sf-secondary" type="button">戻る</button></dialog>`;
document.querySelector('.shell').append(root);const $=id=>root.querySelector('#'+id),canvas=document.querySelector('#game');
const renderer=new StoryRenderer(canvas,chapter.id),audio=new GameAudio();await renderer.load();
let state;try{state=restoreStory(localStorage.getItem(storySaveKey(chapter.id)),chapter.id);}catch{}state??=newStory(chapter.id);
let paused=false,last=0,saveTimer=0,bannerUntil=0,outcomeShown=false,hidden=document.hidden;
const input={keys:new Set(),pointerId:null,joyX:0,joyY:0};
const resetTouch=bindFloatingStick(document.querySelector('.shell'),input,$('stick'),$('thumb'),()=>!paused&&!hidden&&state.status==='playing');
const stop=()=>{resetTouch();input.keys.clear();};
function save(){if(location.pathname.startsWith('/review/'))return true;try{localStorage.setItem(storySaveKey(chapter.id),saveStory(state));localStorage.setItem('frostline-last-stage-v1',chapter.id);return true;}catch{return false;}}
let wasPaused=false;bindStageTravel($('map'),{current:chapter.id,onOpen:()=>{wasPaused=paused;paused=true;stop();},onClose:()=>{paused=wasPaused;stop();},beforeTravel:save});
let journalPaused=false;const narrative=new ChapterNarrative({root,button:$('journal'),chapter:chapter.id,getMission:()=>state.mission,onOpen:()=>{journalPaused=paused;paused=true;stop();},onClose:()=>{paused=journalPaused;stop();}});
for(const[id,symbol,label]of [['settings','settings','設定'],['closeOptions','close','閉じる'],['sound','volume','サウンド'],['pause','pause','一時停止']])buttonIcon($(id),symbol,label);
$('coin').append(icon('coins'));$('flag').append(icon('flag',18));$('trophy').append(icon('trophy',28));
$('start').onclick=()=>{$('intro').close();paused=false;stop();audio.unlock();try{localStorage.setItem(storySaveKey(chapter.id)+'-seen','1');}catch{}};
$('intro').addEventListener('cancel',e=>e.preventDefault());
$('pause').onclick=()=>{paused=!paused;stop();buttonIcon($('pause'),paused?'play':'pause',paused?'再開':'一時停止');};
$('sound').onclick=()=>{audio.toggle();buttonIcon($('sound'),audio.muted?'muted':'volume',audio.muted?'音をオンにする':'音をオフにする');};
let settingsPaused=false;$('settings').onclick=()=>{settingsPaused=paused;paused=true;stop();$('pickupFood').checked=state.pickupFood;$('options').showModal();};$('closeOptions').onclick=()=>$('options').close();$('options').addEventListener('close',()=>{paused=settingsPaused;stop();});
let quality='auto';try{quality=localStorage.getItem('frostline-snowfront-quality')||'auto';}catch{}if(new URLSearchParams(location.search).get('quality')==='low')quality='low';renderer.setQuality(quality);$('quality').value=renderer.quality;
$('quality').onchange=()=>{renderer.setQuality($('quality').value);try{localStorage.setItem('frostline-snowfront-quality',$('quality').value);}catch{}};
for(const bus of ['music','effects']){$(bus).value=audio[bus]*100;$(bus).oninput=()=>audio.setVolume(bus,Number($(bus).value)/100);}
$('pickupFood').checked=state.pickupFood;$('pickupFood').onchange=()=>{state.pickupFood=$('pickupFood').checked;save();};
$('restart').onclick=()=>$('confirm').showModal();$('restartNo').onclick=()=>$('confirm').close();$('restartYes').onclick=()=>{state=newStory(chapter.id);renderer.reset();outcomeShown=false;$('confirm').close();$('options').close();paused=false;stop();save();};
$('repair').onclick=()=>repairConvoy(state);
$('next').onclick=async()=>{if(state.status==='lost'){state=retryStory(state);renderer.reset();outcomeShown=false;$('outcome').close();paused=false;save();}else if(nextStageId(chapter.id)){try{await runStageBoundary({from:chapter.id,to:nextStageId(chapter.id),reason:'clear',storage:location.pathname.startsWith('/review/')?null:localStorage,save,navigate:id=>location.assign(stageUrl(location.href,id))});}catch(e){ui.notify(e.message);}}else{$('outcome').close();state.status='playing';outcomeShown=false;paused=false;}};
$('continue').onclick=()=>{$('outcome').close();state.status='playing';outcomeShown=false;paused=false;stop();save();};$('outcomeMap').onclick=()=>$('map').click();$('outcome').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('keydown',e=>{if(e.target.closest('dialog,input,select'))return;if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(e.key.toLowerCase())){e.preventDefault();input.keys.add(e.key.toLowerCase());audio.unlock();}});document.addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
window.addEventListener('resize',()=>renderer.resize());window.addEventListener('blur',stop);window.addEventListener('pagehide',save);window.addEventListener('frostline:fatal',()=>{paused=true;stop();});document.addEventListener('visibilitychange',()=>{hidden=document.hidden;stop();if(hidden)save();});
let ui,bagKey='',ledgerKey='',receiptUntil=0;function hud(){
  const s=state,p=s.player,goals=storyMissions(s),goal=goals[Math.min(s.mission,goals.length-1)];
  $('money').textContent=p.cash;$('goal').textContent=s.completed?'補給路、完成':goal.title;$('index').textContent=s.completed?'CLEAR':`${s.mission+1}/${goals.length}`;$('detail').textContent=s.completed?chapter.subtitle:goal.text;$('progress').max=goal.target;$('progress').value=Math.min(goal.target,goal.value);
  const[label,target]=storyTarget(s);renderer.waypoint=target;$('hint').textContent=paused?'一時停止':`${label} · ${Math.round(Math.hypot(target.x-p.x,target.y-p.y))}m`;
  const key=JSON.stringify(p.bag);if(key!==bagKey){bagKey=key;$('bag').replaceChildren();for(const[type,name,symbol]of [['wood','木材','layers'],['ore','鉱石','snow'],['raw','生肉','beef'],['food','食料','package'],['kit','補強材','package']]){if(s.chapter==='pass'&&['ore','kit'].includes(type))continue;const span=document.createElement('span');span.append(icon(symbol,20),document.createTextNode(`${name} ${p.bag[type]}`));$('bag').append(span);}}
  const provisions=storyProvisionCapacity(p);
  $('capacity').textContent=`資材 ${storyMaterialCapacity(p)}/30\n食料袋 ${provisions}${provisions>8?'\n追加回収停止':'/8'}`;
  if(s.chapter==='beacon'){
    $('beaconSteps').hidden=false;
    const phaseKey=JSON.stringify([s.built.relayA,s.built.relayB,s.built.relayC,s.completed]);
    if($('beaconSteps').dataset.phase!==phaseKey){$('beaconSteps').dataset.phase=phaseKey;$('beaconSteps').replaceChildren();for(const[id,name]of [['relayA','西灯'],['relayB','東灯'],['relayC','主灯'],['arrived','到着']]){const li=document.createElement('li'),done=id==='arrived'?s.completed:s.built[id];li.textContent=`${done?'✓':'○'} ${name}`;li.classList.toggle('done',!!done);$('beaconSteps').append(li);}}
    const id=s.mission===0?'relayA':s.mission===1?'relayB':s.mission===3?'relayC':null,rows=id?storySupplyRows(s,id):[];
    $('supplyLedger').hidden=!rows.length;
    const nextKey=JSON.stringify([id,rows.map(r=>[r.key,r.paid,r.required])]);
    if(nextKey!==ledgerKey){ledgerKey=nextKey;$('supplyLedger').replaceChildren();for(const r of rows){const el=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong'),left=document.createElement('small');name.textContent={wood:'木材',ore:'鉱石',kit:'補強材',core:'氷核',cash:'現金'}[r.key];value.textContent=`${r.paid}/${r.required}`;left.textContent=r.paid>=r.required?'納入済':`あと${r.required-r.paid}`;el.classList.toggle('paid',r.paid>=r.required);el.append(name,value,left);$('supplyLedger').append(el);}}
    if(s.mission===4)$('detail').textContent=`${Math.floor(s.convoy.progress*100)}% · ${storyConvoyStatus(s).text} · 橇HP ${Math.ceil(s.convoy.hp)}/180`;
  }
  $('receipt').hidden=performance.now()>receiptUntil;narrative.update();
  let title='',detail='',stock='';const near=id=>Math.hypot(p.x-STORY_PADS[id].x,p.y-STORY_PADS[id].y)<1.7;
  if(s.investment){const id=s.investment;title=['weapon','armor'].includes(id)||id.startsWith('relay')?STORY_NAMES[id]:'未開拓の投資枠';detail=Object.entries(storyCost(s,id)).map(([k,n])=>`${{wood:'木材',ore:'鉱石',kit:'補強材',core:'氷核',cash:'現金'}[k]} ${s.paid[id]?.[k]||0}/${n}`).join(' · ');const missing=storySupplyRows(s,id).filter(r=>r.paid<r.required);stock=id.startsWith('relay')?missing.map(r=>`${{wood:'木材',ore:'鉱石',kit:'補強材',core:'氷核',cash:'現金'}[r.key]} あと${r.required-r.paid}`).join(' / '):s.blockedPad===id?'完成 · 次の強化は一度離れてから':p.cash===0?'現金不足':'資材を投入中';}
  else if(s.chapter==='beacon'&&['relayA','relayB','relayC'].some(id=>near(id)&&s.built[id])){const id=['relayA','relayB','relayC'].find(id=>near(id)&&s.built[id]);title=STORY_NAMES[id]+' · 点灯済';detail='修復資材はすべて納入済み';stock=s.built.relayC?storyConvoyStatus(s).text:'次の道標への補給路が開通';}
  else if(near('forge')&&s.built.forge){title='補強材工房';detail='木材1 ＋ 鉱石3 → 補強材1';stock=`在庫 木材${s.forgeWood} / 鉱石${s.forgeOre} · 完成${s.kitStock}`;}
  else if(near('trade')){title='補給隊';detail=s.chapter==='pass'?`救助用の食料 ${s.foodDelivered}/6`:s.chapter==='highland'?`灯台用の補強材 ${s.delivered}/8`:'灯台へ届ける補給隊';stock='余剰を換金 · 木材3 / 生肉4 / 鉱石5 / 食料8';}
  else if(near('food')){title='食料回収';detail=`完成 ${s.foodStock}食`;stock=`調理待ち ${s.rawStock}`;}
  else if(near('output')&&s.built.forge){title='補強材回収';detail=`完成 ${s.kitStock}箱`;stock='灯台の修理に使う補強材';}
  $('context').hidden=!title;$('contextTitle').textContent=title;$('contextDetail').textContent=detail;$('contextStock').textContent=stock;
  $('repair').hidden=!(s.chapter==='beacon'&&s.convoy.started&&s.convoy.hp<180&&Math.hypot(p.x-s.convoy.x,p.y-s.convoy.y)<3);
  $('celebrate').hidden=performance.now()>bannerUntil;
  if(['won','lost'].includes(s.status)&&!outcomeShown){
    outcomeShown=true;stop();const won=s.status==='won';
    $('outcomeIcon').replaceChildren(icon(won?'trophy':'shield',48));$('kicker').textContent=won?`STAGE 1-${Number(chapter.number)} COMPLETE`:'遠征を立て直す';
    $('outcomeTitle').textContent=won?(chapter.next?'補給路が、つながった。':'北極灯台、再点灯。'):'仲間のもとへ戻ろう';
    $('outcomeText').textContent=won?chapter.ending+'\n\n'+TRANSFER_POLICY:s.convoy.hp<=0?'補給隊が動けなくなった。達成済みの目標から、装備と修復を保って再開できる。':'直前に達成した目標の状態から再開できる。';
    const nextId=nextStageId(chapter.id);
    $('next').textContent=won?(nextId?`次へ · ${stageFor(nextId).title}`:'補給路を見守る'):'チェックポイントから再開';
    $('continue').hidden=!won||!nextId;$('continue').textContent='この拠点で続ける';$('outcome').showModal();
    if(won&&!location.pathname.startsWith('/review/')){try{completeChapter(localStorage,chapter.id);completeStage(localStorage,chapter.id);}catch{}}
    save();
  }
  const rows=goals.map((g,i)=>({label:g.title,value:i<s.mission?g.target:g.value,target:g.target}));
  const repairId=s.mission===0?'relayA':s.mission===1?'relayB':s.mission===3?'relayC':null;
  if(s.chapter==='beacon'&&repairId)rows.push(...storySupplyRows(s,repairId).map(r=>({label:({wood:'木材',ore:'鉱石',kit:'補強材',core:'氷核',cash:'現金'})[r.key]+'の納入',value:r.paid,target:r.required})));
  const actions=[];if(!$('repair').hidden)actions.push({label:'橇を修理 · 木4 / 金12',icon:'shield',action:()=>$('repair').click(),disabled:p.bag.wood<4||p.cash<12});
  ui?.update({cash:p.cash,title:goal.title,count:s.completed?'CLEAR':`${Math.min(s.mission+1,goals.length)}/${goals.length}`,progress:s.completed?1:(s.mission+Math.min(1,goal.value/goal.target))/goals.length,hint:$('hint').textContent,completed:s.completed,items:Object.entries(p.bag).map(([k,count])=>({label:{wood:'木材',ore:'鉱石',raw:'生肉',food:'食料',kit:'補強材'}[k],count})),capacity:`資材 ${storyMaterialCapacity(p)}/30 · 食料 ${storyProvisionCapacity(p)}`,rows,note:TRANSFER_POLICY,context:title?{title,text:[detail,stock].filter(Boolean).join(' · '),actions}:actions.length?{title:'補給隊',text:`橇HP ${Math.ceil(s.convoy.hp)}/180`,actions}:null});
}
function frame(t){const dt=Math.min(.2,(t-last)/1000||.016);last=t;if(!paused&&!hidden){const k=input.keys,x=input.joyX+Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),y=input.joyY+Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));advanceSimulation((step,input)=>tickStory(state,step,input),dt,screenToWorldInput(x,y));saveTimer+=dt;if(saveTimer>2){save();saveTimer=0;}}
  const deposits=[];for(const e of state.events.splice(0)){renderer.event(e);const cue={pay:'deposit',transfer:'deposit',pickup:'pickup',sell:'sell',hit:'hit',kill:'hit',build:'build',milestone:'milestone',swing:'swing',hurt:'hurt',failure:'failure',victory:'victory',launch:'launch'}[e.type];if(cue)audio.play(cue);if(e.id?.startsWith('relay')&&['pay','transfer'].includes(e.type))deposits.push(`${{wood:'木材',ore:'鉱石',kit:'補強材',core:'氷核',cash:'現金'}[e.type==='pay'?'cash':e.item]} +${e.amount||e.count}`);if(e.type==='milestone'){narrative.announce(state.mission);$('celebrateText').textContent=e.title;ui.notify('目標達成 · '+e.title);bannerUntil=t+2800;save();}}
  if(deposits.length){$('receipt').textContent=deposits.join(' · ')+' 納入';receiptUntil=t+1800;}
  audio.setActivity({paused:paused||state.status!=='playing',hidden});audio.update({...state.player,x:state.player.x*100,y:state.player.y*100},state.player.y>=0);if(!hidden)renderer.render(state,paused?0:dt);hud();requestAnimationFrame(frame);}
ui=new CampaignHUD({stage:chapter.id,isPaused:()=>paused,pause:v=>{paused=v;},stop,save,restart:()=>$('restartYes').click(),travel:()=>$('map').click(),settings:()=>$('settings').click(),journal:()=>$('journal').click()});
renderer.focus.set(state.player.x,0,state.player.y-1);renderer.render(state,0);hud();canvas.dataset.art='story-toon-v1';window.dispatchEvent(new Event('frostline:ready'));
let seen=false;try{seen=localStorage.getItem(storySaveKey(chapter.id)+'-seen')==='1';}catch{}if(!seen&&!location.pathname.startsWith('/review/')){paused=true;$('intro').showModal();}
requestAnimationFrame(frame);
export {state,renderer,tickStory,saveStory,hud};
