// End-to-end: the auction modes and their player pools, room options (quick pool,
// unsold rounds, overseas limit), open rooms, history and the Just sold strip, and bots:
// adding and removing them in the lobby, then an auction where they bid on their own
// under the same rules as people.
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { prisma } from '../server/db.js';
import { IPL_PLAYERS } from '../src/data/players.js';
import { RATINGS, buildPlayerOrder, isOverseas, planUnsoldRound } from '../server/auctionRules.js';
import { pickBotXI } from '../server/bots.js';
import { teamStrength, xiOverseasCap } from '../src/lib/catalog.js';
import { profileOf } from '../src/lib/playerProfile.js';
import { PLAYER_PROFILES } from '../src/data/playerProfiles.js';

const PLAYERS = new Map(IPL_PLAYERS.map(p => [p.id, p]));
const PORT = 3096;
const SERVER_ENV = { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' };

const { check, failedCount, printSummary } = createChecker();

const server = await startServer({ port: PORT, env: SERVER_ENV });
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

  // ─── Playing profiles and best-XI judging (pure functions) ───
  const badProfiles = Object.entries(PLAYER_PROFILES).filter(([id, text]) => {
    const [bat, order, bowl, phases, style] = text.split(' ');
    return !PLAYERS.has(id) || !/^[RL?]$/.test(bat) || !/^(open|top|middle|finish|tail|\?)$/.test(order) ||
      !/^(RF|LF|OB|LB|SLA|LWS|-|\?)$/.test(bowl) || !/^((pp|mid|death)(,(pp|mid|death))*|-|\?)$/.test(phases) ||
      (style !== undefined && !/^(agg|bal|anc)$/.test(style));
  });
  check('every playing profile is for a real player and well formed', badProfiles.length === 0, JSON.stringify(badProfiles.slice(0, 3)));
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

  // ─── Modes and pools ───
  check('an unknown mode is refused', (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'turbo' })).status === 400);
  for (const bad of [2, 61, 7.5]) {
    check(`a ${bad}s bid timer is refused at creation`, (await host.req('POST', '/api/rooms', { teamId: 'MI', bidTimer: bad })).status === 400);
  }
  const fastMega = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'mega', bidTimer: 3 })).data.id;
  const slowClassic = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint11', bidTimer: 20 })).data.id;
  const plainMega = (await host.req('POST', '/api/rooms', { teamId: 'MI' })).data.id;
  const classic = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint11' })).data.id;
  const blitz = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'blitz5' })).data.id;
  const sprint = (await host.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint5' })).data.id;
  await host.connect();
  const classicState = (await host.join(classic)).state;
  check('Classic 11: 11-player squads, 4 overseas, ₹90 Cr', classicState.squadLimit === 11 && classicState.overseasLimit === 4 && classicState.settings.budget === 90);
  check('a Mega room created with 3-second bids uses them', (await host.join(fastMega)).state.settings.bidTimer === 3);
  check('a Classic room created with 20-second bids uses them', (await host.join(slowClassic)).state.settings.bidTimer === 20);
  check('without a choice the mode default applies (10s)', (await host.join(plainMega)).state.settings.bidTimer === 10);
  const blitzState = (await host.join(blitz)).state;
  check('Blitz 5: 5-player squads, ₹30 Cr and 3-second bids', blitzState.squadLimit === 5 && blitzState.settings.budget === 30 && blitzState.settings.bidTimer === 3);
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
  check('only the host changes room options', /Only the host/.test((await friend.connect().then(() => friend.emit('settings:update', { roomId: noOverseas.data.id, quickPool: true }))).error || ''));
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
  await lister.emit('settings:update', { roomId: listed, isPublic: true });

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
  await host.emit('settings:update', { roomId, bidTimer: 3 });
  check('the auction starts with 8 bots and 2 people', (await host.emit('auction:start', { roomId })).ok);
  check('bots cannot be added once the auction is running', /before the auction starts/.test((await host.emit('bots:add', { roomId, teamId: 'RCB' })).error || ''));
  check('bots cannot be removed once the auction is running', /before the auction starts/.test((await host.emit('bots:remove', { roomId })).error || ''));
  check('a bot\'s franchise cannot be taken over once the auction is running', /already taken/.test((await friend.emit('team:select', { roomId, teamId: 'KKR' })).error || ''));
  check('a bot bids on its own', await eventually(host, () => host.state.currentAuction?.highBidderId?.startsWith('bot_'), 15000, 'a bot bid'));
  // A bots' bidding war on a star can run a few minutes: every bid resets the clock
  check('a bot wins a player', await eventually(host, () => host.state.teams.some(t => t.userId.startsWith('bot_') && t.squad.length > 0), 240000, 'a bot sale'));

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
  check('the new round is announced', roundsHost.events.some(e => e.event === 'chat:message' && /Round 2: 19 unsold players come back/.test(e.payload.text)));
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
