import { IPL_PLAYERS } from '../data/players.js';
import { TEAMS } from '../data/teams.js';
import { buildRatings } from './playerRating.js';

export const PLAYERS_BY_ID = new Map(IPL_PLAYERS.map(p => [p.id, p]));
export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
export const RATINGS = buildRatings(IPL_PLAYERS);

export const ratingOf = (playerId) => RATINGS.get(playerId) ?? 0;

// A squad entry from the server ({ id, bid }) joined with the player's details
export const withPlayer = (entry) => {
  const player = PLAYERS_BY_ID.get(entry.id);
  return player ? { ...player, bid: entry.bid, rating: ratingOf(entry.id) } : null;
};
