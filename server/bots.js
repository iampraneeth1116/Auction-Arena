import { IPL_PLAYERS } from '../src/data/players.js';
import { PLAYERS_BY_ID, RATINGS, isOverseas, nextBidLakhs, toLakhs } from './auctionRules.js';
import { profileOf } from '../src/lib/playerProfile.js';
import { xiNeeds } from '../src/lib/catalog.js';

// Auto-managers for franchises nobody claimed. Every decision is made on the
// server from the same rules humans bid under, so a bot can never break a squad,
// overseas or budget limit. All money here is in lakhs.

// The jobs a bot wants its squad to cover, as a share of its squad limit
const JOB_TARGETS = { batting: 0.5, bowling: 0.45, keeping: 0.1 };

// Which jobs each role does. All-rounders bat and bowl, keepers keep and bat.
const ROLE_JOBS = {
  'Batsman': ['batting'],
  'Wicket-Keeper': ['keeping', 'batting'],
  'All-Rounder': ['batting', 'bowling'],
  'Bowler': ['bowling'],
};

// Each franchise's bot leans a different way, so bot-filled rooms don't all draft alike
const STYLES = {
  MI: { favours: 'Bowler', boldness: 1.1 },
  CSK: { favours: 'All-Rounder', boldness: 0.9 },
  RCB: { favours: 'Batsman', boldness: 1.15 },
  KKR: { favours: 'All-Rounder', boldness: 1.0 },
  DC: { favours: 'Batsman', boldness: 0.95 },
  PBKS: { favours: 'Bowler', boldness: 1.05 },
  RR: { favours: 'All-Rounder', boldness: 0.95 },
  SRH: { favours: 'Batsman', boldness: 1.1 },
  GT: { favours: 'Bowler', boldness: 0.9 },
  LSG: { favours: 'Wicket-Keeper', boldness: 1.0 },
};

export const botUserId = (teamId) => `bot_${teamId}`;
export const botName = (teamId) => `${teamId} Bot`;

// How keen this bot is on this player, rolled once per player so it can't
// change its mind mid-bidding: 0.8–1.2
export const rollMood = () => 0.8 + Math.random() * 0.4;

// What every bot needs to know about the auction as a whole, worked out once per lot:
// how good the pool is, how many lots are left, what cheap players still cost, and
// whether this is a later round of unsold players (they're added to the end of the order)
export function readMarket({ playerOrder, currentIndex, openSlotsByTeam }) {
  const pool = playerOrder.map(index => IPL_PLAYERS[index]);
  const upcoming = pool.slice(currentIndex);
  const prices = upcoming.map(p => toLakhs(p.basePrice)).sort((a, b) => a - b);
  const hungryTeams = openSlotsByTeam.filter(open => open > 0).length;
  return {
    // The players still to come after this one, with their profiles
    later: upcoming.slice(1).map(p => [p, profileOf(p)]),
    poolRating: pool.reduce((sum, p) => sum + (RATINGS.get(p.id) ?? 40), 0) / Math.max(1, pool.length),
    lotsLeft: upcoming.length,
    // A quarter of the remaining lots are this cheap or cheaper
    reservePerSlot: prices[Math.floor(prices.length / 4)] ?? 30,
    fairShare: upcoming.length / Math.max(1, hungryTeams),
    repeatRound: currentIndex >= new Set(playerOrder).size,
  };
}

const needFor = (have, target) => (have < target ? 1.15 : have < target + 2 ? 0.75 : 0.35);

// How much the squad needs this kind of player, from the jobs they'd fill
function roleNeed(squadPlayers, role, squadLimit) {
  const covered = { batting: 0, bowling: 0, keeping: 0 };
  for (const p of squadPlayers) for (const job of ROLE_JOBS[p.role] ?? []) covered[job]++;
  const target = (job) => Math.max(1, Math.round(JOB_TARGETS[job] * squadLimit));
  const need = (job) => needFor(covered[job], target(job));

  if (role === 'All-Rounder') {
    // Fills both jobs, so it's worth a little extra while both are still open,
    // but a squad that's already ~40% all-rounders needs specialists more
    const allRounders = squadPlayers.filter(p => p.role === 'All-Rounder').length;
    const plenty = allRounders >= Math.ceil(squadLimit * 0.4);
    return ((need('batting') + need('bowling')) / 2) * (plenty ? 0.5 : 1.05);
  }
  if (role === 'Wicket-Keeper') {
    // A keeper is a must; extra keepers only add batting, and a side rarely plays two
    return covered.keeping < target('keeping') ? 1.2 : need('batting') * 0.6;
  }
  return need(role === 'Bowler' ? 'bowling' : 'batting');
}

