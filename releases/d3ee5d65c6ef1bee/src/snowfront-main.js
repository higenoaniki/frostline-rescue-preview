import{newSnowfront,tickSnowfront,saveSnowfront,restoreSnowfront,retrySnowfront,SNOWFRONT_KEY,MISSIONS,PADS,BUILD_COST,investmentCost}from'./snowfront-state.js';
import{SnowfrontRenderer}from'./snowfront-renderer.js';
import{bindFloatingStick}from'./touch-controls.js';
import{bindStageTravel,stageUrl}from'./stage-travel.js';
import{chapterFor,completeChapter}from'./chapters.js';
import{chapterPrelude}from'./chapter-prelude.js';
import{GameAudio}from'./game-audio.js';
import{buttonIcon,icon}from'./icons.js';
import{facilityContext}from'./snowfront-ui.js';

const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./snowfront.css',import.meta.url).href;document.head.append(style);
document.documentElement.classList.add('snowfront-mode');
const root=document.createElement('section');root.id='snowfrontRoot';root.className='sf-app';root.setAttribute('aria-label','雪原交易路');root.innerHTML=`
 <header class="sf-hud" data-game-ui><div class="sf-heading"><span class="sf-stage">03</span><div><small>FROSTLINE RESCUE</small><h1>雪原交易路</h1></div></div><div class="sf-cash"><span id="sfCoinIcon"></span><b id="sfCash">0</b></div></header>
 <section class="sf-objective" data-game-ui><div><span id="sfMissionIcon"></span><b id="sfMissionTitle"></b><small id="sfMissionIndex"></small></div><p id="sfMissionText"></p><progress id="sfProgress" max="1" value="0"></progress><span class="sf-next" id="sfNext"></span></section>
 <div class="sf-celebrate" id="sfCelebrate" hidden role="status"><span id="sfTrophy"></span><div><small>MISSION COMPLETE</small><b id="sfCelebrateText"></b></div></div>
 <div class="sf-investment" id="sfInvestment" hidden data-game-ui><span id="sfInvestmentIcon"></span><div><b id="sfInvestmentName"></b><span id="sfInvestmentValue"></span></div><progress id="sfInvestmentProgress" max="1" value="0"></progress></div>
 <section class="sf-context" id="sfContext" hidden data-game-ui><b id="sfContextTitle"></b><span id="sfContextDetail"></span><span id="sfContextStock"></span></section>
 <div class="sf-tools" data-game-ui><button id="sfTravelButton" type="button"></button><button id="sfSettingsButton" type="button"></button><button id="sfSound" type="button"></button><button id="sfPause" type="button"></button></div>
 <footer class="sf-bag" data-game-ui><div id="sfBagItems"></div><span id="sfCapacity"></span></footer>
 <div class="joystick" id="sfJoystick" aria-hidden="true"><span id="sfStick"></span></div>
 <dialog id="sfOutcome" class="sf-dialog" data-game-ui><div id="sfOutcomeIcon"></div><small id="sfOutcomeKicker"></small><h2 id="sfOutcomeTitle"></h2><p id="sfOutcomeText"></p><button id="sfOutcomeAction" type="button"></button><button id="sfOutcomeContinue" class="sf-secondary" type="button" hidden>交易を続ける</button><button id="sfOutcomeMap" class="sf-secondary" type="button">遠征マップ</button></dialog>
 <dialog id="sfSettings" class="sf-dialog sf-settings" data-game-ui><header><h2>設定</h2><button id="sfSettingsClose" type="button" aria-label="閉じる"></button></header><label>画質<select id="sfQuality"><option value="auto">自動</option><option value="detail">標準</option><option value="low">軽量</option></select></label><label>BGM<input id="sfMusic" type="range" min="0" max="100" step="5"></label><label>効果音<input id="sfEffects" type="range" min="0" max="100" step="5"></label><button id="sfRestart" class="sf-secondary" type="button">この遠征を最初から</button><p class="sf-save-note">他の遠征の進捗は変更されません。</p></dialog>
 <dialog id="sfRestartConfirm" class="sf-dialog" data-game-ui><h2>雪原交易路をやり直す？</h2><p>この遠征の施設・所持品・開拓状況を最初に戻します。</p><button id="sfRestartYes" type="button">最初から始める</button><button id="sfRestartNo" class="sf-secondary" type="button">戻る</button></dialog>`;
