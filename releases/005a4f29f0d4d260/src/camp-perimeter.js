export function campPerimeter({min=-8,max=8,serviceGate=true,tradeOpening=true}={}){
  const pickets=[],gates=[{x:0,width:3,service:false}];
  if(serviceGate)gates.push({x:-5,width:1.3,service:true});
  const steps=Math.ceil((max-min)/.34);
  for(let i=0;i<=steps;i++){
    const x=min+(max-min)*i/steps;
    if(!gates.some(g=>Math.abs(x-g.x)<g.width/2))pickets.push({x,y:0});
    if(!tradeOpening||x<1.7||x>5.5)pickets.push({x,y:17});
  }
  for(let y=.34;y<17;y+=.34)pickets.push({x:min,y},{x:max,y});
  return{min,max,pickets,gates};
}
