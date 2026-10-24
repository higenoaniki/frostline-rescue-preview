import {newLife,tickLife,saveLife,restoreLife,loadLifeStage,startLifeInvestment,lifeGoals,lifeTarget,lifeCargo,lifeOutputPad} from './life-state.js';
import {LIFE_STAGES,LIFE_PADS,LIFE_DEPOT,LIFE_ITEMS,RECIPES,FACILITY_NAMES,ITEM_PRICE,plotLetter} from './life-config.js';
import {LifeRenderer} from './life-renderer.js';
import {CampaignHUD} from './campaign-hud.js';
import {stageFor,journeyFor,stageSaveKey,completeStage,TRANSFER_POLICY} from './campaign-catalog.js';
import {bindStageTravel,stageUrl,menuUrl} from './stage-travel.js';
import {runStageBoundary} from './stage-transition.js';
import {bindFloatingStick} from './touch-controls.js';
import {GameAudio} from './game-audio.js';
import {buttonIcon} from './icons.js';
import {advanceSimulation} from './simulation-clock.js';
import {screenToWorldInput} from './player-movement.js';
import {lifeAudio} from './life-audio.js';
import {investmentCommand} from './investment-command.js';
import {readDisplayMode,saveDisplayMode} from './display-settings.js';
import {insidePad} from './interaction-pad.js';