document.querySelector('.shell').append(root);
const $=id=>root.querySelector('#'+id),canvas=document.querySelector('#game');
const audio=new GameAudio(),renderer=new SnowfrontRenderer(canvas);
await renderer.load();
let state;try{state=restoreSnowfront(localStorage.getItem(SNOWFRONT_KEY));}catch{}state??=newSnowfront();
const input={keys:new Set(),pointerId:null,joyX:0,joyY:0};let paused=false,hidden=document.hidden,last=0,saveTimer=0,bannerUntil=0,outcomeShown=false,quality='auto';
const resetTouch=bindFloatingStick(document.querySelector('.shell'),input,$('sfJoystick'),$('sfStick'),()=>!paused&&!hidden&&state.status==='playing');
const save=()=>{if(location.pathname.startsWith('/review/'))return;try{localStorage.setItem(SNOWFRONT_KEY,saveSnowfront(state));}catch{}};
function stop(){resetTouch();input.keys.clear();}
let travelWasPaused=false;const travel=bindStageTravel($('sfTravelButton'),{current:'snowfront',onOpen:()=>{travelWasPaused=paused;paused=true;stop();},onClose:()=>{paused=travelWasPaused;stop();},beforeTravel:save});
for(const [id,name,label]of [['sfSettingsButton','settings','設定'],['sfSettingsClose','close','閉じる'],['sfPause','pause','一時停止'],['sfSound',audio.muted?'muted':'volume','サウンド']])buttonIcon($(id),name,label);
$('sfCoinIcon').append(icon('coins',20));$('sfMissionIcon').append(icon('flag',18));$('sfTrophy').append(icon('trophy',30));$('sfInvestmentIcon').append(icon('coins',22));
$('sfSound').onclick=()=>{audio.toggle();buttonIcon($('sfSound'),audio.muted?'muted':'volume',audio.muted?'音をオンにする':'音をオフにする');};
$('sfPause').onclick=()=>{paused=!paused;stop();buttonIcon($('sfPause'),paused?'play':'pause',paused?'再開':'一時停止');};
let settingsWasPaused=false;$('sfSettingsButton').onclick=()=>{settingsWasPaused=paused;paused=true;stop();$('sfSettings').showModal();};
$('sfSettingsClose').onclick=()=>$('sfSettings').close();$('sfSettings').addEventListener('close',()=>{paused=settingsWasPaused;stop();});
for(const [id,bus]of [['sfMusic','music'],['sfEffects','effects']]){$(id).value=Math.round(audio[bus]*100);$(id).oninput=()=>audio.setVolume(bus,Number($(id).value)/100);}
try{quality=localStorage.getItem('frostline-snowfront-quality')||'auto';}catch{}
if(!['auto','detail','low'].includes(quality))quality='auto';
if(new URLSearchParams(location.search).get('quality')==='low')quality='low';
$('sfQuality').value=quality;renderer.setQuality(quality);$('sfQuality').onchange=()=>{quality=$('sfQuality').value;renderer.setQuality(quality);try{localStorage.setItem('frostline-snowfront-quality',quality);}catch{}};
$('sfRestart').onclick=()=>$('sfRestartConfirm').showModal();$('sfRestartNo').onclick=()=>$('sfRestartConfirm').close();
$('sfRestartYes').onclick=()=>{state=newSnowfront();renderer.reset();outcomeShown=false;save();$('sfRestartConfirm').close();$('sfSettings').close();paused=false;stop();};
$('sfOutcomeAction').onclick=()=>{
  if(state.status==='won'){save();location.assign(stageUrl(location.href,'highland'));return;}
  if(state.status==='lost'){state=retrySnowfront(state);renderer.reset();}else paused=false;
  outcomeShown=false;$('sfOutcome').close();paused=false;stop();save();
};
$('sfOutcomeContinue').onclick=()=>{state.status='playing';state.freeplay=true;outcomeShown=false;$('sfOutcome').close();paused=false;stop();save();};
$('sfOutcomeMap').onclick=()=>$('sfTravelButton').click();
$('sfOutcome').addEventListener('cancel',event=>event.preventDefault());
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,dialog'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();input.keys.add(e.key.toLowerCase());audio.unlock();}});
document.addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));
document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
window.addEventListener('resize',()=>renderer.resize());window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;stop();if(hidden)save();audio.setActivity({paused,hidden});});window.addEventListener('pagehide',save);

