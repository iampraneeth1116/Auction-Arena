import { prisma } from '../../server/db.js';
import { ApiLimitError, collectMatchPlayers, fetchFromCricApi, saveMatch } from '../lib/fantasyScoring.js';

// One-off catch-up: scores every finished IPL 2026 match not already scored.
// Safe to re-run: matches recorded by this script or dailyUpdate.js are skipped.
// Run with `npm run fantasy:backfill` (needs DATABASE_URL and CRICKET_API_KEY).

const CRICKET_API_KEY = process.env.CRICKET_API_KEY;

async function findIplSeries() {
  let offset = 0;
  while (offset < 500) {
    const seriesList = await fetchFromCricApi(`series?offset=${offset}`, CRICKET_API_KEY);
    const series = seriesList.find(s => /indian premier league 2026|ipl 2026/i.test(s.name));
    if (series || seriesList.length === 0) return series ?? null;
    offset += seriesList.length;
  }
  return null;
}

async function backfill() {
  if (!CRICKET_API_KEY) {
    console.error('[backfill] CRICKET_API_KEY is not set.');
    process.exitCode = 1;
    return;
  }

  const iplSeries = await findIplSeries();
  if (!iplSeries) throw new Error('Could not find IPL 2026 in the first 500 series.');
  console.log(`[backfill] Series: ${iplSeries.name} (${iplSeries.id})`);

  const seriesInfo = await fetchFromCricApi(`series_info?id=${iplSeries.id}`, CRICKET_API_KEY);
  const finished = (seriesInfo.matchList || []).filter(m => m.matchEnded || m.status?.toLowerCase().includes('won'));
  console.log(`[backfill] ${finished.length} finished matches`);

  let processed = 0;
  for (const match of finished) {
    if (await prisma.processedMatch.findUnique({ where: { matchId: match.id } })) continue;

    const scorecard = await fetchFromCricApi(`match_scorecard?id=${match.id}`, CRICKET_API_KEY);
    const info = await fetchFromCricApi(`match_info?id=${match.id}`, CRICKET_API_KEY);
    const { matched, total, unmapped } = await saveMatch(prisma, match, collectMatchPlayers(scorecard, info.players || []));
    console.log(`[backfill] ${match.name}: ${matched}/${total} players matched`);
    if (unmapped.length > 0) console.log(`[backfill] Unmatched names: ${unmapped.slice(0, 5).join(', ')}`);
    processed++;
  }
  console.log(`[backfill] Done: scored ${processed} new match${processed === 1 ? '' : 'es'}.`);
}

backfill()
  .catch((err) => {
    if (err instanceof ApiLimitError) {
      console.error(`[backfill] ${err.message}`);
      return;
    }
    console.error('[backfill] Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
