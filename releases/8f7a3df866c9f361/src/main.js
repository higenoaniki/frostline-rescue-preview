import { ToonCampRenderer as ThreeGameRenderer } from './toon-camp-renderer.js';
import { WORLD as world, SAFE as safe, STATIONS as stations, HUNTING, CONVEYOR_PATH, enemyRules, enemySpawnPoint } from "./world-config.js";
import { PLAYER_SPEED, SALE_PRICE, STORAGE_LIMIT, UPGRADE_SPECS, WEAPON_DAMAGE, upgradeCost, upgradeCap, facilityAvailable, facilityBuilt, facilityName, goalText, resetWork, resetUpgrades, resetPaid, resetBuilt, requiredWorkLevel } from './progression.js';
import { advanceObjective } from './campaign.js';
import {chapterFor,completeChapter} from './chapters.js';
import {chapterPrelude} from './chapter-prelude.js';
import {ChapterNarrative} from './chapter-narrative.js';
import {stageUrl} from './stage-travel.js';
import { readCampaign, writeCampaign, restoreCampaign } from './persistence.js';
import { resetAutomation, updateAutomation } from './automation.js';
import { resetShipping, updateShipping, shippingStatus } from './shipping.js';
import { resetProcessor, resetCanner, resetConveyor, updateProduction } from './production.js';
import { resetInvestment, startInvestment, updateInvestment } from './investment.js';
import { enemyStats, armorDamage, resetHunter, updateHunter, countKill, HUNTER_POSITION } from './combat.js';
import { bindFloatingStick } from './touch-controls.js';
import { resetMaterials, resetCrafting, RECIPES, canCraft, craft, recipeCosts, recipeCap, playerAttack, incomingDamage } from './crafting.js';
import { inNearHabitat, habitatPoint } from './ecology.js';
import { renderMission } from './mission-ui.js';
import { resetExpedition, depositSupply, FINAL_SUPPLIES, REFUGE_POSITION, canLaunch, launchExpedition, updateExpedition } from './expedition.js';
import { BOSS_POSITION } from './combat.js';
import { icon, buttonIcon } from './icons.js';
import { GameAudio } from './game-audio.js';
import { missionTarget } from './navigation.js';
import { resetDefense, updateDefense, repairDefense, defeatReason, BREACH, HEATER, REPAIR_COST } from './defense.js';
import { walkingObstacles, insideRect, walkingRoute } from './walkways.js';
import { REGIONS, regionFor, regionUnlocked, campaignKey, completedRegions, markRegionComplete, regionalEnemy } from './regions.js';
import { SWING_DURATION, MELEE_REACH, sweptTargets } from './melee.js';
import { lootAmount, compactGroundMeat, takeLoot, meatYield, spawnBudget } from './harvest-balance.js';
import { loadToonCampAssets as loadSculptedAssets } from './toon-camp-art.js';
import { DisplaySettings } from './display-settings.js';
import { TOP_MENU_ENABLED } from './launch-config.js';
import { bindStageTravel } from './stage-travel.js';

const canvas = document.querySelector("#game");
document.documentElement.classList.add('camp-toon');
const toonStyle=document.createElement('link');toonStyle.rel='stylesheet';toonStyle.href=new URL('./toon-camp.css',import.meta.url).href;document.head.append(toonStyle);
await loadSculptedAssets();
const renderer3d = new ThreeGameRenderer(canvas);
await renderer3d.lightingReady;
const audio = new GameAudio();

const hud = {
  hpText: document.querySelector("#hpText"),
  hpFill: document.querySelector("#hpFill"),
  stageText: document.querySelector("#stageText"),
  fenceText: document.querySelector("#fenceText"),
  fenceFill: document.querySelector("#fenceFill"),
  cashText: document.querySelector("#coinText"),
  questPanel: document.querySelector("#questPanel"),
  investmentPanel: document.querySelector('#investmentPanel'),
  investmentTitle: document.querySelector('#investmentTitle'),
  investmentValue: document.querySelector('#investmentValue'),
  investmentNotice: document.querySelector('#investmentNotice'),
  investButton: document.querySelector('#investButton'),
  shippingPanel: document.querySelector('#shippingPanel'),
  eventPanel: document.querySelector('#eventPanel'),
  achievementPanel: document.querySelector('#achievementPanel'),
  achievementTitle: document.querySelector('#achievementTitle'),
  achievementText: document.querySelector('#achievementText'),
  achievementNext: document.querySelector('#achievementNext'),
  craftButton: document.querySelector('#craftButton'),
  craftModal: document.querySelector('#craftModal'),
  craftInventory: document.querySelector('#craftInventory'),
  recipeList: document.querySelector('#recipeList'),
  craftClose: document.querySelector('#craftClose'),
  launchButton: document.querySelector('#launchButton'),
  planButton: document.querySelector('#planButton'),
  soundButton: document.querySelector('#soundButton'),
  bagPanel: document.querySelector("#bagPanel"),
  pauseButton: document.querySelector("#pauseButton"),
  joystick: document.querySelector("#joystick"),
  stick: document.querySelector("#stick"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalText: document.querySelector("#modalText"),
  modalButton: document.querySelector("#modalButton"),
  modalSecondaryButton: document.querySelector("#modalSecondaryButton")
};

const gate = {
  x: safe.x + safe.w / 2,
  y: safe.y,
  w: 265,
  h: 86,
  open: 0,
  target: 0
};


const state = {
  running: false,
  home: true,
  region: 'valley',
  defense: resetDefense(),
  paused: false,
  gameOver: false,
  renderFailed: false,
  stageClear: false,
  lastTime: 0,
  elapsed: 0,
  phaseStartedAt: 0,
  progressBaseline: resetWork(),
  materials: resetMaterials(),
  crafting: resetCrafting(),
  expedition: resetExpedition(),
  campaignComplete: false,
  endingView: false,
  achievementUntil: 0,
  built: resetBuilt(),
  builtAt: {},
  saveEnabled: !location.pathname.startsWith('/review/'),
  saveTimer: 0,
  stage: 1,
  rules: null,
  stageKills: 0,
  eliteIntroductions: 0,
  stageCash: 0,
  fenceHp: 100,
  fenceHpMax: 100,
  message: "",
  messageTimer: 0,
  checkpoint: null,
  runId: 0,
  transfers: [],
  transferSequence: 0,
  upgradePaid: resetPaid(),
  investment: resetInvestment(),
  hunter: resetHunter(),
  conveyor: resetConveyor(),
  canner: resetCanner(),
  automation: resetAutomation(),
  work: resetWork(),
  shipping: resetShipping(),
  lastUpgrade: null,
  camera: { x: 0, y: 0, scale: 1 },
  player: {
    x: safe.x + safe.w / 2,
    y: safe.y + 550,
    r: 24,
    hp: 100,
    hpMax: 100,
    speed: PLAYER_SPEED,
    attack: WEAPON_DAMAGE[1],
    range: MELEE_REACH,
    attackCooldown: 0,
    attackMotion: null,
    hurtFlash: 0,
    capacity: 24,
    facing: 0,
    moving: false,
    raw: 0,
    cuts: 0,
    goods: 0,
    cash: 0
  },
  processor: resetProcessor(),
  input: {
    keys: new Set(),
    pointerId: null,
    joyX: 0,
    joyY: 0
  },
  upgrades: resetUpgrades(),
  transferBuckets: {}
};

const upgradeDefs = {
  weapon: {
    label: "武器",
    buy: () => {
      state.upgrades.weapon += 1;
      state.player.attack = WEAPON_DAMAGE[state.upgrades.weapon];
      state.player.range += 4;
      toast("武器を強化した");
    }
  },
  armor: {
    label: "防具",
    buy: () => {
      state.upgrades.armor += 1;
      toast("防具を強化した");
    }
  },
  machine: {
    label: "加工機",
    buy: () => {
      state.upgrades.processor += 1;
      state.processor.speed += 0.85;
      toast("肉加工と保存食生産が速くなった");
    }
  },
  delivery: { label: '自動配送', buy: () => { state.upgrades.delivery += 1; toast('配送ドローンを強化した'); } },
  pickup: { label: '回収人', buy: () => {
    state.upgrades.pickup += 1;
    const worker = state.automation.worker;
    const gained = 30;
    worker.hpMax += gained; worker.hp = Math.min(worker.hpMax, worker.hp + gained);
    toast('回収人を雇用・強化した');
  } },
  conveyor: { label: 'コンベア', buy: () => { state.upgrades.conveyor += 1; toast('コンベアを建設・強化した'); } },
  hunter: { label: '自動狩り', buy: () => { state.upgrades.hunter += 1; toast('自動狩り施設を建設・強化した'); } },
  fleet: { label: '出荷ドローン', buy: () => { state.upgrades.fleet += 1; toast('出荷ドローンを増機した'); } },
  forge: { label: '素材工房', buy: () => { state.upgrades.forge = 1; } },
  beacon: { label: '補給通信台', buy: () => { state.upgrades.beacon = 1; } }
};

const enemies = [];
const drops = [];
const floaters = [];
const particles = [];
let resetTouch = () => {};
let narrative;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  renderer3d.resize(window.innerWidth, window.innerHeight, dpr);
}

