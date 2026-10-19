import { IPL_PLAYERS } from '../src/data/players.js';
import { TEAMS } from '../src/data/teams.js';
import { buildRatings } from '../src/lib/playerRating.js';

// Money is whole lakhs on the server (1 Cr = 100 L) so repeated increments never
// pick up floating-point drift. The client sends and receives crores.
// poolSize: how many players go under the hammer (null = the full list)
// bidTimer: seconds per bid when the room is created (the host can change it)
export const AUCTION_MODES = {
  mega: { squadLimit: 25, overseasLimit: 8, budgetLakhs: 12000, poolSize: null },
  sprint11: { squadLimit: 11, overseasLimit: 4, budgetLakhs: 9000, poolSize: 150 },
  sprint5: { squadLimit: 5, overseasLimit: 2, budgetLakhs: 6000, poolSize: 80 },
  // A quick game: a small purse keeps prices down and every bid has only 3 seconds
  blitz5: { squadLimit: 5, overseasLimit: 2, budgetLakhs: 3000, poolSize: 80, bidTimer: 3 },
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
export const RATINGS = buildRatings(IPL_PLAYERS);

export const toLakhs = (crores) => Math.round(crores * 100);
export const toCrores = (lakhs) => lakhs / 100;

export const isOverseas = (player) => player.country !== 'IND';

// First bid is the base price, then +20 L below ₹5 Cr and +25 L above
export function nextBidLakhs(currentLakhs, player) {
  if (currentLakhs === 0) return toLakhs(player.basePrice);
  return currentLakhs + (currentLakhs < 500 ? 20 : 25);
}

const isMarquee = (player) => player.set.startsWith('Marquee');

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Rotate unsold: once every player has been called, this round's unsold players
// come back for another round, as long as that can still change something: the
// round just played sold at least one player, and a franchise with an open slot
// can afford the cheapest of them. Returns the player indexes to call again, or null.
export function planUnsoldRound({ playerOrder, roundStart, soldPlayerIds, buyers }) {
  const round = playerOrder.slice(roundStart);
  const unsold = round.filter(index => !soldPlayerIds.has(IPL_PLAYERS[index].id));
  if (unsold.length === 0 || unsold.length === round.length) return null;
  const cheapest = Math.min(...unsold.map(index => toLakhs(IPL_PLAYERS[index].basePrice)));
  const someoneCanBuy = buyers.some(b => b.openSlots > 0 && b.budgetLakhs >= cheapest);
  return someoneCanBuy ? unsold : null;
}

// Quick pool: just enough players for the franchises taking part, plus spares
export const QUICK_POOL_SPARES = 10;
export const quickPoolSize = (franchises, squadLimit) => Math.max(1, franchises) * squadLimit + QUICK_POOL_SPARES;

// Draws that many players at random from the candidates, sharing the places out
// by role in the same mix as the candidates
function pickByRole(candidates, places, chosen) {
  const byRole = new Map();
  for (const index of candidates) {
    const role = IPL_PLAYERS[index].role;
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(index);
  }
  const drawn = [];
  for (const indices of byRole.values()) {
    const quota = Math.round((indices.length / candidates.length) * places);
    shuffle(indices).forEach((index, rank) => drawn.push({ index, inQuota: rank < quota }));
  }
  // Rounding can leave the quotas a place or two off: top up or trim to the exact size
  const picked = drawn.filter(d => d.inQuota).map(d => d.index).slice(0, places);
  for (const d of shuffle(drawn)) {
    if (picked.length >= places) break;
    if (!d.inQuota) picked.push(d.index);
  }
  picked.forEach(index => chosen.add(index));
}

// Swaps the weakest picks that canGo (marquee players last) for the best players
// left out who are wanted, keeping roles level where it can, until at least min
// are in the pool
function ensureAtLeast(chosen, min, wanted, canGo) {
  let have = [...chosen].filter(index => wanted(IPL_PLAYERS[index])).length;
  if (have >= min) return;
  const scored = (index) => ({ index, score: RATINGS.get(IPL_PLAYERS[index].id) + Math.random() * 25 });
  const marqueeLast = (index) => (isMarquee(IPL_PLAYERS[index]) ? 1 : 0);
  const removable = [...chosen]
    .filter(index => canGo(IPL_PLAYERS[index]))
    .map(scored)
    .sort((a, b) => marqueeLast(a.index) - marqueeLast(b.index) || a.score - b.score);
  const available = IPL_PLAYERS
    .map((player, index) => index)
    .filter(index => !chosen.has(index) && wanted(IPL_PLAYERS[index]))
    .map(scored)
    .sort((a, b) => b.score - a.score);
  for (const { index: out } of removable) {
    if (have >= min || available.length === 0) break;
    const sameRole = available.findIndex(({ index }) => IPL_PLAYERS[index].role === IPL_PLAYERS[out].role);
    const [{ index: replacement }] = available.splice(Math.max(0, sameRole), 1);
    chosen.delete(out);
    chosen.add(replacement);
    have++;
  }
}

// How much bigger than the pool the group of top players it's drawn from is
const TOP_GROUP = 1.5;

// A shorter pool is drawn at random from the top-rated players, a group half as
// big again as the pool, so every room gets a different mix of stars instead of
// the same marquee set each time.
//
// The best players are mostly overseas, so a pool picked on rating alone can run
// short of Indians, and a squad that has used its overseas places then can't fill
// up or find a keeper. So every franchise gets an Indian keeper to go after, and
// there are enough Indians for every squad's non-overseas places plus half its
// overseas places, as not every squad uses them all.
function pickPool(poolSize, { franchises, minIndians }) {
  const chosen = new Set();
  // Highest rated first, with ties in a random order so the cut-off isn't always the same players
  const ranked = shuffle(IPL_PLAYERS.map((player, index) => index))
    .sort((a, b) => RATINGS.get(IPL_PLAYERS[b].id) - RATINGS.get(IPL_PLAYERS[a].id));
  pickByRole(ranked.slice(0, Math.ceil(poolSize * TOP_GROUP)), poolSize, chosen);
  const indian = (player) => !isOverseas(player);
  ensureAtLeast(chosen, franchises, p => indian(p) && p.role === 'Wicket-Keeper', p => p.role === 'Batsman');
  ensureAtLeast(chosen, minIndians, indian, isOverseas);
  return chosen;
}

// Sets run in the order they appear in players.js; players shuffle within a set.
// poolSize overrides the mode's own pool (used by the quick pool option). squads
// describes the room, so a smaller pool still has enough Indians for every squad;
// it defaults to all ten franchises under the mode's own limits.
export function buildPlayerOrder(auctionType = 'mega', poolSize = undefined, squads = {}) {
  const mode = AUCTION_MODES[auctionType] ?? AUCTION_MODES.mega;
  const size = poolSize ?? mode.poolSize;
  const { franchises = TEAMS.length, squadLimit = mode.squadLimit, overseasLimit = mode.overseasLimit } = squads;
  const overseasPlaces = franchises * Math.min(overseasLimit, squadLimit);
  const indianPlaces = franchises * squadLimit - overseasPlaces;
  const minIndians = Math.min(size ?? 0, indianPlaces + Math.ceil(overseasPlaces / 2));
  const pool = size && size < IPL_PLAYERS.length ? pickPool(size, { franchises, minIndians }) : null;

  const indicesBySet = new Map();
  IPL_PLAYERS.forEach((player, index) => {
    if (pool && !pool.has(index)) return;
    if (!indicesBySet.has(player.set)) indicesBySet.set(player.set, []);
    indicesBySet.get(player.set).push(index);
  });

  return [...indicesBySet.values()].flatMap(shuffle);
}
