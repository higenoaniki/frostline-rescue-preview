import {CHAPTERS,completedChapters} from './chapters.js';

export const PROGRESS_KEY='frostline-journey-v2';
export const JOURNEYS=[
  {id:'winter',number:1,title:'雪を越えて',theme:'winter',subtitle:'生き延びるための灯りを、妹のもとへ。',outfit:'防寒パーカ',color:'#4d8fbc'},
  {id:'coast',number:2,title:'潮風の港町',theme:'coast',subtitle:'海の恵みを仕事にして、新しい暮らしを始めよう。',outfit:'マリンシャツと作業用オーバーオール',color:'#218e91'},
  {id:'farm',number:3,title:'陽だまりの農園',theme:'farm',subtitle:'食料をつくる街から、みんなが暮らす故郷へ。',outfit:'麦わら帽子と農園エプロン',color:'#5d914f'}
];
const later=[
  ['harbor','潮風の桟橋','初めての釣りと加工','北岬を出た船は、陽の当たる小さな港に着いた。漁師ナギが貸してくれた竿で、ユイとアオは暮らしの最初の仕事を始める。','初めて自分たちの力で稼いだ。アオが笑う。「今日は、温かいお魚が食べられるね」。明日は町の魚市場へ。'],
  ['market','魚市場の朝','釣りの効率化と仲間の雇用','市場を任されたユイ。魚を切り身にして売り、竿と運搬の仲間に投資しよう。雪原の仲間も少しずつ港へ到着している。','市場に賑わいが戻った。遠くの村にも魚を届けたい。でも、新鮮な魚のままでは長い旅に耐えられない。'],
  ['saltbay','潮だまりの保存食','塩と魚の組み合わせ','海辺の塩田には、保存に使える塩がある。魚と塩を合わせた干物なら、内陸まで届けられる。ナギと保存食の工房を開こう。','干物の荷が内陸へ届いた。丘の村から果物と、次の注文が返ってきた。仕事は、一人では追いつかなくなっている。'],
  ['cannery','入り江の加工場','海藻・缶詰・搬送の自動化','入り江には海藻の群生地がある。切り身と海藻で缶詰を作り、運搬路を整えよう。どこを自動化するかが生産の流れを変える。','加工場が動き、港には安定した収入が生まれた。丘の村は水車が止まり、畑を再開できないという。助けに行く準備をしよう。'],
  ['voyage','旅立ちの船','複数の加工品で遠征準備','港を離れるのは、暮らしを失うためではない。干物と缶詰を旅の食事にまとめ、船を直す。ユイたちは丘の村へ、今度は支える側として向かう。','船いっぱいの食料と仲間を乗せて、川を上る。アオは言う。「今度は、帰れる家をつくりたいね」。港の灯りが背中を見送った。'],
  ['riverside','川辺の畑','水やりと灌漑','丘の村には、雪国を逃れた人々が暮らしていた。まず川の水を畑へ。ユイは鍬に持ち替え、食べ物が育つ場所をつくり始める。','最初の麦が実った。水路ができた畑は、ユイが留守でも育つ。丘の向こうには、手入れを待つ果樹園がある。'],
  ['orchard','果樹の丘','果実とジャムの仕事','果樹園のミオが、冬を越した木を案内してくれた。水を与え、果実を収穫し、ジャムへ。収穫と加工を仲間で分け合おう。','瓶に詰めたジャムが村の楽しみになった。けれど食卓には、まだ主食が足りない。川沿いの水車を動かそう。'],
  ['watermill','川を回す水車','製粉とパン作り','港から来た整備士ハルが水車の修理に加わる。麦を粉に、水と粉をパンに。素材を売るか、次の加工に残すかを選びながら工房を育てよう。','焼きたてのパンの香りが村に広がった。食べられるだけでなく、誰かと楽しめる食卓が生まれた。'],
  ['bakery','パンと果実の市場','二つの生産ラインと配達','パン屋とジャム工房をつなぎ、食事の籠を町へ届けよう。畑、粉、パン、果物。流れのどこを任せるかで、ユイの仕事も変わっていく。','食事の籠が港へ届き、港の魚が丘へ届く。助け合う二つの街を、一本の道がつないだ。最後は、みんなが集まれる場所を。'],
  ['homecoming','みんなの食卓','街づくりと収穫祭','家族と仲間のために、村の集会所を建てよう。パンとジャム、食事の籠を用意して、雪国から始まった旅の仲間を収穫祭へ迎える。','「おかえり、わたしたちの街へ」。ユイとアオの隣には、雪原・港・農園で出会った仲間たちがいる。生き延びる旅は、豊かな暮らしを育てる毎日へと変わった。']
];
export const STAGES=[
  ...CHAPTERS.map((s,i)=>({...s,journey:'winter',chapter:1,local:i+1,theme:'winter',engine:s.id==='camp'?'camp':s.id==='snowfront'?'snowfront':'story'})),
  ...later.map(([id,title,difficulty,story,ending],i)=>({id,title,difficulty,story,ending,number:String(i+6).padStart(2,'0'),journey:i<5?'coast':'farm',chapter:i<5?2:3,local:i%5+1,theme:i<5?'coast':'farm',subtitle:difficulty,symbol:i<5?'fish':'sprout',engine:'life'}))
].map((s,i,all)=>({...s,index:i,next:all[i+1]?.id??null}));
export const stageFor=id=>STAGES.find(s=>s.id===id)??STAGES[0];
export const journeyFor=id=>JOURNEYS.find(c=>c.id===id||c.number===id)??JOURNEYS[0];
export const nextStageId=id=>stageFor(id).next;
export function completedStages(storage){
  let saved=[];try{const v=JSON.parse(storage.getItem(PROGRESS_KEY));if(v?.version===2&&Array.isArray(v.completed))saved=v.completed;}catch{}
  return [...new Set([...completedChapters(storage),...saved])].filter(id=>STAGES.some(s=>s.id===id));
}
export function completeStage(storage,id){
  if(!STAGES.some(s=>s.id===id))return false;
  try{storage.setItem(PROGRESS_KEY,JSON.stringify({version:2,completed:[...new Set([...completedStages(storage),id])],lastStage:id}));return true;}catch{return false;}
}
export function stageUnlocked(storage,id){
  const stage=STAGES.find(s=>s.id===id);if(!stage)return false;
  const done=completedStages(storage),highest=Math.max(-1,...done.map(id=>stageFor(id).index));
  return stage.index<=highest+1||hasStageSave(storage,id);
}
export function stageSaveKey(id){return id==='camp'?'frostline-camp-v1':id==='snowfront'?'frostline-snowfront-v1':stageFor(id).engine==='life'?`frostline-life-${id}-v1`:`frostline-story-${id}-v1`;}
export function hasStageSave(storage,id){try{return !!storage.getItem(stageSaveKey(id));}catch{return false;}}
export function suggestedStage(storage){
  const done=completedStages(storage);return STAGES.find(s=>!done.includes(s.id)&&stageUnlocked(storage,s.id))??STAGES.at(-1);
}
export const TRANSFER_POLICY='現地の荷物・設備・強化はこの場所に残ります。次のステージは新しい支給品で開始。クリア記録・衣装・通信記録は残ります。';
