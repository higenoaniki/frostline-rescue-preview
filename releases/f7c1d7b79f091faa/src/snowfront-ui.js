import {PADS} from './snowfront-state.js';
export function facilityContext(s){
  const p=s.player,near=Object.entries(PADS).filter(([id,a])=>!['weapon','east','west','collector','hunter','porter'].includes(id)&&Math.hypot(a.x-p.x,a.y-p.y)<1.7).sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].y-p.y)-Math.hypot(b[1].x-p.x,b[1].y-p.y))[0]?.[0];
  if(near==='sale'||near==='cash')return{title:'交易所',detail:`焼肉 1食 = 6　販売待ち ${s.marketStock}食`,stock:`売上 ${s.cashStock} / 荷箱 ${s.delivered}/8`};
  if(near==='raw')return{title:'肉加工',detail:`生肉 ${s.rawStock} → 焼肉 ${s.roastStock}`,stock:s.rawStock?'調理中':'生肉の在庫なし'};
  if(near==='roast')return{title:'焼肉回収',detail:`焼き上がり ${s.roastStock}食`,stock:`調理待ち ${s.rawStock}個`};
  if(s.built.smoker&&near==='smoker')return{title:'燻製工房',detail:'焼肉 3 + 毛皮 1 → 荷箱 1',stock:`在庫 焼肉 ${s.smokeRaw} / 毛皮 ${s.smokeFur}`};
  if(s.built.smoker&&near==='smoked')return{title:'荷箱回収',detail:`完成した荷箱 ${s.crateStock}`,stock:`納品済み ${s.delivered}/8`};
  return null;
}
