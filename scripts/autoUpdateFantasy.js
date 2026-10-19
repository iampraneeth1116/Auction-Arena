import { prisma } from '../server/db.js';
import { ApiLimitError, collectMatchPlayers, fetchFromCricApi, saveMatch } from './lib/fantasyScoring.js';

// Daily job: scores every IPL 2026 match that finished since the last run.
// Run with `npm run fantasy:update` (needs DATABASE_URL and CRICKET_API_KEY).

const CRICKET_API_KEY = process.env.CRICKET_API_KEY;
const STATUS_KEY = 'autoUpdateStatus';
const DEFAULT_STATUS = {
  // Matches before this were scored by the backfill script
  lastProcessedMatchDate: '2026-04-08T00:00:00Z',
  // CricAPI's id for the IPL 2026 series
  seriesId: '87c62aac-bc3c-4738-ab93-19da0690488f',
};

const isFinished = (match) => {
  const status = match.status?.toLowerCase() || '';
  return match.matchFinished || ['won', 'tied', 'no result', 'result', 'abandoned'].some(word => status.includes(word));
};

async function saveStatus(status) {
  await prisma.appConfig.upsert({
    where: { key: STATUS_KEY },
    create: { key: STATUS_KEY, value: status },
    update: { value: status },
  });
}

// Lineups come with the scorecard, or failing that from match_info
async function fetchLineup(match, scorecardData) {
  const lineup = scorecardData.players || scorecardData.playerList || [];
  if (lineup.length > 0) return lineup;
  try {
    const info = await fetchFromCricApi(`match_info?id=${match.id}`, CRICKET_API_KEY);
    return info.players || info.playerList || [];
  } catch (err) {
    if (err instanceof ApiLimitError) throw err;
    console.warn(`[update] No lineup for ${match.name}: ${err.message}`);
    return [];
  }
}

async function runAutoUpdate() {
  if (!CRICKET_API_KEY) {
    console.error('[update] CRICKET_API_KEY is not set (.env locally, or a GitHub Actions secret).');
    process.exitCode = 1;
    return;
  }

  const stored = await prisma.appConfig.findUnique({ where: { key: STATUS_KEY } });
  const status = { ...DEFAULT_STATUS, ...(stored?.value ?? {}) };
  const lastDate = new Date(status.lastProcessedMatchDate);
  console.log(`[update] Catching up on matches since ${lastDate.toISOString()}`);

  const series = await fetchFromCricApi(`series_info?id=${status.seriesId}`, CRICKET_API_KEY);
  const pending = (series.matchList || [])
    .filter(m => new Date(m.dateTimeGMT) >= lastDate && isFinished(m))
    .sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
  if (pending.length === 0) {
    console.log('[update] No new finished matches.');
    return;
  }

  let processed = 0;
  for (const match of pending) {
    if (await prisma.processedMatch.findUnique({ where: { matchId: match.id } })) {
      console.log(`[update] Already scored: ${match.name}`);
      continue;
    }

    let scorecardData;
    try {
      scorecardData = await fetchFromCricApi(`match_scorecard?id=${match.id}`, CRICKET_API_KEY);
    } catch (err) {
      if (err instanceof ApiLimitError) throw err;
      const result = (match.status || '').toLowerCase();
      if (result.includes('abandoned') || result.includes('no result')) {
        // No scorecard for a washout: the announced XIs still score their lineup points
        scorecardData = { scorecard: [], players: [] };
      } else {
        // Matches are scored in order, so stop here and try again next run
        console.error(`[update] No scorecard for ${match.name} yet (${err.message}). Will retry next run.`);
        break;
      }
    }

    const lineup = await fetchLineup(match, scorecardData);
    const { matched, total, unmapped } = await saveMatch(prisma, match, collectMatchPlayers(scorecardData, lineup));
    console.log(`[update] ${match.name}: ${matched}/${total} players matched`);
    if (unmapped.length > 0) {
      console.log(`[update] Unmatched names (add real players to NAME_FIXES in scripts/lib/fantasyScoring.js): ${unmapped.slice(0, 5).join(', ')}`);
    }
    await saveStatus({ ...status, lastProcessedMatchDate: match.dateTimeGMT });
    processed++;
  }
  console.log(`[update] Scored ${processed} new match${processed === 1 ? '' : 'es'}.`);
}

runAutoUpdate()
  .catch((err) => {
    if (err instanceof ApiLimitError) {
      console.error(`[update] ${err.message}`);
      return;
    }
    console.error('[update] Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
