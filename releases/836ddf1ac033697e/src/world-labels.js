export function hudOverlaps(x,y,width=132,height=48){
  return [...document.querySelectorAll('.journey-top,.journey-bottom,.journey-context:not([hidden])')].some(e=>{const r=e.getBoundingClientRect();return x+width/2>r.left&&x-width/2<r.right&&y+height/2>r.top&&y-height/2<r.bottom;});
}