function start() {
  let travelPaused=false;
  bindStageTravel(document.querySelector('#stageTravelButton'),{onOpen:()=>{travelPaused=state.paused;state.paused=true;resetTouch();state.input.keys.clear();},onClose:()=>{state.paused=travelPaused;},beforeTravel:flushCampaign});
  buttonIcon(hud.planButton, 'flag', '越冬補給計画');
  buttonIcon(hud.soundButton, audio.muted ? 'muted' : 'volume', audio.muted ? '音をオンにする' : '音をオフにする');
  document.querySelector('.brand-mark').replaceChildren(icon('snow', 20));
  document.querySelector('.coins > span').prepend(icon('coins', 13));
  document.querySelector('.title-emblem').replaceChildren(icon('snow', 28));
  buttonIcon(document.querySelector('#homeButton'), 'home', '遠征を選ぶ');
  document.querySelector('#homeButton').classList.toggle('hidden', !TOP_MENU_ENABLED);
  resize();
  window.addEventListener("resize", resize);
  bindInput();
  let settingsPaused = false;
  new DisplaySettings(renderer3d, {
    onOpen: () => { settingsPaused = state.paused; state.paused = true; state.investment = resetInvestment(); resetTouch(); state.input.keys.clear(); },
    onClose: resume => { state.paused = resume && state.running && !state.gameOver ? false : settingsPaused; resetTouch(); state.input.keys.clear(); }
  });
  for (const [bus, id] of [['music', 'musicVolume'], ['effects', 'effectsVolume']]) {
    const slider = document.querySelector(`#${id}`), output = document.querySelector(`#${id}Value`);
    slider.value = Math.round(audio[bus] * 100); output.value = `${slider.value}%`;
    slider.addEventListener('input', () => { audio.setVolume(bus, Number(slider.value) / 100); output.value = `${slider.value}%`; });
  }
  let saved = null;
  try { if (state.saveEnabled) saved = readCampaign(window.localStorage); } catch {}
  if (saved) {
    restoreCampaign(state, drops, saved);
    state.player.attack = WEAPON_DAMAGE[state.upgrades.weapon];
    state.player.range = MELEE_REACH + (state.upgrades.weapon - 1) * 4;
    state.player.x = 1000; state.player.y = safe.y + 550;
  }
  updateHud();
  if (TOP_MENU_ENABLED) showHome();
  else enterRegion('valley');
  const journalButton=document.createElement('button');journalButton.type='button';journalButton.className='icon-button';document.querySelector('#stageTravelButton').after(journalButton);
  let journalPaused=false;
  narrative=new ChapterNarrative({root:document.querySelector('.shell'),button:journalButton,chapter:'camp',getMission:()=>state.campaignComplete?12:state.stage-1,onOpen:()=>{journalPaused=state.paused;state.paused=true;resetTouch();state.input.keys.clear();},onClose:()=>{state.paused=journalPaused;}});
  if (!TOP_MENU_ENABLED) chapterPrelude('camp', {onOpen:()=>{state.paused=true;},onClose:()=>{state.paused=false;resetTouch();}});
  window.addEventListener('pagehide', () => { audio.setActivity({ hidden: true }); flushCampaign(); });
  window.addEventListener('frostline:fatal', () => {
    audio.setActivity({ hidden: true });
    state.renderFailed = true; state.paused = true;
    state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
    flushCampaign();
  });
  window.addEventListener('storage', event => {
    if (event.key !== campaignKey(state.region) || !state.running || state.home || !state.saveEnabled) return;
    state.saveEnabled = false; state.paused = true; state.investment = resetInvestment();
    resetTouch(); state.input.keys.clear();
    showModal('拠点の更新', '別の画面で更新されました。', '最新の拠点を開く', () => location.reload());
  });
  document.addEventListener('visibilitychange', () => {
    audio.setActivity({ paused: state.paused && !state.home, hidden: document.hidden });
    if (!document.hidden) return;
    state.investment = resetInvestment(); resetTouch(); state.input.keys.clear(); flushCampaign();
  });
  requestAnimationFrame(loop);
}

function showHome() {
  if (!TOP_MENU_ENABLED) return false;
  flushCampaign(); state.home = true; state.paused = true;
  state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
  hud.modal.classList.add('hidden'); hud.craftModal.classList.add('hidden');
  document.querySelector('.shell').classList.add('at-home');
  document.querySelector('#titleScreen').classList.remove('hidden');
  const list = document.querySelector('#regionList'); list.replaceChildren();
  let completed = [];
  try {
    if (readCampaign(localStorage)?.campaignComplete) markRegionComplete(localStorage, 'valley');
    completed = completedRegions(localStorage);
  } catch {}
  document.querySelector('#regionCompletion').textContent = `${completed.length} / ${REGIONS.length} CLEAR`;
  for (const region of REGIONS) {
    let save; try { save = readCampaign(localStorage, region.id); } catch {}
    const unlocked = regionUnlocked(region.id, completed);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'region-option'; button.disabled = !unlocked;
    button.dataset.region = region.id;
    const number = document.createElement('span'); number.className = 'region-number'; number.textContent = region.number;
    const content = document.createElement('span'), name = document.createElement('b'), detail = document.createElement('small');
    name.textContent = region.name;
    detail.textContent = !unlocked ? '白樺の谷のクリアで解放' : completed.includes(region.id) ? 'CLEAR · 拠点を続ける' : save ? `つづける · 補給計画 ${save.stage}/12` : `${region.subtitle} · はじめる`;
    content.append(name, detail); button.append(number, content, icon(unlocked ? 'navigation' : 'shield', 22));
    button.addEventListener('click', () => enterRegion(region.id)); list.append(button);
  }
  document.querySelector('#titleSave').textContent = '遠征ごとに進捗を自動保存';
}
function enterRegion(id) {
  let completed = [], saved;
  try { completed = completedRegions(localStorage); saved = readCampaign(localStorage, id); } catch {}
  if (!regionUnlocked(id, completed)) return false;
  state.region = id; state.home = false; state.running = false;
  document.querySelector('.shell').classList.remove('at-home');
  document.querySelector('#titleScreen').classList.add('hidden');
  startNewRun();
  if (saved) {
    restoreCampaign(state, drops, saved);
    state.player.attack = WEAPON_DAMAGE[state.upgrades.weapon]; state.player.range = MELEE_REACH + (state.upgrades.weapon - 1) * 4;
    state.phaseStartedAt = state.elapsed; enemies.length = 0; spawnStageEnemies();
    if (defeatReason(state)) retryStage();
  }
  state.paused = false; updateHud(); flushCampaign(); return true;
}


function startNewRun() {
  resetLongTermProgress();
  beginStage(1, { saveCheckpoint: true });
}

function resetLongTermProgress() {
  resetStageLoadout();
  state.checkpoint = null;
}

