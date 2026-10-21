import createElement from './vendor/lucide/createElement.js';
import Flag from './vendor/lucide/icons/flag.js';
import Pause from './vendor/lucide/icons/pause.js';
import Play from './vendor/lucide/icons/play.js';
import Coins from './vendor/lucide/icons/coins.js';
import Shield from './vendor/lucide/icons/shield.js';
import Package from './vendor/lucide/icons/package.js';
import Beef from './vendor/lucide/icons/beef.js';
import Layers from './vendor/lucide/icons/layers.js';
import Snowflake from './vendor/lucide/icons/snowflake.js';
import Trophy from './vendor/lucide/icons/trophy.js';
import Volume from './vendor/lucide/icons/volume-2.js';
import Muted from './vendor/lucide/icons/volume-x.js';
import Chevron from './vendor/lucide/icons/chevron-down.js';
import Navigation from './vendor/lucide/icons/navigation.js';
import House from './vendor/lucide/icons/house.js';
import Settings from './vendor/lucide/icons/settings.js';
import Close from './vendor/lucide/icons/x.js';
const nodes = { settings: Settings, close: Close, home: House, flag: Flag, pause: Pause, play: Play, coins: Coins, shield: Shield, package: Package, beef: Beef, layers: Layers, snow: Snowflake, trophy: Trophy, volume: Volume, muted: Muted, chevron: Chevron, navigation: Navigation };
export function icon(name, size = 20) {
  const node = createElement(nodes[name]); node.setAttribute('width', size); node.setAttribute('height', size); node.setAttribute('aria-hidden', 'true'); return node;
}
export function buttonIcon(button, name, label) {
  button.replaceChildren(icon(name)); button.title = label; button.setAttribute('aria-label', label);
}
