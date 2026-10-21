import { ArtModels } from './art-models.js';
import { sculptedModel, sculptedPerson, sculptedBeast } from './sculpted-assets.js';

// The primitive helpers remain for roads, collision markers and effects only.
// Every character, creature, facility and carried item comes from the mesh library.
export class SculptedArtModels extends ArtModels {
  humanoid(color = 'red') { return sculptedPerson(color !== 'red'); }
  creature(kind = 'normal') { return sculptedBeast(kind); }
  item(type) { return sculptedModel(`item-${type}`); }
  processor(canner = false) { return sculptedModel(canner ? 'canner' : 'processor'); }
  forge() { return sculptedModel('forge'); }
  beacon() { return sculptedModel('beacon'); }
  upgradeWorkshop(role) { return sculptedModel(role); }
  dispatchDepot() { return sculptedModel('depot'); }
  rack() { return sculptedModel('rack'); }
  bench() { return sculptedModel('weapon'); }
  armorStand() { return sculptedModel('armor'); }
  workerOffice() { const g = sculptedModel('worker'); g.scale.setScalar(.65); return g; }
  heater() { return sculptedModel('heater'); }
  rock() { return sculptedModel('rock'); }
  tree() { return sculptedModel('pine'); }
  fencePanel() { return sculptedModel('fence-panel'); }
  fencePost() { return sculptedModel('fence-post'); }
  gatePanel() { return sculptedModel('gate-panel'); }
  refuge() { return sculptedModel('refuge'); }
  crate() { const g = this.item('goods'); g.scale.set(1.25, 1.4, 1.3); return g; }
  hunterTower() {
    const g = sculptedModel('hunter-tower'); g.userData.turret = g.getObjectByName('turret'); return g;
  }
  droneDock() { const g = sculptedModel('fleet'); g.scale.setScalar(.72); return g; }
  drone() {
    const g = sculptedModel('drone');
    g.userData = { rotors: Array.from({ length: 4 }, (_, i) => g.getObjectByName(`rotor${i}`)), cargo: g.getObjectByName('cargo') };
    return g;
  }
}