function beginStage(stageNumber, options = {}) {
  state.home = false;
  document.querySelector('.shell').classList.remove('at-home');
  document.querySelector('#titleScreen').classList.add('hidden');
  state.defense = resetDefense();
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.stageClear = false;
  state.stage = stageNumber;
  state.phaseStartedAt = 0;
  state.progressBaseline = resetWork();
  state.built = resetBuilt();
  state.builtAt = {};
  state.saveTimer = 0;
  state.runId += 1;
  state.transfers = [];
  state.transferSequence = 0;
  state.upgradePaid = resetPaid();
  state.investment = resetInvestment();
  state.hunter = resetHunter();
  state.conveyor = resetConveyor();
  state.canner = resetCanner();
  state.automation = resetAutomation();
  state.work = resetWork();
  state.shipping = resetShipping();
  state.lastUpgrade = null;
  state.rules = enemyRules(stageNumber);
  state.stageKills = 0;
  state.eliteIntroductions = 0;
  state.stageCash = 0;
  state.fenceHpMax = state.rules.fenceHp;
  state.fenceHp = state.fenceHpMax;
  resetStageLoadout();
  state.elapsed = 0;
  state.message = "";
  state.messageTimer = 0;
  state.transferBuckets = {};
  gate.open = 0;
  gate.target = 0;
  state.player.x = safe.x + safe.w / 2;
  state.player.y = safe.y + 550;
  state.player.facing = 0;
  state.player.hp = state.player.hpMax;
  state.player.attackCooldown = 0;
  state.player.attackMotion = null;
  state.player.hurtFlash = 0;
  enemies.length = 0;
  drops.length = 0;
  floaters.length = 0;
  particles.length = 0;
  spawnStageEnemies();
  buttonIcon(hud.pauseButton, 'pause', '一時停止');
  hud.modal.classList.add("hidden");
  hud.modalSecondaryButton.classList.add("hidden");
  if (options.saveCheckpoint) saveCheckpoint();
  resetTouch();
  state.input.keys.clear();
  toast(`開拓目標 ${state.stage}`);
  updateHud();
}

function resetStageLoadout() {
  state.expedition = resetExpedition(); state.campaignComplete = false; state.endingView = false;
  state.materials = resetMaterials(); state.crafting = resetCrafting(); state.achievementUntil = 0;
  state.player.hpMax = 100;
  state.player.hp = state.player.hpMax;
  state.player.speed = PLAYER_SPEED;
  state.player.attack = WEAPON_DAMAGE[1];
  state.player.range = MELEE_REACH;
  state.player.capacity = 24;
  state.player.raw = 0;
  state.player.cuts = 0;
  state.player.goods = 0;
  state.player.cash = 0;
  state.processor = resetProcessor();
  state.upgrades = resetUpgrades();
}

function saveCheckpoint() { state.checkpoint = { stage: state.stage }; }
function retryStage() {
  state.endingView = false;
  state.running = true; state.paused = false; state.gameOver = false; state.stageClear = false;
  state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
  state.player.x = 1000; state.player.y = safe.y + 550;
  state.player.hp = state.player.hpMax; state.player.attackMotion = null; state.player.attackCooldown = 0;
  state.fenceHp = state.fenceHpMax; state.phaseStartedAt = state.elapsed;
  state.defense = resetDefense();
  for (const enemy of enemies) if (enemy.y >= safe.y) { enemy.y = safe.y - 160; enemy.x = BREACH.x; }
  if (!enemies.length) spawnStageEnemies();
  else ensureBoss();
  for (const enemy of enemies) { enemy.attackMotion = null; enemy.cooldown = 2; enemy.spawnGrace = 2; }
  hud.modal.classList.add('hidden'); buttonIcon(hud.pauseButton, 'pause', '一時停止');
  updateHud(); flushCampaign();
}

function bindInput() {
  document.querySelector('#homeButton').addEventListener('click', showHome);
  document.querySelector('#repairButton').addEventListener('click', () => {
    if (state.paused || state.home || !repairDefense(state)) return;
    toast('柵と熱源を応急修理した'); audio.play('build'); flushCampaign(); updateHud();
  });
  buttonIcon(hud.pauseButton, 'pause', '一時停止');
  window.addEventListener('pointerdown', () => audio.unlock());
  window.addEventListener('keydown', () => audio.unlock());
  hud.soundButton.addEventListener('click', () => { audio.toggle(); buttonIcon(hud.soundButton, audio.muted ? 'muted' : 'volume', audio.muted ? '音をオンにする' : '音をオフにする'); });
  window.addEventListener("keydown", (event) => {
    state.input.keys.add(event.key.toLowerCase());
  });
  window.addEventListener("keyup", (event) => state.input.keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => { state.investment = resetInvestment(); });

  resetTouch = bindFloatingStick(document.querySelector('.shell'), state.input, hud.joystick, hud.stick,
    () => state.running && !state.paused && !state.gameOver && !state.stageClear);

  hud.pauseButton.addEventListener("click", togglePause);
  hud.planButton.addEventListener('click', () => {
    if (!state.running || state.gameOver) return;
    state.paused = true; state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
    showModal('越冬補給計画', state.campaignComplete ? '避難所の暖房が復旧し、越冬物資が届きました。拠点と装備はそのまま続けられます。' : `計画 ${state.stage} / 12\n北の氷冠獣から氷核を回収し、避難所の暖房を復旧する。\n保存食18は食料、毛皮4は防寒、鉱石4は修理のために確保。育てた拠点から最終便を届ける。`, '探索に戻る', () => { state.paused = false; hud.modal.classList.add('hidden'); });
  });
  hud.launchButton.addEventListener('click', () => {
    if (state.paused || !insideZone(state.player, stations.beacon) || !launchExpedition(state)) return;
    resetTouch(); state.input.keys.clear(); audio.play('launch'); toast('最終便 積み込み中'); flushCampaign(); updateHud();
  });
  hud.questPanel.addEventListener('mission:toggle', updateHud);
  hud.craftButton.addEventListener('click', openCraftMenu);
  hud.craftClose.addEventListener('click', () => {
    hud.craftModal.classList.add('hidden'); state.paused = false; resetTouch(); state.input.keys.clear();
    flushCampaign(); updateHud();
  });
  hud.investButton.addEventListener('click', () => {
    if (state.investment.id) { state.investment = resetInvestment(); return; }
    const id = Object.keys(UPGRADE_SPECS).find(id => isStationUnlocked(id) && insideZone(state.player, stations[id]));
    if (id && !state.player.moving && !state.paused) startInvestment(state, id);
  });
  hud.modalButton.addEventListener("click", () => {
    const action = hud.modalButton._action;
    if (action) action();
  });
  hud.modalSecondaryButton.addEventListener("click", () => {
    const action = hud.modalSecondaryButton._action;
    if (action) action();
  });
}

function togglePause() {
  if (!state.running || state.gameOver || state.stageClear) return;
  state.paused = !state.paused;
  state.investment = resetInvestment();
  resetTouch();
  state.input.keys.clear();
  buttonIcon(hud.pauseButton, state.paused ? 'play' : 'pause', state.paused ? '再開' : '一時停止');
  if (state.paused) {
    showModal(
      "一時停止",
      `開拓目標 ${state.stage}`,
      "再開",
      () => {
        state.paused = false;
        buttonIcon(hud.pauseButton, 'pause', '一時停止');
        hud.modal.classList.add("hidden");
      },
      "拠点で再開",
      retryStage
    );
  } else {
    hud.modal.classList.add("hidden");
  }
}

function loop(time) {
  if (state.renderFailed) return;
  let remaining = Math.min(0.1, Math.max(0, (time - state.lastTime) / 1000 || 0));
  state.lastTime = time;
  let advanced = false;
  // Catch up a slow render frame using short collision/combat steps, not slow-motion movement.
  while (remaining > 0 && state.running && !state.paused && !state.gameOver && !state.stageClear) {
    const step = Math.min(1 / 60, remaining);
    update(step, false); remaining -= step; advanced = true;
  }
  if (advanced) updateHud();
  audio.setActivity({ paused: state.paused && !state.home, hidden: document.hidden });
  audio.update(state.home ? null : state.player, isInsideSafe(state.player));
  draw();
  renderer3d.observeFrame(time, state.running && !state.paused && !state.gameOver && !document.hidden);
  requestAnimationFrame(loop);
}

function update(dt, refreshHud = true) {
  state.elapsed += dt;
  updateGate(dt);
  const wasBreached = state.defense.breach;
  updateDefense(state, enemies, dt);
  if (state.defense.breach && !wasBreached) { toast('柵が破壊された! 熱源を守れ'); audio.play('hit'); }
  if (!state.expedition.flight || state.expedition.arrived) movePlayer(dt);
  else state.player.moving = false;
  if (state.expedition.crest && isInsideSafe(state.player)) state.expedition.returned = true;
  updatePlayerCombat(dt);
  updateEnemies(dt);
  updateDrops(dt);
  updateProduction(state, dt);
  updateAutoStations(dt);
  updateAutomation(state, drops, dt, { transfer: recordTransfer, sell: sellGoods });
  updateHunter(state, enemies, dt, damageEnemy, drops);
  updateShipping(state, dt);
  updateRecovery(dt);
  updateEffects(dt);
  maintainEnemies(dt);
  updateExpedition(state, dt);
  checkFailure();
  checkStageClear();
  state.saveTimer += dt;
  if (state.saveTimer >= 2) { state.saveTimer = 0; flushCampaign(); }
  if (refreshHud) updateHud();
}

