export const CHAPTERS = [
  {id:'camp',number:'01',title:'白樺の谷',subtitle:'最初の火を、絶やさない。',story:'ユイの妹アオは、北岬の避難所にいる。大吹雪で道も通信も途絶えた。谷の補給基地を育て、食料と帰り道の灯りを北へ届ける旅が始まる。',ending:'谷の避難所へ食料が届いた。しかし峠の橋が落ち、救助隊が孤立している。アオへの道をつなぐには、まず3人の仲間を連れ戻さなくては。',next:'pass',symbol:'home',difficulty:'基礎 · 生産と自動化'},
  {id:'pass',number:'02',title:'白霧の峠',subtitle:'途切れた橋の向こうに、仲間がいる。',story:'谷から届いた食料を携え、倒木で橋を修復する。対岸の救助隊3人を連れ帰り、交易所への道を開こう。',ending:'3人の仲間と峠を越えた。次は旅人が集まる雪原に、補給の中継地を築こう。',next:'snowfront',symbol:'shield',difficulty:'初級 · 修復と救助'},
  {id:'snowfront',number:'03',title:'雪原交易路',subtitle:'救った仲間と、街道をつなぐ。',story:'峠を越えた仲間が交易所を開く。狩り、調理、交易をつなぎ、北の採掘隊へ燻製の荷箱を届けよう。',ending:'交易路が開き、採掘隊へ食料が届いた。灯台の修理には、高地の鉱石で作る補強材が必要だ。',next:'highland',symbol:'package',difficulty:'中級 · 交易と区画開拓'},
  {id:'highland',number:'04',title:'星灯りの高地',subtitle:'食料の道を、鋼の道へ。',story:'交易隊の食料で鉱山が再開した。木材と鉱石を補強材に加工する。鉱石を防具に回すか、灯台の補給に回すか。採掘の自動化も力になる。',ending:'灯台用の補強材8箱を積み込んだ。北極灯台の火を取り戻す、最後の遠征が始まる。',next:'beacon',symbol:'layers',difficulty:'上級 · 採掘と素材配分'},
  {id:'beacon',number:'05',title:'北極灯台',subtitle:'最後の灯りを、アオのもとへ。',story:'「お姉ちゃん、光を待ってる」。途切れた無線の向こうに、妹アオと避難所の人々がいる。3基の道標と主灯を直し、救助隊と食料の橇を届ける。ここまでつないだ仲間たちの力で、最後の雪原を越えよう。',ending:'「お姉ちゃん、おかえり」。灯りをたどって、補給隊はアオの待つ北岬に到着した。谷の食料、峠の仲間、交易路、高地の補強材。その全部が、今夜の温かい食卓につながった。',next:null,symbol:'trophy',difficulty:'最終章 · 修復と補給隊護衛'}
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
