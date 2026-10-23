import {PLAYER_WORLD_SPEED} from './player-movement.js';
import {LIFE_STAGES,LIFE_PADS,LIFE_DEPOT,RECIPES,ITEM_PRICE,LIFE_ITEMS,facilityOrder} from './life-config.js';
import {newLifeWorker,tickLifeWorkers} from './life-logistics.js';

export const LIFE_CAPACITY=36,WATER_CAPACITY=8;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),near=(a,b,r=1.25)=>dist(a,b)<r;
export const lifeCargo=s=>Object.entries(s.player.bag).reduce((n,[k,v])=>n+(k==='water'?0:v),0);
export const lifeValue=(s,key)=>key.split('.').reduce((v,k)=>v?.[k],s)??0;
export function lifeGoals(s){return LIFE_STAGES[s.stage].goals.map(g=>({...g,value:Math.min(g.target,Number(lifeValue(s,g.metric)))}));}
const emit=(s,type,data={})=>{s.events.push({type,...data});if(s.events.length>96)s.events.shift();};
function nodeSet(config){
  if(config.theme==='coast')return config.resources.flatMap(type=>type==='fish'?[-9,-3,3,9].map((x,i)=>({id:`fish-${i}`,type,x,y:-9-(i%2)*3,stock:99,time:0,growth:1})):Array.from({length:3},(_,i)=>({id:`${type}-${i}`,type,x:type==='salt'?12:-12,y:-1-i*2.2,stock:6,time:0,growth:1})));
  return config.resources.flatMap(type=>Array.from({length:4},(_,i)=>({id:`${type}-${i}`,type,x:type==='grain'?-7:7,y:-6-i*3.3,stock:0,time:0,growth:0,watered:false})));
}
export function newLife(stage,previous=null){
  const c=LIFE_STAGES[stage];if(!c)throw Error('Unknown life stage');
  const s={version:1,design:2,stage,theme:c.theme,status:'playing',completed:false,mission:0,time:0,tool:c.built.includes('tool')?2:1,
    player:{x:0,y:2,hp:100,energy:100,facing:-Math.PI/2,moving:false,motion:null,bag:Object.fromEntries(Object.keys(LIFE_ITEMS).map(k=>[k,0])),cash:c.cash},
    built:Object.fromEntries(facilityOrder(c).map(k=>[k,c.built.includes(k)])),paid:{},blockedPad:null,investment:null,
    nodes:nodeSet(c),machines:{},caught:0,watered:0,gathered:Object.fromEntries(c.resources.map(k=>[k,0])),crafted:{},sold:{},saleType:c.sell,autoSale:true,automationEnabled:true,
    work:null,actionTime:0,transferTimer:0,automationTimer:0,worker:newLifeWorker(12,9),fisher:newLifeWorker(),harvester:newLifeWorker(),conveyor:[],investmentActive:null,store:{},boat:{time:0,phase:'docked'},events:[],checkpoint:null};
  for(const r of Object.values(RECIPES))if(facilityOrder(c).includes(r.facility))s.machines[r.facility]={input:{},stock:0,time:0,recipe:r.output};
  if(previous?.theme===s.theme)inheritLife(s,previous,true);
  s.checkpoint=saveLife(s,false);return s;
}
export function inheritLife(s,previous,cargo=false){
  if(previous?.theme!==s.theme)return s;
  for(const id of Object.keys(s.built))if(previous.built[id])s.built[id]=true;
  for(const[id,n]of Object.entries(previous.paid||{}))if(id in LIFE_STAGES[s.stage].plots)s.paid[id]=Math.max(s.paid[id]||0,n);
  s.tool=Math.max(s.tool,previous.tool||1,s.built.tool?2:1);
  if(cargo){s.player.cash=previous.player.cash;s.player.bag={...s.player.bag,...previous.player.bag};s.player.energy=previous.player.energy;s.store={...previous.store};for(const id of Object.keys(s.machines))if(previous.machines[id])s.machines[id]=JSON.parse(JSON.stringify(previous.machines[id]));for(const id of ['worker','fisher','harvester','conveyor'])s[id]=JSON.parse(JSON.stringify(previous[id]));for(const n of s.nodes){const old=previous.nodes.find(o=>o.id===n.id);if(old)Object.assign(n,{stock:old.stock,time:old.time,growth:old.growth,watered:old.watered});}}
  return s;
}
export function loadLifeStage(storage,stage,{restart=false}={}){
  const read=id=>restoreLife(storage.getItem(`frostline-life-${id}-v2`),id)??restoreLife(storage.getItem(`frostline-life-${id}-v1`),id);
  let own=null,previous=null;try{if(!restart)own=read(stage);const stages=Object.keys(LIFE_STAGES),index=stages.indexOf(stage);for(let i=index-1;i>=0&&LIFE_STAGES[stages[i]].theme===LIFE_STAGES[stage].theme;i--){const p=read(stages[i]);if(p?.completed){previous=p;break;}}}catch{}
  return own?inheritLife(own,previous):newLife(stage,previous);
}
export function startLifeInvestment(s,id){if(!s.built[id]&&LIFE_STAGES[s.stage].plots[id]&&near(s.player,LIFE_PADS[id],1.6)&&s.player.cash>0){s.investmentActive=id;return true;}return false;}
export function validLifePosition(s,p){
  if(Math.abs(p.x)>15||p.y>17||p.y< -18)return false;
  if(s.theme==='coast'&&p.y< -4.4&&![-9,-3,3,9].some(x=>Math.abs(p.x-x)<1.45))return false;
  if(s.built.line&&p.x> -11.1&&p.x< -9.9&&p.y>6.8&&p.y<15)return false;
  return !Object.entries(s.built).some(([id,built])=>built&&s.machines[id]&&dist(p,{x:LIFE_PADS[id].x,y:LIFE_PADS[id].y+2.3})<1.45);
}
export function moveLife(s,p,target,speed,dt){
  const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);p.moving=d>.06;if(!p.moving)return true;p.facing=Math.atan2(dy,dx);
  const step=Math.min(d,speed*dt),next={x:p.x+dx/d*step,y:p.y+dy/d*step};
  if(validLifePosition(s,next)){p.x=next.x;p.y=next.y;}else{if(validLifePosition(s,{x:next.x,y:p.y}))p.x=next.x;if(validLifePosition(s,{x:p.x,y:next.y}))p.y=next.y;}
  return d<.2;
}
export function investLife(s,id,dt){
  const cost=LIFE_STAGES[s.stage].plots[id];if(!cost||s.built[id]||s.blockedPad===id)return false;
  const n=Math.min(cost-(s.paid[id]||0),s.player.cash,Math.max(1,Math.ceil(360*dt)));if(n>0){s.player.cash-=n;s.paid[id]=(s.paid[id]||0)+n;emit(s,'pay',{id,item:'cash',count:n,from:{...s.player},to:LIFE_PADS[id]});}
  if((s.paid[id]||0)<cost)return false;
  s.built[id]=true;s.blockedPad=id;s.investmentActive=null;if(id==='tool')s.tool=2;emit(s,'build',{id,...LIFE_PADS[id]});return true;
}
function collect(s,key,n){const free=key==='water'?WATER_CAPACITY-s.player.bag.water:LIFE_CAPACITY-lifeCargo(s);n=Math.max(0,Math.min(n,free));if(n)s.player.bag[key]+=n;return n;}
function gather(s,dt){
  const p=s.player,c=LIFE_STAGES[s.stage];
  if(s.theme==='farm'&&near(p,LIFE_PADS.water,1.6)){const n=collect(s,'water',8);if(n)emit(s,'pickup',{item:'water',count:n,x:p.x,y:p.y});}
  const node=s.nodes.filter(n=>near(p,n,n.type==='fish'?1.5:1.65)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(!node||p.moving){s.work=null;s.actionTime=0;p.motion=null;return;}
  if(c.theme==='farm'&&!node.watered&&node.stock===0){
    if(p.bag.water>0){p.bag.water--;node.watered=true;node.growth=0;s.watered++;emit(s,'water',{x:node.x,y:node.y});}
    s.work={type:'water',node:node.id};return;
  }
  if(!node.stock){s.work={type:'growing',node:node.id};return;}
  if(lifeCargo(s)>=LIFE_CAPACITY){s.work={type:'full',node:node.id};return;}
  s.work={type:node.type==='fish'?'fishing':'harvest',node:node.id};s.actionTime+=dt;
  p.facing=node.type==='fish'?0:Math.atan2(node.y-p.y,node.x-p.x);p.motion={time:s.actionTime% .9,duration:.9,angle:p.facing};
  if(s.actionTime>=(node.type==='fish'?(s.tool===2?.8:1.25):.55)*(p.energy<20?1.25:1)){
    s.actionTime=0;const n=collect(s,node.type,node.type==='fish'?2:3);s.gathered[node.type]=(s.gathered[node.type]||0)+n;if(node.type==='fish')s.caught+=n;
    if(node.type!=='fish'){node.stock-=n;if(node.stock<=0){node.stock=0;node.time=0;if(c.theme==='farm'){node.watered=false;node.growth=0;}}}
    p.energy=Math.max(0,p.energy-(node.type==='fish'?2:3));emit(s,node.type==='fish'?'catch':'harvest',{item:node.type,count:n,x:node.x,y:node.y});emit(s,'pickup',{item:node.type,count:n,x:node.x,y:node.y});
  }
}
function resourceGrowth(s,dt){
  for(const n of s.nodes){if(n.type==='fish'||n.stock>0)continue;
    if(s.theme==='farm'){if(s.built.irrigation&&!n.watered){n.watered=true;s.watered++;}if(n.watered){n.growth=Math.min(1,n.growth+dt/(n.type==='grain'?5:6));if(n.growth===1)n.stock=6;}}
    else{n.time+=dt;if(n.time>6){n.stock=6;n.time=0;}}
  }
}
export function sellLife(s,type,count=2,source=s.player.bag){
  if(!ITEM_PRICE[type]||!(source[type]>0))return 0;
  const n=Math.min(source[type],count);source[type]-=n;s.sold[type]=(s.sold[type]||0)+n;s.player.cash+=n*ITEM_PRICE[type];emit(s,'sell',{item:type,count:n,x:LIFE_PADS.market.x,y:LIFE_PADS.market.y});return n;
}
function recipeFor(id){return Object.values(RECIPES).find(r=>r.facility===id);}
export function lifeOutputPad(id){return{x:LIFE_PADS[id].x+(LIFE_PADS[id].x<0?2.3:-2.3),y:LIFE_PADS[id].y};}
function transfer(s,from,key,to,n,fromPoint,toPoint){n=Math.max(0,Math.min(from[key]||0,n));if(!n)return;from[key]-=n;to[key]=(to[key]||0)+n;emit(s,'transfer',{item:key,count:n,from:fromPoint,to:toPoint});}
function industry(s,dt){
  s.transferTimer+=dt;const pulse=s.transferTimer>=.12;if(pulse)s.transferTimer=0;
  s.investment=Object.keys(LIFE_STAGES[s.stage].plots).find(id=>!s.built[id]&&near(s.player,LIFE_PADS[id],1.4))??null;
  if(s.investmentActive!==s.investment)s.investmentActive=null;
  if(s.blockedPad&&!near(s.player,LIFE_PADS[s.blockedPad],1.65))s.blockedPad=null;
  if(pulse&&!s.player.moving){
    if(s.investmentActive){investLife(s,s.investmentActive,.12);if(!s.player.cash)s.investmentActive=null;}
    if(near(s.player,LIFE_PADS.market,1.5))sellLife(s,s.saleType);
    if(near(s.player,LIFE_DEPOT,1.6))for(const key of Object.keys(s.store))transfer(s,s.store,key,s.player.bag,LIFE_CAPACITY-lifeCargo(s),LIFE_DEPOT,s.player);
  }
  for(const [id,m]of Object.entries(s.machines)){
    if(!s.built[id])continue;const recipe=recipeFor(id);
    if(pulse&&!s.player.moving&&near(s.player,LIFE_PADS[id],1.3))for(const key of Object.keys(recipe.input))transfer(s,s.player.bag,key,m.input,Math.max(0,96-(m.input[key]||0)),s.player,LIFE_PADS[id]);
    if(pulse&&near(s.player,lifeOutputPad(id),1.1)&&m.stock){const n=collect(s,recipe.output,Math.min(2,m.stock));m.stock-=n;if(n)emit(s,'pickup',{item:recipe.output,count:n,x:s.player.x,y:s.player.y});}
    if(Object.entries(recipe.input).every(([key,n])=>(m.input[key]||0)>=n)&&m.stock<16){m.time+=dt;if(m.time>=recipe.seconds){m.time=0;for(const [key,n]of Object.entries(recipe.input))m.input[key]-=n;m.stock++;s.crafted[recipe.output]=(s.crafted[recipe.output]||0)+1;emit(s,'cook',{x:LIFE_PADS[id].x,y:LIFE_PADS[id].y});}}
    else m.time=0;
  }
  for(const parcel of s.conveyor)parcel.progress+=dt/4.5;
  const arrived=s.conveyor.filter(p=>p.progress>=1);if(arrived.length&&s.machines.canner){s.machines.canner.input.fillet=(s.machines.canner.input.fillet||0)+arrived.length;s.conveyor=s.conveyor.filter(p=>p.progress<1);}
  if(s.built.line&&s.machines.processor?.stock&&s.built.canner&&(s.machines.canner.input.fillet||0)+s.conveyor.length<16&&pulse&&s.conveyor.length<6){s.machines.processor.stock--;s.conveyor.push({progress:0});}
}
function automation(s,dt){
  if(s.automationEnabled)tickLifeWorkers(s,dt,{emit,sell:sellLife});else for(const id of ['worker','fisher','harvester'])s[id].moving=false;
}
export function lifeTarget(s){
  const goal=lifeGoals(s)[s.mission];if(!goal)return['この街で暮らす',LIFE_PADS.market];
  if(goal.metric.startsWith('built.')){const id=goal.metric.split('.')[1],cost=LIFE_STAGES[s.stage].plots[id]-(s.paid[id]||0);if(s.player.cash<cost)return s.player.bag[s.saleType]?['市場で余剰を売って投資資金に',LIFE_PADS.market]:productionTarget(s,s.saleType);return[goal.title,LIFE_PADS[id]];}
  if(goal.metric.startsWith('sold.')){const type=goal.metric.split('.')[1];if(s.player.bag[type])return[goal.title,LIFE_PADS.market];return productionTarget(s,type);}
  if(goal.metric.startsWith('crafted.'))return productionTarget(s,goal.metric.split('.')[1]);
  if(goal.metric==='watered'&&!s.player.bag.water)return['川の井戸で水をくむ',LIFE_PADS.water];
  const node=s.nodes.find(n=>n.type===goal.point&&(s.theme==='coast'||n.stock>0||!n.watered));
  if(s.theme==='farm'&&node&&!node.watered&&!s.player.bag.water)return['井戸で水をくむ',LIFE_PADS.water];
  return[goal.title,node??s.nodes.find(n=>n.type===goal.point)??LIFE_PADS.market];
}
function productionTarget(s,type,seen=new Set()){
  if(seen.has(type))return['市場へ',LIFE_PADS.market];seen.add(type);
  if((s.store[type]||0)>0)return[`${LIFE_ITEMS[type]}を共同倉庫で回収`,LIFE_DEPOT];
  const r=RECIPES[type];if(!r){const node=s.nodes.filter(n=>n.type===type).sort((a,b)=>Number(b.stock>0)-Number(a.stock>0)||dist(s.player,a)-dist(s.player,b))[0];if(s.theme==='farm'&&node&&!node.stock&&!node.watered&&!s.player.bag.water)return['井戸で水をくむ',LIFE_PADS.water];return[type==='water'?'井戸で水をくむ':`${LIFE_ITEMS[type]}を集める`,type==='water'?LIFE_PADS.water:node??LIFE_PADS.market];}
  const m=s.machines[r.facility];if(!s.built[r.facility])return['加工の区画に投資',LIFE_PADS[r.facility]];
  if(m.stock)return[`${LIFE_ITEMS[type]}を回収`,lifeOutputPad(r.facility)];
  const missing=Object.entries(r.input).find(([k,n])=>(m.input[k]||0)<n&&s.player.bag[k]<n-(m.input[k]||0));
  if(missing)return productionTarget(s,missing[0],seen);
  return[`${LIFE_ITEMS[type]}の材料を投入`,LIFE_PADS[r.facility]];
}
export function tickLife(s,dt,input={x:0,y:0}){
  if(s.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.05,dt);s.time+=dt;
  const d=Math.hypot(input.x,input.y);s.player.moving=false;if(d>.05)moveLife(s,s.player,{x:s.player.x+input.x/d,y:s.player.y+input.y/d},PLAYER_WORLD_SPEED*Math.min(1,d),dt);
  const resting=near(s.player,LIFE_PADS.market,2)||near(s.player,LIFE_PADS.water,2);s.player.energy=Math.min(100,s.player.energy+dt*(resting?10:s.player.moving?.4:.9));
  resourceGrowth(s,dt);gather(s,dt);industry(s,dt);automation(s,dt);
  const goal=lifeGoals(s)[s.mission];
  if(goal&&goal.value>=goal.target){s.mission++;const next=lifeGoals(s)[s.mission];if(s.autoSale&&(next?.metric.startsWith('sold.')||next?.metric.startsWith('crafted.')))s.saleType=next.metric.split('.')[1];emit(s,'milestone',{title:goal.title});s.checkpoint=saveLife(s,false);}
  if(s.mission>=LIFE_STAGES[s.stage].goals.length&&!s.completed){s.completed=true;s.status='won';emit(s,'victory');s.checkpoint=saveLife(s,false);}
}
export function saveLife(s,checkpoint=true){const{events,checkpoint:point,...data}=s;return JSON.stringify({...data,investmentActive:null,player:{...s.player,motion:null,moving:false},...(checkpoint?{checkpoint:point}:{})});}
export function restoreLife(raw,stage){try{
  const d=JSON.parse(raw),c=LIFE_STAGES[stage];if(!c||d?.version!==1||d.stage!==stage||!d.player||!Array.isArray(d.nodes))return null;
  if(!['x','y','cash'].every(k=>Number.isFinite(d.player[k]))||d.player.cash<0||!Object.keys(LIFE_ITEMS).every(k=>Number.isFinite(d.player.bag?.[k])&&d.player.bag[k]>=0))return null;
  const s=newLife(stage),expectedNodes=s.nodes.map(n=>n.id),machineIds=Object.keys(s.machines);for(const key of Object.keys(s))if(!['version','stage','theme','events','built','nodes','machines','worker','fisher','harvester','design'].includes(key)&&d[key]!==undefined)s[key]=d[key];
  if(!d.built||Object.values(d.built).some(v=>typeof v!=='boolean')||!d.machines)return null;
  for(const id of Object.keys(s.built))s.built[id]=s.built[id]||d.built[id]===true;
  for(const id of machineIds)if(d.machines[id])s.machines[id]=d.machines[id];
  if(!d.nodes.every(n=>expectedNodes.includes(n.id)))return null;
  for(const n of s.nodes){const old=d.nodes.find(o=>o.id===n.id);if(old)Object.assign(n,{stock:old.stock,time:old.time,growth:old.growth,watered:old.watered===true});}
  for(const id of ['worker','fisher','harvester'])if(d.design===2&&d[id])s[id]=d[id];
  s.player.energy=Number.isFinite(s.player.energy)?Math.max(0,Math.min(100,s.player.energy)):100;
  if(d.design!==2&&s.paid)for(const[id,paid]of Object.entries(s.paid))if(Number.isFinite(paid)&&paid>=0&&id in c.plots&&paid>c.plots[id]){s.player.cash+=paid-c.plots[id];s.paid[id]=c.plots[id];s.built[id]=true;}
  s.tool=Math.max(s.tool,s.built.tool?2:1);s.investmentActive=null;s.investment=null;
  if(d.design!==2){s.player.x=0;s.player.y=2;s.conveyor=[];if(d.worker?.load>0&&LIFE_ITEMS[d.worker.item])s.store[d.worker.item]=(s.store[d.worker.item]||0)+d.worker.load;if(d.completed)for(const g of c.goals)if(g.metric.startsWith('built.'))s.built[g.metric.split('.')[1]]=true;s.mission=lifeGoals(s).findIndex(g=>g.value<g.target);if(s.mission<0)s.mission=c.goals.length;}
  if(!Number.isInteger(s.mission)||s.mission<0||s.mission>c.goals.length||!s.nodes.every(n=>c.resources.includes(n.type)&&[n.x,n.y,n.stock,n.time,n.growth].every(Number.isFinite)))return null;
  if(!Object.values(s.machines).every(m=>Number.isFinite(m.stock)&&m.stock>=0&&Number.isFinite(m.time)&&m.input&&Object.values(m.input).every(v=>Number.isFinite(v)&&v>=0)))return null;
  if(!s.built||!facilityOrder(c).every(id=>typeof s.built[id]==='boolean')||!s.paid||!Object.entries(s.paid).every(([k,v])=>k in c.plots&&Number.isFinite(v)&&v>=0&&v<=c.plots[k]))return null;
  if(!s.machines||Object.keys(s.machines).length!==machineIds.length||!machineIds.every(id=>s.machines[id]?.recipe===recipeFor(id).output)||!s.worker||![s.worker.x,s.worker.y].every(Number.isFinite)||![s.worker.load,s.time,s.caught,s.watered].every(v=>Number.isFinite(v)&&v>=0)||!['coast','farm'].includes(s.theme))return null;
  if(s.nodes.length!==expectedNodes.length||!expectedNodes.every(id=>s.nodes.some(n=>n.id===id))||![s.gathered,s.crafted,s.sold,s.store].every(x=>x&&Object.values(x).every(v=>Number.isFinite(v)&&v>=0)))return null;
  if(!Array.isArray(s.conveyor)||!s.conveyor.every(p=>Number.isFinite(p.progress)&&p.progress>=0&&p.progress<=1.1)||!['worker','fisher','harvester'].every(id=>[s[id].x,s[id].y,s[id].load,s[id].timer].every(Number.isFinite)))return null;
  s.completed=d.completed===true&&s.mission===c.goals.length&&lifeGoals(s).every(g=>g.value>=g.target);s.status='playing';s.player.motion=null;s.player.moving=false;s.events=[];s.checkpoint=typeof d.checkpoint==='string'?d.checkpoint:saveLife(s,false);return s;
}catch{return null;}}
export function retryLife(s){return restoreLife(s.checkpoint,s.stage)??newLife(s.stage);}