function updateGate(dt) {
  const playerNearGate =
    Math.abs(state.player.x - gate.x) < gate.w * 0.58 &&
    Math.abs(state.player.y - gate.y) < 150;
  gate.target = playerNearGate ? 1 : 0;
  const speed = gate.target > gate.open ? 9 : 3;
  gate.open += (gate.target - gate.open) * Math.min(1, dt * speed);
}

function movePlayer(dt) {
  const prev = { x: state.player.x, y: state.player.y };
  let x = state.input.joyX;
  let y = state.input.joyY;
  if (state.input.keys.has("arrowleft") || state.input.keys.has("a")) x -= 1;
  if (state.input.keys.has("arrowright") || state.input.keys.has("d")) x += 1;
  if (state.input.keys.has("arrowup") || state.input.keys.has("w")) y -= 1;
  if (state.input.keys.has("arrowdown") || state.input.keys.has("s")) y += 1;

  const direction = renderer3d.screenDirectionToWorld(x, y);
  x = direction.x;
  y = direction.y;
  const mag = Math.hypot(x, y);
  state.player.moving = mag > 0.05;
  if (mag > 0.05) {
    state.player.facing = Math.atan2(x, y);
    const outsidePenalty = isInsideSafe(state.player) ? 1 : 0.96;
    state.player.x += (x / mag) * state.player.speed * outsidePenalty * dt;
    state.player.y += (y / mag) * state.player.speed * outsidePenalty * dt;
  }
  state.player.x = clamp(state.player.x, 60, world.width - 60);
  state.player.y = clamp(state.player.y, 80, world.height - 80);
  constrainPlayerByFence(prev);
  constrainPlayerByBuildings(prev);
}

function constrainPlayerByBuildings(prev) {
  const p = state.player;
  for (const obstacle of walkingObstacles(state, p.r)) {
    if (!insideRect(p, obstacle)) continue;
    if (!insideRect({ x: p.x, y: prev.y }, obstacle)) p.y = prev.y;
    else if (!insideRect({ x: prev.x, y: p.y }, obstacle)) p.x = prev.x;
    else { p.x = prev.x; p.y = prev.y; }
  }
}

function constrainPlayerByFence(prev) {
  const wasInside = isInsideSafe(prev);
  const nowInside = isInsideSafe(state.player);
  if (wasInside === nowInside) return;
  if (canPassGate(prev, state.player)) return;

  const p = state.player;
  const r = p.r + 5;
  if (wasInside && !nowInside) {
    p.x = clamp(p.x, safe.x + r, safe.x + safe.w - r);
    p.y = clamp(p.y, safe.y + r, safe.y + safe.h - r);
  } else if (!wasInside && nowInside) {
    if (prev.y < safe.y) p.y = safe.y - r;
    if (prev.y > safe.y + safe.h) p.y = safe.y + safe.h + r;
    if (prev.x < safe.x) p.x = safe.x - r;
    if (prev.x > safe.x + safe.w) p.x = safe.x + safe.w + r;
  }
}

function canPassGate(prev, next) {
  const crossesTop =
    (prev.y <= safe.y && next.y >= safe.y) || (prev.y >= safe.y && next.y <= safe.y);
  const inGate = Math.abs(next.x - gate.x) < gate.w * 0.46 || Math.abs(prev.x - gate.x) < gate.w * 0.46;
  return crossesTop && (inGate && gate.open > 0.42 || state.fenceHp <= 0 && Math.abs(next.x - BREACH.x) < 100);
}

function updatePlayerCombat(dt) {
  const p = state.player;
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 4);

  if (!p.attackMotion && p.attackCooldown <= 0) {
    const target = nearestEnemyInRange(p.range + 12);
    if (target) {
      p.attackMotion = {
        time: 0,
        duration: SWING_DURATION,
        angle: Math.atan2(target.y - p.y, target.x - p.x),
        hit: false,
        hits: new Set()
      };
      p.attackCooldown = 0.49;
      audio.play('swing');
    }
  }

  if (!p.attackMotion) return;
  const previousTime = p.attackMotion.time;
  p.attackMotion.time += dt;
  const m = p.attackMotion;
  const hit = sweptTargets(p, [...enemies], m, previousTime);
  for (const enemy of hit) damageEnemy(enemy, playerAttack(state), Math.atan2(enemy.y - p.y, enemy.x - p.x));
  if (m.hits?.size >= 2 && m.comboShown !== m.hits.size) {
    m.comboShown = m.hits.size;
    if (m.comboFloater) { m.comboFloater.text = `${m.hits.size} HIT`; m.comboFloater.life = 1; }
    else m.comboFloater = addFloater(`${m.hits.size} HIT`, p.x, p.y - 110, '#ffe5a0');
    renderer3d.impact = Math.min(.1, .035 * m.hits.size);
  }
  if (m.time >= m.duration) p.attackMotion = null;
}

