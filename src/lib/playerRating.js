import { PLAYER_OUTLOOK } from '../data/playerOutlook.js';

// Arena Rating: a 1–99 score for every player.
//
// Career stats in the player list are patchy, so they can't carry a rating on
// their own. Instead the player's auction tier (marquee, Set 1 … uncapped, which
// reflects their real-world standing) sets a band, and their stats place them
// inside it by comparison with every other player in the same role. The best
// bowler in the marquee set therefore rates as highly as the best batter, and an
// all-rounder is judged on both suits. Last comes the player's outlook for the next
// IPL (data/playerOutlook.js): recent form, breakouts, decline and availability,
// which career numbers can't see.

const num = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const statLine = (player) => {
  const s = player.stats || {};
  return { runs: num(s.runs), avg: num(s.avg), sr: num(s.sr), wickets: num(s.wickets), econ: num(s.econ) };
};

// The band each auction tier rates within
const SET_BANDS = {
  'Marquee Set 1': [82, 96],
  'Set 1': [74, 88],
  'Set 2': [68, 82],
  'Set 3': [62, 76],
  'Set 4': [55, 70],
};
// Other sets are banded by base price; uncapped players sit a little lower
const PRICE_BANDS = [
  [2, [70, 85]],
  [1.5, [66, 81]],
  [1, [62, 77]],
  [0.75, [58, 73]],
  [0.5, [50, 66]],
  [0, [32, 56]],
];

function bandFor(player) {
  if (SET_BANDS[player.set]) return SET_BANDS[player.set];
  const [, band] = PRICE_BANDS.find(([price]) => player.basePrice >= price);
  return player.set.startsWith('U') ? [band[0], band[1] - 4] : band;
}

// Batting: average × strike rate (the usual T20 batting index), plus credit for a
// big career. Trust grows with career runs (half at 700).
function batting({ runs, avg, sr }) {
  if (runs <= 0 || avg <= 0 || sr <= 0) return { score: 0, trust: 0 };
  return { score: (avg * sr) / 100 + Math.min(12, runs / 500), trust: runs / (runs + 700) };
}

// Bowling: economy first, plus credit for career wickets. Trust grows with wickets (half at 35).
function bowling({ wickets, econ }) {
  if (wickets <= 0 || econ <= 0) return { score: 0, trust: 0 };
  return { score: (10 - econ) * 12 + Math.min(14, wickets / 15), trust: wickets / (wickets + 35) };
}

const sortedScores = (players, skill) =>
  players.map(p => skill(statLine(p))).filter(s => s.trust > 0.3).map(s => s.score).sort((a, b) => a - b);

// Share of the comparison group this score beats (0–1)
function percentile(sorted, score) {
  if (sorted.length < 2) return 0.5;
  let below = 0;
  while (below < sorted.length && sorted[below] < score) below++;
  return below / (sorted.length - 1);
}

// Where the player sits within their band (0–1). With little data they stay near the middle.
function placement(player, batScores, bowlScores) {
  const line = statLine(player);
  const settle = (sorted, { score, trust }) => trust * percentile(sorted, score) + (1 - trust) * 0.5;
  const bat = settle(batScores, batting(line));
  const bowl = settle(bowlScores, bowling(line));
  if (player.role === 'Bowler') return bowl;
  if (player.role === 'All-Rounder') {
    // The stronger suit leads; the other still counts for 30%
    const [strong, weak] = bat >= bowl ? [bat, bowl] : [bowl, bat];
    return strong * 0.7 + weak * 0.3;
  }
  return bat; // batters and keepers
}

// Ratings for a whole player list, keyed by player id. Stats are compared across the list
// passed in; outlook adjustments (by default the reviewed list) are applied last.
export function buildRatings(players, outlook = PLAYER_OUTLOOK) {
  const batScores = sortedScores(players, batting);
  const bowlScores = sortedScores(players, bowling);
  return new Map(players.map(player => {
    const [low, high] = bandFor(player);
    const fromCareer = Math.round(low + (high - low) * placement(player, batScores, bowlScores));
    const rating = fromCareer + (outlook[player.id]?.change ?? 0);
    return [player.id, Math.max(1, Math.min(99, rating))];
  }));
}

// A player's next-IPL outlook ({ change, note }), or null when their career numbers tell the story
export const outlookOf = (playerId) => PLAYER_OUTLOOK[playerId] ?? null;

export const ratingTier = (rating) =>
  rating >= 90 ? 'elite' : rating >= 80 ? 'star' : rating >= 65 ? 'solid' : rating >= 50 ? 'squad' : 'prospect';

export const TIER_LABELS = { elite: 'Elite', star: 'Star', solid: 'Solid', squad: 'Squad player', prospect: 'Prospect' };
