import { resetUpgrades, resetBuilt, resetPaid, resetWork, UPGRADE_SPECS, upgradeCost, STORAGE_LIMIT, CAMPAIGN_LENGTH } from './progression.js';
import { resetProcessor, resetCanner, resetConveyor } from './production.js';
import { resetAutomation } from './automation.js';
import { resetShipping, newFlight } from './shipping.js';
import { enemyRules, WORLD, STATIONS } from './world-config.js';
import { resetMaterials, resetCrafting } from './crafting.js';
import { resetExpedition, FINAL_SUPPLIES, REFUGE_POSITION } from './expedition.js';
import { resetDefense } from './defense.js';
import { campaignKey } from './regions.js';
import { compactGroundMeat } from './harvest-balance.js';

export const SAVE_KEY = 'frostline-camp-v1';
const finite = (value, fallback = 0, maximum = 1e9) => Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : fallback;
const counters = (template, source) => Object.fromEntries(Object.entries(template).map(([key, value]) => [key, finite(source?.[key], value)]));
const point = (p, fallback) => ({ x: finite(p?.x, fallback.x, WORLD.width + 800), y: finite(p?.y, fallback.y, WORLD.height + 400) });
const list = value => Array.isArray(value) ? value : [];

export function campaignSnapshot(state, drops) {
  const worker = state.automation.worker;
  return JSON.parse(JSON.stringify({
    version: 1, region: state.region || 'valley', defense: state.defense, stage: state.stage, elapsed: state.elapsed, phaseStartedAt: state.phaseStartedAt, stageCash: state.stageCash,
    work: state.work, progressBaseline: state.progressBaseline, upgrades: state.upgrades,
    materials: state.materials, crafting: state.crafting,
    expedition: state.expedition, campaignComplete: state.campaignComplete,
    built: state.built, upgradePaid: state.upgradePaid,
    player: { raw: state.player.raw, cuts: state.player.cuts, goods: state.player.goods, cash: state.player.cash, hp: state.player.hp },
    processor: state.processor, canner: state.canner, conveyor: state.conveyor,
    automation: state.automation, workerTargetIndex: drops.indexOf(worker.target),
    shipping: state.shipping, drops, fenceHp: state.fenceHp
  }));
}
export function readCampaign(storage, region = 'valley') {
  try {
    const saved = JSON.parse(storage.getItem(campaignKey(region)));
    return saved?.version === 1 && Number.isInteger(saved.stage) && saved.stage >= 1 && saved.stage <= 10000 && saved.upgrades && saved.player ? saved : null;
  } catch { return null; }
}
export function writeCampaign(storage, state, drops) {
  try { storage.setItem(campaignKey(state.region), JSON.stringify(campaignSnapshot(state, drops))); return true; }
  catch { return false; }
}
export function restoreCampaign(state, drops, saved) {
  state.region = saved.region === 'highland' ? 'highland' : 'valley';
  state.defense = resetDefense();
  state.defense.hp = finite(saved.defense?.hp, 600, 600);
  state.stage = Math.min(CAMPAIGN_LENGTH, saved.expedition ? saved.stage : Math.min(saved.stage, 9));
  state.expedition = resetExpedition();
  if (saved.expedition) {
    for (const key of ['bossDefeated', 'crest', 'returned', 'arrived']) state.expedition[key] = saved.expedition[key] === true;
    for (const [key, maximum] of Object.entries(FINAL_SUPPLIES)) state.expedition.supplies[key] = Math.floor(finite(saved.expedition.supplies?.[key], 0, maximum));
    const flight = saved.expedition.flight;
    if (flight && ['loading', 'outbound', 'landing', 'arrived'].includes(flight.phase)) state.expedition.flight = { ...point(flight, STATIONS.beacon), phase: flight.phase, timer: finite(flight.timer, 0, flight.phase === 'loading' ? 1.2 : 1.5) };
  }
  state.campaignComplete = saved.campaignComplete === true && state.expedition.arrived && state.expedition.crest && state.expedition.returned && state.expedition.bossDefeated && Object.entries(FINAL_SUPPLIES).every(([key, value]) => state.expedition.supplies[key] >= value);
  if (state.expedition.arrived) state.expedition.flight = { ...REFUGE_POSITION, phase: 'arrived', timer: 1.5 };
  if (state.campaignComplete) state.stage = CAMPAIGN_LENGTH;
  state.elapsed = finite(saved.elapsed);
  state.phaseStartedAt = finite(saved.phaseStartedAt);
  state.stageCash = finite(saved.stageCash);
  state.work = counters(resetWork(), saved.work);
  state.progressBaseline = counters(resetWork(), saved.progressBaseline);
  for (const [key, sources] of Object.entries({ rawDelivered: ['autoRaw'], kills: ['armedKills', 'autoKills'] })) {
    if (saved.work?.[key] === undefined) state.work[key] = sources.reduce((sum, source) => sum + state.work[source], 0);
    if (saved.progressBaseline?.[key] === undefined) state.progressBaseline[key] = sources.reduce((sum, source) => sum + state.progressBaseline[source], 0);
  }
  for (const key of Object.keys(state.work)) state.progressBaseline[key] = Math.min(state.work[key], state.progressBaseline[key]);
  state.upgrades = resetUpgrades();
  for (const [id, spec] of Object.entries(UPGRADE_SPECS)) {
    const minimum = state.upgrades[spec.levelKey];
    state.upgrades[spec.levelKey] = Math.max(minimum, Math.floor(finite(saved.upgrades[spec.levelKey], minimum, spec.max)));
  }
  state.built = resetBuilt();
  const initial = resetUpgrades();
  for (const [id, spec] of Object.entries(UPGRADE_SPECS)) state.built[id] = saved.built?.[id] === true || state.upgrades[spec.levelKey] > initial[spec.levelKey];
  state.upgradePaid = counters(resetPaid(), saved.upgradePaid);
  for (const id of Object.keys(state.upgradePaid)) state.upgradePaid[id] = Math.floor(Math.min(state.upgradePaid[id], upgradeCost(state, id) - 1));
  Object.assign(state.player, counters({ raw: 0, cuts: 0, goods: 0, cash: 0, hp: 100 }, saved.player));
  state.materials = counters(resetMaterials(), saved.materials);
  state.crafting = counters(resetCrafting(), saved.crafting);
  for (const key of Object.keys(state.crafting)) state.crafting[key] = Math.floor(Math.min(3, state.crafting[key]));
  for (const key of Object.keys(state.materials)) state.materials[key] = Math.floor(state.materials[key]);
  state.player.hpMax = 100 + state.crafting.lining * 20;
  state.player.hp = Math.min(state.player.hp, state.player.hpMax);
  state.processor = counters(resetProcessor(), saved.processor);
  state.canner = counters(resetCanner(), saved.canner);
  for (const store of [state.processor, state.canner]) {
    for (const key of ['rawStored', 'cutsStored', 'goodsStored']) if (key in store) store[key] = Math.floor(Math.min(STORAGE_LIMIT, store[key]));
    store.timer = Math.min(1.6, store.timer);
  }
  state.conveyor = resetConveyor();
  state.conveyor.timer = finite(saved.conveyor?.timer, 0, 0.8);
  state.conveyor.sequence = finite(saved.conveyor?.sequence);
  state.conveyor.items = list(saved.conveyor?.items).slice(0, STORAGE_LIMIT).map(item => ({ id: finite(item?.id), progress: finite(item?.progress, 0, 1) }));
  drops.splice(0, drops.length, ...list(saved.drops).map(d => ({ type: ['fur', 'ore', 'core'].includes(d?.type) ? d.type : 'raw', amount: Math.max(1, Math.floor(finite(d?.amount, 1, Number.MAX_SAFE_INTEGER))), ...point(d, { x: 1000, y: 3000 }), life: 0, vy: 0 })));
  state.automation = resetAutomation();
  const d = saved.automation?.drones?.delivery;
  if (d && ['idle', 'loading', 'unloading', 'return'].includes(d.phase)) {
    const cargo = finite(d.cargo, 0, 12);
    const phase = cargo > 0 && ['idle', 'loading'].includes(d.phase) ? 'unloading' : d.phase;
    const zone = { loading: STATIONS.cannerOut, unloading: STATIONS.market, return: STATIONS.delivery }[phase];
    Object.assign(state.automation.drones.delivery, point(d, state.automation.drones.delivery), {
      phase, cargo, target: zone ? { x: zone.modelX ?? zone.x, y: zone.modelY } : null
    });
  }
  const w = saved.automation?.worker;
  if (w && ['idle', 'collecting', 'unloading', 'down'].includes(w.phase)) {
    const worker = state.automation.worker;
    Object.assign(worker, point(w, worker), { hp: finite(w.hp, 120, 210), hpMax: 120 + state.upgrades.pickup * 30, cargo: finite(w.cargo, 0, 16), phase: w.phase, route: list(w.route).map(p => point(p, worker)) });
    worker.hp = Math.min(worker.hp, worker.hpMax);
    worker.target = Number.isInteger(saved.workerTargetIndex) && saved.workerTargetIndex >= 0 ? drops[saved.workerTargetIndex] ?? null : null;
    if (worker.phase === 'collecting' && worker.target && worker.route.length) worker.route[worker.route.length - 1] = worker.target;
  }
  state.shipping = resetShipping();
  state.shipping.queued = finite(saved.shipping?.queued);
  state.shipping.dispatched = finite(saved.shipping?.dispatched);
  if (list(saved.shipping?.flights).length) state.shipping.flights = saved.shipping.flights.slice(0, state.upgrades.fleet).map((f, index) => ({
    ...point(f, newFlight(index)), index, phase: ['idle', 'loading', 'outbound', 'return'].includes(f?.phase) ? f.phase : 'idle',
    cargo: finite(f?.cargo, 0, 6), timer: finite(f?.timer, 0, 1.5)
  }));
  state.rules = enemyRules(state.stage);
  state.fenceHpMax = state.rules.fenceHp;
  state.fenceHp = finite(saved.fenceHp, state.fenceHpMax, state.fenceHpMax);
  state.defense.breach = state.fenceHp <= 0;
  compactGroundMeat(drops, state.automation.worker.target);
}
