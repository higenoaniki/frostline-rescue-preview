import {buttonIcon,icon} from './icons.js';
import {stageFor,journeyFor,TRANSFER_POLICY} from './campaign-catalog.js';
import {menuUrl} from './stage-travel.js';

const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
export class CampaignHUD{
  constructor({stage,root=document.querySelector('.shell'),isPaused,pause,stop=()=>{},save=()=>true,restart,travel,settings,journal}){
    this.stage=stageFor(stage);this.view={};this.pause=pause;this.isPaused=isPaused;this.stop=stop;this.save=save;this.key='';
    document.documentElement.classList.add('journey-active');document.documentElement.dataset.journey=this.stage.journey;
    this.root=el('section','journey-ui');this.root.setAttribute('aria-label','共通ゲームUI');root.append(this.root);
    this.top=el('header','journey-top');this.top.dataset.gameUi='';this.mapButton=el('button','journey-location');this.mapButton.type='button';this.mapButton.setAttribute('aria-label','ステージを選ぶ');
    this.mapButton.append(icon('navigation',18),el('span','',`${this.stage.chapter}-${this.stage.local} ${this.stage.title}`));this.mapButton.onclick=travel;
    this.cash=el('b','journey-money','0');const wallet=el('span','journey-wallet');wallet.append(icon('coins',18),this.cash);
    const menu=el('button','journey-icon');menu.type='button';buttonIcon(menu,'pause','メニュー・一時停止');this.top.append(this.mapButton,wallet,menu);
    this.bottom=el('footer','journey-bottom');this.bottom.dataset.gameUi='';
    this.goalButton=el('button','journey-goal');this.goalButton.type='button';this.goalButton.setAttribute('aria-label','目標の詳細');
    this.goalTitle=el('b');this.goalCount=el('span');const line=el('div');line.append(icon('flag',17),this.goalTitle,this.goalCount,icon('chevron',17));this.goalProgress=el('progress');this.goalProgress.max=1;this.goalButton.append(line,this.goalProgress);
    this.hint=el('small','journey-hint');this.inventory=el('button','journey-inventory');this.inventory.type='button';this.inventory.setAttribute('aria-label','所持品の詳細');this.bagCopy=el('span');this.bagCapacity=el('small');this.inventory.append(icon('package',18),this.bagCopy,this.bagCapacity,icon('chevron',16));this.bottom.append(this.goalButton,this.hint,this.inventory);
    this.context=el('section','journey-context');this.context.dataset.gameUi='';this.context.hidden=true;this.contextTitle=el('b');this.contextText=el('span');this.contextActions=el('div');this.context.append(this.contextTitle,this.contextText,this.contextActions);
    this.toast=el('div','journey-toast');this.toast.hidden=true;this.toast.setAttribute('role','status');this.root.append(this.top,this.bottom,this.context,this.toast);
    this.details=this.dialog('目標と補給');this.inventorySheet=this.dialog('所持品');this.menu=this.dialog('遠征メニュー');
    const chapter=journeyFor(this.stage.journey);this.menu.body.append(el('small','journey-kicker',`第${chapter.number}章 ${chapter.title}`),el('h3','',`${this.stage.local}/5 · ${this.stage.title}`));
    const actions=el('div','journey-menu-actions');
    const command=(symbol,label,action)=>{const b=el('button','journey-command');b.type='button';b.append(icon(symbol,20),el('span','',label));b.onclick=action;actions.append(b);return b;};
    command('play','ゲームへ戻る',()=>this.menu.node.close());
    command('navigation','ステージを選ぶ',()=>this.afterMenu(travel));
    this.journalButton=command('book','物語と通信記録',()=>this.afterMenu(journal));
    command('settings','設定',()=>this.afterMenu(settings));
    const confirm=el('section','journey-restart-confirm');confirm.hidden=true;confirm.append(el('b','','このステージを最初からやり直す？'),el('p','','この場所の荷物・設備・強化だけが初期状態に戻ります。他のステージとクリア記録は残ります。'));
    const yes=el('button','journey-danger','このステージを最初から'),no=el('button','journey-secondary','戻る');yes.type=no.type='button';confirm.append(yes,no);
    command('restart','このステージをやり直す',()=>{confirm.hidden=false;actions.hidden=true;});no.onclick=()=>{confirm.hidden=true;actions.hidden=false;};yes.onclick=()=>{this.savedPause=false;restart();this.menu.node.close();confirm.hidden=true;actions.hidden=false;};
    command('home','章・ステージ選択へ',async()=>{try{if(await save()===false)throw Error('保存できません');location.assign(menuUrl(location.href));}catch(e){this.notify(e.message);}});
    this.menu.body.append(actions,confirm,el('p','journey-policy',TRANSFER_POLICY));
    menu.onclick=()=>this.open(this.menu);this.goalButton.onclick=()=>{this.renderDetails();this.open(this.details);};this.inventory.onclick=()=>{this.renderInventory();this.open(this.inventorySheet);};
    window.addEventListener('frostline:radio',()=>{this.journalButton.classList.add('has-news');});
    this.journalButton.classList.add('has-news');
  }
  dialog(title){
    const node=el('dialog','journey-dialog');node.dataset.gameUi='';node.setAttribute('aria-label',title);const header=el('header'),h=el('h2','',title),close=el('button','journey-icon');close.type='button';buttonIcon(close,'close','閉じる');header.append(h,close);const body=el('div','journey-dialog-body');node.append(header,body);document.body.append(node);close.onclick=()=>node.close();node.addEventListener('close',()=>{if(this.opened===node){this.opened=null;this.pause(this.savedPause);this.stop();const action=this.pendingAction;this.pendingAction=null;action?.();}});return{node,body};
  }
  open(sheet){if(this.opened)return;this.savedPause=this.isPaused();this.pause(true);this.stop();this.opened=sheet.node;sheet.node.showModal();}
  afterMenu(action){this.pendingAction=action;this.menu.node.close();this.journalButton.classList.remove('has-news');}
  notify(text){this.toast.textContent=text;this.toast.hidden=false;this.toastUntil=performance.now()+2400;}
  update(view){
    this.view=view;this.cash.textContent=Math.floor(view.cash||0).toLocaleString('ja-JP');
    this.goalTitle.textContent=view.completed?'ステージクリア':view.title;this.goalCount.textContent=view.count??'';this.goalProgress.value=Math.max(0,Math.min(1,view.progress||0));this.hint.textContent=view.alert??view.hint??'';this.hint.classList.toggle('journey-warning',!!view.alert);
    const bag=(view.items||[]).filter(i=>i.count>0);this.bagCopy.textContent=bag.slice(0,2).map(i=>`${i.label} ${i.count}`).join(' · ')||'荷物なし';this.bagCapacity.textContent=view.capacity??'';
    const c=view.context;this.context.hidden=!c;
    if(c){this.contextTitle.textContent=c.title;this.contextText.textContent=c.text;const key=JSON.stringify([c.title,(c.actions||[]).map(a=>[a.label,a.disabled])]);if(this.actionKey!==key){this.actionKey=key;this.contextActions.replaceChildren();for(const a of c.actions||[]){const b=el('button','journey-small-command');b.type='button';b.append(icon(a.icon||'play',16),el('span','',a.label));b.disabled=!!a.disabled;b.onclick=a.action;this.contextActions.append(b);}}}
    this.toast.hidden=performance.now()>(this.toastUntil||0);this.context.style.bottom=`${this.bottom.getBoundingClientRect().height+26}px`;
  }
  renderDetails(){
    const v=this.view;this.details.body.replaceChildren(el('h3','',v.title),el('p','journey-detail-hint',v.hint??''));
    for(const row of v.rows||[]){const item=el('div','journey-detail-row');const h=el('div');h.append(el('span','',row.label),el('strong','',`${row.value}/${row.target}`));const bar=el('progress');bar.max=row.target||1;bar.value=row.value;item.classList.toggle('done',row.value>=row.target);item.append(h,bar);this.details.body.append(item);}
    if(v.note)this.details.body.append(el('p','journey-policy',v.note));
  }
  renderInventory(){
    this.inventorySheet.body.replaceChildren(el('p','',this.view.capacity??''));for(const i of this.view.items||[]){const row=el('div','journey-detail-row');row.append(el('span','',i.label),el('strong','',i.count));this.inventorySheet.body.append(row);}
  }
}
