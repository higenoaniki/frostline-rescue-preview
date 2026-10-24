import {chapterFor} from './chapters.js';
import {buttonIcon} from './icons.js';

export const NARRATIVE={
  camp:[
    {at:0,speaker:'ユイ',text:'妹のアオは北岬の避難所にいる。吹雪で道も通信も途切れた。まず、この谷から食料を届けられるようにしなくちゃ。'},
    {at:3,speaker:'整備士ハル',text:'基地が動き始めたな。人の手だけじゃ北まで持たない。機械と仲間の力で、補給を絶やさずつなごう。'},
    {at:9,speaker:'救助隊長ミナ',text:'北の道標を動かす氷核が必要だ。避難所の暖房を立て直せたら、落ちた峠の橋まで来てほしい。'},
    {at:12,speaker:'ユイ',text:'谷の補給は届いた。でも峠の橋が落ちて、救助隊が孤立している。アオへの道を、次につなごう。'}
  ],
  pass:[
    {at:0,speaker:'救助隊長ミナ',text:'ユイ、対岸に私の仲間が3人いる。橋を直して連れ戻せれば、妹さんのいる北岬へ抜ける道を案内できる。'},
    {at:1,speaker:'ユイ',text:'使える倒木が集まった。あの3人を、もう雪の中で待たせたくない。'},
    {at:2,speaker:'ミナ',text:'橋がつながった！ 帰還組の食料を補給隊に預けたら、対岸へ迎えに行こう。'},
    {at:3,speaker:'救助隊の仲間',text:'声が聞こえた……迎えに来てくれたんだね。そばを歩くよ、一緒に橋を渡ろう。'},
    {at:4,speaker:'ミナ',text:'全員戻った、ありがとう。雪原の交易所に旧い無線がある。そこで北岬の消息を探そう。'}
  ],
  snowfront:[
    {at:0,speaker:'交易人ソラ',text:'ミナから聞いたよ、妹さんを探してるんだね。北へ荷を運ぶには、この交易路を動かす必要がある。'},
    {at:2,speaker:'ソラ',text:'東の区画が開いた。売上で仲間を雇えば、ユイが狩場にいる間も補給を続けられる。'},
    {at:4,speaker:'採掘班の無線',text:'北岬から弱い通信を受けた。アオという子は無事だ。ただ、灯台の発電機が壊れて道が見えない。'},
    {at:6,speaker:'ユイ',text:'アオが無事でよかった……。食料を採掘班へ届けた。次は高地で、灯台を直す補強材を用意しよう。'}
  ],
  highland:[
    {at:0,speaker:'整備士ハル',text:'交易隊の食料で、採掘を再開できる。アオたちへ向かう灯台を直すには、ここの鉱石と木材が必要なんだ。'},
    {at:1,speaker:'採掘班のリク',text:'坑道、開通。外の鉱脈も使えるよ。防具に回す鉱石と、補強材に回す鉱石を考えて持ってきて。'},
    {at:2,speaker:'ハル',text:'十分な鉱石だ。火床を整えれば、木材1と鉱石3で補強材を1箱作れる。'},
    {at:3,speaker:'リク',text:'採掘は僕らにも任せて。ユイは補強材の回収と、灯台へ送る荷箱を頼む。'},
    {at:4,speaker:'アオの無線',text:'お姉ちゃん……聞こえる？ みんな無事だよ。でも、外は何も見えない。灯台の光、待ってるね。'},
    {at:5,speaker:'ユイ',text:'補強材8箱、積み込み完了。アオ、待ってて。今度こそ、みんなで帰れる道を灯すから。'}
  ],
  beacon:[
    {at:0,speaker:'救助隊長ミナ',text:'北岬にはアオたちがいる。3基の灯りを直して、それから食料を積んだ橇を届けよう。私も最後まで一緒だ。'},
    {at:1,speaker:'ミナ',text:'西の灯り、確認！ 次は東の中継灯だ。納入した資材は修復台に保管してある。足りない分だけ運べばいい。'},
    {at:2,speaker:'アオの無線',text:'ユイ姉ちゃん、声が届いたよ！ こっちから、まだ灯台の光は見えない。みんなで待ってる。'},
    {at:3,speaker:'ハル',text:'氷核を回収したな。それが発電機の心臓になる。主灯へ納入すれば、避難所までの道が見える。'},
    {at:4,speaker:'ミナ',text:'主灯、点灯！ 橇は拠点で待機している。戻って合流しよう。光だけじゃ冬は越せない、食料も届けなくちゃ。'},
    {at:5,speaker:'アオ',text:'お姉ちゃん、おかえり。光が見えて、ほんとうにうれしかった。今夜はみんなで、温かいご飯にしよう。'}
  ]
};
export function narrativeBeat(chapter,mission){return [...(NARRATIVE[chapter]||[])].reverse().find(b=>b.at<=mission);}
export class ChapterNarrative{
  constructor({root,button,chapter,getMission,onOpen=()=>{},onClose=()=>{}}){
    this.root=root;this.chapter=chapter;this.getMission=getMission;this.seen=null;this.until=0;this.updated=performance.now();
    this.radio=document.createElement('section');this.radio.className='chapter-radio';this.radio.hidden=true;this.radio.setAttribute('role','status');this.radio.setAttribute('aria-live','polite');
    this.speaker=document.createElement('b');this.line=document.createElement('p');this.radio.append(this.speaker,this.line);root.append(this.radio);
    this.dialog=document.createElement('dialog');this.dialog.className='chapter-journal';this.dialog.dataset.gameUi='';this.dialog.setAttribute('aria-label','物語と通信記録');
    const header=document.createElement('header'),title=document.createElement('h2');title.textContent='ユイの通信記録';const close=document.createElement('button');close.type='button';buttonIcon(close,'close','閉じる');header.append(title,close);
    const purpose=document.createElement('p');purpose.className='journal-purpose';purpose.textContent='妹のアオがいる北岬へ、食料と帰還の灯りを届ける。';this.entries=document.createElement('div');this.dialog.append(header,purpose,this.entries);document.body.append(this.dialog);
    buttonIcon(button,'book','物語と通信記録');button.onclick=()=>{onOpen();this.entries.replaceChildren();const heading=document.createElement('h3');heading.textContent=`第1章 · ${Number(chapterFor(chapter).number)}/5 · ${chapterFor(chapter).title}`;this.entries.append(heading);for(const b of NARRATIVE[chapter]||[])if(b.at<=getMission()){const block=document.createElement('blockquote'),name=document.createElement('b'),text=document.createElement('p');name.textContent=b.speaker;text.textContent=b.text;block.append(name,text);this.entries.append(block);}this.dialog.showModal();};
    close.onclick=()=>this.dialog.close();this.dialog.addEventListener('close',onClose);this.announce(getMission(),true);
  }
  announce(mission,initial=false){const beat=narrativeBeat(this.chapter,mission);if(!beat||this.seen===beat.at)return;this.seen=beat.at;this.speaker.textContent=beat.speaker;this.line.textContent=beat.text;this.until=performance.now()+(initial?10000:8500);this.radio.hidden=false;window.dispatchEvent(new CustomEvent('frostline:radio',{detail:beat}));}
  update(){
    const now=performance.now(),modal=[...document.querySelectorAll('dialog[open],.modal:not(.hidden)')].some(el=>el.getClientRects().length>0);
    if(modal)this.until+=now-this.updated;this.updated=now;
    const objective=this.root.querySelector('.sf-objective')??this.root.querySelector('#questPanel');
    const shipping=this.root.querySelector('#shippingPanel');
    this.radio.style.top=`${Math.max(objective?.getBoundingClientRect().bottom??190,shipping?.getBoundingClientRect().bottom??0)+8}px`;this.radio.hidden=modal||now>this.until;
  }
}
