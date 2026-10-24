import * as T from './vendor/three.module.js';

export const PAD_SIZE={input:[3.1,1.5],output:[1.4,1.5],investment:[3.1,1.5],market:[4.4,1.65]};
export function insidePad(player,point,kind='input'){
  const [width,depth]=PAD_SIZE[kind];return Math.abs(player.x-point.x)<width/2&&Math.abs(player.y-point.y)<depth/2;
}
export function interactionPad(kind='input',color=0xffffff){
  const [w,d]=PAD_SIZE[kind],border=.055,shape=new T.Shape();
  shape.moveTo(-w/2,-d/2);shape.lineTo(w/2,-d/2);shape.lineTo(w/2,d/2);shape.lineTo(-w/2,d/2);shape.closePath();
  const hole=new T.Path();hole.moveTo(-w/2+border,-d/2+border);hole.lineTo(-w/2+border,d/2-border);hole.lineTo(w/2-border,d/2-border);hole.lineTo(w/2-border,-d/2+border);hole.closePath();shape.holes.push(hole);
  const group=new T.Group(),line=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));line.rotation.x=-Math.PI/2;
  const fill=new T.Mesh(new T.PlaneGeometry(w-border*2,d-border*2),new T.MeshBasicMaterial({color,transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;fill.position.y=-.002;
  group.add(fill,line);group.userData.padKind=kind;group.userData.size=[w,d];group.userData.outlineParameters={visible:false};group.traverse(n=>{n.userData.outlineParameters={visible:false};});return group;
}
