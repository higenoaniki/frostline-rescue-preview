export const CHAPTERS = [
  {id:'camp',number:'01',title:'白樺の谷',subtitle:'最初の火を、絶やさない。',story:'大吹雪で北の集落との連絡が途絶えた。谷の補給基地を育て、峠へ送る越冬物資を揃えよう。',ending:'避難所に食料が届いた。しかし峠の橋が落ち、救助隊が立ち往生している。',next:'pass',symbol:'home',difficulty:'基礎 · 生産と自動化'},
  {id:'pass',number:'02',title:'白霧の峠',subtitle:'途切れた橋の向こうに、仲間がいる。',story:'谷から届いた食料を携え、倒木で橋を修復する。対岸の救助隊3人を連れ帰り、交易所への道を開こう。',ending:'3人の仲間と峠を越えた。次は旅人が集まる雪原に、補給の中継地を築こう。',next:'snowfront',symbol:'shield',difficulty:'初級 · 修復と救助'},
  {id:'snowfront',number:'03',title:'雪原交易路',subtitle:'救った仲間と、街道をつなぐ。',story:'峠を越えた仲間が交易所を開く。狩り、調理、交易をつなぎ、北の採掘隊へ燻製の荷箱を届けよう。',ending:'交易路が開き、採掘隊へ食料が届いた。灯台の修理には、高地の鉱石で作る補強材が必要だ。',next:'highland',symbol:'package',difficulty:'中級 · 交易と区画開拓'},
  {id:'highland',number:'04',title:'星灯りの高地',subtitle:'食料の道を、鋼の道へ。',story:'交易隊の食料で鉱山が再開した。木材と鉱石を補強材に加工する。鉱石を防具に回すか、灯台の補給に回すか。採掘の自動化も力になる。',ending:'灯台用の補強材8箱を積み込んだ。北極灯台の火を取り戻す、最後の遠征が始まる。',next:'beacon',symbol:'layers',difficulty:'上級 · 採掘と素材配分'},
  {id:'beacon',number:'05',title:'北極灯台',subtitle:'最後の灯りを、みんなのもとへ。',story:'補給隊と最後の雪原へ。3基の中継灯を修復し、氷冠獣の氷核を回収する。橇を守って灯台に辿り着けば、北の集落へ帰り道が灯る。',ending:'北極灯台、再点灯。谷・峠・交易所・鉱山がひとつの補給路でつながった。もう、この冬を独りでは越えない。',next:null,symbol:'trophy',difficulty:'最終章 · 修復と補給隊護衛'}
];
export const STORY_PROGRESS_KEY='frostline-story-progress-v1';
export const chapterFor=id=>CHAPTERS.find(c=>c.id===id)??CHAPTERS[0];
export const storySaveKey=id=>`frostline-story-${id}-v1`;
function storedJSON(storage,key){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
export function completedChapters(storage){
    const stored=storedJSON(storage,STORY_PROGRESS_KEY),ids=Array.isArray(stored)?[...stored]:[];
    const old=storedJSON(storage,'frostline-regions-v1');
    if(Array.isArray(old)&&old.includes('valley'))ids.push('camp');
    const snow=storedJSON(storage,'frostline-snowfront-v1');
    if(snow?.completed&&snow.delivered>=8)ids.push('snowfront');
    return [...new Set(ids)].filter(id=>CHAPTERS.some(c=>c.id===id));
}
export function completeChapter(storage,id){
  if(!CHAPTERS.some(c=>c.id===id))return false;
  try{storage.setItem(STORY_PROGRESS_KEY,JSON.stringify([...new Set([...completedChapters(storage),id])]));return true;}catch{return false;}
}
