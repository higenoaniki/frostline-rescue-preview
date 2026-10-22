export const facilityJoints = ['wheel','dish','saw','piston','hammer','needle','pulley','hook','radar','gauge--42','gauge-42'];

export function facilityWorking(id, state) {
  const processor = state.processor.rawStored > 0 && state.processor.cutsStored < 72;
  const canner = state.canner.cutsStored > 0 && state.canner.goodsStored < 72;
  if (id === 'processorIn') return processor;
  if (id === 'cannerIn') return canner;
  if (id === 'machine') return processor || canner;
  if (id === 'conveyor') return state.conveyor.items.length > 0;
  if (id === 'fleet' || id === 'delivery') return state.shipping.flights.some(f => f.phase !== 'idle');
  if (id === 'hunter') return !!state.hunter.motion;
  return state.investment?.id === id;
}

export function updateFacilityMotion(station, id, state) {
  if (!station.motion) {
    station.motion = new Map(facilityJoints.map(name => [name, station.model.getObjectByName(name)]).filter(([,node]) => node));
    for (const node of station.motion.values()) node.userData.rest = node.position.clone();
    station.craftingSignature = JSON.stringify(state.crafting);
  }
  const signature = JSON.stringify(state.crafting);
  if (signature !== station.craftingSignature && ['forge','armor','weapon'].includes(id)) station.craftUntil = state.elapsed + 2;
  station.craftingSignature = signature;
  const working = facilityWorking(id, state) || state.elapsed < (station.craftUntil ?? 0);
  const time = state.elapsed, phase = Math.sin(time * 8), wave = (1 - Math.cos(time * 8)) * .5;
  for (const [name, node] of station.motion) {
    const rest = node.userData.rest;
    if (name === 'wheel' || name === 'pulley') { if (working) node.rotation.z = time * 2.8; }
    else if (name === 'saw') node.position.y = rest.y + (working ? wave * 17 : 0);
    else if (name === 'piston') node.position.y = rest.y - (working ? wave * 15 : 0);
    else if (name === 'hammer') { node.rotation.x = working ? -.3 * (1 - wave) : 0; node.position.y = rest.y - (working ? wave * 20 : 0); }
    else if (name === 'needle') node.position.y = rest.y + (working ? wave * 4 : 0);
    else if (name.startsWith('gauge')) node.rotation.z = working ? phase * .35 : -.5;
    else if (name === 'hook') node.position.y = rest.y + (working ? phase * 8 : 0);
    else if (name === 'radar') node.rotation.y = time * (working ? 1.1 : .18);
    else if (name === 'dish') node.rotation.y = Math.sin(time * .35) * .3;
  }
}
