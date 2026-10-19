import { IPL_PLAYERS } from '../data/players.js';
import { TEAMS } from '../data/teams.js';
import { buildRatings } from './playerRating.js';
import { MODE_META, isOverseas } from './format.js';
import { profileOf } from './playerProfile.js';

export const PLAYERS_BY_ID = new Map(IPL_PLAYERS.map(p => [p.id, p]));
export const TEAMS_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
export const RATINGS = buildRatings(IPL_PLAYERS);

export const ratingOf = (playerId) => RATINGS.get(playerId) ?? 0;

// How many players go under the hammer. With the quick pool it's one squad per
// franchise taking part plus 10 spares (the server works it out the same way at the start).
export const QUICK_POOL_SPARES = 10;
export function auctionPoolSize({ auctionType, quickPool, franchises, squadLimit }) {
  if (quickPool) return Math.max(1, franchises) * squadLimit + QUICK_POOL_SPARES;
  return MODE_META[auctionType]?.pool ?? IPL_PLAYERS.length;
}

// A squad entry from the server ({ id, bid }) joined with the player's details
export const withPlayer = (entry) => {
  const player = PLAYERS_BY_ID.get(entry.id);
  return player ? { ...player, bid: entry.bid, rating: ratingOf(entry.id), profile: profileOf(player) } : null;
};

// How a squad covers the jobs in a T20 side. All-rounders count as both a
// batting and a bowling option.
export function squadBalance(players) {
  const count = (role) => players.filter(p => p.role === role).length;
  const allRounders = count('All-Rounder');
  const keepers = count('Wicket-Keeper');
  return {
    keepers,
    allRounders,
    battingOptions: count('Batsman') + keepers + allRounders,
    bowlingOptions: count('Bowler') + allRounders,
  };
}

// What a playing XI needs, scaled down for the 5-player modes
export const xiNeeds = (xiSize) => {
  const full = xiSize >= 8;
  return {
    bowling: Math.min(5, Math.ceil(xiSize * 0.4)),
    batting: Math.min(6, Math.ceil(xiSize * 0.5)),
    openers: full ? 2 : 1,
    finisher: full ? 1 : 0,
    handMix: full,
    hitters: full ? 3 : 1,
    anchors: full,
    pace: full ? 2 : 1,
    spin: 1,
    powerplay: full ? 2 : 1,
    death: full ? 2 : 1,
    leftArm: full ? 1 : 0,
  };
};

// How many overseas players the XI may field. When the XI is the whole squad, the
// room's overseas limit already applies to it. In bigger squads the XI gets half the
// squad allowance, as in the IPL (4 of 8), so a host who allows more gets more here too.
export function xiOverseasCap(squadLimit, overseasLimit = 8, xiSize = Math.min(11, squadLimit)) {
  if (squadLimit <= xiSize) return xiSize;
  return Math.min(xiSize, Math.ceil(overseasLimit / 2));
}

const isBowlingOption = (p) => p.role === 'Bowler' || p.role === 'All-Rounder';

// Players known to do a job, and players we have no data on (who get the benefit of the doubt)
function tally(players, test) {
  let have = 0;
  let unsure = 0;
  for (const p of players) {
    const result = test(p.profile);
    if (result === null) unsure++;
    else if (result) have++;
  }
  return { have, unsure };
}

const knownOr = (value, test) => (value === null ? null : test(value));

// Judges an XI's combination: a keeper and enough batting and bowling first, then
// openers and a finisher, a left/right mix up top, power hitters and an anchor, pace
// and spin, and bowlers for the powerplay and the death. Returns what's missing and how many points it costs.
export function judgeXI(xi, xiSize) {
  const needs = xiNeeds(xiSize);
  const balance = squadBalance(xi);
  const bowlers = xi.filter(isBowlingOption);
  const batters = xi.filter(p => p.role !== 'Bowler');
  const topOrder = batters.filter(p => p.profile.order !== 'finish' && p.profile.order !== 'tail');
  const gaps = [];
  let penalty = 0;
  const check = (need, { have, unsure = 0 }, cost, label) => {
    const short = need - have - unsure;
    if (short > 0) {
      gaps.push(typeof label === 'function' ? label(have) : label);
      penalty += short * cost;
    }
  };

  check(1, { have: balance.keepers }, 8, 'No wicketkeeper');
  check(needs.bowling, { have: balance.bowlingOptions }, 6, `Short of bowling (${balance.bowlingOptions}/${needs.bowling})`);
  check(needs.batting, { have: balance.battingOptions }, 5, `Short of batting (${balance.battingOptions}/${needs.batting})`);

  if (batters.length) {
    check(needs.openers, tally(batters, p => knownOr(p.order, o => o === 'open')), 3,
      have => (have ? 'Only one opener' : needs.openers > 1 ? 'No specialist openers' : 'No opener'));
    check(needs.finisher, tally(batters, p => knownOr(p.order, o => o === 'finish')), 3, 'No finisher');
    if (needs.handMix && topOrder.length >= 2) {
      check(1, tally(topOrder, p => knownOr(p.bat, b => b === 'L')), 2, 'All right-handed top order');
      check(1, tally(topOrder, p => knownOr(p.bat, b => b === 'R')), 2, 'All left-handed top order');
    }
    // Enough hitters to keep the rate up, and someone up top who can build an innings
    check(needs.hitters, tally(batters, p => knownOr(p.batStyle, s => s === 'aggressive')), 2,
      have => (have ? 'Short of power hitting' : 'No power hitters'));
    if (needs.anchors && topOrder.length >= 2) {
      check(1, tally(topOrder, p => knownOr(p.batStyle, s => s !== 'aggressive')), 2, 'No anchor up top');
    }
  }

  // Style checks only make sense once there's a bowling attack; "short of bowling" covers none at all
  if (bowlers.length) {
    check(needs.pace, tally(bowlers, p => knownOr(p.bowling, b => b === 'pace')), 3,
      have => (have ? 'Light on pace' : 'No pace bowling'));
    check(needs.spin, tally(bowlers, p => knownOr(p.bowling, b => b === 'spin')), 3, 'No spinner');
    check(needs.powerplay, tally(bowlers, p => knownOr(p.phases, ph => ph.includes('pp'))), 2,
      have => (have ? 'Thin in the powerplay' : 'No powerplay bowler'));
    check(needs.death, tally(bowlers, p => knownOr(p.phases, ph => ph.includes('death'))), 3,
      have => (have ? 'Thin at the death' : 'No death bowler'));
    check(needs.leftArm, tally(bowlers, p => (p.bowling === 'none' ? false : p.leftArm)), 1, 'No left-arm bowler');
  }
  return { gaps, penalty };
}

