import { IPL_PLAYERS } from '../data/players.js';
import { TEAMS } from '../data/teams.js';
import { buildRatings } from './playerRating.js';
import { MODE_META } from './format.js';

export const PLAYERS_BY_ID = new Map(IPL_PLAYERS.map(p => [p.id, p]));
export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
export const RATINGS = buildRatings(IPL_PLAYERS);

export const ratingOf = (playerId) => RATINGS.get(playerId) ?? 0;

// How many players go under the hammer in this mode
export const auctionPoolSize = (auctionType) => MODE_META[auctionType]?.pool ?? IPL_PLAYERS.length;

// A squad entry from the server ({ id, bid }) joined with the player's details
export const withPlayer = (entry) => {
  const player = PLAYERS_BY_ID.get(entry.id);
  return player ? { ...player, bid: entry.bid, rating: ratingOf(entry.id) } : null;
};

// Arena Strength: how good a squad is on paper. The average Arena Rating of its
// best XI (an empty place counts as zero) makes up most of it, and the whole
// squad's average adds a little for depth.
export function teamStrength(squadEntries, squadLimit = 25) {
  const ratings = squadEntries.map(withPlayer).filter(Boolean).map(p => p.rating).sort((a, b) => b - a);
  if (ratings.length === 0) return { score: 0, core: 0, depth: 0 };
  const xiSize = Math.min(11, squadLimit);
  const total = (list) => list.reduce((sum, rating) => sum + rating, 0);
  const core = total(ratings.slice(0, xiSize)) / xiSize;
  const depth = total(ratings) / ratings.length;
  return { score: Math.round(core * 0.75 + depth * 0.25), core: Math.round(core), depth: Math.round(depth) };
}
