import { IPL_PLAYERS } from '../data/players.js';
import { TEAMS } from '../data/teams.js';

export const PLAYERS_BY_ID = new Map(IPL_PLAYERS.map(p => [p.id, p]));
export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
