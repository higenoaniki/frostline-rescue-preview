const sample=(name,gain=.3,cooldown=.25)=>({files:[name],gain,cooldown,priority:1});
export function lifeAudio(theme){
  return{musicUrl:new URL(`../assets/audio/${theme==='coast'?'harbor-morning':'orchard-afternoon'}.mp3`,import.meta.url).href,cues:{
    stepStone:sample(theme==='coast'?'crate-wood':'basket-rustle',.10,.24),
    pickup:sample(theme==='coast'?'net-rustle':'basket-rustle',.28,.2),
    cast:sample('rod-cast',.36,.8),catch:sample('water-catch',.4,.8),harvest:sample('crop-cut',.33,.35),water:sample('watering-can',.3,.5),
    deposit:sample(theme==='coast'?'crate-wood':'basket-rustle',.27,.3),unload:sample('crate-wood',.3,.6)
  }};
}
