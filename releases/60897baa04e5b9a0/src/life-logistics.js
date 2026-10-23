import {LIFE_PADS,LIFE_DEPOT,RECIPES,CONVEYOR_ROUTE} from './life-config.js';
import {insideRect,segmentBlocked} from './walkways.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const newLifeWorker=(x=LIFE_DEPOT.x,y=LIFE_DEPOT.y)=>({x,y,moving:false,facing:0,load:0,item:null,phase:'idle',timer:0,route:[],job:null});
export function lifeObstacles(s){
  const rects=Object.keys(s.machines).filter(id=>s.built[id]).map(id=>{const p=LIFE_PADS[id];return{left:p.x-1.6,right:p.x+1.6,top:p.y+.65,bottom:p.y+4.0};});
  if(s.built.line)rects.push({left:-11.1,right:-9.9,top:6.8,bottom:15});
  if(s.theme==='coast')for(const [left,right]of [[-16,-10.4],[-7.6,-4.4],[-1.6,1.6],[4.4,7.6],[10.4,16]])rects.push({left,right,top:-19,bottom:-4.4});
  return rects;
}
// Same visibility-graph approach and segment test as the original camp navigation.
export function lifeRoute(s,start,end){
  const obstacles=lifeObstacles(s),clear=(a,b)=>!obstacles.some(r=>segmentBlocked(a,b,r));
  if(obstacles.some(r=>insideRect(end,r)))return[];
  if(clear(start,end))return[{...end}];
  const nodes=[{x:start.x,y:start.y},{...end}];
  for(const r of obstacles)for(const x of [r.left-.04,r.right+.04])for(const y of [r.top-.04,r.bottom+.04])if(Math.abs(x)<15&&y> -18&&y<17&&!obstacles.some(o=>insideRect({x,y},o)))nodes.push({x,y});
  const cost=nodes.map(()=>Infinity),prev=[],seen=new Set();cost[0]=0;
  while(seen.size<nodes.length){let at=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(at<0||cost[i]<cost[at]))at=i;
    if(at<0||!Number.isFinite(cost[at]))break;
    if(at===1){const route=[];for(let i=1;i!==0;i=prev[i])route.unshift(nodes[i]);return route;}
    seen.add(at);for(let i=1;i<nodes.length;i++)if(!seen.has(i)&&clear(nodes[at],nodes[i])){const c=cost[at]+distance(nodes[at],nodes[i]);if(c<cost[i]){cost[i]=c;prev[i]=at;}}
  }return[];
}
function walk(s,w,target,dt){
  const key=`${target.x}:${target.y}:${JSON.stringify(s.built)}`;
  if(w.routeKey!==key){w.route=lifeRoute(s,w,target);w.routeKey=key;}
  const p=w.route[0];w.moving=false;if(!p)return distance(w,target)<.25;
  const d=distance(w,p),step=Math.min(d,5.6*dt);if(d>.001){w.x+=(p.x-w.x)/d*step;w.y+=(p.y-w.y)/d*step;w.facing=Math.atan2(p.y-w.y,p.x-w.x);w.moving=true;}if(d<=step+.04)w.route.shift();return distance(w,target)<.22;
}
const outputPad=id=>({x:LIFE_PADS[id].x+(LIFE_PADS[id].x<0?2.3:-2.3),y:LIFE_PADS[id].y});
function desiredRecipes(s,type=s.saleType,seen=new Set()){
  const r=RECIPES[type];if(!r||seen.has(type)||!s.built[r.facility])return[];seen.add(type);
  return [...Object.keys(r.input).flatMap(k=>desiredRecipes(s,k,seen)),r];
}
function carrierJob(s){
  const recipes=desiredRecipes(s);
  for(const r of [...recipes].reverse())for(const [item,n]of Object.entries(r.input)){
    if((s.machines[r.facility].input[item]||0)>=n*6)continue;
    if(item==='water')return{from:'well',to:r.facility,item,point:LIFE_PADS.water,target:LIFE_PADS[r.facility]};
    if(s.store[item]>0)return{from:'store',to:r.facility,item,point:LIFE_DEPOT,target:LIFE_PADS[r.facility]};
    const upstream=RECIPES[item]?.facility;if(upstream&&s.built[upstream]&&s.machines[upstream].stock>0&&!(s.built.line&&upstream==='processor'&&r.facility==='canner'))return{from:upstream,to:r.facility,item,point:outputPad(upstream),target:LIFE_PADS[r.facility]};
  }
  const sale=RECIPES[s.saleType]?.facility;
  if(sale&&s.built[sale]&&s.machines[sale].stock>0)return{from:sale,to:'market',item:s.saleType,point:outputPad(sale),target:{x:1.6,y:15.3}};
  if(!sale&&s.store[s.saleType]>0)return{from:'store',to:'market',item:s.saleType,point:LIFE_DEPOT,target:{x:1.6,y:15.3}};
  return null;
}
export function tickLifeWorkers(s,dt,{emit,sell}){
  const f=s.fisher;f.moving=false;
  if(s.built.crew){
    if(f.phase==='idle'){f.phase='outbound';f.timer=0;}
    if(f.phase==='outbound'&&walk(s,f,{x:9,y:-10},dt)){f.phase='fishing';f.timer=0;f.facing=0;}
    if(f.phase==='fishing'){f.timer+=dt;if(f.timer>=(s.tool>=2?1.8:2.8)){f.load=s.tool>=2?8:6;f.item='fish';s.caught+=f.load;s.gathered.fish=(s.gathered.fish||0)+f.load;f.phase='returning';emit(s,'catch',{x:f.x,y:f.y,item:'fish',count:f.load});}}
    if(f.phase==='returning'&&walk(s,f,LIFE_DEPOT,dt)){s.store.fish=(s.store.fish||0)+f.load;f.load=0;f.item=null;f.phase=(s.store.fish||0)>=48?'waiting':'outbound';emit(s,'unload',{x:f.x,y:f.y});}
    if(f.phase==='waiting'&&(s.store.fish||0)<30)f.phase='outbound';
  }
  const h=s.harvester;h.moving=false;
  if(s.built.harvester){
    if(h.phase==='idle'){const wanted=new Set(RECIPES[s.saleType]?desiredRecipes(s).flatMap(r=>Object.keys(r.input).filter(k=>!RECIPES[k])):[s.saleType]),score=n=>Number(!wanted.has(n.type))*100+(s.store[n.type]||0)*2+distance(h,n);const node=s.nodes.filter(n=>n.stock>0&&(s.store[n.type]||0)<48).sort((a,b)=>score(a)-score(b))[0];if(node){h.job=node.id;h.phase='outbound';h.timer=0;}}
    const node=s.nodes.find(n=>n.id===h.job);
    if(h.phase==='outbound'&&node&&walk(s,h,{x:node.x+.9,y:node.y+.5},dt)){h.phase='harvest';h.timer=0;h.facing=Math.atan2(node.y-h.y,node.x-h.x);}
    if(h.phase==='harvest'&&node){h.timer+=dt;if(h.timer>=1.1){const n=Math.min(6,node.stock);node.stock-=n;h.load=n;h.item=node.type;s.gathered[node.type]=(s.gathered[node.type]||0)+n;if(!node.stock){node.growth=0;node.watered=false;}h.phase='returning';emit(s,'harvest',{x:node.x,y:node.y,item:node.type,count:n});}}
    if(h.phase==='returning'&&walk(s,h,LIFE_DEPOT,dt)){s.store[h.item]=(s.store[h.item]||0)+h.load;h.load=0;h.item=null;h.job=null;h.phase='idle';emit(s,'unload',{x:h.x,y:h.y});}
  }
  const w=s.worker;w.moving=false;if(!s.built.porter)return;
  if(!w.job){w.job=carrierJob(s);w.phase=w.job?'pickup':'idle';}
  const job=w.job;if(!job)return;
  if(w.phase==='pickup'&&walk(s,w,job.point,dt)){
    const amount=job.from==='well'?8:job.from==='store'?s.store[job.item]:s.machines[job.from].stock;
    w.load=Math.min(8,amount||0);w.item=job.item;if(job.from==='store')s.store[job.item]-=w.load;else if(job.from!=='well')s.machines[job.from].stock-=w.load;
    w.phase=w.load?'deliver':'idle';if(!w.load)w.job=null;
  }else if(w.phase==='deliver'&&walk(s,w,job.target,dt)){
    if(job.to==='market'){if(job.item===s.saleType)sell(s,job.item,w.load,{[job.item]:w.load});else s.store[job.item]=(s.store[job.item]||0)+w.load;}else{s.machines[job.to].input[job.item]=(s.machines[job.to].input[job.item]||0)+w.load;emit(s,'unload',{x:w.x,y:w.y});}
    w.load=0;w.item=null;w.job=null;w.phase='idle';
  }
}
export function conveyorPosition(t){
  const lengths=CONVEYOR_ROUTE.slice(1).map((p,i)=>distance(p,CONVEYOR_ROUTE[i])),total=lengths.reduce((a,b)=>a+b,0);let d=Math.max(0,Math.min(1,t))*total;
  for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const a=CONVEYOR_ROUTE[i],b=CONVEYOR_ROUTE[i+1],f=d/lengths[i];return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}d-=lengths[i];}
}