function nearestEnemyInRange(range) {
  let best = null;
  let bestDist = Infinity;
  enemies.forEach((enemy) => {
    const dist = distance(enemy, state.player);
    if (dist < range + enemy.r && dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  });
  return best;
}

function damageEnemy(enemy, amount, angle, automatic = false) {
  audio.play('hit');
  amount = Math.max(1, amount - ((!automatic && state.crafting.blade > 0) ? 0 : enemy.armor || 0));
  enemy.hp -= amount;
  enemy.hurt = 1;
  enemy.x += Math.cos(angle) * 12;
  enemy.y += Math.sin(angle) * 12;
  addFloater(`-${Math.ceil(amount)}`, enemy.x, enemy.y - 42, "#ffffff");
  slashParticles(enemy.x, enemy.y, angle);
  if (enemy.hp <= 0) defeatEnemy(enemy, automatic);
}

function defeatEnemy(enemy, automatic) {
  const index = enemies.indexOf(enemy);
  if (index >= 0) enemies.splice(index, 1);
  state.stageKills += 1;
  countKill(state, enemy, automatic);
  if (enemy.boss) {
    state.expedition.bossDefeated = true;
    drops.push({ type: 'core', x: enemy.x, y: enemy.y - 55, vy: -90, life: 0.18 });
    toast('氷冠獣を討伐! 氷核を回収して拠点へ');
  }
  const count = meatYield(enemy);
  for (let i = 0; i < count; i += 1) {
    drops.push({
      type: "raw",
      x: enemy.x + (Math.random() - 0.5) * 54,
      y: enemy.y + (Math.random() - 0.5) * 44,
      vy: -85 - Math.random() * 45,
      life: 0.18
    });
  }
  const materials = enemy.boss ? { ore: 4, fur: 4 } : enemy.kind === 'brute' ? { ore: 2, fur: 1 } : enemy.elite ? { fur: 2 } : {};
  for (const [type, amount] of Object.entries(materials)) for (let i = 0; i < amount; i++) {
    drops.push({ type, x: enemy.x + (i - 0.5) * 35, y: enemy.y - 55, vy: -90, life: 0.18 });
  }
  burst(enemy.x, enemy.y, "#ffcf8a", 16);
  addFloater(`+${count} 原料`, enemy.x, enemy.y - 70, "#ffcf8a");
}

function updateEnemies(dt) {
  enemies.forEach((enemy, index) => {
    enemy.spawnGrace = Math.max(0, enemy.spawnGrace - dt);
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.hurt = Math.max(0, enemy.hurt - dt * 4);
    enemy.wobble += dt * 4;

    if (enemy.attackMotion) {
      updateEnemyAttack(enemy, dt);
      return;
    }

    if (!enemy.boss && (isInsideSafe(enemy) || state.fenceHp <= 0 && index < state.rules.raiders)) {
      if (!isInsideSafe(enemy)) {
        const entrance = { x: BREACH.x, y: safe.y + 65 };
        if (Math.abs(enemy.x - BREACH.x) > 55 && enemy.y < safe.y) moveEnemyToward(enemy, BREACH.x, safe.y - 95, enemy.speed, dt);
        else moveEnemyToward(enemy, entrance.x, entrance.y, enemy.speed, dt);
      } else {
        const target = distance(enemy, state.player) < 240 ? state.player : HEATER;
        const approach = target === HEATER ? { x: HEATER.x - 110, y: HEATER.y } : target;
        const layout = Object.values(state.built).join('') + state.upgrades.conveyor;
        if (!enemy.route || enemy.routeLayout !== layout || !enemy.routeTarget || distance(enemy.routeTarget, approach) > 60) {
          enemy.route = walkingRoute(enemy, approach, state); enemy.routeTarget = { ...approach }; enemy.routeLayout = layout;
        }
        const next = enemy.route[0];
        if (next) { moveEnemyToward(enemy, next.x, next.y, enemy.speed * .8, dt); if (distance(enemy, next) < 5) enemy.route.shift(); }
        if (distance(enemy, target) < enemy.attackRange + (target === HEATER ? 40 : 0) && enemy.cooldown <= 0) startEnemyAttack(enemy, target === HEATER ? 'heater' : 'player', HEATER);
      }
      return;
    }

    const playerOutside = !isInsideSafe(state.player);
    const distToPlayer = distance(enemy, state.player);
    const worker = state.automation.worker;
    const distToWorker = state.upgrades.pickup && worker.hp > 0 && !isInsideSafe(worker) ? distance(enemy, worker) : Infinity;
    const canChasePlayer = playerOutside && distToPlayer < enemy.detectionRange && (!enemy.boss || distance(state.player, BOSS_POSITION) < 1000);
    const target = !enemy.boss && distToWorker < enemy.detectionRange && (!canChasePlayer || distToWorker < distToPlayer) ? worker : canChasePlayer ? state.player : null;
    if (target) {
      moveEnemyToward(enemy, target.x, target.y, enemy.speed, dt);
      if (distance(enemy, target) < enemy.attackRange && enemy.cooldown <= 0 && enemy.spawnGrace <= 0) startEnemyAttack(enemy, target === worker ? 'worker' : 'player');
      return;
    }

    if (enemy.boss) { if (distance(enemy, BOSS_POSITION) > 30) moveEnemyToward(enemy, BOSS_POSITION.x, BOSS_POSITION.y, enemy.speed, dt); return; }

    if (!state.expedition.flight && state.rules.fenceRaid && state.elapsed - state.phaseStartedAt >= state.rules.raidDelay && index < state.rules.raiders) {
      const target = { x: BREACH.x, y: safe.y - 18 };
      moveEnemyToward(enemy, target.x, target.y, enemy.speed * 0.78, dt);
      if (distance(enemy, target) < enemy.attackRange + 8 && enemy.cooldown <= 0) {
        startEnemyAttack(enemy, "fence", target);
      }
      return;
    }

    wanderEnemy(enemy, dt);
  });
  // Spread a pursuing group so bodies and attack windups remain readable.
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy), spacing = a.r + b.r + 60;
    if (length >= spacing || (a.attackMotion && b.attackMotion)) continue;
    const push = (spacing - length) * Math.min(0.5, dt * 5);
    const nx = length > 0.01 ? dx / length : 1, ny = length > 0.01 ? dy / length : 0;
    if (!a.attackMotion) { a.x -= nx * push; a.y -= ny * push; keepEnemyOutsideSafe(a); }
    if (!b.attackMotion) { b.x += nx * push; b.y += ny * push; keepEnemyOutsideSafe(b); }
  }
}

function updateEnemyAttack(enemy, dt) {
  const motion = enemy.attackMotion;
  motion.time += dt;
  const windup = enemy.boss ? 0.85 : 0.46;
  const active = motion.time >= windup && motion.time <= windup + (enemy.boss ? 0.22 : 0.12);
  if (enemy.boss && active) moveEnemyToward(enemy, enemy.x + Math.cos(motion.angle) * 400, enemy.y + Math.sin(motion.angle) * 400, 650, dt);
  if (active && !motion.hit) {
    motion.hit = true;
    const hit = {
      x: enemy.x + Math.cos(motion.angle) * (enemy.boss ? 90 : 44),
      y: enemy.y + Math.sin(motion.angle) * (enemy.boss ? 90 : 44)
    };
    if (motion.target === "player") {
      const canHitPlayer = (!isInsideSafe(state.player) || isInsideSafe(enemy)) && distance(hit, state.player) < (enemy.boss ? 75 : 36) + state.player.r * 0.72;
      if (canHitPlayer) {
        const damage = incomingDamage(state, armorDamage(enemy.damage, state.upgrades.armor));
        state.player.hp = Math.max(0, state.player.hp - damage);
        state.player.hurtFlash = 1;
        audio.play('hurt');
        addFloater(`-${Math.ceil(damage)} HP`, state.player.x, state.player.y - 60, "#ef5f5f");
        burst(state.player.x, state.player.y, "#ef5f5f", 10);
      }
    } else if (motion.target === 'worker') {
      const worker = state.automation.worker;
      if (worker.hp > 0 && !isInsideSafe(worker) && distance(hit, worker) < 58) {
        worker.hp = Math.max(0, worker.hp - enemy.damage); worker.hurt = 1;
        addFloater(`-${Math.ceil(enemy.damage)} HP`, worker.x, worker.y - 50, '#ef5f5f');
        burst(worker.x, worker.y, '#ef5f5f', 8);
      }
    } else if (motion.target === 'heater') {
      if (distance(enemy, HEATER) < enemy.attackRange + 45) {
        state.defense.hp = Math.max(0, state.defense.hp - enemy.damage * 0.7);
        burst(HEATER.x, HEATER.y, '#ffaf5e', 8);
      }
    } else if (motion.target === "fence") {
      state.fenceHp = Math.max(0, state.fenceHp - enemy.fenceDamage);
      addFloater(`-${Math.ceil(enemy.fenceDamage)}`, motion.fencePoint.x, motion.fencePoint.y - 18, "#ef5f5f");
      burst(motion.fencePoint.x, motion.fencePoint.y, "#dff7ff", 9);
    }
  }
  if (motion.time >= motion.duration) {
    enemy.attackMotion = null;
    enemy.cooldown = 0.7 + Math.random() * 0.25;
  }
}

function startEnemyAttack(enemy, target, fencePoint = null) {
  const angle =
    target !== "fence" && target !== 'heater'
      ? Math.atan2((target === 'worker' ? state.automation.worker : state.player).y - enemy.y, (target === 'worker' ? state.automation.worker : state.player).x - enemy.x)
      : Math.atan2(fencePoint.y - enemy.y, fencePoint.x - enemy.x);
  enemy.attackMotion = {
    target,
    fencePoint,
    time: 0,
    duration: enemy.boss ? 1.5 : 0.88,
    windup: enemy.boss ? 0.85 : 0.46,
    angle,
    hit: false
  };
}

function moveEnemyToward(enemy, x, y, speed, dt) {
  const dx = x - enemy.x;
  const dy = y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / dist) * speed * dt;
  enemy.y += (dy / dist) * speed * dt;
  keepEnemyOutsideSafe(enemy);
}

function wanderEnemy(enemy, dt) {
  enemy.wander += (Math.random() - 0.5) * dt * 2;
  enemy.x += Math.cos(enemy.wander) * enemy.speed * 0.22 * dt;
  enemy.y += Math.sin(enemy.wander) * enemy.speed * 0.22 * dt;
  enemy.x = clamp(enemy.x, 130, world.width - 130);
  enemy.y = clamp(enemy.y, HUNTING.y, safe.y - 100);
}

function keepEnemyOutsideSafe(enemy) {
  if (!enemy.boss && (enemy.y > safe.y + 35 || state.fenceHp <= 0 && Math.abs(enemy.x - BREACH.x) < 100)) return;
  if (!isInsideSafe(enemy)) return;
  const dTop = Math.abs(enemy.y - safe.y);
  const dBottom = Math.abs(enemy.y - (safe.y + safe.h));
  const dLeft = Math.abs(enemy.x - safe.x);
  const dRight = Math.abs(enemy.x - (safe.x + safe.w));
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  if (min === dTop) enemy.y = safe.y - enemy.r - 8;
  if (min === dBottom) enemy.y = safe.y + safe.h + enemy.r + 8;
  if (min === dLeft) enemy.x = safe.x - enemy.r - 8;
  if (min === dRight) enemy.x = safe.x + safe.w + enemy.r + 8;
}