// The jobs a playing XI needs covered (the same needs Arena Strength judges, see
// judgeXI in src/lib/catalog.js), who does each one, and the points a gap costs there
const bowls = (p) => p.role === 'Bowler' || p.role === 'All-Rounder';
const bats = (p) => p.role !== 'Bowler';
const XI_JOBS = [
  { cost: 8, need: () => 1, does: (p) => p.role === 'Wicket-Keeper' },
  { cost: 6, need: (n) => n.bowling, does: bowls },
  { cost: 5, need: (n) => n.batting, does: bats },
  { cost: 3, need: (n) => n.openers, does: (p, pr) => bats(p) && pr.order === 'open' },
  { cost: 3, need: (n) => n.finisher, does: (p, pr) => bats(p) && pr.order === 'finish' },
  { cost: 3, need: (n) => n.pace, does: (p, pr) => bowls(p) && pr.bowling === 'pace' },
  { cost: 3, need: (n) => n.spin, does: (p, pr) => bowls(p) && pr.bowling === 'spin' },
  { cost: 2, need: (n) => n.powerplay, does: (p, pr) => bowls(p) && Boolean(pr.phases?.includes('pp')) },
  { cost: 3, need: (n) => n.death, does: (p, pr) => bowls(p) && Boolean(pr.phases?.includes('death')) },
];

// How keen the squad's gaps make a bot on this player. A player who fills jobs the
// squad still lacks is worth more, the more those gaps would cost (a keeper most);
// once there are about as many unfilled jobs as open places, a bot holds out for
// players who fill one, as long as enough lots are left to wait for them and
// someone still to come could.
function xiNeed(squadPlayers, player, squadLimit, market) {
  const needs = xiNeeds(Math.min(11, squadLimit));
  const withProfile = (p) => [p, profileOf(p)];
  const squad = squadPlayers.map(withProfile);
  const missing = XI_JOBS.filter(job => squad.filter(([p, pr]) => job.does(p, pr)).length < job.need(needs));
  if (missing.length === 0) return 1;
  const [, profile] = withProfile(player);
  const filled = missing.filter(job => job.does(player, profile)).reduce((sum, job) => sum + job.cost, 0);
  const openSlots = squadLimit - squadPlayers.length;
  const tight = missing.length >= openSlots;
  const canWait = market.fairShare >= openSlots * 2
    && missing.some(job => market.later.some(([p, pr]) => job.does(p, pr)));
  if (filled === 0) return tight && canWait ? 0.35 : 1;
  return 1 + filled * (tight ? 0.04 : 0.015);
}

// The most this bot will pay for the player, in lakhs
export function botValuation({ player, member, squadPlayers, room, market, mood }) {
  const openSlots = room.squadLimit - squadPlayers.length;
  if (openSlots <= 0) return 0;

  const style = STYLES[member.teamId] ?? { favours: null, boldness: 1 };
  const rating = RATINGS.get(player.id) ?? 40;
  const basePrice = toLakhs(player.basePrice);

  // A player as good as the pool's average is worth one average slot;
  // every 10 rating points above it doubles that
  const perSlot = member.budgetRemaining / openSlots;
  const quality = 2 ** ((rating - market.poolRating) / 10);
  const favour = player.role === style.favours ? 1.12 : 1;
  const urgency = openSlots <= 2 ? 1.25 : 1;
  const need = roleNeed(squadPlayers, player.role, room.squadLimit) * xiNeed(squadPlayers, player, room.squadLimit, market);
  let value = perSlot * quality * need * favour * style.boldness * urgency;

  // One star can take ~22% of the purse in a mega auction, up to ~35% in a 5-player one
  const starShare = 0.22 + ((25 - room.squadLimit) / 25) * 0.17;
  value = Math.min(value, room.budget * starShare) * mood;

  // Falling behind on filling the squad, or a player back in a round of unsold
  // players (money left at the end is worth nothing): take him at his base price
  if (openSlots >= market.fairShare * 0.8 || market.repeatRound) value = Math.max(value, basePrice);

  // Always keep enough for the rest of the squad at the going cheap price
  value = Math.min(value, member.budgetRemaining - (openSlots - 1) * market.reservePerSlot);
  return Math.floor(value);
}

