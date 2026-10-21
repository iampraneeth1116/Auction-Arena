import { IPL_PLAYERS } from '../../src/data/players.js';

// Shared by the daily update and the one-off backfill: turns CricAPI scorecards
// into fantasy points for our players and saves them.

export const normalizeName = (name) => (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

const playersByName = new Map(IPL_PLAYERS.map(p => [normalizeName(p.name), p]));

// CricAPI spellings that differ from players.js (API name → our player name).
// Resolved by name at startup so they can't drift out of sync with player ids.
const NAME_FIXES = {
  amghazanfar: 'Allah Ghazanfar',
  philipsalt: 'Phil Salt',
  mohammedshami: 'Mohammad Shami',
  mohammedsiraj: 'Mohammad Siraj',
  lungingidi: 'Lungisani Ngidi',
  manimaransiddharth: 'M. Siddharth',
  varunchakaravarthy: 'Varun Chakravarthy',
  vijaykumarvyshak: 'Vyshak Vijaykumar',
  digveshsinghrathi: 'Digvesh Rathi',
};

const fixedPlayers = new Map();
for (const [apiName, ourName] of Object.entries(NAME_FIXES)) {
  const player = playersByName.get(normalizeName(ourName));
  if (player) fixedPlayers.set(apiName, player);
  else console.warn(`[warning] Name fix target not found in players.js: ${ourName}`);
}

export const findPlayer = (normalizedName) =>
  fixedPlayers.get(normalizedName) || playersByName.get(normalizedName) || null;

const int = (value) => parseInt(value) || 0;

// ─── Points ───

// Batting: runs, boundaries, milestones, duck and strike rate (not for bowlers)
function battingPoints({ r, b, fours, sixes, dismissal }, isBowler) {
  const runs = int(r);
  const balls = int(b);
  let points = runs + int(fours) * 4 + int(sixes) * 6;

  if (runs >= 100) points += 16;
  else if (runs >= 75) points += 12;
  else if (runs >= 50) points += 8;
  else if (runs >= 25) points += 4;

  if (runs === 0 && dismissal && !isBowler) points -= 2;

  // Strike rate counts from 10 balls faced
  if (balls >= 10 && !isBowler) {
    const sr = (runs / balls) * 100;
    if (sr > 170) points += 6;
    else if (sr > 150) points += 4;
    else if (sr > 130) points += 2;
    else if (sr >= 60 && sr < 70) points -= 2;
    else if (sr >= 50 && sr < 60) points -= 4;
    else if (sr < 50) points -= 6;
  }
  return points;
}

// Bowling: dots, wickets, maidens, LBW/bowled bonus, hauls and economy
function bowlingPoints({ w, m, r, o, dot, lbw_bowled: lbwBowled }) {
  const wickets = int(w);
  let points = int(dot) + wickets * 30 + int(m) * 12 + int(lbwBowled) * 8;

  if (wickets >= 5) points += 12;
  else if (wickets >= 4) points += 8;
  else if (wickets >= 3) points += 4;

  // Economy counts from 2 overs bowled
  const overs = parseFloat(o) || 0;
  if (overs >= 2) {
    const economy = int(r) / overs;
    if (economy < 5) points += 6;
    else if (economy < 6) points += 4;
    else if (economy < 7.01) points += 2;
    else if (economy >= 10 && economy < 11.01) points -= 2;
    else if (economy > 11 && economy < 12.01) points -= 4;
    else if (economy > 12) points -= 6;
  }
  return points;
}

// Fielding: catches (with a 3-catch bonus), stumpings and run-outs
function fieldingPoints({ c, s, ro_d: runOutsDirect, ro_i: runOutsIndirect }) {
  const catches = int(c);
  let points = catches * 8 + int(s) * 12 + int(runOutsDirect) * 12 + int(runOutsIndirect) * 6;
  if (catches >= 3) points += 4;
  return points;
}

export function calculatePoints(stats, role) {
  const isBowler = role.toLowerCase().includes('bowler');
  const details = {
    batting: stats.batting ? battingPoints(stats.batting, isBowler) : 0,
    bowling: stats.bowling ? bowlingPoints(stats.bowling) : 0,
    fielding: stats.fielding ? fieldingPoints(stats.fielding) : 0,
    // Being in the announced XI, and coming on as the impact player
    other: (stats.announced ? 4 : 0) + (stats.impact ? 4 : 0),
  };
  return { points: details.batting + details.bowling + details.fielding + details.other, details };
}

// ─── CricAPI ───

export class ApiLimitError extends Error {}

export async function fetchFromCricApi(endpoint, apiKey) {
  console.log(`[api] ${endpoint}`);
  const url = `https://api.cricapi.com/v1/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;
  const data = await (await fetch(url)).json();

  if (data.info) {
    const { hitsToday, hitsLimit } = data.info;
    console.log(`[api] ${hitsToday}/${hitsLimit} calls used today`);
  }
  if (data.status !== 'success') {
    if (data.reason?.toLowerCase().includes('hits today exceeded')) {
      throw new ApiLimitError('Daily API limit reached. Matches saved so far are kept; run again tomorrow to continue.');
    }
    throw new Error(`API error: ${data.reason}`);
  }
  return data.data;
}

// Every player who batted, bowled, fielded or was in the announced lineup, keyed by normalized name
export function collectMatchPlayers(scorecardData, lineupPlayers = []) {
  const matchPlayers = {};
  const announced = new Set(lineupPlayers.map(p => normalizeName(p.name || p.playerName)).filter(Boolean));

  const entryFor = (rawName) => {
    const name = normalizeName(rawName);
    if (!name) return null;
    matchPlayers[name] ??= {};
    if (announced.has(name)) matchPlayers[name].announced = true;
    return matchPlayers[name];
  };

  // The API has used several field names for the same data over time
  const scorecard = scorecardData.scorecard || scorecardData.score || scorecardData.data?.scorecard;
  for (const inning of Array.isArray(scorecard) ? scorecard : []) {
    for (const b of inning.batting || []) {
      const entry = entryFor(b.batsman?.name || b.name || b.player || b.playerName);
      if (entry) entry.batting = b;
    }
    for (const bw of inning.bowling || []) {
      const entry = entryFor(bw.bowler?.name || bw.name || bw.player || bw.playerName);
      if (entry) entry.bowling = bw;
    }
    for (const f of inning.fielding || []) {
      const entry = entryFor(f.catcher?.name || f.fielder?.name || f.fielder?.playerName || f.name || f.player || f.playerName);
      if (entry) entry.fielding = f;
    }
  }

  // Players who were announced but didn't bat, bowl or field still earn lineup points
  for (const name of announced) matchPlayers[name] ??= { announced: true };
  return matchPlayers;
}

// Saves one match atomically: per-player points, running totals and the processed
// marker. The marker is what stops a re-run from counting the same match twice.
// That's two writes per player, so the transaction gets more than Prisma's default
// 5 seconds: run from a laptop against a hosted database, each write is a slow round trip.
export async function saveMatch(prisma, match, matchPlayers) {
  const scored = [];
  const unmapped = [];
  for (const [name, stats] of Object.entries(matchPlayers)) {
    const player = findPlayer(name);
    if (!player) {
      unmapped.push(name);
      continue;
    }
    scored.push({ player, ...calculatePoints(stats, player.role) });
  }

  await prisma.$transaction([
    ...scored.flatMap(({ player, points, details }) => [
      prisma.playerMatchPoint.upsert({
        where: { playerId_matchId: { playerId: player.id, matchId: match.id } },
        create: { playerId: player.id, playerName: player.name, matchId: match.id, matchName: match.name, points, details },
        update: { matchName: match.name, points, details },
      }),
      prisma.playerStat.upsert({
        where: { playerId: player.id },
        create: { playerId: player.id, totalPoints: points, matches: 1 },
        update: { totalPoints: { increment: points }, matches: { increment: 1 } },
      }),
    ]),
    prisma.processedMatch.create({ data: { matchId: match.id, name: match.name } }),
  ], { maxWait: 15_000, timeout: 60_000 });

  return { matched: scored.length, total: Object.keys(matchPlayers).length, unmapped };
}