function nearestFencePoint(enemy) {
  const topPoint = { x: clamp(enemy.x, safe.x + 42, safe.x + safe.w - 42), y: safe.y - 18 };
  const leftPoint = { x: safe.x - 18, y: clamp(enemy.y, safe.y + 42, safe.y + safe.h - 42) };
  const rightPoint = { x: safe.x + safe.w + 18, y: clamp(enemy.y, safe.y + 42, safe.y + safe.h - 42) };
  const points = [topPoint, leftPoint, rightPoint];
  return points.reduce((best, point) => (distance(enemy, point) < distance(enemy, best) ? point : best), topPoint);
}

function updateDrops(dt) {
  const p = state.player;
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    if (drop.life > 0) {
      drop.life -= dt;
      drop.y += drop.vy * dt;
      drop.vy += 340 * dt;
    }
    const dist = distance(drop, p);
    const material = ['fur', 'ore', 'core'].includes(drop.type);
    if (dist < 145 && (material || totalStack() < p.capacity)) {
      const pull = Math.min(1, (640 * dt) / Math.max(dist, 1));
      drop.x += (p.x - drop.x) * pull;
      drop.y += (p.y - drop.y) * pull;
    }
    if (dist < 34 && (material || totalStack() < p.capacity)) {
      if (drop.type === 'core' && state.expedition.crest) { drops.splice(i, 1); continue; }
      recordTransfer(drop.type || 'raw', drop, p, 'pickup');
      if (drop.type === 'core') { state.expedition.crest = true; toast('氷核を回収'); }
      else if (material) { const count = takeLoot(drop, lootAmount(drop)); state.materials[drop.type] += count; state.work[`${drop.type}Collected`] += count; }
      else p.raw += takeLoot(drop, p.capacity - totalStack());
      if (drop.type === 'core' || drop.amount <= 0) drops.splice(i, 1);
      if (drop.type === 'core') flushCampaign();
      audio.play('pickup');
      popParticle(p.x + 25, p.y - 32, "#ffcf8a");
    }
  }
  state.lootCompactTimer = (state.lootCompactTimer || 0) + dt;
  if (state.lootCompactTimer >= .5) { state.lootCompactTimer = 0; compactGroundMeat(drops, state.automation.worker.target); }
}

function updateAutoStations(dt) {
  const p = state.player;
  const routes = [
    ['rawIn', 'processorIn', () => p.raw > 0 && state.processor.rawStored < STORAGE_LIMIT, () => {
      p.raw--; state.processor.rawStored++; state.work.rawDelivered++;
      recordTransfer('raw', p, { x: stations.processorIn.x, y: stations.processorIn.modelY }, 'deposit');
    }],
    ['cutsOut', 'processorOut', () => state.processor.cutsStored > 0 && totalStack() < p.capacity, () => {
      state.processor.cutsStored--; p.cuts++;
      recordTransfer('cuts', { x: stations.processorOut.modelX, y: stations.processorOut.modelY }, p, 'collect');
    }],
    ['cutsIn', 'cannerIn', () => p.cuts > 0 && state.canner.cutsStored + state.conveyor.items.length < STORAGE_LIMIT, () => {
      p.cuts--; state.canner.cutsStored++; state.work.manualCuts++;
      recordTransfer('cuts', p, { x: stations.cannerIn.x, y: stations.cannerIn.modelY }, 'deposit');
    }],
    ['goodsOut', 'cannerOut', () => state.canner.goodsStored > 0 && totalStack() < p.capacity, () => {
      state.canner.goodsStored--; p.goods++;
      recordTransfer('goods', { x: stations.cannerOut.x, y: stations.cannerOut.modelY }, p, 'collect');
    }],
    ['sell', 'market', () => p.goods > 0, () => { p.goods--; sellGoods(1, p, false); }]
  ];
  for (const [key, id, eligible, action] of routes) {
    if (insideZone(p, stations[id]) && eligible()) dripTransfer(key, dt, 9, action);
    else state.transferBuckets[key] = 0;
  }
  for (const key of Object.keys(FINAL_SUPPLIES)) {
    if (state.stage >= 11 && insideZone(p, stations.beacon) && state.upgrades.beacon) {
      dripTransfer(`supply-${key}`, dt, 12, () => {
        if (depositSupply(state, key)) recordTransfer(key, p, { x: stations.beacon.x, y: stations.beacon.modelY }, 'supply');
      });
    } else state.transferBuckets[`supply-${key}`] = 0;
  }
  updateInvestment(state, dt, id => insideZone(p, stations[id]), {
    transfer: id => recordTransfer('cash', p, stations[id], 'upgrade'),
    buy: id => {
      const newlyBuilt = !facilityBuilt(state, id);
      upgradeDefs[id].buy();
      state.built[id] = true;
      if (newlyBuilt) state.builtAt[id] = state.elapsed;
      audio.play('build');
      toast(newlyBuilt ? `${UPGRADE_SPECS[id].label} 完成` : `${UPGRADE_SPECS[id].label} Lv${state.upgrades[UPGRADE_SPECS[id].levelKey]}`);
      state.lastUpgrade = { id, level: state.upgrades[UPGRADE_SPECS[id].levelKey], expires: state.elapsed + 3 };
      burst(stations[id].x, stations[id].y, '#ffe082', 18);
      burst(stations[id].x, stations[id].modelY, '#dff7ff', 24);
      flushCampaign();
    }
  });
}

function sellGoods(count, from, automated) {
  if (!count) return;
  if (!automated || distance(from, state.player) < 700) audio.play('sell');
  const gained = count * SALE_PRICE;
  state.player.cash += gained;
  state.stageCash += gained;
  state.work.shipped += count;
  state.shipping.queued += count;
  if (automated && state.upgrades.delivery >= requiredWorkLevel(state.stage, 'delivery')) state.work.autoSales += count;
  recordTransfer('goods', from, { x: stations.market.x, y: stations.market.modelY }, automated ? 'drone-sale' : 'sale');
  recordTransfer('cash', { x: stations.market.x + 70, y: stations.market.modelY }, state.player, 'payment');
}

function dripTransfer(key, dt, perSecond, action) {
  state.transferBuckets[key] = (state.transferBuckets[key] || 0) + dt * perSecond;
  if (state.transferBuckets[key] < 1) return false;
  state.transferBuckets[key] -= 1;
  action();
  return true;
}

function activeUpgrade() {
  return Object.keys(UPGRADE_SPECS).find(id => isStationUnlocked(id) && insideZone(state.player, stations[id]));
}

function recordTransfer(type, from, to, kind) {
  if (kind === 'deposit' || kind === 'collect' || kind === 'supply') audio.play('deposit');
  state.transfers.push({ id: ++state.transferSequence, type, kind, time: state.elapsed,
    from: { x: from.x, y: from.y, h: from === state.player ? 125 : from.h ?? (['pickup', 'drone-load'].includes(kind) ? 13 : 72) },
    to: { x: to.x, y: to.y, h: to === state.player ? 135 : to.h ?? 80 } });
}

function updateRecovery(dt) {
  if (state.player.hp <= 0) return;
  if (!isInsideSafe(state.player)) return;
  if (enemies.some(e => isInsideSafe(e) && distance(e, state.player) < 320)) return;
  state.player.hp = Math.min(state.player.hpMax, state.player.hp + 14 * dt);
}

