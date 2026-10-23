(function () {
  const panel = document.querySelector('#bootPanel');
  const title = document.querySelector('#bootTitle');
  const message = document.querySelector('#bootMessage');
  const details = document.querySelector('#bootDetails');
  const retry = document.querySelector('#bootRetry');
  let ready = false;
  let failed = false;
  let timer;
  const failure = (heading, text, error) => {
    failed = true;
    clearTimeout(timer);
    window.dispatchEvent(new Event('frostline:fatal'));
    title.textContent = heading;
    message.textContent = text;
    details.textContent = `${error?.message || String(error || '')}\n${navigator.userAgent}`;
    details.hidden = false;
    retry.hidden = false;
    panel.hidden = false;
    panel.setAttribute('role', 'alert');
  };
  retry.addEventListener('click', () => location.reload());
  window.addEventListener('frostline:ready', () => {
    ready = true;
    if (failed) return;
    clearTimeout(timer);
    panel.hidden = true;
  }, { once: true });
  window.addEventListener('error', event => {
    if (!event.error) return;
    failure('ゲームの起動に失敗しました', '下の詳細をお知らせください。保存済みの進捗は削除していません。', event.error);
  });
  window.addEventListener('unhandledrejection', event => {
    failure('ゲームの読み込みに失敗しました', '通信状態を確認して再読み込みしてください。', event.reason);
  });
  document.querySelector('#game').addEventListener('webglcontextlost', () => {
    failure('3D描画が停止しました', 'ほかのタブを閉じてから再読み込みしてください。', new Error('WebGL context lost'));
  });
  timer = setTimeout(() => {
    if (ready || failed) return;
    message.textContent = '読み込みに時間がかかっています。通信状態を確認してください。';
    retry.hidden = false;
  }, 20000);
  async function launch(){
    const params=new URLSearchParams(location.search),stage=params.get('stage'),view=params.get('view');
    const {STAGES,stageUnlocked}=await import('./campaign-catalog.js');
    const life=STAGES.find(s=>s.id===stage&&s.engine==='life');
    const menu=view==='menu'||view==='title'||!stage&&params.get('play')!=='1'&&!params.has('qa-boot');
    if(menu||life&&!stageUnlocked(localStorage,stage)&&!location.pathname.startsWith('/review/'))return import('./journey-menu.js');
    const gameModule=life?'./life-main.js':['pass','highland','beacon'].includes(stage)?'./story-main.js'
      :new URLSearchParams(location.search).get('stage') === 'snowfront'?'./snowfront-main.js':'./main.js';
    return import(gameModule);
  }
  launch().catch(error => {
    const gpu = /webgl|context|gpu/i.test(error.message);
    failure('ゲームの起動に失敗しました', gpu
      ? '3D描画を開始できませんでした。SafariまたはChromeを更新し、ほかのタブを閉じて再読み込みしてください。'
      : 'ゲームデータを読み込めませんでした。通信状態を確認して再読み込みしてください。', error);
  });
})();