const xiValue = (xi, xiSize) => xi.reduce((sum, p) => sum + p.rating, 0) / xiSize * 0.75 - judgeXI(xi, xiSize).penalty;

// The strongest legal playing XI a squad can field. A first XI is built the way a
// selector would (a keeper, then bowling, then batting, then the best of the rest,
// within the overseas cap), then bench players are swapped in while that makes the
// side better, so a slightly lower-rated spinner or death bowler can win a place
// when the XI needs one.
export function pickBestXI(players, xiSize, overseasCap = Math.min(4, xiSize)) {
  const ranked = [...players].sort((a, b) => b.rating - a.rating);
  const overseasIn = (list) => list.filter(isOverseas).length;
  const xi = [];
  const fits = (p) => !xi.includes(p) && xi.length < xiSize && (!isOverseas(p) || overseasIn(xi) < overseasCap);
  const fill = (wanted, howMany) => {
    for (const p of ranked) {
      if (howMany() <= 0) break;
      if (wanted(p) && fits(p)) xi.push(p);
    }
  };
  const needs = xiNeeds(xiSize);
  const count = (roles) => xi.filter(p => roles.includes(p.role)).length;
  fill(p => p.role === 'Wicket-Keeper', () => 1 - count(['Wicket-Keeper']));
  fill(isBowlingOption, () => needs.bowling - count(['Bowler', 'All-Rounder']));
  fill(p => p.role !== 'Bowler', () => needs.batting - count(['Batsman', 'Wicket-Keeper', 'All-Rounder']));
  fill(() => true, () => xiSize - xi.length);

  // Best single swap each round, until none helps
  let best = xiValue(xi, xiSize);
  for (let round = 0; round < 12; round++) {
    let swap = null;
    for (const out of xi) {
      for (const sub of ranked) {
        if (xi.includes(sub)) continue;
        const trial = xi.map(p => (p === out ? sub : p));
        if (overseasIn(trial) > overseasCap) continue;
        const value = xiValue(trial, xiSize);
        if (value > best + 1e-9) {
          best = value;
          swap = trial;
        }
      }
    }
    if (!swap) break;
    xi.splice(0, xi.length, ...swap);
  }
  return xi.sort((a, b) => b.rating - a.rating);
}

// Arena Strength: how good a squad is on paper, judged on the best playing XI it
// can actually field (see pickBestXI) rather than its eleven highest ratings.
// The XI counts most, depth a little, an empty place in the XI counts as zero,
// and a combination that doesn't cover the jobs of a T20 side loses points.
export function teamStrength(squadEntries, squadLimit = 25, overseasLimit) {
  const players = squadEntries.map(withPlayer).filter(Boolean);
  if (players.length === 0) return { score: 0, core: 0, depth: 0, gaps: [], bestXI: [] };

  const xiSize = Math.min(11, squadLimit);
  const bestXI = pickBestXI(players, xiSize, xiOverseasCap(squadLimit, overseasLimit, xiSize));
  const total = (list) => list.reduce((sum, p) => sum + p.rating, 0);
  const core = total(bestXI) / xiSize;
  const depth = total(players) / players.length;
  const { gaps, penalty } = judgeXI(bestXI, xiSize);
  if (players.length < xiSize) gaps.unshift(`Squad incomplete (${players.length}/${xiSize})`);
  else if (bestXI.length < xiSize) gaps.unshift(`Overseas cap leaves an XI of ${bestXI.length}`);

  // Empty places are already priced into core, so an incomplete squad isn't charged twice for them
  const score = Math.max(0, Math.round(core * 0.75 + depth * 0.25 - penalty));
  return { score, core: Math.round(core), depth: Math.round(depth), gaps, bestXI };
}
