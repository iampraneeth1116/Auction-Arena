import { IPL_2026_STATS } from '../data/ipl2026Stats.js';
import { ipl2026MatchesOf } from '../data/iplMatches.js';

// A side of the game only shows when there's enough of it to mean something: a bowler's
// 5 runs off 7 balls, or a batter's one over, would just be noise. A player's own side
// (batting for batters and keepers, bowling for bowlers) always shows if he did it at all.
export const MIN_BALLS_FACED = 30;
export const MIN_BALLS_BOWLED = 36; // 6 overs

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const overs = (balls) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;
// No average without a dismissal (or a wicket): there's nothing to divide by
const average = (runs, outs) => (outs > 0 ? (runs / outs).toFixed(1) : '—');

function batting(b) {
  const sr = ((b.runs / b.balls) * 100 || 0).toFixed(1);
  return {
    key: 'bat',
    title: 'Batting',
    stats: [
      { label: 'Runs', value: String(b.runs) },
      { label: 'Strike rate', value: b.balls ? sr : '—' },
      { label: 'Average', value: average(b.runs, b.inns - b.notOuts) },
      { label: 'Best', value: `${b.hs}${b.hsNotOut ? '*' : ''}` },
    ],
    extra: [
      count(b.inns, 'innings', 'innings'),
      b.hundreds && count(b.hundreds, 'hundred', 'hundreds'),
      b.fifties && count(b.fifties, 'fifty', 'fifties'),
      b.sixes && count(b.sixes, 'six', 'sixes'),
    ].filter(Boolean).join(' · '),
    short: `${count(b.runs, 'run', 'runs')}${b.balls ? `, SR ${sr}` : ''}`,
  };
}

function bowling(w) {
  const econ = ((w.runs / w.balls) * 6).toFixed(2);
  return {
    key: 'bowl',
    title: 'Bowling',
    stats: [
      { label: 'Wickets', value: String(w.wickets) },
      { label: 'Economy', value: econ },
      { label: 'Average', value: average(w.runs, w.wickets) },
      { label: 'Best', value: `${w.bestWickets}/${w.bestRuns}` },
    ],
    extra: `${overs(w.balls)} ${w.balls === 6 ? 'over' : 'overs'}`,
    short: `${count(w.wickets, 'wkt', 'wkts')}, econ ${econ}`,
  };
}

// A player's IPL 2026 season, ready to show: null if he didn't play in it.
// sides: batting and/or bowling, his own side first, each with four headline numbers,
// an extra line (innings, hundreds, overs...) and a short version for tight spaces.
export function season2026Of(player) {
  const entry = player && IPL_2026_STATS[player.id];
  if (!entry) return null;
  const { bat, bowl } = entry;
  const batsFirst = player.role === 'Batsman' || player.role === 'Wicket-Keeper';
  const bowlsFirst = player.role === 'Bowler';
  let showBat = Boolean(bat) && (bat.balls >= MIN_BALLS_FACED || batsFirst);
  let showBowl = Boolean(bowl) && (bowl.balls >= MIN_BALLS_BOWLED || bowlsFirst);
  if (!showBat && !showBowl) {
    // A little of either is still better than nothing for someone who played
    showBat = Boolean(bat);
    showBowl = Boolean(bowl);
  }
  const sides = [showBat && batting(bat), showBowl && bowling(bowl)].filter(Boolean);
  if (bowlsFirst) sides.reverse();
  return { team: entry.team, matches: ipl2026MatchesOf(player.id), sides };
}
