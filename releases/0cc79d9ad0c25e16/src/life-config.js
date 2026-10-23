export const LIFE_ITEMS={fish:'魚',kelp:'海藻',salt:'塩',fillet:'切り身',dried:'干物',can:'缶詰',meal:'船旅の食事',grain:'麦',fruit:'果実',flour:'小麦粉',bread:'パン',jam:'ジャム',basket:'食事の籠',water:'水'};
export const ITEM_PRICE={fish:4,kelp:3,salt:3,fillet:12,dried:20,can:25,meal:55,grain:4,fruit:5,flour:12,bread:26,jam:22,basket:58};
export const RECIPES={
  fillet:{name:'魚をさばく',facility:'processor',input:{fish:2},output:'fillet',seconds:1.8},
  dried:{name:'干物',facility:'dryer',input:{fish:2,salt:1},output:'dried',seconds:2.6},
  can:{name:'海藻入り缶詰',facility:'canner',input:{fillet:1,kelp:1},output:'can',seconds:2.4},
  meal:{name:'船旅の食事',facility:'kitchen',input:{dried:1,can:1},output:'meal',seconds:2.4},
  flour:{name:'製粉',facility:'mill',input:{grain:2},output:'flour',seconds:2},
  bread:{name:'焼きたてのパン',facility:'bakery',input:{flour:1,water:1},output:'bread',seconds:2.8},
  jam:{name:'果実のジャム',facility:'preserve',input:{fruit:2,water:1},output:'jam',seconds:2.4},
  basket:{name:'食事の籠',facility:'packing',input:{bread:1,jam:1},output:'basket',seconds:2.6}
};
export const FACILITY_NAMES={processor:'魚の下ごしらえ台',dryer:'干物工房',canner:'缶詰工房',kitchen:'旅の食事工房',mill:'水車の製粉所',bakery:'石窯パン工房',preserve:'ジャム工房',packing:'食事の籠工房',tool:'道具の改良',porter:'運搬係',crew:'漁船と漁師',line:'搬送ライン',irrigation:'灌漑水路',harvester:'収穫の仲間',ship:'旅立ちの船',community:'村の集会所'};
export const LIFE_PADS={
  processor:{x:-7,y:5},dryer:{x:7,y:5},canner:{x:-7,y:12},kitchen:{x:7,y:12},
  mill:{x:-7,y:5},bakery:{x:7,y:5},preserve:{x:-7,y:12},packing:{x:7,y:12},
  market:{x:0,y:15.3},water:{x:0,y:-1.5},tool:{x:-12,y:2},porter:{x:12,y:9},crew:{x:12,y:3},line:{x:0,y:8},irrigation:{x:12,y:2},harvester:{x:12,y:9},ship:{x:-12,y:15},community:{x:0,y:10}
};
const goal=(title,metric,target,point,extra={})=>({title,metric,target,point,...extra});
export const LIFE_STAGES={
  harbor:{theme:'coast',cash:24,resources:['fish'],built:[],plots:{processor:36},sell:'fish',goals:[goal('桟橋で魚を8匹釣る','caught',8,'fish'),goal('魚を6匹、市場へ届ける','sold.fish',6,'market'),goal('区画Aを建てる','built.processor',1,'processor'),goal('切り身を4皿作る','crafted.fillet',4,'processor'),goal('切り身4皿を町へ届ける','sold.fillet',4,'market')]},
  market:{theme:'coast',cash:24,resources:['fish'],built:['processor'],plots:{tool:48,porter:60},sell:'fillet',goals:[goal('切り身を8皿作る','crafted.fillet',8,'processor'),goal('竿を改良する','built.tool',1,'tool'),goal('切り身8皿を販売する','sold.fillet',8,'market'),goal('区画Bへ投資して仲間を迎える','built.porter',1,'porter')]},
  saltbay:{theme:'coast',cash:36,resources:['fish','salt'],built:[],plots:{dryer:48,crew:72},sell:'fish',goals:[goal('海辺で塩を6つ集める','gathered.salt',6,'salt'),goal('区画Aを建てる','built.dryer',1,'dryer'),goal('魚と塩で干物を6枚作る','crafted.dried',6,'dryer'),goal('干物6枚を内陸へ出荷','sold.dried',6,'market'),goal('区画Bで漁の仕事を任せる','built.crew',1,'crew')]},
  cannery:{theme:'coast',cash:48,resources:['fish','kelp'],built:['processor'],plots:{canner:60,line:60,porter:72},sell:'fillet',goals:[goal('海藻を6つ回収する','gathered.kelp',6,'kelp'),goal('区画Aを建てる','built.canner',1,'canner'),goal('缶詰を6個作る','crafted.can',6,'canner'),goal('区画Bへ投資して搬送をつなぐ','built.line',1,'line'),goal('缶詰8個を出荷する','sold.can',8,'market')]},
  voyage:{theme:'coast',cash:48,resources:['fish','salt','kelp'],built:['processor','dryer','canner'],plots:{kitchen:60,ship:120,crew:72,porter:72,line:60},sell:'dried',goals:[goal('区画Aに旅の工房を建てる','built.kitchen',1,'kitchen'),goal('船を修理する','built.ship',1,'ship'),goal('干物と缶詰で食事を6箱作る','crafted.meal',6,'kitchen'),goal('旅の食事6箱を船へ積む','sold.meal',6,'market')]},
  riverside:{theme:'farm',cash:24,resources:['grain'],built:[],plots:{irrigation:48},sell:'grain',goals:[goal('4つの畑に水を届ける','watered',4,'grain'),goal('麦を12束収穫する','gathered.grain',12,'grain'),goal('麦を8束、村へ届ける','sold.grain',8,'market'),goal('区画Aに水路を整える','built.irrigation',1,'irrigation')]},
  orchard:{theme:'farm',cash:36,resources:['fruit'],built:[],plots:{preserve:48,harvester:72},sell:'fruit',goals:[goal('果樹に水を届け果実12個を収穫','gathered.fruit',12,'fruit'),goal('区画Aを建てる','built.preserve',1,'preserve'),goal('果実と水でジャム6瓶を作る','crafted.jam',6,'preserve'),goal('ジャム6瓶を販売','sold.jam',6,'market'),goal('区画Bで収穫を仲間に任せる','built.harvester',1,'harvester')]},
  watermill:{theme:'farm',cash:36,resources:['grain'],built:[],plots:{mill:60,bakery:60,irrigation:48},sell:'grain',goals:[goal('区画Aの水車を修復','built.mill',1,'mill'),goal('麦を小麦粉8袋にする','crafted.flour',8,'mill'),goal('区画Bに火を入れる','built.bakery',1,'bakery'),goal('パンを6個焼く','crafted.bread',6,'bakery'),goal('焼きたて6個を食卓へ','sold.bread',6,'market')]},
  bakery:{theme:'farm',cash:48,resources:['grain','fruit'],built:['mill','bakery','preserve'],plots:{packing:72,porter:72,irrigation:48,harvester:72},sell:'bread',goals:[goal('パンを4個焼く','crafted.bread',4,'bakery'),goal('ジャムを4瓶作る','crafted.jam',4,'preserve'),goal('区画Aを建てる','built.packing',1,'packing'),goal('区画Bで配達を任せる','built.porter',1,'porter'),goal('食事の籠を6つ町へ届ける','sold.basket',6,'market')]},
  homecoming:{theme:'farm',cash:48,resources:['grain','fruit'],built:['mill','bakery','preserve','packing'],plots:{community:120,irrigation:48,harvester:72,porter:72},sell:'basket',goals:[goal('村の集会所を建てる','built.community',1,'community'),goal('収穫祭のパン4個を届ける','sold.bread',4,'market'),goal('収穫祭のジャム4瓶を届ける','sold.jam',4,'market'),goal('仲間の食事の籠を4つ届ける','sold.basket',4,'market')]}
};
export function facilityOrder(stage){return [...new Set([...stage.built,...Object.keys(stage.plots)])];}
export function plotLetter(config,id){return String.fromCharCode(65+Object.keys(config.plots).indexOf(id));}