function updateEffects(dt) {
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.transfers = state.transfers.filter((event) => state.elapsed - event.time < 1);
  for (let i = floaters.length - 1; i >= 0; i -= 1) {
    floaters[i].life -= dt;
    floaters[i].y -= 38 * dt;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function maintainEnemies(dt) {
  state.spawnTimer = (state.spawnTimer || 0) - dt;
  if (state.spawnTimer > 0) return;
  const budget = spawnBudget(state, drops), near = enemies.filter(inNearHabitat).length;
  const supplyNear = near < budget.near;
  if (supplyNear && enemies.length >= budget.max) {
    const distant = enemies.find(e => !e.boss && !inNearHabitat(e) && distance(e, state.player) > 1000 && !e.attackMotion);
    if (distant) enemies.splice(enemies.indexOf(distant), 1);
  }
  if (enemies.length < budget.max) {
    const introduce = state.eliteIntroductions > 0;
    spawnEnemy(supplyNear ? 'habitat' : introduce ? 'near' : undefined, introduce && state.stage === 6 ? 'brute' : introduce);
    if (introduce) state.eliteIntroductions--;
  }
  state.spawnTimer = budget.delay;
}

function spawnStageEnemies() {
  ensureBoss();
  state.spawnTimer = 0;
  const budget = spawnBudget(state, drops);
  for (let i = 0; i < budget.max; i += 1) spawnEnemy(i < budget.near ? 'habitat' : ['middle', 'deep'][i % 2], state.stage >= 6 && i === 0 ? 'brute' : state.stage >= 3 && i < 2);
}

function ensureBoss() {
  if (state.stage < 10) return;
  if (!state.expedition.bossDefeated && !enemies.some(e => e.boss)) enemies.push({ ...BOSS_POSITION, ...regionalEnemy(enemyStats(state.stage, 'boss'), state.region) });
  if (state.expedition.bossDefeated && !state.expedition.crest && !drops.some(d => d.type === 'core')) drops.push({ ...BOSS_POSITION, type: 'core', vy: 0, life: 0 });
}

function spawnEnemy(band = Math.random() < 0.55 ? 'near' : Math.random() < 0.55 ? 'middle' : 'deep', forcedElite = false) {
  let point = band === 'habitat' ? habitatPoint(state.player, enemies) : enemySpawnPoint(band);
  if (!point) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (enemies.every(e => distance(e, point) > 145) && (isInsideSafe(state.player) || distance(state.player, point) > 220)) break;
    if (band === 'habitat') break;
    point = enemySpawnPoint(band);
  }
  const { x, y } = point;
  const roll = Math.random(), elite = state.stage >= 6 && (forcedElite === 'brute' || roll < state.rules.bruteRatio) ? 'brute' : state.stage >= 3 && (forcedElite || roll < state.rules.bruteRatio + state.rules.eliteRatio);
  enemies.push({ x, y, ...regionalEnemy(enemyStats(state.stage, elite), state.region), spawnGrace: 1, wander: Math.random() * Math.PI * 2 });
  burst(x, y, '#dff7ff', 6);
}

function checkStageClear() {
  const result = advanceObjective(state);
  if (!result) return;
  narrative?.announce(result.final?12:state.stage-1);
  ensureBoss();
  if (result.final) {
    if (state.saveEnabled) { try { markRegionComplete(localStorage, state.region); } catch {} }
    if (state.saveEnabled) { try { completeChapter(localStorage,'camp'); } catch {} }
    state.endingView = true;
    const destination = state.expedition.flight ?? REFUGE_POSITION;
    renderer3d.focus.set(destination.x - world.width / 2, 120, destination.y - world.height / 2);
    audio.play('victory');
    state.paused = true; state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
    burst(state.player.x, state.player.y, '#ffd060', 64);
    const continueCamp = () => { state.endingView = false; state.paused = false; renderer3d.focus.set(state.player.x - world.width / 2, 0, state.player.y - world.height / 2); hud.modal.classList.add('hidden'); };
    showModal('越冬補給 完了', `${regionFor(state.region).name} CLEAR\n${chapterFor('camp').ending}\n討伐 ${state.work.kills} · 出荷 ${state.work.shipped}`, '次へ · 白霧の峠', ()=>{flushCampaign();location.assign(stageUrl(location.href,'pass'));}, '拠点を続ける', continueCamp);
    flushCampaign(); return;
  }
  state.messageTimer = 0;
  audio.play('milestone');
  hud.achievementTitle.textContent = `目標 ${result.completed} 達成!`;
  hud.achievementText.textContent = result.title;
  hud.achievementNext.textContent = `開拓目標 ${state.stage} が解禁`;
  hud.achievementPanel.classList.add('hidden');
  void hud.achievementPanel.offsetWidth;
  hud.achievementPanel.classList.remove('hidden'); state.achievementUntil = state.elapsed + 3.5;
  burst(state.player.x, state.player.y, '#ffd060', 40); burst(state.player.x, state.player.y, '#42a98e', 24);
  state.eliteIntroductions = [3, 6].includes(state.stage) ? 2 : 0;
  flushCampaign();
}

function checkFailure() {
  const reason = defeatReason(state);
  if (reason) triggerGameOver(reason);
}

function triggerGameOver(reason) {
  if (state.gameOver) return;
  state.gameOver = true;
  audio.play('failure');
  state.paused = true;
  state.investment = resetInvestment();
  flushCampaign();
  showModal("探索中断", reason, "拠点で再開", retryStage);
}

function flushCampaign() {
  if (!state.saveEnabled || !state.running) return true;
  let saved = false;
  try { saved = writeCampaign(window.localStorage, state, drops); } catch {}
  if (!saved) toast('保存できません');
  return saved;
}

function updateHud() {
  narrative?.update();
  document.querySelector('#regionName').textContent = `${regionFor(state.region).number} ${regionFor(state.region).name}`;
  const powerPct = clamp(state.player.attack / 8, 0, 1);
  const fencePct = clamp(state.defense.hp / state.defense.hpMax, 0, 1);
  hud.hpText.textContent = `Lv ${state.upgrades.weapon}`;
  hud.hpFill.style.transform = `scaleX(${powerPct})`;
  hud.stageText.textContent = state.campaignComplete ? 'CLEAR' : `${state.stage}/12`;
  hud.fenceText.textContent = `${Math.ceil(fencePct * 100)}%`;
  hud.fenceFill.style.transform = `scaleX(${fencePct})`;
  const repairPanel = document.querySelector('#defensePanel');
  const damaged = state.fenceHp < state.fenceHpMax || state.defense.hp < state.defense.hpMax;
  repairPanel.classList.toggle('hidden', state.home || !damaged || distance(state.player, HEATER) > 240);
  document.querySelector('#defenseStatus').textContent = state.fenceHp <= 0 ? '柵が破壊された · 熱源を守れ' : `柵 ${Math.ceil(state.fenceHp / state.fenceHpMax * 100)}% · 熱源 ${Math.ceil(fencePct * 100)}%`;
  document.querySelector('#repairButton').disabled = state.player.cash < REPAIR_COST || state.paused || state.gameOver;
  document.querySelector('#defenseLabel').textContent = state.fenceHp <= 0 ? '熱源 / 侵入中' : '熱源';
  hud.cashText.textContent = String(Math.floor(state.player.cash));
  renderMission(hud.questPanel, state);
  const direction = document.querySelector('#navigationHint');
  if (direction) {
    direction.classList.toggle('hidden', state.campaignComplete || !!state.expedition.flight);
    const target = missionTarget(state), screen = renderer3d.worldDirectionToScreen(target.x - state.player.x, target.y - state.player.y);
    direction.querySelector('svg').style.transform = `rotate(${Math.atan2(screen.y, screen.x) * 180 / Math.PI + 45}deg)`;
    const name = target === HEATER ? '熱源を守れ・応急修理' : target === BOSS_POSITION ? '北の氷原' : target.id ? UPGRADE_SPECS[target.id] ? facilityName(state, target.id) : target.title : target.y >= safe.y ? '拠点の入口' : '狩場';
    direction.querySelector('span').textContent = `${name} · ${Math.round(distance(target, state.player) / 10)}m`;
  }
  hud.achievementPanel.classList.toggle('hidden', state.elapsed >= state.achievementUntil);
  const focus = Object.keys(stations).find(id => isStationUnlocked(id) && insideZone(state.player, stations[id]));
  hud.investmentPanel.dataset.station = focus ?? '';
  hud.investmentValue.classList.toggle('supply-values', focus === 'beacon' && state.upgrades.beacon > 0);
  hud.investmentPanel.classList.toggle('hidden', !focus || state.endingView || !!state.expedition.flight && !state.expedition.arrived);
  hud.investButton.classList.toggle('hidden', !focus || !UPGRADE_SPECS[focus]);
  hud.craftButton.classList.toggle('hidden', focus !== 'forge' || !state.upgrades.forge);
  if (focus === 'forge' && state.upgrades.forge) hud.investButton.classList.add('hidden');
  hud.launchButton.classList.toggle('hidden', focus !== 'beacon' || !state.upgrades.beacon || state.stage < 12 || state.campaignComplete);
  hud.launchButton.disabled = !canLaunch(state);
  hud.launchButton.textContent = state.expedition.flight ? '最終便 出発済み' : '最終便を出発';
  if (focus && UPGRADE_SPECS[focus]) {
    const spec = UPGRADE_SPECS[focus], level = state.upgrades[spec.levelKey], maxed = level >= upgradeCap(state.stage, focus), built = facilityBuilt(state, focus);
    hud.investmentTitle.textContent = built ? `${spec.label} Lv${level}${maxed ? '' : ` → ${level + 1}`}` : facilityName(state, focus);
    hud.investmentValue.textContent = maxed ? 'MAX' : `現金 ${state.upgradePaid[focus]} / ${upgradeCost(state, focus)}`;
    hud.investButton.disabled = maxed || state.player.cash <= 0 || state.player.moving;
    hud.investButton.textContent = state.investment.id === focus ? '投資停止' : '投資開始';
    hud.investmentNotice.textContent = state.lastUpgrade?.id === focus && state.elapsed < state.lastUpgrade.expires ? '完成' : '';
    if (focus === 'beacon' && built) {
      hud.investButton.classList.add('hidden');
      hud.investmentValue.replaceChildren(...Object.entries(FINAL_SUPPLIES).map(([key, n]) => {
        const count = document.createElement('span'); count.className = 'supply-count';
        count.textContent = `${{ goods: '保存食', fur: '毛皮', ore: '鉱石' }[key]} ${state.expedition.supplies[key]}/${n}`; return count;
      }));
      hud.investmentNotice.textContent = state.expedition.arrived ? '避難所への補給 完了' : state.stage < 11 ? '補給路を安全にする' : state.expedition.flight ? '避難所へ飛行中' : state.expedition.crest ? '氷核 確保済み' : '氷核 未回収';
    }
  } else if (focus) {
    const data = {
      processorIn: [state.processor.rawStored, '肉'],
      processorOut: [state.processor.cutsStored, '加工肉'],
      cannerIn: [state.canner.cutsStored, '加工肉'],
      cannerOut: [state.canner.goodsStored, '保存食'],
      market: [state.shipping.queued, '待機商品']
    }[focus];
    hud.investmentTitle.textContent = stations[focus].title;
    hud.investmentValue.textContent = `${data[1]} ${data[0]}${focus === 'market' ? '' : ` / ${STORAGE_LIMIT}`}`;
    hud.investmentNotice.textContent = '';
  }
  hud.eventPanel.textContent = state.message;
  hud.eventPanel.classList.toggle('hidden', state.messageTimer <= 0);
  const flight = state.expedition.flight;
  hud.shippingPanel.textContent = flight && !state.expedition.arrived ? `最終便 · ${{ loading: '物資を積み込み中', outbound: '避難所へ飛行中', landing: '避難所へ着陸中' }[flight.phase]}` : shippingStatus(state);
  hud.shippingPanel.style.top = `${hud.questPanel.offsetTop + hud.questPanel.offsetHeight + 4}px`;
  hud.eventPanel.style.top = `${hud.shippingPanel.offsetTop + hud.shippingPanel.offsetHeight + 4}px`;
  const bag = `${state.player.raw}:${state.player.cuts}:${state.player.goods}:${state.player.capacity}:${state.materials.fur}:${state.materials.ore}:${state.stage >= 3}:${state.expedition.crest}`;
  if (hud.bagPanel.dataset.stack !== bag) {
    hud.bagPanel.dataset.stack = bag;
    hud.bagPanel.replaceChildren();
    const entries = [['beef', `肉 ${state.player.raw}`, 'raw'], ['layers', `加工肉 ${state.player.cuts}`, 'cuts'], ['package', `保存食 ${state.player.goods}`, 'goods'], [null, `${totalStack()}/${state.player.capacity}`]];
    if (state.stage >= 3) entries.push([null, `毛皮 ${state.materials.fur} / 鉱石 ${state.materials.ore}`]);
    if (state.expedition.crest) entries.push(['snow', '氷核', 'core']);
    for (const [name, text, type] of entries) {
      const item = document.createElement('span'); item.className = 'bag-item';
      if (name) { const glyph = icon(name, 13); glyph.classList.add(type); item.append(glyph); }
      item.append(document.createTextNode(text)); hud.bagPanel.append(item);
    }
  }
}

function openCraftMenu() {
  if (!state.running || state.gameOver || !state.upgrades.forge || !insideZone(state.player, stations.forge)) return;
  state.paused = true; state.investment = resetInvestment(); resetTouch(); state.input.keys.clear();
  hud.craftModal.classList.remove('hidden'); renderCraftMenu();
}
function renderCraftMenu() {
  hud.craftInventory.textContent = `毛皮 ${state.materials.fur} · 鉱石 ${state.materials.ore} · 加工肉 ${state.player.cuts} · 保存食 ${state.player.goods} · 現金 ${state.player.cash}`;
  hud.recipeList.replaceChildren();
  for (const [id, recipe] of Object.entries(RECIPES)) {
    if (state.stage < recipe.stage) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'recipe-button';
    button.disabled = !canCraft(state, id);
    const name = document.createElement('b'); name.textContent = `${recipe.name}${recipe.maximum ? state.crafting[id] >= recipeCap(state, id) ? ` Lv${state.crafting[id]} MAX` : ` Lv${state.crafting[id]} → ${state.crafting[id] + 1}` : ''}`;
    const effect = document.createElement('span'); effect.textContent = recipe.effect;
    const cost = document.createElement('small'); cost.textContent = Object.entries(recipeCosts(state, id)).map(([key, count]) => `${{ fur: '毛皮', ore: '鉱石', cuts: '加工肉', goods: '保存食', cash: '現金' }[key]} ${count}`).join(' + ');
    button.append(name, effect, cost); button.onclick = () => {
      if (!craft(state, id)) return;
      toast(`${recipe.name} 完成`); burst(state.player.x, state.player.y, '#ffe082', 20);
      flushCampaign(); renderCraftMenu(); updateHud();
    }; hud.recipeList.append(button);
  }
}

function draw() {
  state.gateOpen = gate.open;
  state.enemies = enemies;
  renderer3d.render(state, enemies, drops, particles, floaters);
  if (!canvas.dataset.rendered) {
    canvas.dataset.rendered = 'true';
    window.dispatchEvent(new Event('frostline:ready'));
  }
}


function showModal(title, text, primaryText, primaryAction, secondaryText = "", secondaryAction = null) {
  hud.modal.classList.toggle('ending', state.campaignComplete && title === '越冬補給 完了');
  hud.modalTitle.textContent = title;
  hud.modalText.textContent = text;
  hud.modalButton.textContent = primaryText;
  hud.modalButton._action = primaryAction;
  if (secondaryAction) {
    hud.modalSecondaryButton.textContent = secondaryText;
    hud.modalSecondaryButton._action = secondaryAction;
    hud.modalSecondaryButton.classList.remove("hidden");
  } else {
    hud.modalSecondaryButton._action = null;
    hud.modalSecondaryButton.classList.add("hidden");
  }
  hud.modal.classList.remove("hidden");
}

function toast(message) {
  state.message = message;
  state.messageTimer = 2.1;
}

function addFloater(text, x, y, color) {
  const floater = { text, x, y, color, life: 1 }; floaters.push(floater); return floater;
}

function popParticle(x, y, color) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 100,
    vy: -85 - Math.random() * 65,
    gravity: 110,
    r: 4 + Math.random() * 5,
    color,
    life: 0.55
  });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) popParticle(x, y, color);
}