// The bid this bot would make right now, or null to stay out. eagerness is how
// far the price still is from the bot's limit: 1 = a bargain, 0 = at the limit.
export function botOffer({ live, member, squadPlayers, room, market, mood }) {
  if (live.highBidderId === member.userId) return null;
  if (squadPlayers.length >= room.squadLimit) return null;

  const player = PLAYERS_BY_ID.get(live.playerId);
  if (isOverseas(player) && squadPlayers.filter(isOverseas).length >= room.overseasLimit) return null;

  const amount = nextBidLakhs(live.currentBid, player);
  const value = botValuation({ player, member, squadPlayers, room, market, mood });
  if (amount > value) return null;
  return { amount, eagerness: 1 - amount / value, opening: !live.highBidderId };
}

// Near its limit a bot sometimes drops out of a bidding war, so prices don't always
// hit the ceiling. It never balks at opening the bidding: a player it wants at the
// base price shouldn't go unsold.
export const botHesitates = (offer) => !offer.opening && offer.eagerness < 0.15 && Math.random() < 0.4;

// How long a bot "thinks" before raising. Paddles go up fast while the price is
// a bargain and slow down near the limit, sometimes with a late bid. Never in
// the last 600 ms, so a person always gets the final word.
export function botThinkMs(bidTimerSeconds, remainingMs, eagerness) {
  let wanted;
  if (eagerness > 0.5) {
    wanted = 350 + Math.random() * 550;
  } else if (eagerness > 0.2) {
    wanted = 900 + Math.random() * 1300;
  } else {
    wanted = remainingMs - bidTimerSeconds * 1000 * (0.2 + Math.random() * 0.2);
  }
  return Math.max(400, Math.min(wanted, remainingMs - 600));
}

const XI_SIZE = 11;
const MAX_OVERSEAS_IN_XI = 4;
const MIN_FANTASY_PLAYERS = 5;

// A bot's fantasy XI once the auction ends: its best-rated players within the
// overseas limit, always with a keeper if it bought one. Captain and vice-captain
// are its two best; the impact player is the best one left on the bench.
export function pickBotXI(squadPlayers) {
  if (squadPlayers.length < MIN_FANTASY_PLAYERS) return null;
  const ranked = [...squadPlayers].sort((a, b) => (RATINGS.get(b.id) ?? 0) - (RATINGS.get(a.id) ?? 0));

  const xi = [];
  for (const player of ranked) {
    if (xi.length === XI_SIZE) break;
    if (isOverseas(player) && xi.filter(isOverseas).length >= MAX_OVERSEAS_IN_XI) continue;
    xi.push(player);
  }

  const keeper = ranked.find(p => p.role === 'Wicket-Keeper' && !xi.includes(p));
  if (keeper && !xi.some(p => p.role === 'Wicket-Keeper') && xi.length === XI_SIZE) {
    // Swap the weakest Indian player out for an Indian keeper. An overseas keeper replaces
    // the weakest player who keeps the XI within the overseas limit.
    const roomForOverseas = xi.filter(isOverseas).length < MAX_OVERSEAS_IN_XI;
    const out = [...xi].reverse().find(p => (isOverseas(keeper) ? isOverseas(p) || roomForOverseas : !isOverseas(p)));
    if (out) xi.splice(xi.indexOf(out), 1, keeper);
  }

  const overseasInXI = xi.filter(isOverseas).length;
  const impact = ranked.find(p => !xi.includes(p) && (!isOverseas(p) || overseasInXI < MAX_OVERSEAS_IN_XI));
  const byRating = [...xi].sort((a, b) => (RATINGS.get(b.id) ?? 0) - (RATINGS.get(a.id) ?? 0));
  return {
    players: xi.map(p => p.id),
    captain: byRating[0].id,
    viceCaptain: byRating[1].id,
    impactPlayer: impact?.id ?? null,
  };
}
