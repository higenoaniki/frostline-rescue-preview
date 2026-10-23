import {sweptTargets} from './melee.js';

export const STORY_IDS=['pass','highland','beacon'];
export const STORY_SPEED=8.4;
export const STORY_MATERIAL_LIMIT=30,STORY_PROVISION_LIMIT=8;
export const STORY_PADS={cook:{x:-5,y:6},food:{x:-2,y:6},trade:{x:5,y:12},weapon:{x:-5,y:12},armor:{x:-9,y:12},forge:{x:9,y:6},output:{x:12,y:6},miner:{x:9,y:12},bridge:{x:0,y:-7},relayA:{x:-9,y:-5},relayB:{x:9,y:-13},relayC:{x:0,y:-23},guard:{x:0,y:12}};
export const STORY_NAMES={cook:'食料加工',food:'食料回収',trade:'補給隊',weapon:'斧の強化',armor:'防具の強化',forge:'補強材工房',output:'補強材回収',miner:'自動採掘班',bridge:'峠の橋',relayA:'中継灯・西',relayB:'中継灯・東',relayC:'灯台の主灯',guard:'護衛隊'};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),near=(a,b,r=1.25)=>dist(a,b)<r;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const storySafe=(s,p)=>p.y>=0&&Math.abs(p.x)<15||s.chapter==='beacon'&&['relayA','relayB','relayC'].some(id=>s.built[id]&&dist(p,STORY_PADS[id])<2.6);
export const storyCapacity=p=>Object.values(p.bag).reduce((a,b)=>a+b,0);
export const storyMaterialCapacity=p=>p.bag.wood+p.bag.ore+p.bag.kit;
export const storyProvisionCapacity=p=>p.bag.raw+p.bag.food;
export function storySupplyRows(s,id){return Object.entries(storyCost(s,id)||{}).map(([key,required])=>({key,required,paid:Math.min(required,s.paid[id]?.[key]||0),carried:Number(key==='cash'?s.player.cash:key==='core'?s.core:s.player.bag[key])||0}));}
export function storyRepairProgress(s,id){if(s.built[id])return 1;const rows=storySupplyRows(s,id);return rows.reduce((n,r)=>n+r.paid/r.required,0)/Math.max(1,rows.length);}
export function storyConvoyStatus(s){
  if(s.completed)return{phase:'arrived',text:'補給隊が北岬の避難所に到着',point:s.convoy};
  if(!s.built.relayC)return{phase:'preparing',text:'補給隊は拠点で待機中 · 主灯の修復後に出発',point:s.convoy};
  if(dist(s.player,s.convoy)>=7)return{phase:'waiting',text:'護衛待ち · 補給隊の橇へ合流',point:s.convoy};
  if(s.enemies.some(e=>dist(e,s.convoy)<3.2))return{phase:'blocked',text:'敵が進路を塞いでいる · 橇の周囲を制圧',point:s.convoy};
  return{phase:'moving',text:'補給隊、移動中 · 灯台まで護衛',point:s.convoy};
}
const emit=(s,type,data={})=>{s.events.push({type,...data});if(s.events.length>100)s.events.shift();};
const random=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
export function storyMissions(s){
  if(s.chapter==='pass')return[
    {title:'橋を架ける木材',text:`木材を回収 ${Math.min(s.work.wood,12)}/12`,value:Math.min(s.work.wood,12),target:12,point:()=>nodeTarget(s,'wood')},
    {title:'対岸への橋',text:`木材 ${s.paid.bridge?.wood||0}/18 · 現金 ${s.paid.bridge?.cash||0}/36`,value:Number(!!s.built.bridge),target:1,point:()=>STORY_PADS.bridge},
    {title:'救助隊の食料',text:`食料を補給隊へ ${s.foodDelivered}/6`,value:s.foodDelivered,target:6,point:()=>s.player.bag.food?STORY_PADS.trade:s.foodStock?STORY_PADS.food:s.player.bag.raw?STORY_PADS.cook:nodeTarget(s,'raw')},
    {title:'3人を連れて帰る',text:`救助 ${s.rescued}/3 · 同行中 ${s.survivors.filter(p=>p.following&&!p.home).length}人`,value:s.rescued,target:3,point:()=>s.survivors.find(p=>!p.home&&!p.following)??{x:0,y:4}}
  ];
  if(s.chapter==='highland')return[
    {title:'採掘坑を再開',text:`木材 ${s.paid.mine?.wood||0}/12 · 現金 ${s.paid.mine?.cash||0}/36`,value:Number(!!s.built.mine),target:1,point:()=>STORY_PADS.bridge},
    {title:'新しい素材',text:`鉱石を回収 ${Math.min(s.work.ore,18)}/18`,value:Math.min(s.work.ore,18),target:18,point:()=>nodeTarget(s,'ore')},
    {title:'火床を整える',text:`工房 ${s.built.forge?'完成':'未完成'} · 斧 Lv.${s.weapon}/3`,value:Number(!!s.built.forge)+Number(s.weapon===3),target:2,point:()=>!s.built.forge?STORY_PADS.forge:STORY_PADS.weapon},
    {title:'働く採掘隊',text:`採掘班 ${s.built.miner?'雇用済':'未雇用'} · 補強材 ${Math.min(s.crafted,4)}/4`,value:Number(!!s.built.miner)+Math.min(4,s.crafted),target:5,point:()=>!s.built.miner?STORY_PADS.miner:s.kitStock?STORY_PADS.output:STORY_PADS.forge},
    {title:'灯台へ、補強材8箱',text:`補強材の納品 ${s.delivered}/8`,value:s.delivered,target:8,point:()=>s.player.bag.kit?STORY_PADS.trade:s.kitStock?STORY_PADS.output:STORY_PADS.forge}
  ];
  return[
    {title:'西の中継灯を修復',text:'木材・鉱石・現金を納入して、最初の道標を灯す',value:storyRepairProgress(s,'relayA'),target:1,point:()=>STORY_PADS.relayA},
    {title:'東の中継灯を修復',text:'補強材・鉱石・現金を納入して、北への道を開く',value:storyRepairProgress(s,'relayB'),target:1,point:()=>STORY_PADS.relayB},
    {title:'氷冠獣から氷核を回収',text:`氷核 ${s.coreRecovered||s.core||s.paid.relayC?.core?1:0}/1 · 北の雪原の氷冠獣を討伐`,value:Number(!!(s.coreRecovered||s.core||s.paid.relayC?.core)),target:1,point:()=>s.drops.find(d=>d.type==='core')??s.enemies.find(e=>e.boss)??{x:6,y:-26}},
    {title:'灯台の主灯を修復',text:'氷核・補強材・現金を納入し、避難所までの道を灯す',value:storyRepairProgress(s,'relayC'),target:1,point:()=>STORY_PADS.relayC},
    {title:'最後の補給隊を守る',text:`灯台への道 ${Math.floor(s.convoy.progress*100)}% · 橇HP ${Math.ceil(s.convoy.hp)}/180`,value:s.convoy.progress,target:1,point:()=>s.convoy}
  ];
}
export function storyCost(s,id){
  return ({bridge:{wood:18,cash:36},mine:{wood:12,cash:36},forge:{wood:8,cash:48},miner:{cash:72},guard:{cash:90},weapon:{cash:s.weapon===1?36:72},armor:{ore:6,cash:36},relayA:{wood:6,ore:6,cash:24},relayB:{kit:2,ore:6,cash:36},relayC:{core:1,kit:2,cash:48}})[id];
}
export function storyAvailable(s,id){
  if(id==='weapon')return s.weapon<3;
  if(id==='armor')return s.chapter!=='pass'&&s.armor<2;
  if(id==='bridge')return s.chapter==='pass'&&s.mission>=1&&!s.built.bridge;
  if(id==='mine')return s.chapter==='highland'&&!s.built.mine;
  if(id==='forge')return s.chapter==='highland'&&s.built.mine&&!s.built.forge;
  if(id==='miner')return s.chapter==='highland'&&s.built.forge&&!s.built.miner;
  if(id==='guard')return s.chapter==='beacon'&&!s.built.guard;
  const index=['relayA','relayB','relayC'].indexOf(id);
  return s.chapter==='beacon'&&index>=0&&!s.built[id]&&(index===0||s.built[['relayA','relayB'][index-1]]);
}
function nodesFor(chapter){
  return ['wood','ore'].flatMap((type,t)=>Array.from({length:6},(_,i)=>{let y=-3-Math.floor(i/2)*9-t*2;if(chapter==='pass'&&y< -9&&y> -15)y-=5;return{id:`${type}-${i}`,type,x:(i%2?1:-1)*(6+(i%3)*3),y,remaining:18,hits:0,respawn:0};}));
}
export function newStory(chapter,seed=9417){
  if(!STORY_IDS.includes(chapter))throw Error('Unknown story chapter');
  const s={version:1,chapter,seed,time:0,status:'playing',completed:false,mission:0,weapon:chapter==='pass'?1:2,armor:0,
    player:{x:0,y:7,hp:100,facing:-Math.PI/2,moving:false,bag:{wood:chapter==='beacon'?12:0,ore:chapter==='beacon'?12:0,raw:0,food:chapter==='pass'?6:0,kit:chapter==='beacon'?2:0},cash:chapter==='pass'?36:chapter==='highland'?48:96,cooldown:0,invulnerable:0,motion:null},
    built:{bridge:false,mine:chapter==='beacon',forge:chapter==='beacon',miner:false,guard:false,relayA:false,relayB:false,relayC:false},paid:{},blockedPad:null,investment:null,
    rawStock:0,foodStock:0,forgeWood:0,forgeOre:0,kitStock:0,foodDelivered:0,delivered:0,crafted:0,rescued:0,core:false,coreRecovered:false,pickupFood:true,
    work:{wood:0,ore:0,kills:0,guardKills:0},cookTimer:0,forgeTimer:0,minerTimer:0,transferTimer:0,spawnTimer:0,guardTimer:0,guardMotion:null,
    nodes:nodesFor(chapter),enemies:[],drops:[],events:[],sequence:0,finale:null,
    survivors:Array.from({length:3},(_,i)=>({id:i,x:(i-1)*4,y:-22+i*.7,following:false,home:false,hp:100,facing:0,moving:false})),
    convoy:{x:0,y:10,hp:180,progress:0,started:false},checkpoint:null};
  for(let i=0;i<(chapter==='pass'?7:chapter==='highland'?12:14);i++)spawnStoryEnemy(s);
  if(chapter==='beacon')spawnStoryEnemy(s,true);
  s.checkpoint=saveStory(s,false);return s;
}
function nodeTarget(s,type){
  return s.nodes.filter(n=>n.type===type&&n.remaining>0&&(s.chapter!=='pass'||s.built.bridge||n.y> -9)).sort((a,b)=>dist(s.player,a)-dist(s.player,b))[0]??{x:0,y:-4};
}
export function spawnStoryEnemy(s,boss=false){
  const wolf=s.chapter!=='pass'&&random(s)<.45;
  const x=boss?6:(random(s)-.5)*34;let y=boss?-26:-4-random(s)*24;
  if(s.chapter==='pass'&&y< -9&&y> -15)y=-17-random(s)*10;
  if(!boss&&dist({x,y},s.player)<4)return false;
  const hp=boss?72:wolf?18:6;
  s.enemies.push({id:++s.sequence,kind:wolf?'wolf':'snowbeast',boss,x,y,hp,hpMax:hp,r:boss?1:.65,speed:boss?1.4:wolf?2.2:1.65,facing:0,moving:false,motion:null,cooldown:1,spawnGrace:1});return true;
}
export function moveStoryActor(s,p,target,speed,dt){
  const d=dist(p,target);p.moving=d>.06;if(!p.moving)return true;
  const step=Math.min(d,speed*dt),next={x:p.x+(target.x-p.x)/d*step,y:p.y+(target.y-p.y)/d*step};
  p.facing=Math.atan2(target.y-p.y,target.x-p.x);
  const valid=q=>q.x>=-23&&q.x<=23&&q.y>=-30&&q.y<=16&&!(q.y>=0&&Math.abs(q.x)>14)&&!(Math.abs(q.y)<.65&&Math.abs(q.x)>1.6)&&!(s.chapter==='pass'&&q.y< -9&&q.y> -15&&(!s.built.bridge||Math.abs(q.x)>2.2))&&!storyObstacles(s).some(o=>dist(q,o)<o.r);
  if(valid(next)){p.x=next.x;p.y=next.y;}else{if(valid({...next,y:p.y}))p.x=next.x;if(valid({x:p.x,y:next.y}))p.y=next.y;}
  return d<.2;
}
export function storyObstacles(s){return [{x:-5,y:3.5,r:1.3},{x:-2,y:3.5,r:1},{x:5,y:14,r:1.5},{x:-5,y:14,r:1},...(s.built.forge?[{x:9,y:3.5,r:1.5}]:[])];}
export function investStory(s,id,dt){
  if(!storyAvailable(s,id)||s.blockedPad===id)return false;
  const cost=storyCost(s,id),paid=s.paid[id]??={};
  const rate=Math.max(1,Math.ceil(dt*180));
  for(const [key,total]of Object.entries(cost)){
    const source=key==='cash'?s.player:key==='core'?s:s.player.bag;
    const amount=Math.min(total-(paid[key]||0),Number(source[key]||0),key==='cash'?rate:3);
    if(amount>0){source[key]-=amount;paid[key]=(paid[key]||0)+amount;emit(s,key==='cash'?'pay':'transfer',{id,item:key,count:amount,amount,from:{x:s.player.x,y:s.player.y},to:STORY_PADS[id==='mine'?'bridge':id]});}
  }
  if(!Object.entries(cost).every(([key,total])=>(paid[key]||0)>=total))return false;
  if(id==='weapon'){s.weapon++;s.paid[id]={};}else if(id==='armor'){s.armor++;s.paid[id]={};}else s.built[id]=true;
  s.blockedPad=id;emit(s,'build',{id,...STORY_PADS[id==='mine'?'bridge':id]});return true;
}
function addDrop(s,type,amount,p){const pile=type==='raw'&&s.drops.find(d=>d.type==='raw'&&dist(d,p)<2);if(pile){pile.amount+=amount;pile.age=0;}else s.drops.push({id:++s.sequence,type,amount,x:p.x,y:p.y,age:0});}
function kill(s,e){
  s.enemies.splice(s.enemies.indexOf(e),1);s.work.kills++;s.player.cash+=e.boss?48:4;
  addDrop(s,'raw',e.boss?6:2,e);if(e.boss)addDrop(s,'core',1,e);
  emit(s,'kill',{x:e.x,y:e.y});
}
function combat(s,dt){
  const p=s.player;p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);
  if(storySafe(s,p))p.hp=Math.min(100,p.hp+20*dt);
  const target=s.enemies.filter(e=>dist(e,p)<2.8).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  const resource=s.nodes.filter(n=>n.remaining>0&&(n.type!=='ore'||s.built.mine)&&dist(p,n)<2.1).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(!p.motion&&p.cooldown===0&&!storySafe(s,p)&&(target||resource)){
    const t=target??resource;p.facing=Math.atan2(t.y-p.y,t.x-p.x);p.motion={time:0,duration:.44,angle:p.facing,hits:new Set(),node:target?null:resource.id};p.cooldown=[0,.64,.55,.47][s.weapon];emit(s,'swing');
  }
  if(p.motion){
    const m=p.motion,previous=m.time;m.time+=dt;
    if(m.node){
      const n=s.nodes.find(n=>n.id===m.node);
      if(previous<.2&&m.time>=.2&&n&&dist(n,p)<2.4&&n.remaining>0&&storyMaterialCapacity(p)<STORY_MATERIAL_LIMIT){const count=Math.min(n.remaining,n.type==='wood'?3:2,STORY_MATERIAL_LIMIT-storyMaterialCapacity(p));n.remaining-=count;p.bag[n.type]+=count;s.work[n.type]+=count;emit(s,'pickup',{item:n.type,count,x:n.x,y:n.y});if(!n.remaining)n.respawn=12;}
    }else for(const e of sweptTargets({...p,range:2.3},s.enemies,m,previous)){e.hp-=[0,3,6,12][s.weapon];emit(s,'hit',{x:e.x,y:e.y});if(e.hp<=0)kill(s,e);}
    if(m.time>=.44)p.motion=null;
  }
  for(const e of [...s.enemies]){
    e.cooldown=Math.max(0,e.cooldown-dt);e.spawnGrace=Math.max(0,e.spawnGrace-dt);e.moving=false;
    const convoy=s.convoy.started&&s.convoy.progress<1?s.convoy:null;
    const candidates=[...(!storySafe(s,p)?[p]:[]),...(convoy?[convoy]:[])];
    const victim=candidates.sort((a,b)=>dist(e,a)-dist(e,b))[0];
    if(e.motion){
      const m=e.motion,previous=m.time;m.time+=dt;
      if(previous<.78&&m.time>=.78){const impact={x:e.x+Math.cos(m.angle)*1.1,y:e.y+Math.sin(m.angle)*1.1};
        for(const v of [p,...(convoy?[convoy]:[])])if((v!==p||!storySafe(s,p))&&dist(v,impact)<1.05&&!(v.invulnerable>0)){v.hp=Math.max(0,v.hp-(v===p?Math.max(3,(e.boss?14:e.kind==='wolf'?9:5)-s.armor*2):e.boss?12:6));v.invulnerable=.65;emit(s,'hurt',{x:v.x,y:v.y});}
      }if(m.time>=1.2)e.motion=null;continue;
    }
    if(victim&&dist(e,victim)<(e.boss?15:11)&&!e.spawnGrace){e.facing=Math.atan2(victim.y-e.y,victim.x-e.x);if(dist(e,victim)<1.8&&e.cooldown===0){e.motion={time:0,angle:e.facing};e.cooldown=1.9;}else if(dist(e,victim)>1.25){
      let target=victim;
      if(s.chapter==='pass'&&(e.y< -15&&victim.y> -15||e.y> -9&&victim.y< -9||e.y>=-15&&e.y<=-9)){
        if(!s.built.bridge)continue;
        target=Math.abs(e.x)>1.8?{x:0,y:e.y}:{x:0,y:victim.y};
      }
      const d=dist(e,target),step=Math.min(d,e.speed*dt);if(d>0){e.x+=(target.x-e.x)/d*step;e.y+=(target.y-e.y)/d*step;}e.y=Math.min(-.75,e.y);e.moving=true;
    }}
  }
}
function deposit(s,source,key,destination,destKey,n,from,to){
  const amount=Math.min(source[key]||0,n);if(amount<=0)return;
  source[key]-=amount;destination[destKey]=(destination[destKey]||0)+amount;emit(s,'transfer',{item:key,count:amount,from,to});
}
function interactions(s,dt){
  const p=s.player,b=p.bag;
  for(const d of [...s.drops])if(near(p,d,1.5)){
    if(d.type==='core'){s.core=s.coreRecovered=true;s.drops.splice(s.drops.indexOf(d),1);emit(s,'pickup',{item:'core',x:d.x,y:d.y});continue;}
    if(d.type==='raw'&&!s.pickupFood)continue;
    const free=d.type==='raw'?STORY_PROVISION_LIMIT-storyProvisionCapacity(p):STORY_MATERIAL_LIMIT-storyMaterialCapacity(p);
    const n=Math.max(0,Math.min(d.amount,free));if(!n)continue;b[d.type]+=n;d.amount-=n;emit(s,'pickup',{item:d.type,count:n,x:d.x,y:d.y});if(!d.amount)s.drops.splice(s.drops.indexOf(d),1);
  }
  s.transferTimer+=dt;if(s.transferTimer<.1)return;s.transferTimer=0;s.investment=null;
  if(s.blockedPad){const pos=STORY_PADS[s.blockedPad==='mine'?'bridge':s.blockedPad];if(!near(p,pos,1.65))s.blockedPad=null;}
  for(const id of ['weapon','armor','bridge','mine','forge','miner','guard','relayA','relayB','relayC'])if(storyAvailable(s,id)&&near(p,STORY_PADS[id==='mine'?'bridge':id])){s.investment=id;investStory(s,id,.1);break;}
  if(near(p,STORY_PADS.cook))deposit(s,b,'raw',s,'rawStock',3,{...p},STORY_PADS.cook);
  if(near(p,STORY_PADS.food))deposit(s,s,'foodStock',b,'food',Math.max(0,Math.min(3,STORY_PROVISION_LIMIT-storyProvisionCapacity(p))),STORY_PADS.food,{...p});
  if(near(p,STORY_PADS.trade)){
    if(s.chapter==='pass'&&s.foodDelivered<6)deposit(s,b,'food',s,'foodDelivered',6-s.foodDelivered,{...p},STORY_PADS.trade);
    else if(s.chapter==='highland'&&s.delivered<8)deposit(s,b,'kit',s,'delivered',Math.min(2,8-s.delivered),{...p},STORY_PADS.trade);
    const build=currentBuild(s),cost=build?storyCost(s,build):{},paid=s.paid[build]||{};
    const reserve=key=>Math.max(0,(cost[key]||0)-(paid[key]||0));
    const type=b.raw>0?'raw':b.food>0?'food':b.wood>reserve('wood')?'wood':b.ore>reserve('ore')?'ore':null;
    if(type){const n=Math.min(3,b[type]-(['wood','ore'].includes(type)?reserve(type):0));b[type]-=n;p.cash+=n*(type==='wood'?3:type==='raw'?4:type==='ore'?5:8);emit(s,'sell',{x:p.x,y:p.y});}
  }
  if(s.built.forge&&near(p,STORY_PADS.forge)){
    if(s.forgeWood<8)deposit(s,b,'wood',s,'forgeWood',Math.min(2,8-s.forgeWood),{...p},STORY_PADS.forge);
    if(s.forgeOre<24)deposit(s,b,'ore',s,'forgeOre',Math.min(3,24-s.forgeOre),{...p},STORY_PADS.forge);
  }
  if(s.built.forge&&near(p,STORY_PADS.output))deposit(s,s,'kitStock',b,'kit',Math.max(0,Math.min(2,STORY_MATERIAL_LIMIT-storyMaterialCapacity(p))),STORY_PADS.output,{...p});
}
function production(s,dt){
  s.cookTimer+=dt;if(s.rawStock&&s.cookTimer>=.8){s.rawStock--;s.foodStock++;s.cookTimer=0;emit(s,'cook');}
  s.forgeTimer+=dt;if(s.built.forge&&s.forgeWood>=1&&s.forgeOre>=3&&s.forgeTimer>=1.5&&s.kitStock<12){s.forgeWood--;s.forgeOre-=3;s.kitStock++;s.crafted++;s.forgeTimer=0;emit(s,'cook');}
  if(s.built.miner){s.minerTimer+=dt;if(s.minerTimer>4&&s.forgeOre<24){s.minerTimer=0;s.forgeOre+=2;s.work.ore+=2;emit(s,'transfer',{item:'ore',from:{x:10,y:-18},to:STORY_PADS.forge});}}
  for(const n of s.nodes)if(!n.remaining){n.respawn-=dt;if(n.respawn<=0)n.remaining=18;}
}
function rescue(s,dt){
  if(s.chapter!=='pass'||!s.built.bridge||s.foodDelivered<6)return;
  for(const [i,p]of s.survivors.entries()){
    if(p.home)continue;if(near(s.player,p,2.4)&&!p.following){p.following=true;emit(s,'build',{x:p.x,y:p.y});}
    if(!p.following)continue;
    const waypoint=p.y< -15?(Math.abs(p.x)>.4?{x:0,y:p.y}:{x:0,y:-7}):p.y< -8?{x:0,y:-7}:p.y<0?{x:0,y:2}:null;
    const target=waypoint??{x:s.player.x+(i-1)*.6,y:s.player.y-1};
    if(dist(s.player,p)<9&&dist(p,target)>(waypoint ? .12 : .6))moveStoryActor(s,p,target,5,dt);else p.moving=false;
    if(p.y>2){p.home=true;s.rescued++;emit(s,'build',{x:p.x,y:p.y});}
  }
}
function escort(s,dt){
  if(s.chapter!=='beacon'||!s.built.relayC)return;
  const c=s.convoy;if(!c.started){c.started=true;for(let i=0;i<4;i++)spawnStoryEnemy(s);emit(s,'launch');}
  c.invulnerable=Math.max(0,(c.invulnerable||0)-dt);
  const blockers=s.enemies.some(e=>dist(e,c)<3.2);
  if(dist(c,s.player)<7&&!blockers){c.y=Math.max(-23,c.y-1.7*dt);c.progress=clamp((10-c.y)/33,0,1);}
  if(s.built.guard){
    s.guardTimer+=dt;
    if(s.guardMotion){const m=s.guardMotion;m.time+=dt;if(!m.hit&&m.time>=.2){m.hit=true;const e=s.enemies.find(e=>e.id===m.target);if(e&&dist(e,c)<4.2){e.hp-=6;emit(s,'hit',{x:e.x,y:e.y});if(e.hp<=0){s.work.guardKills++;kill(s,e);}}}if(m.time>=.44)s.guardMotion=null;}
    else if(s.guardTimer>1){const e=s.enemies.filter(e=>dist(e,c)<4.2).sort((a,b)=>a.hp-b.hp)[0];if(e){s.guardTimer=0;s.guardMotion={time:0,duration:.44,target:e.id,angle:Math.atan2(e.y-c.y,e.x-c.x),hit:false};emit(s,'swing');}}
  }
}
export function repairConvoy(s){
  if(s.chapter!=='beacon'||!s.convoy.started||!near(s.player,s.convoy,3)||s.convoy.hp>=180||s.player.bag.wood<4||s.player.cash<12)return false;
  s.player.bag.wood-=4;s.player.cash-=12;s.convoy.hp=Math.min(180,s.convoy.hp+60);emit(s,'build',{x:s.convoy.x,y:s.convoy.y});return true;
}
export function tickStory(s,dt,input={x:0,y:0}){
  if(s.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.05,dt);s.time+=dt;
  if(s.player.hp<=0||s.convoy.hp<=0){s.status='lost';emit(s,'failure');return;}
  const p=s.player,len=Math.hypot(input.x,input.y);p.moving=false;
  if(len>0)moveStoryActor(s,p,{x:p.x+input.x/len,y:p.y+input.y/len},STORY_SPEED*Math.min(1,len),dt);
  interactions(s,dt);production(s,dt);combat(s,dt);rescue(s,dt);escort(s,dt);
  for(let i=s.drops.length-1;i>=0;i--){const d=s.drops[i];if(d.type==='raw'){d.age=(d.age||0)+dt;if(d.age>60)s.drops.splice(i,1);}}
  s.spawnTimer+=dt;const max=s.chapter==='pass'?7:s.chapter==='highland'?12:14;
  if(s.spawnTimer>2&&s.enemies.length<max&&s.drops.reduce((n,d)=>n+d.amount,0)<30){s.spawnTimer=0;spawnStoryEnemy(s);}
  if(p.hp<=0||s.convoy.hp<=0){s.status='lost';emit(s,'failure');return;}
  const goals=storyMissions(s),goal=goals[s.mission];
  if(goal&&goal.value>=goal.target){s.mission++;emit(s,'milestone',{title:goal.title,x:p.x,y:p.y});s.checkpoint=saveStory(s,false);}
  if(s.mission>=goals.length&&!s.completed){s.completed=true;s.status='won';emit(s,'victory',{x:p.x,y:p.y});s.checkpoint=saveStory(s,false);}
}
export function storyTarget(s){
  const goal=storyMissions(s)[s.mission];if(!goal)return['補給路、完成',{x:0,y:7}];
  const build=currentBuild(s);
  if(build){
    const cost=storyCost(s,build),paid=s.paid[build]||{},b=s.player.bag;
    if((cost.wood||0)-(paid.wood||0)>b.wood)return['修復用の木材を集める',nodeTarget(s,'wood')];
    if((cost.ore||0)-(paid.ore||0)>b.ore)return['修復用の鉱石を集める',nodeTarget(s,'ore')];
    if((cost.kit||0)-(paid.kit||0)>b.kit)return productionTarget(s);
    if((cost.core||0)-(paid.core||0)>Number(s.core))return['氷核を回収する',s.drops.find(d=>d.type==='core')??s.enemies.find(e=>e.boss)??{x:6,y:-26}];
    if((cost.cash||0)-(paid.cash||0)>s.player.cash)return b.raw||b.food||b.wood>Math.max(0,(cost.wood||0)-(paid.wood||0))||b.ore>Math.max(0,(cost.ore||0)-(paid.ore||0))?['余剰物資を補給隊へ換金',STORY_PADS.trade]:['換金用の木材を集める',nodeTarget(s,'wood')];
    return[STORY_NAMES[build]+'へ納入',STORY_PADS[build==='mine'?'bridge':build]];
  }
  if(s.chapter==='beacon'&&s.mission===4)return[storyConvoyStatus(s).text,s.convoy];
  if(s.chapter==='highland'&&s.mission>=3&&s.player.bag.kit===0){
    if(!(s.mission===3&&!s.built.miner))return productionTarget(s);
  }
  return[goal.title,goal.point()];
}
function currentBuild(s){
  if(s.chapter==='pass')return s.mission===1?'bridge':null;
  if(s.chapter==='highland')return s.mission===0?'mine':s.mission===2?!s.built.forge?'forge':s.weapon<3?'weapon':null:s.mission===3&&!s.built.miner?'miner':null;
  return s.mission===0?'relayA':s.mission===1?'relayB':s.mission===3?'relayC':null;
}
function productionTarget(s){
  if(s.kitStock)return['補強材を回収',STORY_PADS.output];
  if(s.forgeWood<1&&!s.player.bag.wood)return['加工用の木材を集める',nodeTarget(s,'wood')];
  if(s.forgeOre<3&&s.player.bag.ore<3)return['加工用の鉱石を集める',nodeTarget(s,'ore')];
  if(s.forgeOre>=3&&s.forgeWood>=1)return['補強材の回収棚へ',STORY_PADS.output];
  return['木材と鉱石を工房へ',STORY_PADS.forge];
}
export function saveStory(s,includeCheckpoint=true){
  const {events,checkpoint,...data}=s;
  return JSON.stringify({...data,player:{...s.player,motion:null},enemies:s.enemies.map(e=>({...e,motion:null})),...(includeCheckpoint?{checkpoint}: {})});
}
export function restoreStory(raw,chapter){
  try{
    const data=JSON.parse(raw);if(data?.version!==1||data.chapter!==chapter||!STORY_IDS.includes(chapter))return null;
    const s=newStory(chapter);
    for(const key of ['time','mission','weapon','armor','rawStock','foodStock','forgeWood','forgeOre','kitStock','foodDelivered','delivered','crafted','rescued','sequence','seed'])if(!Number.isFinite(data[key])||data[key]<0)return null;
    if(!data.player||!data.player.bag||!Object.keys(s.player.bag).every(k=>Number.isFinite(data.player.bag[k])&&data.player.bag[k]>=0)||!['cash','hp','x','y'].every(k=>Number.isFinite(data.player[k])))return null;
    for(const key of Object.keys(s))if(!['chapter','version','events','checkpoint','status'].includes(key)&&data[key]!==undefined)s[key]=data[key];
    s.weapon=clamp(Math.floor(s.weapon),1,3);s.armor=clamp(Math.floor(s.armor),0,2);s.mission=clamp(Math.floor(s.mission),0,storyMissions(s).length);
    if(!Array.isArray(s.nodes)||s.nodes.length!==12||!s.nodes.every(n=>['wood','ore'].includes(n.type)&&[n.x,n.y,n.remaining,n.respawn].every(Number.isFinite))||!Array.isArray(s.enemies)||!Array.isArray(s.survivors)||s.survivors.length!==3||!s.convoy||![s.convoy.hp,s.convoy.progress,s.convoy.x,s.convoy.y].every(Number.isFinite))return null;
    s.player.hp=clamp(s.player.hp,1,100);s.player.cash=Math.max(0,Math.floor(s.player.cash));s.player.motion=null;s.player.cooldown=0;s.player.invulnerable=1;
    s.coreRecovered=!!(s.coreRecovered||s.core||s.paid.relayC?.core||s.built.relayC);s.pickupFood=data.pickupFood!==false;
    const previousMission=s.mission;
    if(chapter==='beacon')while(s.mission<storyMissions(s).length&&storyMissions(s)[s.mission].value>=1)s.mission++;
    s.completed=s.completed===true&&s.mission===storyMissions(s).length&&(chapter==='pass'?s.rescued===3:chapter==='highland'?s.delivered>=8:s.convoy.progress>=1);
    s.status=data.status==='lost'?'lost':'playing';s.events=[];s.checkpoint=previousMission!==s.mission?saveStory(s,false):typeof data.checkpoint==='string'?data.checkpoint:saveStory(s,false);return s;
  }catch{return null;}
}
export function retryStory(s){const next=restoreStory(s.checkpoint,s.chapter)??newStory(s.chapter);next.player.hp=100;next.convoy.hp=Math.max(90,next.convoy.hp);next.status='playing';return next;}