function slashParticles(x, y, angle) {
  for (let i = 0; i < 8; i += 1) {
    particles.push({
      x,
      y,
      vx: Math.cos(angle + (Math.random() - 0.5) * 1.3) * (120 + Math.random() * 120),
      vy: Math.sin(angle + (Math.random() - 0.5) * 1.3) * (120 + Math.random() * 120),
      gravity: 60,
      r: 3 + Math.random() * 4,
      color: i % 2 ? "#dff7ff" : "#ffe082",
      life: 0.42
    });
  }
}

function totalStack() {
  return state.player.raw + state.player.cuts + state.player.goods;
}

function isStationUnlocked(id) {
  return facilityAvailable(state, id);
}


function isInsideSafe(point) {
  return (
    point.x >= safe.x &&
    point.x <= safe.x + safe.w &&
    point.y >= safe.y &&
    point.y <= safe.y + safe.h
  );
}

function insideZone(point, zone) {
  return (
    point.x >= zone.x - zone.w / 2 &&
    point.x <= zone.x + zone.w / 2 &&
    point.y >= zone.y - zone.h / 2 &&
    point.y <= zone.y + zone.h / 2
  );
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


export { state, enemies, drops, particles, floaters, renderer3d, beginStage, retryStage, update, draw, flushCampaign, showHome, enterRegion };

start();
