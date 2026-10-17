import { IPL_PLAYERS } from '../src/data/players.js';
import { TEAMS } from '../src/data/teams.js';

// Money is whole lakhs on the server (1 Cr = 100 L) so repeated increments never
// pick up floating-point drift. The client sends and receives crores.
export const AUCTION_MODES = {
  mega: { squadLimit: 25, overseasLimit: 8, budgetLakhs: 12000 },
};

export const DEFAULT_BID_TIMER = 10;
export const MIN_BID_TIMER = 3;
export const MAX_BID_TIMER = 60;
// The first player gets longer, so everyone has time to arrive in the auction room
export const FIRST_PLAYER_MS = 15000;
// How long the SOLD / UNSOLD card stays up before the next player
export const SOLD_CARD_MS = 5000;
export const UNSOLD_CARD_MS = 2000;

export const PLAYERS_BY_ID = new Map(IPL_PLAYERS.map(p => [p.id, p]));
export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));

export const toLakhs = (crores) => Math.round(crores * 100);
export const toCrores = (lakhs) => lakhs / 100;

// First bid is the base price, then +20 L below ₹5 Cr and +25 L above
export function nextBidLakhs(currentLakhs, player) {
  if (currentLakhs === 0) return toLakhs(player.basePrice);
  return currentLakhs + (currentLakhs < 500 ? 20 : 25);
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// The order players come up in, as indexes into IPL_PLAYERS: sets run in the
// order they first appear in players.js, and players shuffle within a set
export function buildPlayerOrder() {
  const indicesBySet = new Map();
  IPL_PLAYERS.forEach((player, index) => {
    if (!indicesBySet.has(player.set)) indicesBySet.set(player.set, []);
    indicesBySet.get(player.set).push(index);
  });
  return [...indicesBySet.values()].flatMap(shuffle);
}