const stage=stageFor(new URLSearchParams(location.search).get('stage')),config=LIFE_STAGES[stage.id],chapter=journeyFor(stage.journey),canvas=document.querySelector('#game'),shell=document.querySelector('.shell');
document.documentElement.classList.add('life-mode');
const renderer=new LifeRenderer(canvas,stage.id),audio=new GameAudio(lifeAudio(config.theme));await renderer.load();
let state;try{state=loadLifeStage(localStorage,stage.id);}catch{}state??=newLife(stage.id);
let paused=false,hidden=document.hidden,last=0,saveTimer=0,outcomeShown=false;
const input={keys:new Set(),pointerId:null,joyX:0,joyY:0},stick=document.createElement('div');stick.className='joystick';stick.setAttribute('aria-hidden','true');const thumb=document.createElement('span');stick.append(thumb);shell.append(stick);
const resetTouch=bindFloatingStick(shell,input,stick,thumb,()=>!paused&&!hidden&&state.status==='playing');const stop=()=>{resetTouch();input.keys.clear();state.investmentActive=null;};
function save(){if(location.pathname.startsWith('/review/'))return true;try{localStorage.setItem(stageSaveKey(stage.id),saveLife(state));localStorage.setItem('frostline-last-stage-v1',stage.id);return true;}catch{return false;}}
const makeDialog=(title)=>{const d=document.createElement('dialog');d.className='journey-dialog';d.dataset.gameUi='';d.setAttribute('aria-label',title);d.innerHTML='<header><h2></h2><button type="button"></button></header><div class="journey-dialog-body"></div>';d.querySelector('h2').textContent=title;buttonIcon(d.querySelector('button'),'close','閉じる');d.querySelector('button').onclick=()=>d.close();document.body.append(d);return d;};
const options=makeDialog('設定');options.querySelector('.journey-dialog-body').innerHTML='<label class="life-setting">画質<select id="lifeQuality"><option value="auto">自動</option><option value="detail">標準</option><option value="low">軽量</option></select></label><label class="life-setting">BGM<input id="lifeMusic" type="range" min="0" max="100" step="5"></label><label class="life-setting">効果音<input id="lifeEffects" type="range" min="0" max="100" step="5"></label>';
const journal=makeDialog('物語と通信記録'),sales=makeDialog('市場に届ける品物');let sheetPaused=false;
function openSheet(d){sheetPaused=paused;paused=true;stop();d.showModal();}
for(const d of [options,journal,sales])d.addEventListener('close',()=>{paused=sheetPaused;stop();});
const travelButton=document.createElement('button');travelButton.hidden=true;shell.append(travelButton);let travelPaused=false;
bindStageTravel(travelButton,{current:stage.id,onOpen:()=>{travelPaused=paused;paused=true;stop();},onClose:()=>{paused=travelPaused;stop();},beforeTravel:save});
function openJournal(){const body=journal.querySelector('.journey-dialog-body');body.replaceChildren();const h=document.createElement('h3');h.textContent=`第${stage.chapter}章 · ${stage.title}`;const p=document.createElement('p');p.textContent=stage.story;body.append(h,p);for(const g of lifeGoals(state).slice(0,state.mission)){const row=document.createElement('p');row.textContent='✓ '+g.title;body.append(row);}if(state.completed){const end=document.createElement('p');end.textContent=stage.ending;body.append(end);}openSheet(journal);}
function openSales(){const body=sales.querySelector('.journey-dialog-body');body.replaceChildren();for(const[type,price]of Object.entries(ITEM_PRICE)){if(!config.resources.includes(type)&&!Object.keys(state.machines).some(id=>RECIPES[type]?.facility===id))continue;const b=document.createElement('button');b.type='button';b.className='journey-command';b.textContent=`${state.saleType===type?'✓ ':''}${LIFE_ITEMS[type]} · ${price} / 個 · 所持 ${state.player.bag[type]}`;b.onclick=()=>{state.saleType=type;state.autoSale=false;sales.close();};body.append(b);}const note=document.createElement('p');note.className='journey-policy';note.textContent='ここで選んだ品物だけを市場へ納入します。次の加工に使う素材は、そのまま持っておけます。';body.append(note);openSheet(sales);}
function restart(){try{state=loadLifeStage(localStorage,stage.id,{restart:true});}catch{state=newLife(stage.id);}renderer.reset();outcomeShown=false;outcome.close();paused=false;stop();save();}
const ui=new CampaignHUD({stage:stage.id,root:shell,isPaused:()=>paused,pause:v=>{paused=v;},stop,save,restart,travel:()=>travelButton.click(),settings:()=>openSheet(options),journal:openJournal});
const quality=options.querySelector('#lifeQuality');renderer.setQuality(readDisplayMode());quality.value=renderer.quality;quality.onchange=()=>{renderer.setQuality(quality.value);quality.value=renderer.quality;saveDisplayMode(quality.value);};
for(const[id,bus]of [['lifeMusic','music'],['lifeEffects','effects']]){const input=options.querySelector('#'+id);input.value=audio[bus]*100;input.oninput=()=>audio.setVolume(bus,Number(input.value)/100);}
const outcome=makeDialog('ステージクリア');outcome.querySelector('header>button').hidden=true;outcome.addEventListener('cancel',e=>e.preventDefault());
const outro=outcome.querySelector('.journey-dialog-body'),ending=document.createElement('p'),policy=document.createElement('p'),next=document.createElement('button'),stay=document.createElement('button');policy.className='journey-policy';policy.textContent=TRANSFER_POLICY;next.type=stay.type='button';next.className='journey-primary';stay.className='journey-secondary';stay.textContent='この場所で続ける';outro.append(ending,policy,next,stay);
next.onclick=async()=>{next.disabled=true;try{await runStageBoundary({from:stage.id,to:stage.next,reason:'clear',storage:location.pathname.startsWith('/review/')?null:localStorage,save,navigate:id=>location.assign(id?stageUrl(location.href,id):menuUrl(location.href))});}catch(e){ui.notify(e.message);next.disabled=false;}};
stay.onclick=()=>{outcome.close();state.status='playing';paused=false;stop();save();};
const intro=makeDialog(stage.title);intro.querySelector('.journey-dialog-body').innerHTML='<small class="journey-kicker"></small><p></p><button type="button" class="journey-primary">この場所で始める</button>';intro.querySelector('small').textContent=`第${stage.chapter}章 · STAGE ${stage.local}/5 · ${chapter.outfit}`;intro.querySelector('p').textContent=stage.story;intro.querySelector('.journey-primary').onclick=()=>intro.close();intro.addEventListener('close',()=>{paused=false;stop();try{localStorage.setItem(stageSaveKey(stage.id)+'-seen','1');}catch{}});
let seen=false;try{seen=[3,2,1].some(v=>localStorage.getItem(`frostline-life-${stage.id}-v${v}-seen`)==='1');}catch{}
if(!seen&&!location.pathname.startsWith('/review/')){paused=true;intro.showModal();}
function context(){
  const p=state.player,near=(target,r=1.7)=>Math.hypot(p.x-target.x,p.y-target.y)<r;
  if(insidePad(p,LIFE_PADS.market,'market'))return{title:`市場 · ${LIFE_ITEMS[state.saleType]}を納入`,text:`単価 ${ITEM_PRICE[state.saleType]} · 所持 ${p.bag[state.saleType]} · 他の素材は売りません`,actions:[{label:'納入品を選ぶ',icon:'package',action:openSales}]};
  if(state.investment){const id=state.investment,cost=config.plots[id];return{title:`区画${plotLetter(config,id)}`,text:`現金 ${state.paid[id]||0} / ${cost} · ${state.investmentActive?'投入中':p.cash?'投資待機':'現金不足'}`,actions:[investmentCommand({active:state.investmentActive===id,available:!paused&&!p.moving&&p.cash>0&&state.blockedPad!==id,start:()=>startLifeInvestment(state,id),stop:()=>{state.investmentActive=null;}})]};}
  if(state.built.line&&near(LIFE_PADS.line,3))return{title:`搬送ライン · ${state.conveyor.length?'搬送中':'待機'}`,text:`搬送中 ${state.conveyor.length}皿 · 到着 ${state.automation.delivered}皿 · 稼働後の缶詰 ${state.automation.produced}個 / 出荷 ${state.automation.shipped}個`};
  for(const[id,m]of Object.entries(state.machines))if(state.built[id]){
    const r=RECIPES[m.recipe];if(insidePad(p,LIFE_PADS[id]))return{title:FACILITY_NAMES[id],text:Object.entries(r.input).map(([k,n])=>`${LIFE_ITEMS[k]} 在庫${m.input[k]||0}（${n}/回）`).join(' ＋ ')+` → ${LIFE_ITEMS[r.output]} · 完成${m.stock}`};
    if(insidePad(p,lifeOutputPad(id),'output'))return{title:LIFE_ITEMS[r.output]+'の回収',text:`完成 ${m.stock}${lifeCargo(state)>=36?' · 荷物がいっぱい':''}`};
  }
  if(state.work){const n=state.nodes.find(n=>n.id===state.work.node);return{title:state.work.type==='fishing'?'釣り上げ中':LIFE_ITEMS[n.type],text:state.work.type==='full'?'荷物がいっぱい · 加工か市場へ':state.work.type==='water'?'井戸で水をくみ、畑へ届ける':state.work.type==='growing'?`成長 ${Math.round(n.growth*100)}% · 別の畑も手入れできる`:state.work.type==='fishing'?`竿 Lv.${state.tool} · 釣果 ${state.caught}`:`収穫中 · ${n.stock}個`};}
  if(near(LIFE_DEPOT,2))return{title:'共同倉庫 · 仲間の収穫',text:Object.entries(state.store).filter(([,n])=>n>0).map(([k,n])=>`${LIFE_ITEMS[k]} ${n}`).join(' · ')||'仲間が運搬中',actions:[{label:state.automationEnabled?'仲間の作業を一時停止':'仲間の作業を再開',icon:state.automationEnabled?'pause':'play',action:()=>{state.automationEnabled=!state.automationEnabled;}}]};
  if(config.theme==='farm'&&near(LIFE_PADS.water,2))return{title:'川の井戸',text:`水 ${p.bag.water}/8${state.built.harvester?' · 仲間の収穫もここで回収':''}`};
  return null;
}
function hud(){
  const goals=lifeGoals(state),goal=goals[Math.min(state.mission,goals.length-1)],[label,target]=lifeTarget(state);renderer.waypoint=target;
  ui.update({cash:state.player.cash,title:goal.title,count:state.completed?'CLEAR':`${state.mission+1}/${goals.length}`,progress:state.completed?1:(state.mission+goal.value/goal.target)/goals.length,hint:paused?'一時停止':`${label} · ${Math.round(Math.hypot(target.x-state.player.x,target.y-state.player.y))}m`,completed:state.completed,items:Object.entries(state.player.bag).filter(([k])=>config.resources.includes(k)||k==='water'&&config.theme==='farm'||Object.values(state.machines).some(m=>m.recipe===k)).map(([k,count])=>({label:LIFE_ITEMS[k],count})),capacity:`荷物 ${lifeCargo(state)}/36`,rows:goals.map((g,i)=>({label:g.title,value:i<state.mission?g.target:g.value,target:g.target})),context:context(),note:stage.story});
  if(state.status==='won'&&!outcomeShown){outcomeShown=true;paused=true;stop();ending.textContent=stage.ending;next.textContent=stage.next?`次へ · ${stageFor(stage.next).title}`:'章・ステージ選択へ';if(!location.pathname.startsWith('/review/'))completeStage(localStorage,stage.id);save();outcome.showModal();}
}
document.addEventListener('keydown',e=>{if(e.target.closest('dialog,input,select'))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){e.preventDefault();input.keys.add(k);audio.unlock();}});document.addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
window.addEventListener('blur',stop);window.addEventListener('resize',()=>renderer.resize());window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{hidden=document.hidden;stop();if(hidden)save();});window.addEventListener('frostline:fatal',()=>{paused=true;stop();});
function frame(t){const dt=Math.min(.2,(t-last)/1000||.016);last=t;if(!paused&&!hidden){const k=input.keys,x=input.joyX+Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),y=input.joyY+Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));advanceSimulation((step,input)=>tickLife(state,step,input),dt,screenToWorldInput(x,y));saveTimer+=dt;if(saveTimer>2){save();saveTimer=0;}}
  for(const e of state.events.splice(0)){renderer.event(e);const cue={pickup:'pickup',transfer:'deposit',pay:'deposit',sell:'sell',cook:'deposit',water:'water',catch:'catch',harvest:'harvest',unload:'unload',build:'build',milestone:'milestone',victory:'victory'}[e.type];if(cue)audio.play(cue);if(e.type==='milestone'){ui.notify('目標達成 · '+e.title);save();}}
  if(state.work?.type==='fishing'&&state.actionTime<dt)audio.play('cast');
  audio.setActivity({paused:paused||state.status!=='playing',hidden});audio.update({x:state.player.x*100,y:state.player.y*100,moving:state.player.moving},true);hud();if(!hidden)renderer.render(state,paused?0:dt);requestAnimationFrame(frame);
}
renderer.focus.set(state.player.x,0,state.player.y-1);hud();renderer.render(state,0);canvas.dataset.art='journey-production-v3';save();window.dispatchEvent(new Event('frostline:ready'));requestAnimationFrame(frame);
export {state,renderer,hud,tickLife,saveLife,restart,ui};
