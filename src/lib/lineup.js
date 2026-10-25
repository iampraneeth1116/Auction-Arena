import { ratingOf, xiOverseasCap } from './catalog.js';
import { isOverseas } from './format.js';
import { profileOf } from './playerProfile.js';

// A manager's own playing XI in their batting order. It's for show: Arena Strength,
// standings and the AI rankings keep judging the best XI (see teamStrength).

// Where each batting position goes in the order, and where players without a known position go
const ORDER_RANK = { open: 0, top: 1, middle: 2, finish: 3, tail: 4 };
const ROLE_RANK = { Batsman: 2, 'Wicket-Keeper': 2, 'All-Rounder': 3, Bowler: 4 };
const battingRank = (player) => ORDER_RANK[profileOf(player).order] ?? ROLE_RANK[player.role] ?? 2;

// Openers, top order, middle order, finishers, then the tail; the better-rated first within each
export function suggestBattingOrder(players) {
  return [...players].sort((a, b) => battingRank(a) - battingRank(b) || ratingOf(b.id) - ratingOf(a.id));
}

// How many players the XI must have: 11 (5 in the 5-player modes), or fewer when the
// squad can't field that many within the XI's overseas cap
export function lineupRules(squadPlayers, squadLimit, overseasLimit) {
  const xiSize = Math.min(11, squadLimit);
  const overseasCap = xiOverseasCap(squadLimit, overseasLimit, xiSize);
  const overseas = squadPlayers.filter(isOverseas).length;
  const size = Math.min(xiSize, squadPlayers.length - overseas + Math.min(overseas, overseasCap));
  return { size, overseasCap };
}

// Why a batting order can't be saved, or null if it can
export function lineupProblem(playerIds, squadPlayers, squadLimit, overseasLimit) {
  if (!Array.isArray(playerIds) || playerIds.length > 11 || playerIds.some(id => typeof id !== 'string')) {
    return 'Invalid batting order';
  }
  if (new Set(playerIds).size !== playerIds.length) return 'A player can only bat once';
  const owned = new Map(squadPlayers.map(p => [p.id, p]));
  if (!playerIds.every(id => owned.has(id))) return 'You can only pick players you bought';
  const { size, overseasCap } = lineupRules(squadPlayers, squadLimit, overseasLimit);
  if (playerIds.length !== size) return `Your XI needs ${size} players`;
  if (playerIds.filter(id => isOverseas(owned.get(id))).length > overseasCap) {
    return `At most ${overseasCap} overseas players in the XI`;
  }
  return null;
}

// The XI a team shows: the manager's batting order if they saved one, else its best XI in
// the suggested order. players and bestXI are the team's players; the result uses the
// objects from players.
export function lineupFor(players, bestXI, battingOrder = []) {
  const byId = new Map(players.map(p => [p.id, p]));
  const saved = battingOrder.map(id => byId.get(id)).filter(Boolean);
  const custom = saved.length > 0 && saved.length === battingOrder.length;
  const xi = custom ? saved : suggestBattingOrder(bestXI).map(p => byId.get(p.id)).filter(Boolean);
  const inXI = new Set(xi.map(p => p.id));
  return { xi, bench: players.filter(p => !inXI.has(p.id)), custom };
}
