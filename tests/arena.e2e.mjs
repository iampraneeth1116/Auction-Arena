// End-to-end: the auction modes and their player pools, room options (quick pool,
// unsold rounds, overseas limit), open rooms, history and the Just sold strip, and bots:
// adding and removing them in the lobby, then an auction where they bid on their own
// under the same rules as people.
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { prisma } from '../server/db.js';
import { IPL_PLAYERS } from '../src/data/players.js';
import { AUCTION_MODES, PLAYER_MIXES, RATINGS, buildPlayerOrder, incompletePenalty, isOverseas, planUnsoldRound } from '../server/auctionRules.js';
import { pickBotXI } from '../server/bots.js';
import { teamStrength, xiOverseasCap } from '../src/lib/catalog.js';
import { profileOf } from '../src/lib/playerProfile.js';
import { nextBid } from '../src/lib/format.js';
import { PLAYER_PROFILES } from '../src/data/playerProfiles.js';
import { PLAYER_OUTLOOK } from '../src/data/playerOutlook.js';
import { IPL_2026_MATCHES, IPL_MATCHES, ipl2026MatchesOf, iplMatchesOf } from '../src/data/iplMatches.js';
import { buildRatings, ratingTier } from '../src/lib/playerRating.js';

const PLAYERS = new Map(IPL_PLAYERS.map(p => [p.id, p]));
const PORT = 3096;
const SERVER_ENV = { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' };

const { check, failedCount, printSummary } = createChecker();

let server = await startServer({ port: PORT, env: SERVER_ENV });
const base = server.url;
const eventually = (client, predicate, ms, label) => client.waitFor(predicate, ms, label).then(() => true, () => false);

const guest = async (name) => {
  const client = new TestClient(base);
  await client.req('POST', '/api/auth/guest', { name });
  client.user = (await client.req('GET', '/api/auth/me')).data.user;
  return client;
};

try {
  const host = await guest('Host');
  const friend = await guest('Friend');

  // ─── Bot fantasy XI (pure function) ───
  const overseasPool = IPL_PLAYERS.filter(p => p.country !== 'IND');
  const indianPool = IPL_PLAYERS.filter(p => p.country === 'IND' && p.role !== 'Wicket-Keeper');
  const indianKeeper = IPL_PLAYERS.find(p => p.role === 'Wicket-Keeper' && p.country === 'IND' && p.set !== 'Marquee Set 1');
  const botSquad = [...overseasPool.slice(0, 8), ...indianPool.slice(0, 16), indianKeeper];
  const botXI = pickBotXI(botSquad);
  const botXIPlayers = botXI.players.map(id => PLAYERS.get(id));
  check('bot XI has 11 players with at most 4 overseas', botXIPlayers.length === 11 && botXIPlayers.filter(p => p.country !== 'IND').length <= 4);
  check('bot XI always fields a keeper it bought', botXIPlayers.some(p => p.role === 'Wicket-Keeper'));
  check('bot captain and vice-captain are different XI players', botXI.captain !== botXI.viceCaptain && botXI.players.includes(botXI.captain) && botXI.players.includes(botXI.viceCaptain));
  check('bot impact player comes from the bench', Boolean(botXI.impactPlayer) && !botXI.players.includes(botXI.impactPlayer));
  check('no fantasy XI for a bot with fewer than 5 players', pickBotXI(botSquad.slice(0, 4)) === null);
  {
    // 4 overseas stars and 7 Indians fill the XI; the only keeper is overseas and rated below them all
    const rate = (p) => RATINGS.get(p.id) ?? 0;
    const keeper = IPL_PLAYERS.filter(p => p.role === 'Wicket-Keeper' && isOverseas(p)).sort((a, b) => rate(a) - rate(b))[0];
    const stars = IPL_PLAYERS.filter(p => p.role !== 'Wicket-Keeper' && isOverseas(p)).sort((a, b) => rate(b) - rate(a)).slice(0, 4);
    const indians = IPL_PLAYERS.filter(p => p.role !== 'Wicket-Keeper' && !isOverseas(p) && rate(p) > rate(keeper)).slice(0, 7);
    const xi = pickBotXI([...stars, ...indians, keeper]).players.map(id => PLAYERS.get(id));
    check('an overseas keeper joins a bot XI without going over 4 overseas',
      xi.length === 11 && xi.includes(keeper) && xi.filter(isOverseas).length === 4, JSON.stringify(xi.map(p => p.id)));
  }

  // ─── Playing profiles and best-XI judging (pure functions) ───
  const badProfiles = Object.entries(PLAYER_PROFILES).filter(([id, text]) => {
    const [bat, order, bowl, phases, style] = text.split(' ');
    return !PLAYERS.has(id) || !/^[RL?]$/.test(bat) || !/^(open|top|middle|finish|tail|\?)$/.test(order) ||
      !/^(RF|LF|OB|LB|SLA|LWS|-|\?)$/.test(bowl) || !/^((pp|mid|death)(,(pp|mid|death))*|-|\?)$/.test(phases) ||
      (style !== undefined && !/^(agg|bal|anc)$/.test(style));
  });
  check('every playing profile is for a real player and well formed', badProfiles.length === 0, JSON.stringify(badProfiles.slice(0, 3)));

  // ─── Next-IPL outlook (pure rules) ───
  const fromCareer = buildRatings(IPL_PLAYERS, {});
  const sample = IPL_PLAYERS.find(p => fromCareer.get(p.id) < 80);
  const lifted = buildRatings(IPL_PLAYERS, { [sample.id]: { change: 6, note: 'test' } });
  check('an outlook entry moves a rating by its change', lifted.get(sample.id) === fromCareer.get(sample.id) + 6 && lifted.get(IPL_PLAYERS[0].id) === fromCareer.get(IPL_PLAYERS[0].id));
  const star = IPL_PLAYERS.find(p => fromCareer.get(p.id) >= 90);
  check('ratings never go past 99', buildRatings(IPL_PLAYERS, { [star.id]: { change: 20, note: 'test' } }).get(star.id) === 99);
  const badOutlook = Object.entries(PLAYER_OUTLOOK).filter(([id, o]) =>
    !PLAYERS.has(id) || !Number.isInteger(o.change) || o.change === 0 || o.change < -40 || o.change > 25 || typeof o.note !== 'string' || o.note.length < 10);
  check('every outlook entry is for a real player with a change and a reason', badOutlook.length === 0, JSON.stringify(badOutlook.slice(0, 3)));
  check('the ratings in play include the outlook', Object.entries(PLAYER_OUTLOOK).every(([id, o]) => RATINGS.get(id) === Math.max(1, Math.min(99, fromCareer.get(id) + o.change))));
  const byName = (name) => IPL_PLAYERS.find(p => p.name === name);
  const bumrah = profileOf(byName('Jasprit Bumrah'));
  check('a known profile reads correctly', bumrah.bowling === 'pace' && bumrah.phases.includes('death') && bumrah.order === 'tail');
  const unprofiledQuick = IPL_PLAYERS.find(p => /^UFA\d/.test(p.set) && !PLAYER_PROFILES[p.id]);
  check('an unprofiled bowler from a fast-bowling set still counts as pace', profileOf(unprofiledQuick).bowling === 'pace');
  check('the XI overseas cap follows the room limit', xiOverseasCap(25, 8) === 4 && xiOverseasCap(25, 16) === 8 && xiOverseasCap(25, 25) === 11 && xiOverseasCap(11, 4) === 11);
  const squadOf = (names) => names.map(n => ({ id: byName(n).id, bid: 1 }));
  const overseasHeavy = squadOf(['Travis Head', 'Jos Buttler', 'Nicholas Pooran', 'Heinrich Klaasen', 'Tim David', 'Rashid Khan', 'Pat Cummins', 'Virat Kohli', 'Jasprit Bumrah', 'Ravindra Jadeja', 'Mohammad Siraj']);
  const capped = teamStrength(overseasHeavy, 25, 8);
  const freed = teamStrength(overseasHeavy, 25, 16);
  check('7 overseas under the usual limit: only 4 play, so the XI is short', capped.bestXI.length === 8 && capped.gaps.some(g => /Overseas cap/.test(g)), JSON.stringify(capped.gaps));
  check('allowing more overseas lets them all play and scores higher', freed.bestXI.length === 11 && freed.score > capped.score);
  const balanced = teamStrength(squadOf(['Nicholas Pooran', 'Shreyas Iyer', 'Josh Hazlewood', 'Sunil Narine', 'Hardik Pandya', 'Ishan Kishan', 'Jasprit Bumrah', 'Rohit Sharma', 'Virat Kohli', 'Ravindra Jadeja', 'Sam Curran']), 11, 4);
  const noBowlers = teamStrength(squadOf(['Virat Kohli', 'Rohit Sharma', 'Shubman Gill', 'Suryakumar Yadav', 'Rishabh Pant', 'KL Rahul', 'Sanju Samson', 'Ishan Kishan', 'Rinku Singh', 'Yashasvi Jaiswal', 'Ruturaj Gaikwad']), 11, 4);
  const allPace = teamStrength(squadOf(['Virat Kohli', 'Rohit Sharma', 'Shreyas Iyer', 'Suryakumar Yadav', 'Rishabh Pant', 'Hardik Pandya', 'Rinku Singh', 'Jasprit Bumrah', 'Mohammad Siraj', 'Mohammad Shami', 'Bhuvneshwar Kumar']), 11, 4);
  check('a balanced XI has no gaps', balanced.gaps.length === 0, JSON.stringify(balanced.gaps));
  check('an XI with no bowlers is flagged and scores much lower', noBowlers.gaps.some(g => /Short of bowling/.test(g)) && noBowlers.score < balanced.score - 20, `${noBowlers.score} vs ${balanced.score}`);
  check('an all-pace attack is flagged for having no spinner', allPace.gaps.includes('No spinner') && allPace.score < balanced.score, JSON.stringify(allPace.gaps));

  // ─── Unsold rounds (pure rules) ───
  const roundOrder = [0, 1, 2, 3, 4, 5];
  const soldTwo = new Set([IPL_PLAYERS[0].id, IPL_PLAYERS[3].id]);
  const buyer = [{ openSlots: 2, budgetLakhs: 5000 }];
  check('unsold players come back for another round', JSON.stringify(planUnsoldRound({ playerOrder: roundOrder, roundStart: 0, soldPlayerIds: soldTwo, buyers: buyer })) === JSON.stringify([1, 2, 4, 5]));
  check('only the current round is looked at', JSON.stringify(planUnsoldRound({ playerOrder: roundOrder, roundStart: 3, soldPlayerIds: soldTwo, buyers: buyer })) === JSON.stringify([4, 5]));
  check('no new round after a round that sold nobody', planUnsoldRound({ playerOrder: roundOrder, roundStart: 0, soldPlayerIds: new Set(), buyers: buyer }) === null);
  check('no new round when no franchise has a free slot', planUnsoldRound({ playerOrder: roundOrder, roundStart: 0, soldPlayerIds: soldTwo, buyers: [{ openSlots: 0, budgetLakhs: 5000 }] }) === null);
  check('no new round when nobody can afford the cheapest player', planUnsoldRound({ playerOrder: roundOrder, roundStart: 0, soldPlayerIds: soldTwo, buyers: [{ openSlots: 3, budgetLakhs: 10 }] }) === null);
  check('an unfinished squad loses 8 per empty XI place and 1 per missing reserve', incompletePenalty(8, 11) === 24 && incompletePenalty(11, 11) === 0 && incompletePenalty(20, 25) === 5 && incompletePenalty(3, 5) === 16);

  // ─── Modes and pools ───
  check('an unknown mode is refused', (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'turbo' })).status === 400);
  for (const bad of [2, 61, 7.5]) {
    check(`a ${bad}s bid timer is refused at creation`, (await host.req('POST', '/api/rooms', { teamId: 'MI', bidTimer: bad })).status === 400);
  }
  const fastMega = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'mega', bidTimer: 3 })).data.id;
  const slowClassic = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint11', bidTimer: 20 })).data.id;
  const plainMega = (await host.req('POST', '/api/rooms', { teamId: 'MI' })).data.id;
  const classic = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint11' })).data.id;
  const sprint = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint5' })).data.id;
  await host.connect();
  const classicState = (await host.join(classic)).state;
  check('Classic 11: 11-player squads, 4 overseas, ₹90 Cr', classicState.squadLimit === 11 && classicState.overseasLimit === 4 && classicState.settings.budget === 90);
  check('a Mega room created with 3-second bids uses them', (await host.join(fastMega)).state.settings.bidTimer === 3);
  check('a Classic room created with 20-second bids uses them', (await host.join(slowClassic)).state.settings.bidTimer === 20);
  check('without a choice the mode default applies (10s)', (await host.join(plainMega)).state.settings.bidTimer === 10);
  check('Blitz 5 rooms can no longer be created', (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'blitz5' })).status === 400);
  check('Blitz 5 rooms made before still have their settings', AUCTION_MODES.blitz5?.budgetLakhs === 3000 && AUCTION_MODES.blitz5.bidTimer === 3);
  await friend.req('POST', `/api/rooms/${sprint}/join`, { teamId: 'CSK' });
  await host.join(sprint);
  check('Sprint 5 starts', (await host.emit('auction:start', { roomId: sprint })).ok);
  await host.waitFor(() => host.state?.id === sprint && host.state.status === 'active', 3000, 'sprint live');
  const order = host.state.playerOrder;
  check('Sprint 5 auctions an 80-player pool, each player once', order.length === 80 && new Set(order).size === 80, String(order.length));
  // Drawn from the top 120 by rating (80 × 1.5); a few may be swapped in to guarantee Indians and keepers
  const cutoff = RATINGS.get([...IPL_PLAYERS].sort((a, b) => RATINGS.get(b.id) - RATINGS.get(a.id))[119].id);
  const fromTop = order.filter(i => RATINGS.get(IPL_PLAYERS[i].id) >= cutoff).length;
  check('the pool is drawn from the top-rated players', fromTop >= 60, String(fromTop));
  const indianKeepers = order.filter(i => !isOverseas(IPL_PLAYERS[i]) && IPL_PLAYERS[i].role === 'Wicket-Keeper').length;
  check('the pool has an Indian keeper for every franchise', indianKeepers >= 2, String(indianKeepers));
  const starsIn = () => buildPlayerOrder('sprint5').filter(i => IPL_PLAYERS[i].set.startsWith('Marquee')).sort().join();
  check('the stars change from room to room', starsIn() !== starsIn());
  check('the Mega pool is the full list', buildPlayerOrder('mega').length === IPL_PLAYERS.length);
  await host.emit('auction:end', { roomId: sprint });

  // ─── Room options ───
  const quick = (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint5', quickPool: true })).data.id;
  await host.join(quick);
  await host.emit('bots:add', { roomId: quick, teamId: 'MI' });
  await host.emit('bots:add', { roomId: quick, teamId: 'CSK' });
  check('quick pool shows in the room state', host.state.quickPool === true);
  check('unsold rounds are on by default', host.state.rotateUnsold === true && host.state.round === 1);
  check('quick pool starts', (await host.emit('auction:start', { roomId: quick })).ok);
  await host.waitFor(() => host.state.id === quick && host.state.status === 'active', 3000, 'quick pool active');
  check('quick pool: 3 franchises × 5 + 10 = 25 players', host.state.playerOrder.length === 25 && new Set(host.state.playerOrder).size === 25, String(host.state.playerOrder.length));
  check('the quick pool is all players with 5+ IPL 2026 matches', host.state.playerOrder.every(index => ipl2026MatchesOf(IPL_PLAYERS[index].id) >= 5));
  check('the pool is fixed once the auction starts', /fixed/.test((await host.emit('settings:update', { roomId: quick, quickPool: false })).error || ''));
  check('the overseas limit is fixed once the auction starts', /fixed/.test((await host.emit('settings:update', { roomId: quick, overseasLimit: 3 })).error || ''));
  check('unsold rounds can still be switched during the auction', (await host.emit('settings:update', { roomId: quick, rotateUnsold: false })).ok);
  await host.emit('auction:end', { roomId: quick });

  const quickMega = (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'mega', quickPool: true })).data.id;
  await host.join(quickMega);
  await host.emit('bots:add', { roomId: quickMega });
  await host.emit('auction:start', { roomId: quickMega });
  await host.waitFor(() => host.state.id === quickMega && host.state.status === 'active', 3000, 'quick mega active');
  check('quick pool in Mega: 10 franchises × 25 + 10 = 260 players', host.state.playerOrder.length === 260, String(host.state.playerOrder.length));
  await host.emit('auction:end', { roomId: quickMega });

  const noOverseas = await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint11', overseasLimit: 0, rotateUnsold: false });
  const noOverseasState = (await host.join(noOverseas.data.id)).state;
  check('a room can start with no overseas players allowed', noOverseasState.overseasLimit === 0 && noOverseasState.rotateUnsold === false);
  check('an overseas limit above the squad size is refused', (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint5', overseasLimit: 6 })).status === 400);
  check('overseas "no limit" (= squad size) is accepted', (await host.emit('settings:update', { roomId: noOverseas.data.id, overseasLimit: 11 })).ok);
  check('quick pool can be switched before the start', (await host.emit('settings:update', { roomId: noOverseas.data.id, quickPool: true })).ok);
  check('only the host changes room options', /Only the host/.test((await friend.connect().then(() => friend.emit('settings:update', { roomId: noOverseas.data.id, quickPool: true }))).error || ''));

  // Hidden upcoming players: while the auction runs, only the lots already called reach the room
  const secret = (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint5', hideUpcoming: true })).data.id;
  check('a room can hide upcoming players', (await host.join(secret)).state.hideUpcoming === true);
  await host.emit('bots:add', { roomId: secret, teamId: 'MI' });
  await host.emit('auction:start', { roomId: secret });
  check('only the lots called so far are sent, with the total', await eventually(host, () =>
    host.state.id === secret && host.state.status === 'active' && host.state.playerOrder.length === host.state.currentIndex + 1 && host.state.lotCount === 80,
  3000, 'hidden order'), `${host.state.playerOrder?.length}/${host.state.lotCount}`);
  check('only the host shows or hides them', /Only the host/.test((await friend.emit('settings:update', { roomId: secret, hideUpcoming: false })).error || ''));
  check('the setting must be on or off', /Invalid upcoming/.test((await host.emit('settings:update', { roomId: secret, hideUpcoming: 'yes' })).error || ''));
  check('the host can show them during the auction', (await host.emit('settings:update', { roomId: secret, hideUpcoming: false })).ok);
  check('then the whole order is sent', await eventually(host, () => host.state.id === secret && host.state.playerOrder.length === 80, 3000, 'order shown'));
  await host.emit('auction:end', { roomId: secret });

  // Player mix: a shorter pool drawn from the top-rated players, or every rating tier equally
  const TIERS = ['elite', 'star', 'solid', 'squad', 'prospect'];
  const tierCounts = (order) => {
    const counts = Object.fromEntries(TIERS.map(tier => [tier, 0]));
    for (const index of order) counts[ratingTier(RATINGS.get(IPL_PLAYERS[index].id))]++;
    return counts;
  };
  const evenly = (counts) => TIERS.every(tier => counts[tier] >= 3 && counts[tier] <= 5);
  const twoTeams = { franchises: 2, squadLimit: 5, overseasLimit: 2 };
  const topPool = tierCounts(buildPlayerOrder('sprint5', { squads: twoTeams, quickPool: true }));
  check('a top-players pool of 20 is all Elite and Star', topPool.elite + topPool.star === 20, JSON.stringify(topPool));
  let evenDraws = 0;
  let safeDraws = 0;
  for (let draw = 0; draw < 25; draw++) {
    const order = buildPlayerOrder('sprint5', { squads: twoTeams, quickPool: true, mix: 'balanced' });
    if (evenly(tierCounts(order))) evenDraws++;
    const indians = order.filter(index => !isOverseas(IPL_PLAYERS[index]));
    // 2 squads of 5 with 2 overseas each: 6 Indian places plus half the 4 overseas ones
    if (indians.length >= 8 && indians.filter(index => IPL_PLAYERS[index].role === 'Wicket-Keeper').length >= 2) safeDraws++;
  }
  check('a balanced pool of 20 has 3 to 5 players from every rating tier', evenDraws === 25, `${evenDraws}/25 draws`);
  let experiencedDraws = 0;
  for (let draw = 0; draw < 25; draw++) {
    if (buildPlayerOrder('sprint5', { mix: 'balanced' }).every(index => iplMatchesOf(IPL_PLAYERS[index].id) >= 7)) experiencedDraws++;
  }
  check('every player in a balanced pool has played at least 7 IPL matches', experiencedDraws === 25, `${experiencedDraws}/25 draws`);
  const ids = new Set(IPL_PLAYERS.map(p => p.id));
  check('IPL match counts are whole numbers for real players', Object.entries(IPL_MATCHES).every(([id, n]) => ids.has(id) && Number.isInteger(n) && n > 0));
  check('IPL match counts look right', iplMatchesOf('virat-kohli') > 250 && iplMatchesOf('jasprit-bumrah') > 120 && iplMatchesOf('no-such-player') === 0);
  const megaTeams = (franchises) => ({ franchises, squadLimit: 25, overseasLimit: 8 });
  check('a balanced Mega quick pool for 10 teams still fills to 260', buildPlayerOrder('mega', { squads: megaTeams(10), quickPool: true, mix: 'balanced' }).length === 260);
  check('a balanced pool still has enough Indians and an Indian keeper per franchise', safeDraws === 25, `${safeDraws}/25 draws`);
  check('the player mix only changes a shorter pool', buildPlayerOrder('mega', { mix: 'balanced' }).length === IPL_PLAYERS.length);


  // Quick pool outside Mega: only this season's regulars, players with 5+ IPL 2026 matches
  const regular = (index) => ipl2026MatchesOf(IPL_PLAYERS[index].id) >= 5;
  const regulars = IPL_PLAYERS.filter(p => ipl2026MatchesOf(p.id) >= 5).length;
  check('IPL 2026 match counts are for real players, 1 to 17 each', Object.entries(IPL_2026_MATCHES).every(([id, n]) => ids.has(id) && Number.isInteger(n) && n >= 1 && n <= 17));
  check('no one played more IPL 2026 matches than IPL matches', Object.entries(IPL_2026_MATCHES).every(([id, n]) => iplMatchesOf(id) >= n));
  check('IPL 2026 match counts look right', ipl2026MatchesOf('virat-kohli') >= 10 && ipl2026MatchesOf('auqib-dar') === 5 && ipl2026MatchesOf('no-such-player') === 0 && regulars > 140, String(regulars));
  const quickCases = [
    ['sprint5', { franchises: 2, squadLimit: 5, overseasLimit: 2 }],
    ['sprint11', { franchises: 2, squadLimit: 11, overseasLimit: 4 }],
    ['sprint11', { franchises: 10, squadLimit: 11, overseasLimit: 4 }],
  ];
  let regularDraws = 0;
  let quickSafeDraws = 0;
  for (let draw = 0; draw < 10; draw++) {
    for (const [mode, squads] of quickCases) {
      for (const mix of PLAYER_MIXES) {
        const order = buildPlayerOrder(mode, { squads, quickPool: true, mix });
        const indians = order.filter(index => !isOverseas(IPL_PLAYERS[index]));
        const overseasPlaces = squads.franchises * Math.min(squads.overseasLimit, squads.squadLimit);
        const enoughIndians = indians.length >= squads.franchises * squads.squadLimit - overseasPlaces + Math.ceil(overseasPlaces / 2);
        const keepers = indians.filter(index => IPL_PLAYERS[index].role === 'Wicket-Keeper').length >= squads.franchises;
        if (order.length === squads.franchises * squads.squadLimit + 10 && order.every(regular)) regularDraws++;
        if (enoughIndians && keepers) quickSafeDraws++;
      }
    }
  }
  const quickDraws = 10 * quickCases.length * PLAYER_MIXES.length;
  check('every quick pool is drawn only from players with 5+ IPL 2026 matches', regularDraws === quickDraws, `${regularDraws}/${quickDraws} draws`);
  check('a quick pool still has enough Indians and an Indian keeper per franchise', quickSafeDraws === quickDraws, `${quickSafeDraws}/${quickDraws} draws`);
  // Mega's 25-player squads need more players than that: its quick pool is drawn as before
  let megaAsBefore = 0;
  for (let draw = 0; draw < 10; draw++) {
    const stars = buildPlayerOrder('mega', { squads: megaTeams(4), quickPool: true });
    const balanced = buildPlayerOrder('mega', { squads: megaTeams(4), quickPool: true, mix: 'balanced' });
    if (stars.length === 110 && !stars.every(regular) && balanced.length === 110 && balanced.every(index => iplMatchesOf(IPL_PLAYERS[index].id) >= 7)) megaAsBefore++;
  }
  check('a Mega quick pool is drawn as before, not only from the 2026 regulars', megaAsBefore === 10, `${megaAsBefore}/10 draws`);
  const plainSprint = buildPlayerOrder('sprint11');
  check('a pool without Quick pool still draws from everyone', !plainSprint.every(regular));

  check('rooms draw from the top-rated players by default', (await host.join(plainMega)).state.playerMix === 'stars');
  check('an unknown player mix is refused', (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint5', playerMix: 'random' })).status === 400);
  const mixed = (await host.req('POST', '/api/rooms', { teamId: 'GT', auctionType: 'sprint5', quickPool: true, playerMix: 'balanced' })).data.id;
  check('a room can use a balanced player mix', (await host.join(mixed)).state.playerMix === 'balanced');
  check('only the host changes the player mix', /Only the host/.test((await friend.emit('settings:update', { roomId: mixed, playerMix: 'stars' })).error || ''));
  check('the player mix must be a known one', /Invalid player mix/.test((await host.emit('settings:update', { roomId: mixed, playerMix: 'random' })).error || ''));
  check('the player mix can be switched before the start', (await host.emit('settings:update', { roomId: mixed, playerMix: 'stars' })).ok
    && (await host.emit('settings:update', { roomId: mixed, playerMix: 'balanced' })).ok);
  await host.emit('bots:add', { roomId: mixed, teamId: 'MI' });
  await host.emit('auction:start', { roomId: mixed });
  await host.waitFor(() => host.state.id === mixed && host.state.status === 'active', 3000, 'balanced room active');
  const mixedCounts = tierCounts(host.state.playerOrder);
  check('a balanced quick pool for 2 franchises spreads its 20 players across the tiers', host.state.playerOrder.length === 20 && evenly(mixedCounts), JSON.stringify(mixedCounts));
  check('the player mix is fixed once the auction starts', /fixed/.test((await host.emit('settings:update', { roomId: mixed, playerMix: 'stars' })).error || ''));
  await host.emit('auction:end', { roomId: mixed });
  friend.disconnect();
  host.disconnect();

  // ─── Open rooms, history and the Just sold strip ───
  const lister = await guest('Lister');
  const shopper = await guest('Buyer');
  const listed = (await lister.req('POST', '/api/rooms', { teamId: 'KKR', auctionType: 'sprint5', isPublic: true, bidTimer: 3 })).data.id;
  const unlisted = (await lister.req('POST', '/api/rooms', { teamId: 'KKR', auctionType: 'sprint5', bidTimer: 3 })).data.id;
  const openRooms = async () => (await lister.req('GET', '/api/rooms/public')).data.rooms;
  check('a listed room nobody has open is not shown', !(await openRooms()).some(r => r.id === listed));
  await lister.connect();
  await lister.join(listed);
  await lister.join(unlisted);
  let rows = await openRooms();
  const row = rows.find(r => r.id === listed);
  check('a listed room with someone in it shows in open rooms', row?.status === 'waiting' && row.hostName === 'Lister' && row.humans === 1 && row.openTeams === 9, JSON.stringify(row));
  check('an unlisted room never shows', !rows.some(r => r.id === unlisted));
  check('open rooms name only the host', row && !('players' in row) && !('members' in row));
  check('the room state says it is listed', (await lister.join(listed)).state.isPublic === true);
  check('visibility must be on or off', /Invalid visibility/.test((await lister.emit('settings:update', { roomId: listed, isPublic: 'yes' })).error || ''));
  check('the host can unlist a room', (await lister.emit('settings:update', { roomId: listed, isPublic: false })).ok && !(await openRooms()).some(r => r.id === listed));
  check('a setting left out keeps its value', (await lister.join(listed)).state.settings.bidTimer === 3);
  await lister.emit('settings:update', { roomId: listed, isPublic: true });
  await lister.emit('bots:add', { roomId: listed, teamId: 'SRH' });
  const withBot = (await openRooms()).find(r => r.id === listed);
  check('the listing counts bots and open franchises', withBot?.bots === 1 && withBot.openTeams === 8, JSON.stringify(withBot));
  await lister.emit('bots:remove', { roomId: listed, teamId: 'SRH' });

  // One sale in each room: only the listed room's reaches Just sold
  for (const roomCode of [listed, unlisted]) {
    await shopper.req('POST', `/api/rooms/${roomCode}/join`, { teamId: 'MI' });
    await lister.emit('auction:start', { roomId: roomCode });
  }
  const soldIn = (roomCode) => lister.events.some(e => e.event === 'room:state' && e.payload.id === roomCode && e.payload.currentAuction?.status === 'sold');
  const firstLot = (roomCode) => lister.events.find(e => e.event === 'room:state' && e.payload.id === roomCode && e.payload.status === 'active')?.payload;
  await lister.waitFor(() => firstLot(listed) && firstLot(unlisted), 5000, 'both rooms live');
  for (const roomCode of [listed, unlisted]) {
    const state = firstLot(roomCode);
    await lister.emit('bid:place', { roomId: roomCode, amount: IPL_PLAYERS[state.playerOrder[0]].basePrice });
  }
  check('both first lots sell', await eventually(lister, () => soldIn(listed) && soldIn(unlisted), 10000, 'two sales'));
  rows = await openRooms();
  const liveRow = rows.find(r => r.id === listed);
  check('a live listed room shows its lot', liveRow?.status === 'active' && liveRow.lot >= 1 && liveRow.lots === firstLot(listed).playerOrder.length, JSON.stringify(liveRow));
  const [listedSale] = await prisma.purchase.findMany({ where: { roomId: listed } });
  const [unlistedSale] = await prisma.purchase.findMany({ where: { roomId: unlisted } });
  const activity = (await lister.req('GET', '/api/activity')).data;
  check('Just sold shows a sale from a listed room', activity.recentSignings.some(s => s.id === listedSale.id && s.teamId === 'KKR' && s.playerId === listedSale.playerId), JSON.stringify(activity.recentSignings.slice(0, 3)));
  check('Just sold never shows a sale from an unlisted room', !activity.recentSignings.some(s => s.id === unlistedSale.id));
  check('Just sold counts live auctions and names nobody', activity.liveAuctions >= 2 && activity.recentSignings.every(s => !('userName' in s) && !('roomId' in s)));

  const history = async (client) => (await client.req('GET', '/api/me/history')).data.sessions;
  const mine = await history(lister);
  const listedSession = mine.find(s => s.roomId === listed);
  check('history lists each auction the user ran a franchise in', listedSession?.teamId === 'KKR' && listedSession.isHost && listedSession.squad.length === 1 && mine.some(s => s.roomId === unlisted), JSON.stringify(listedSession));
  const drifter = await guest('Drifter');
  await drifter.req('POST', `/api/rooms/${listed}/join`, {});
  check('joining without a franchise leaves history empty', (await history(drifter)).length === 0);
  check('a live auction cannot be removed from history', (await lister.req('DELETE', `/api/me/history/${listedSession.id}`)).status === 409);
  await lister.emit('auction:end', { roomId: listed });
  await lister.emit('auction:end', { roomId: unlisted });
  check("nobody else can remove someone's history", (await shopper.req('DELETE', `/api/me/history/${listedSession.id}`)).status === 404);
  check('a finished auction can be removed', (await lister.req('DELETE', `/api/me/history/${listedSession.id}`)).status === 200 && !(await history(lister)).some(s => s.roomId === listed));
  check("removing only hides it: the other manager's history keeps the room", (await history(shopper)).some(s => s.roomId === listed));
  check('undo brings it back', (await lister.req('POST', `/api/me/history/${listedSession.id}/restore`)).status === 200 && (await history(lister)).some(s => s.roomId === listed));
  check('a finished room leaves open rooms', !(await openRooms()).some(r => r.id === listed));
  lister.disconnect();

  // A tiny quick-pool room left to run on its own while the bots play below: its
  // host buys the first player, nobody bids on the rest, so a second round should start
  const roundsHost = await guest('RoundsHost');
  const roundsRoom = (await roundsHost.req('POST', '/api/rooms', { teamId: 'SRH', auctionType: 'sprint5', quickPool: true, bidTimer: 3 })).data.id;
  await roundsHost.connect();
  await roundsHost.join(roundsRoom);
  await roundsHost.emit('bots:add', { roomId: roundsRoom, teamId: 'PBKS' });
  await roundsHost.emit('bots:remove', { roomId: roundsRoom, teamId: 'PBKS' });
  const roundsFriend = await guest('RoundsFriend');
  await roundsFriend.req('POST', `/api/rooms/${roundsRoom}/join`, { teamId: 'LSG' });
  await roundsHost.emit('auction:start', { roomId: roundsRoom });
  await roundsHost.waitFor(() => roundsHost.state.status === 'active' && roundsHost.state.currentAuction?.status === 'bidding', 3000, 'rounds room live');
  const roundsFirst = IPL_PLAYERS[roundsHost.state.playerOrder[0]];
  check('the rounds room host opens the first lot', (await roundsHost.emit('bid:place', { roomId: roundsRoom, amount: roundsFirst.basePrice })).ok);

  const roomId = (await host.req('POST', '/api/rooms', { teamId: 'MI' })).data.id;
  await friend.req('POST', `/api/rooms/${roomId}/join`, {});
  await host.connect();
  await friend.connect();
  await host.join(roomId);
  await friend.join(roomId);

  // ─── Lobby ───
  check('only the host can add bots', /Only the host/.test((await friend.emit('bots:add', { roomId })).error || ''));
  const one = await host.emit('bots:add', { roomId, teamId: 'CSK' });
  check('host adds a bot to CSK', one.ok && one.added.join() === 'CSK', JSON.stringify(one));
  check('a bot cannot take a taken franchise', /already taken/.test((await host.emit('bots:add', { roomId, teamId: 'MI' })).error || ''));
  check('an unknown franchise is refused', /Unknown franchise/.test((await host.emit('bots:add', { roomId, teamId: 'XYZ' })).error || ''));
  const fill = await host.emit('bots:add', { roomId });
  check('fill adds a bot to every open franchise', fill.ok && fill.added.length === 8, JSON.stringify(fill));
  check('nothing left to fill', /Every franchise/.test((await host.emit('bots:add', { roomId })).error || ''));
  check('the room shows bots online with their names', await eventually(friend, () => {
    const bot = friend.state.players.find(p => p.team === 'CSK');
    return bot?.isBot === true && bot.isOnline === true && bot.name === 'CSK Bot';
  }, 3000, 'bot in state'));
  check('nine bots manage franchises', friend.state.players.filter(p => p.isBot).length === 9);
  const cskBot = friend.state.players.find(p => p.team === 'CSK');
  check('bots cannot be removed like people', /bot controls/.test((await host.emit('member:kick', { roomId, userId: cskBot.id })).error || ''));
  check('host removes the RCB bot', (await host.emit('bots:remove', { roomId, teamId: 'RCB' })).ok);
  check('RCB is open again', await eventually(friend, () => !friend.state.players.some(p => p.team === 'RCB'), 3000, 'rcb open'));
  check('the friend takes RCB', (await friend.emit('team:select', { roomId, teamId: 'RCB' })).ok);

  // Taking a franchise over from its bot
  const takeover = await friend.emit('team:select', { roomId, teamId: 'CSK' });
  check('a person can take a franchise over from its bot', takeover.ok, JSON.stringify(takeover));
  check('the bot leaves and the person manages CSK', await eventually(host, () =>
    !host.state.players.some(p => p.isBot && p.team === 'CSK') && host.state.players.find(p => p.id === friend.user.id)?.team === 'CSK', 3000, 'takeover'));
  check('RCB is free again after the switch', !host.state.players.some(p => p.team === 'RCB'));
  check('the takeover is logged', await eventually(host, () => host.events.some(e => e.event === 'chat:message' && /took over CSK from its bot/.test(e.payload.text)), 3000, 'takeover log'));
  check('host puts a bot back on RCB', (await host.emit('bots:add', { roomId, teamId: 'RCB' })).ok);
  check('removing a bot from a franchise a person manages is refused', /No bot/.test((await host.emit('bots:remove', { roomId, teamId: 'MI' })).error || ''));

  // ─── Bots bid on their own ───
  // Listed, so the test can check that bots' buys stay off the Just sold strip
  await host.emit('settings:update', { roomId, bidTimer: 3, isPublic: true });
  check('the auction starts with 8 bots and 2 people', (await host.emit('auction:start', { roomId })).ok);
  check('bots cannot be added once the auction is running', /before the auction starts/.test((await host.emit('bots:add', { roomId, teamId: 'RCB' })).error || ''));
  check('bots cannot be removed once the auction is running', /before the auction starts/.test((await host.emit('bots:remove', { roomId })).error || ''));
  check('a bot\'s franchise cannot be taken over once the auction is running', /already taken/.test((await friend.emit('team:select', { roomId, teamId: 'KKR' })).error || ''));
  check('a bot bids on its own', await eventually(host, () => host.state.currentAuction?.highBidderId?.startsWith('bot_'), 15000, 'a bot bid'));
  // A bots' bidding war on a star can run a few minutes: every bid resets the clock
  check('a bot wins a player', await eventually(host, () => host.state.teams.some(t => t.userId.startsWith('bot_') && t.squad.length > 0), 240000, 'a bot sale'));
  const botBuys = new Set((await prisma.purchase.findMany({ where: { roomId, member: { isBot: true } }, select: { id: true } })).map(p => p.id));
  const strip = (await new TestClient(base).req('GET', '/api/activity')).data;
  check("bots' buys stay off the Just sold strip", botBuys.size > 0 && !strip.recentSignings.some(s => botBuys.has(s.id)), JSON.stringify(strip.recentSignings.slice(0, 3)));

  // A person can still bid against bots
  await eventually(host, () => host.state.currentAuction?.status === 'bidding', 10000, 'a lot open');
  const contested = host.state.currentAuction;
  const myBid = await friend.emit('bid:place', { roomId, amount: nextBid(contested.currentBid, PLAYERS.get(contested.playerId).basePrice) });
  check('a person can bid while bots are bidding', myBid.ok || /price has moved|already the highest/.test(myBid.error || ''), JSON.stringify(myBid));

  // Stop the server mid-auction: the bots pick up where they left off
  host.disconnect();
  friend.disconnect();
  roundsHost.disconnect();
  await server.stop();
  server = await startServer({ port: PORT, env: SERVER_ENV });
  await host.connect();
  await host.join(roomId);
  await roundsHost.connect();
  // Chat that arrived while the server was down comes back with the room's history
  const roundsHistory = (await roundsHost.join(roundsRoom)).messages ?? [];
  const resumedAt = Date.now();
  check('bots keep bidding after a server restart', await eventually(host, () => host.state.currentAuction?.highBidderId?.startsWith('bot_') && host.state.currentAuction.timerEndsAt > resumedAt, 30000, 'bot bid after restart'));

  // Let a few more lots go, then check every bot squad against the rules
  await eventually(host, () => host.state.currentIndex >= 5, 300000, 'five lots');
  const botTeams = host.state.teams.filter(t => t.userId.startsWith('bot_'));
  const broken = botTeams.filter(t => {
    const players = t.squad.map(s => PLAYERS.get(s.id));
    const spent = t.squad.reduce((sum, s) => sum + s.bid, 0);
    return t.budgetRemaining < 0 || Math.abs(t.budgetRemaining + spent - 120) > 1e-6 ||
      t.squad.length > 25 || players.filter(isOverseas).length > 8;
  });
  check('bot squads keep within purse, squad and overseas limits', broken.length === 0, JSON.stringify(broken));
  check('the lot after a sale is announced to the room', host.events.some(e => e.event === 'chat:message' && e.payload.type === 'sold_card' && e.payload.metadata.buyerId.startsWith('bot_')));
  await host.emit('auction:end', { roomId });
  host.disconnect();
  friend.disconnect();

  // Back to the rounds room: every lot has been called, so round 2 should be under way
  check('unsold players come back in round 2', await eventually(roundsHost, () => roundsHost.state.round === 2, 120000, 'round 2'));
  const round2 = roundsHost.state;
  check('round 2 brings back the 19 unsold players', round2.playerOrder.length === 20 + 19 && !round2.playerOrder.slice(20).includes(round2.playerOrder[0]), String(round2.playerOrder.length));
  const roundAnnounced = (text) => /Round 2: 19 unsold players come back/.test(text);
  check('the new round is announced', roundsHost.events.some(e => e.event === 'chat:message' && roundAnnounced(e.payload.text)) || roundsHistory.some(m => roundAnnounced(m.text)));
  await roundsHost.emit('auction:end', { roomId: roundsRoom });
  roundsHost.disconnect();
} catch (err) {
  check('the run finished without an error', false, err.stack);
} finally {
  await prisma.$disconnect();
  await server.stop();
  if (failedCount()) console.log(`\n--- server log ---\n${server.logs().slice(-3000)}`);
  printSummary();
  process.exit(failedCount() ? 1 : 0);
}
