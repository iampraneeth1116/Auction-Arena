import { TEAMS } from '../src/data/teams.js';

// Money is whole lakhs on the server (1 Cr = 100 L) so repeated increments never
// pick up floating-point drift. The client sends and receives crores.
export const AUCTION_MODES = {
  mega: { squadLimit: 25, overseasLimit: 8, budgetLakhs: 12000 },
};

export const DEFAULT_BID_TIMER = 10;

export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));

export const toLakhs = (crores) => Math.round(crores * 100);
export const toCrores = (lakhs) => lakhs / 100;
