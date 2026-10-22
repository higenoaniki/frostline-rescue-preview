import {sweptTargets} from './melee.js';

export const SNOWFRONT_KEY='frostline-snowfront-v1';
export const SNOWFRONT_SPEED=8;
export const PADS={
  raw:{x:-4,y:5.4},roast:{x:-1.5,y:5.4},sale:{x:3.6,y:13.5},cash:{x:6,y:13.5},
  weapon:{x:-4,y:10.3},east:{x:6,y:8},west:{x:-6,y:8},
  smoker:{x:13,y:6.4},smoked:{x:15.6,y:6.4},collector:{x:13,y:12.4},
  hunter:{x:-13,y:5.8},porter:{x:-13,y:12.4}
};
export const BUILD_COST={east:96,west:180,smoker:66,collector:84,hunter:144,porter:96};
export const MISSIONS=[
  {title:'雪原に交易所を',text:'焼き肉を旅人へ販売',target:6,value:s=>s.sold},
  {title:'東の区画へ',text:'斧Lv.2と東区画の開拓',target:2,value:s=>Number(s.weapon>=2)+Number(s.built.east)},
  {title:'仲間と集める',text:'回収人を雇用し、合計40個の獲物を回収',target:2,value:s=>Number(s.built.collector)+Number(s.gathered>=40)},
  {title:'新しい獲物、新しい製法',text:'斧Lv.3・燻製工房・灰牙獣6体',target:3,value:s=>Number(s.weapon===3)+Number(s.built.smoker)+Number(s.wolfKills>=6)},
  {title:'働く拠点',text:'西区画・自動狩り台・燻製の荷箱を4箱製作',target:3,value:s=>Number(s.built.west)+Number(s.built.hunter)+Number(s.crafted>=4)},
  {title:'交易路をつなぐ',text:'燻製の荷箱を8箱、出荷台へ納品',target:8,value:s=>s.delivered}
];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const near=(p,pad,r=1.12)=>distance(p,pad)<r;
export function isSafe(p,s){return p.y>=0&&p.y<=17&&p.x>=(s.built.west?-20:-8)&&p.x<=(s.built.east?20:8);}
export function buildAvailable(s,id){
  if(id==='weapon')return s.weapon<3;
  if(id==='east')return s.sold>=6;
  if(id==='west')return s.built.east&&s.weapon===3;
  if(['smoker','collector'].includes(id))return s.built.east;
  if(id==='hunter')return s.built.west&&s.weapon===3;
  if(id==='porter')return s.built.west;
  return false;
}
export function investmentCost(s,id){return id==='weapon'?(s.weapon===1?24:54):BUILD_COST[id]??0;}
export function investmentPad(s){return ['weapon',...Object.keys(BUILD_COST)].find(id=>!s.built[id]&&buildAvailable(s,id)&&near(s.player,PADS[id]));}
function event(s,type,data={}){s.events.push({type,...data});if(s.events.length>96)s.events.shift();}
const bagCount=p=>p.bag.raw+p.bag.roast+p.bag.fur+p.bag.crate;
export function newSnowfront(seed=8128){
  const s={version:1,seed,time:0,status:'playing',mission:0,completed:false,freeplay:false,weapon:1,
    player:{x:0,y:6,hp:100,facing:-Math.PI/2,moving:false,bag:{raw:0,roast:0,fur:0,crate:0},cash:0,cooldown:0,invulnerable:0,motion:null,swings:0},
    built:Object.fromEntries(Object.keys(BUILD_COST).map(k=>[k,false])),paid:{},blockedPad:null,investment:null,
    rawStock:0,roastStock:0,marketStock:0,cashStock:0,smokeRaw:0,smokeFur:0,crateStock:0,
    sold:0,gathered:0,kills:0,wolfKills:0,crafted:0,delivered:0,cookTimer:0,smokeTimer:0,transferTimer:0,spawnTimer:0,tradeTimer:0,turretTimer:0,
    worker:{x:-4,y:5.7,hp:80,load:0,phase:'idle',cooldown:0,facing:0,moving:false},
    porter:{x:-13,y:12,hp:80,load:0,phase:'idle',facing:0,moving:false},
    enemies:[],drops:[],buyers:[],effects:[],events:[],sequence:0,gate:0,serviceGate:0,finale:null,checkpoint:null};
  for(let i=0;i<14;i++)spawnEnemy(s);
  for(let i=0;i<4;i++)s.buyers.push({id:++s.sequence,x:6+i*1.8,y:19.5,phase:'queue',need:2+(i%2),facing:-Math.PI/2,moving:false});
  s.checkpoint=saveSnowfront(s);return s;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function spawnEnemy(s){
  const wolf=s.built.east&&s.enemies.filter(e=>e.kind==='wolf').length<5&&random(s)<.5;
  const x=(random(s)-.5)*30,y=-3-random(s)*22,hp=wolf?12:6;
  if(distance({x,y},s.player)<3)return false;
  s.enemies.push({id:++s.sequence,kind:wolf?'wolf':'snowbeast',x,y,hp,hpMax:hp,r:wolf?.55:.7,speed:wolf?2.25:1.7,facing:Math.PI/2,phase:'walk',timer:random(s)*2,cooldown:1,motion:null,moving:false,wander:{x,y}});return true;
}
export function killEnemy(s,e,source='player'){
  if(!s.enemies.includes(e))return;
  s.enemies.splice(s.enemies.indexOf(e),1);s.kills++;if(e.kind==='wolf')s.wolfKills++;
  const pile=s.drops.find(d=>d.type==='raw'&&distance(d,e)<1.8);
  if(pile)pile.amount+=2;else s.drops.push({id:++s.sequence,x:e.x,y:e.y,type:'raw',amount:2});
  if(e.kind==='wolf')s.drops.push({id:++s.sequence,x:e.x+.6,y:e.y,type:'fur',amount:1});
  event(s,'kill',{x:e.x,y:e.y,source});
}
const OBSTACLES=[{x:-4,y:3,r:1.18},{x:-1.5,y:3.9,r:.8},{x:-6.4,y:3.3,r:.7},{x:3.6,y:16,r:1.6},{x:-4,y:12,r:.9}];
function validPosition(s,p){
  if(p.x< -25||p.x>25||p.y< -30||p.y>16.3)return false;
  if(p.y>=-.45&&!isSafe({...p,y:Math.max(0,p.y)},s))return false;
  if(Math.abs(p.y)<.5&&Math.abs(p.x)>1.15)return false;
  const obstacles=[...OBSTACLES];
  if(s.built.smoker)obstacles.push({x:13,y:4.3,r:1.15});
  if(s.built.hunter)obstacles.push({x:-13,y:3.5,r:1.1});
  if(s.built.collector)obstacles.push({x:13,y:14.5,r:.8});
  if(s.built.porter)obstacles.push({x:-13,y:14.5,r:.8});
  return !obstacles.some(o=>distance(p,o)<o.r+.35);
}
export function moveActor(s,p,target,speed,dt,worker=false){
  const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);p.moving=d>.08;
  if(!p.moving)return true;p.facing=Math.atan2(dy,dx);
  const next={x:p.x+dx/d*step,y:p.y+dy/d*step};
  if(worker||validPosition(s,next)){p.x=next.x;p.y=next.y;}
  else{if(validPosition(s,{x:next.x,y:p.y}))p.x=next.x;if(validPosition(s,{x:p.x,y:next.y}))p.y=next.y;}
  return d<.2;
}
function transfer(s,source,key,destination,destKey,count=1,from,to){
  count=Math.min(count,source[key]||0);if(count<=0)return false;
  source[key]-=count;destination[destKey]=(destination[destKey]||0)+count;
  event(s,'transfer',{item:key==='cashStock'?'cash':key,count,from:from??PADS.raw,to:to??s.player});return true;
}
function collect(s,actor,worker=false){
  for(const d of [...s.drops]){
    if(distance(actor,d)>1.35||worker&&d.type!=='raw')continue;
    const capacity=worker?12-actor.load:30-bagCount(actor);if(capacity<=0)break;
    const amount=Math.min(capacity,d.amount);d.amount-=amount;
    if(worker)actor.load+=amount;else actor.bag[d.type]+=amount;
    if(d.type==='raw')s.gathered+=amount;
    event(s,'pickup',{x:d.x,y:d.y,item:d.type,count:amount,worker});
    if(!d.amount)s.drops.splice(s.drops.indexOf(d),1);
  }
}
export function invest(s,dt){
  const id=investmentPad(s);
  if(s.blockedPad&&!near(s.player,PADS[s.blockedPad],1.45))s.blockedPad=null;
  s.investment=id??null;if(!id||s.blockedPad===id)return;
  const cost=investmentCost(s,id),remaining=cost-(s.paid[id]||0),amount=Math.min(remaining,s.player.cash,Math.max(1,Math.ceil(dt*100)));
  if(amount<=0)return;s.player.cash-=amount;s.paid[id]=(s.paid[id]||0)+amount;
  event(s,'pay',{id,amount,from:{x:s.player.x,y:s.player.y},to:PADS[id]});
  if(s.paid[id]>=cost){
    if(id==='weapon'){s.weapon++;s.paid[id]=0;}else s.built[id]=true;
    s.blockedPad=id;event(s,'build',{id,x:PADS[id].x,y:PADS[id].y});
  }
}
function playerCombat(s,dt){
  const p=s.player;p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);
  if(isSafe(p,s)){p.hp=Math.min(100,p.hp+16*dt);p.motion=null;return;}
  const targets=s.enemies.filter(e=>distance(p,e)<2.8).sort((a,b)=>distance(p,a)-distance(p,b));
  if(!p.motion&&p.cooldown===0&&targets.length){
    const e=targets[0];p.facing=Math.atan2(e.y-p.y,e.x-p.x);p.swings++;
    p.motion={time:0,duration:.44,angle:p.facing,hits:new Set(),spin:s.weapon===3&&p.swings%4===0};
    p.cooldown=[0,.72,.61,.51][s.weapon];event(s,'swing');
  }
  if(!p.motion)return;const m=p.motion,previous=m.time;m.time+=dt;
  let hit=[];
  if(m.spin){if(previous<.2&&m.time>=.2)hit=s.enemies.filter(e=>distance(p,e)<3.5);}
  else hit=sweptTargets({...p,range:2.3},s.enemies,m,previous);
  for(const e of hit){e.hp-=[0,3,6,12][s.weapon];event(s,'hit',{x:e.x,y:e.y});if(e.hp<=0)killEnemy(s,e);}
  if(m.time>=m.duration)p.motion=null;
}
function enemyCombat(s,dt){
  for(const e of [...s.enemies]){
    e.cooldown=Math.max(0,e.cooldown-dt);e.moving=false;
    const candidates=[s.player,...(s.built.collector&&s.worker.hp>0?[s.worker]:[])].filter(p=>!isSafe(p,s)&&p.hp>0).sort((a,b)=>distance(e,a)-distance(e,b));
    const target=candidates[0];
    if(e.motion){
      const m=e.motion,previous=m.time;m.time+=dt;
      if(previous<.78&&m.time>=.78){
        const impact={x:e.x+Math.cos(m.angle)*1.1,y:e.y+Math.sin(m.angle)*1.1};
        for(const p of [s.player,s.worker])if(!isSafe(p,s)&&p.hp>0&&distance(p,impact)<1.05&&!(p.invulnerable>0)){
          p.hp=Math.max(0,p.hp-(e.kind==='wolf'?10:6));p.invulnerable=.7;event(s,'hurt',{worker:p===s.worker,x:p.x,y:p.y});
        }
      }
      if(m.time>=1.2)e.motion=null;continue;
    }
    if(target&&distance(e,target)<13){
      e.facing=Math.atan2(target.y-e.y,target.x-e.x);
      if(distance(e,target)<1.8&&e.cooldown===0){e.motion={time:0,angle:e.facing};e.cooldown=1.9;}
      else if(distance(e,target)>1.25)moveActor(s,e,{x:target.x,y:Math.min(-.75,target.y)},e.speed,dt,true);
    }else{
      e.timer-=dt;if(e.timer<=0){e.wander={x:clamp(e.x+(random(s)-.5)*7,-23,23),y:clamp(e.y+(random(s)-.5)*7,-28,-1.8)};e.timer=3+random(s)*3;}
      moveActor(s,e,e.wander,e.speed*.33,dt,true);
    }
    e.y=Math.min(-.7,e.y);
  }
}
function collector(s,dt){
  if(!s.built.collector)return;const w=s.worker;w.invulnerable=Math.max(0,(w.invulnerable||0)-dt);
  if(w.hp<=0){w.phase='recover';w.cooldown=6;w.x=-4;w.y=5.7;w.hp=.01;w.crossing=null;event(s,'workerDown');}
  if(w.phase==='recover'){w.cooldown-=dt;w.hp=Math.min(80,w.hp+14*dt);w.moving=false;if(w.cooldown<=0){w.hp=80;w.phase='idle';}return;}
  if(isSafe(w,s))w.hp=Math.min(80,w.hp+14*dt);
  if(w.crossing){
    // The clear central aisle avoids both the grill and its output table.
    const outbound=[{x:.25,y:5.7},{x:.25,y:1.4},{x:-5,y:1.4},{x:-5,y:-1.4}];
    const route=w.crossing.direction==='out'?outbound:[...outbound].reverse();
    if(moveActor(s,w,route[w.crossing.index],3.6,dt,true)){w.crossing.index++;if(w.crossing.index===route.length)w.crossing=null;}return;
  }
  if(w.load>=10||w.hp<25||w.phase==='return'){
    w.phase='return';
    if(w.y<0){w.crossing={direction:'in',index:0};return;}
    if(moveActor(s,w,PADS.raw,3.6,dt,true)){s.rawStock+=w.load;event(s,'transfer',{item:'raw',count:w.load,from:{...w},to:PADS.raw});w.load=0;w.phase='idle';}return;
  }
  const target=s.drops.filter(d=>d.type==='raw').sort((a,b)=>distance(w,a)-distance(w,b))[0];
  if(!target){w.moving=false;return;}
  if(w.y>=0&&target.y<0){w.crossing={direction:'out',index:0};return;}
  moveActor(s,w,target,3.6,dt,true);collect(s,w,true);
  if(w.load>0&&!s.drops.some(d=>d.type==='raw'))w.phase='return';
}
function porter(s,dt){
  if(!s.built.porter)return;const p=s.porter,target=p.load?PADS.sale:PADS.roast;
  if(moveActor(s,p,target,3.6,dt,true)){
    if(p.load){s.marketStock+=p.load;p.load=0;event(s,'deposit');}
    else if(s.roastStock>0){const n=Math.min(8,s.roastStock);s.roastStock-=n;p.load=n;event(s,'pickup',{x:p.x,y:p.y,item:'roast',count:n});}
  }
}
function production(s,dt){
  s.cookTimer+=dt;if(s.rawStock>0&&s.roastStock<40&&s.cookTimer>=(s.built.east?.75:1.15)){s.cookTimer=0;s.rawStock--;s.roastStock++;event(s,'cook');}
  if(!s.rawStock)s.cookTimer=0;
  s.smokeTimer+=dt;
  if(s.built.smoker&&s.smokeRaw>=3&&s.smokeFur>=1&&s.crateStock<12&&s.smokeTimer>=2.4){s.smokeTimer=0;s.smokeRaw-=3;s.smokeFur--;s.crateStock++;s.crafted++;event(s,'cook');}
}
function trading(s,dt){
  s.tradeTimer+=dt;
  const queued=s.buyers.filter(b=>b.phase==='queue');
  for(const [i,b]of queued.entries())moveActor(s,b,{x:3.6+i*1.5,y:19.5},2.8,dt,true);
  const first=queued[0];
  if(first&&distance(first,{x:3.6,y:19.5})<.15&&s.marketStock>0&&s.tradeTimer>=.45){
    s.tradeTimer=0;s.marketStock--;s.cashStock+=6;s.sold++;first.need--;event(s,'sell',{x:3.6,y:17});if(first.need<=0)first.phase='leave';
  }
  for(const b of s.buyers.filter(b=>b.phase==='leave')){moveActor(s,b,{x:-28,y:20.2},3.2,dt,true);if(b.x< -27)s.buyers.splice(s.buyers.indexOf(b),1);}
  if(queued.length<4&&s.buyers.length<8)s.buyers.push({id:++s.sequence,x:28,y:19.5,phase:'queue',need:2+(s.sequence%2),facing:Math.PI,moving:true});
}
function interaction(s,dt){
  const p=s.player,b=p.bag;s.transferTimer+=dt;
  if(s.transferTimer<.09)return;s.transferTimer=0;
  if(near(p,PADS.raw))transfer(s,b,'raw',s,'rawStock',3,p,PADS.raw);
  if(near(p,PADS.roast)&&bagCount(p)<30)transfer(s,s,'roastStock',b,'roast',Math.min(3,30-bagCount(p)),PADS.roast,p);
  if(near(p,PADS.sale)){
    if(b.crate>0&&s.delivered<8)transfer(s,b,'crate',s,'delivered',1,p,PADS.sale);
    else if(s.marketStock<60)transfer(s,b,'roast',s,'marketStock',3,p,PADS.sale);
  }
  if(near(p,PADS.cash)||near(p,PADS.sale))transfer(s,s,'cashStock',p,'cash',Math.min(24,s.cashStock),PADS.cash,p);
  if(s.built.smoker&&near(p,PADS.smoker)){
    if(s.smokeRaw<24)transfer(s,b,'roast',s,'smokeRaw',3,p,PADS.smoker);
    if(s.smokeFur<8)transfer(s,b,'fur',s,'smokeFur',1,p,PADS.smoker);
  }
  if(s.built.smoker&&near(p,PADS.smoked)&&bagCount(p)<30)transfer(s,s,'crateStock',b,'crate',Math.min(2,30-bagCount(p)),PADS.smoked,p);
}
function objectives(s){
  if(s.mission>=MISSIONS.length)return;
  const goal=MISSIONS[s.mission];
  if(goal.value(s)<goal.target)return;
  s.mission++;event(s,'milestone',{title:goal.title,mission:s.mission,x:s.player.x,y:s.player.y});
  if(s.mission===MISSIONS.length&&!s.completed){s.finale={time:0,x:3.6,y:20.8};event(s,'launch');}
  s.checkpoint=saveSnowfront(s);
}
export function tickSnowfront(s,dt,input={x:0,y:0}){
  if(!Number.isFinite(dt)||dt<=0||s.status!=='playing')return;
  dt=Math.min(dt,.05);s.time+=dt;
  const p=s.player,amount=Math.min(1,Math.hypot(input.x,input.y));p.moving=false;
  if(amount>0){const length=Math.hypot(input.x,input.y);moveActor(s,p,{x:p.x+input.x/length,y:p.y+input.y/length},SNOWFRONT_SPEED*amount,dt);}
  collect(s,p);invest(s,dt);interaction(s,dt);production(s,dt);trading(s,dt);collector(s,dt);porter(s,dt);playerCombat(s,dt);enemyCombat(s,dt);
  s.spawnTimer+=dt;const raw=s.drops.filter(d=>d.type==='raw').reduce((n,d)=>n+d.amount,0);
  if(s.enemies.length<(s.built.east?19:14)&&raw<36&&s.spawnTimer>1.5){s.spawnTimer=0;spawnEnemy(s);}
  s.turretTimer+=dt;
  if(s.built.hunter&&s.turretTimer>1.1){const e=s.enemies.filter(e=>distance(e,{x:-13,y:0})<13).sort((a,b)=>a.hp-b.hp)[0];if(e){s.turretTimer=0;e.hp-=6;event(s,'bolt',{from:{x:-13,y:2},to:{x:e.x,y:e.y}});if(e.hp<=0)killEnemy(s,e,'hunter');}}
  s.gate+=(Number(distance(p,{x:0,y:0})<2.4)-s.gate)*Math.min(1,dt*12);
  s.serviceGate+=(Number(s.built.collector&&distance(s.worker,{x:-5,y:0})<2)-s.serviceGate)*Math.min(1,dt*12);
  objectives(s);
  if(p.hp<=0){s.status='lost';event(s,'failure');}
  if(s.finale){s.finale.time+=dt;s.finale.x-=dt*4;if(s.finale.time>7){s.finale=null;s.completed=true;s.status='won';event(s,'victory');}}
}
export function saveSnowfront(s){
  return JSON.stringify({version:1,seed:s.seed,weapon:s.weapon,mission:s.mission,completed:s.completed,freeplay:s.freeplay,built:s.built,paid:s.paid,
    player:{x:s.player.x,y:s.player.y,hp:s.player.hp,bag:s.player.bag,cash:s.player.cash},
    ...Object.fromEntries(['rawStock','roastStock','marketStock','cashStock','smokeRaw','smokeFur','crateStock','sold','gathered','kills','wolfKills','crafted','delivered'].map(k=>[k,s[k]]))});
}
export function restoreSnowfront(raw){
  let data;try{data=JSON.parse(raw);if(data?.version!==1||!data.player||!data.built) return null;}catch{return null;}
  const numeric=['weapon','mission','rawStock','roastStock','marketStock','cashStock','smokeRaw','smokeFur','crateStock','sold','gathered','kills','wolfKills','crafted','delivered'];
  if(!numeric.every(k=>Number.isFinite(data[k])&&data[k]>=0)||!Number.isFinite(data.player.cash)||data.player.cash<0)return null;
  if(!['raw','roast','fur','crate'].every(k=>Number.isFinite(data.player.bag?.[k])&&data.player.bag[k]>=0))return null;
  const s=newSnowfront();for(const k of numeric)s[k]=Math.floor(data[k]);s.weapon=clamp(s.weapon,1,3);s.mission=clamp(s.mission,0,MISSIONS.length);
  for(const id of Object.keys(BUILD_COST))s.built[id]=data.built[id]===true;
  s.paid={};for(const id of ['weapon',...Object.keys(BUILD_COST)])if(Number.isFinite(data.paid?.[id]))s.paid[id]=clamp(Math.floor(data.paid[id]),0,investmentCost(s,id)-1);
  s.player.bag={...data.player.bag};s.player.cash=Math.floor(data.player.cash);s.player.hp=clamp(Number.isFinite(data.player.hp)?data.player.hp:100,1,100);
  s.completed=data.completed===true&&s.delivered>=8&&s.mission===MISSIONS.length;s.freeplay=s.completed;
  if(s.mission===MISSIONS.length&&!s.completed)s.finale={time:0,x:3.6,y:20.8};
  s.checkpoint=saveSnowfront(s);return s;
}
export function retrySnowfront(s){const next=restoreSnowfront(s.checkpoint);if(!next)return newSnowfront();next.player.hp=100;next.status='playing';return next;}