function businessTarget(){
  const p=state.player,b=p.bag;
  if(b.crate>0&&state.delivered<8)return['荷箱の納品',PADS.sale];
  if(b.raw>0)return['調理台へ',PADS.raw];
  if(b.roast>0)return['交易所へ',PADS.sale];
  if(state.roastStock>0)return['焼き肉を回収',PADS.roast];
  if(state.cashStock>0)return['売上を回収',PADS.cash];
  if(state.rawStock>0)return['調理台の焼き上がりへ',PADS.roast];
  const enemy=state.enemies.filter(e=>state.mission===3&&state.wolfKills<6?e.kind==='wolf':true).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  return enemy?['狩場へ',enemy]:['狩場へ',{x:0,y:-5}];
}
function target(){
  const s=state,p=s.player;
  if(p.bag.crate>0&&s.delivered<8)return['荷箱の納品',PADS.sale];
  if(s.crateStock>0&&s.mission>=4)return['荷箱を回収',PADS.smoked];
  if(s.mission>=4&&s.built.smoker&&s.crafted<8){
    if(p.bag.fur>0&&s.smokeFur<8||p.bag.roast>=3&&s.smokeRaw<24)return['燻製工房へ',PADS.smoker];
    if(s.smokeFur<1&&!p.bag.fur){const e=s.enemies.find(e=>e.kind==='wolf');if(e)return['灰牙獣から毛皮を回収',e];}
  }
  const id=s.mission===1?(s.weapon<2?'weapon':!s.built.east?'east':null):s.mission===2&&!s.built.collector?'collector':s.mission===3?(s.weapon<3?'weapon':!s.built.smoker?'smoker':null):s.mission===4?(!s.built.west?'west':!s.built.hunter?'hunter':null):null;
  if(id&&p.cash>=investmentCost(s,id)-(s.paid[id]||0))return[id==='weapon'?'斧を強化':'未開拓の投資枠へ',PADS[id]];
  return businessTarget();
}
let lastHud='';function hud(){
  const s=state,goal=MISSIONS[Math.min(s.mission,MISSIONS.length-1)],p=s.player;
  $('sfCash').textContent=p.cash;$('sfMissionTitle').textContent=s.completed?'交易路 開通':s.finale?'隊商が出発しました':goal.title;
  $('sfMissionIndex').textContent=s.completed?'CLEAR':`${Math.min(s.mission+1,6)} / 6`;
  const details=[`焼き肉の販売 ${Math.min(s.sold,6)} / 6`,`斧 Lv.${s.weapon}/2 · 東区画 ${s.built.east?'開拓済':'未開拓'}`,`回収人 ${s.built.collector?'雇用済':'未雇用'} · 獲物 ${Math.min(s.gathered,40)}/40`,`斧 Lv.${s.weapon}/3 · 工房 ${s.built.smoker?'完成':'未完成'} · 灰牙獣 ${Math.min(s.wolfKills,6)}/6`,`西区画 ${s.built.west?'✓':'—'} · 狩り台 ${s.built.hunter?'✓':'—'} · 荷箱 ${Math.min(s.crafted,4)}/4`,`荷箱の納品 ${Math.min(s.delivered,8)} / 8`];
  $('sfMissionText').textContent=s.completed?'交易所は引き続き営業できます。':s.finale?'燻製の荷箱を積んだ隊商が、次の集落へ。':details[Math.min(s.mission,5)];
  $('sfProgress').max=goal.target;$('sfProgress').value=Math.min(goal.target,goal.value(s));
  const [label,point]=target(),distance=Math.round(Math.hypot(point.x-p.x,point.y-p.y));renderer.waypoint=point;$('sfNext').textContent=s.finale?'出発を見届ける':paused?'一時停止':`${label} · ${distance}m`;
  const bagKey=JSON.stringify(p.bag);if(lastHud!==bagKey){lastHud=bagKey;$('sfBagItems').replaceChildren();for(const [type,title,symbol]of [['raw','生肉','beef'],['roast','焼肉','layers'],['fur','毛皮','snow'],['crate','荷箱','package']]){const span=document.createElement('span');span.append(icon(symbol,19),document.createTextNode(`${title} ${p.bag[type]}`));$('sfBagItems').append(span);}}
  $('sfCapacity').textContent=`${Object.values(p.bag).reduce((a,b)=>a+b,0)} / 30`;
  const id=s.investment;$('sfInvestment').hidden=!id;
  if(id){const cost=investmentCost(s,id),paid=s.paid[id]||0;$('sfInvestmentName').textContent=id==='weapon'?`斧 Lv.${s.weapon+1}`:'未開拓の投資枠';$('sfInvestmentValue').textContent=`${paid} / ${cost}${p.cash===0?' · 現金不足':''}`;$('sfInvestmentProgress').max=cost;$('sfInvestmentProgress').value=paid;}
  const context=facilityContext(s);$('sfContext').hidden=!!id||!context;
  if(context){$('sfContextTitle').textContent=context.title;$('sfContextDetail').textContent=context.detail;$('sfContextStock').textContent=context.stock;}
  $('sfCelebrate').hidden=performance.now()>bannerUntil;
  if((s.status==='won'||s.status==='lost')&&!outcomeShown){
    outcomeShown=true;stop();const won=s.status==='won';$('sfOutcomeIcon').replaceChildren(icon(won?'trophy':'shield',52));$('sfOutcomeKicker').textContent=won?'CHAPTER 03 COMPLETE':'EXPEDITION PAUSED';$('sfOutcomeTitle').textContent=won?'交易路、開通。':'拠点で立て直そう';$('sfOutcomeText').textContent=won?chapterFor('snowfront').ending:'直前に達成した開拓目標の状態から再開できます。';$('sfOutcomeAction').textContent=won?'次へ · 星灯りの高地':'目標のチェックポイントから再開';$('sfOutcomeContinue').hidden=!won;$('sfOutcome').showModal();
    if(won&&!location.pathname.startsWith('/review/')){try{completeChapter(localStorage,'snowfront');}catch{}}
    save();
  }
}
function frame(t){
  const dt=Math.min(.05,(t-last)/1000||.016);last=t;
  if(!paused&&!hidden){
    const keys=input.keys,x=input.joyX+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y=input.joyY+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    tickSnowfront(state,dt,{x:x*.81+y*.586,y:-x*.586+y*.81});saveTimer+=dt;if(saveTimer>2){saveTimer=0;save();}
  }
  for(const e of state.events.splice(0)){
    renderer.event(e);const cue={pay:'deposit',transfer:'deposit',pickup:'pickup',sell:'sell',hit:'hit',kill:'hit',build:'build',milestone:'milestone',swing:'swing',hurt:'hurt',failure:'failure',victory:'victory',launch:'launch'}[e.type];if(cue)audio.play(cue);
    if(e.type==='milestone'){$('sfCelebrateText').textContent=e.title;bannerUntil=t+2900;save();}
  }
  audio.setActivity({paused:paused||state.status!=='playing',hidden});audio.update({...state.player,x:state.player.x*100,y:state.player.y*100},isSafeForAudio());
  if(!hidden)renderer.render(state,paused?0:dt);hud();requestAnimationFrame(frame);
}
function isSafeForAudio(){return state.player.y>=0;}
renderer.render(state,0);hud();canvas.dataset.art='snowfront-v1';window.dispatchEvent(new Event('frostline:ready'));requestAnimationFrame(frame);
chapterPrelude('snowfront',{onOpen:()=>{paused=true;stop();},onClose:()=>{paused=false;stop();}});
export{state,renderer,tickSnowfront,saveSnowfront};
