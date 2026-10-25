// End-to-end: auth and sessions, rooms, the live lobby, chat, host controls, server-run
// bidding (latecomers and simultaneous bids included), pause / resume / end, restart
// recovery, the squad / overseas / purse rules, batting orders, and the fantasy league,
// its admin and scoring, against a real server and database.
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { prisma } from '../server/db.js';
import { IPL_PLAYERS } from '../src/data/players.js';
import { signAccessToken } from '../server/auth/tokens.js';
import { calculatePoints, collectMatchPlayers, findPlayer, saveMatch } from '../scripts/lib/fantasyScoring.js';
import { lineupFor, lineupProblem, suggestBattingOrder } from '../src/lib/lineup.js';
import { profileOf } from '../src/lib/playerProfile.js';

const PORT = 3099;
const ADMIN_EMAIL = 'admin@arena.test';
// Keep Google sign-in unconfigured for this run, whatever .env contains
const SERVER_ENV = { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ADMIN_EMAIL };

const { check, failedCount, printSummary } = createChecker();
const step = (crores) => Math.round(crores * 100 + (crores < 5 ? 20 : 25)) / 100;
const isOverseas = (player) => player.country !== 'IND';

let server = await startServer({ port: PORT, env: SERVER_ENV });
const base = server.url;

// waitFor as a yes/no, so a slow step fails one check instead of the whole run
const eventually = (client, predicate, ms, label) => client.waitFor(predicate, ms, label).then(() => true, () => false);

async function signedIn(name) {
  const client = new TestClient(base);
  await client.req('POST', '/api/auth/guest', { name });
  const me = await client.req('GET', '/api/auth/me');
  client.user = me.data.user;
  return client;
}

try {
  const ts = Date.now();

  // ─── Auth ───
  const anon = new TestClient(base);
  check('GET /api/auth/me without a session → 401', (await anon.req('GET', '/api/auth/me')).status === 401);

  const alice = new TestClient(base);
  const reg = await alice.req('POST', '/api/auth/register', { name: 'Alice', email: `alice+${ts}@test.dev`, password: 'password123' });
  check('register → 201', reg.status === 201, JSON.stringify(reg.data));
  const accessCookie = reg.setCookies.find(c => c.startsWith('access_token='));
  const refreshCookie = reg.setCookies.find(c => c.startsWith('refresh_token='));
  check('access cookie is HttpOnly and SameSite=Lax', accessCookie && /HttpOnly/i.test(accessCookie) && /SameSite=Lax/i.test(accessCookie), accessCookie);
  check('refresh cookie is HttpOnly and scoped to /api/auth', refreshCookie && /HttpOnly/i.test(refreshCookie) && /Path=\/api\/auth/.test(refreshCookie), refreshCookie);
  check('tokens never appear in the JSON body', !JSON.stringify(reg.data).includes(alice.cookies.get('access_token')));
  const dup = await new TestClient(base).req('POST', '/api/auth/register', { name: 'A2', email: `ALICE+${ts}@test.dev`, password: 'password123' });
  check('duplicate email (any case) → 409', dup.status === 409, JSON.stringify(dup.data));
  const short = await new TestClient(base).req('POST', '/api/auth/register', { name: 'S', email: `s+${ts}@test.dev`, password: 'short' });
  check('a short password → 400 with a reason', short.status === 400 && /8 characters/.test(short.data?.error || ''), JSON.stringify(short.data));
  check('wrong password → 401', (await new TestClient(base).req('POST', '/api/auth/login', { email: `alice+${ts}@test.dev`, password: 'wrong-password' })).status === 401);
  check('correct password → 200', (await new TestClient(base).req('POST', '/api/auth/login', { email: `alice+${ts}@test.dev`, password: 'password123' })).status === 200);
  const forged = new TestClient(base);
  forged.cookies.set('access_token', `${alice.cookies.get('access_token').slice(0, -4)}abcd`);
  check('tampered JWT → 401', (await forged.req('GET', '/api/auth/me')).status === 401);
  check('Google sign-in without credentials configured → 503', (await new TestClient(base).req('POST', '/api/auth/google', { code: 'fake' })).status === 503);
  alice.user = (await alice.req('GET', '/api/auth/me')).data.user;

  // ─── Rooms and the live lobby ───
  const bob = await signedIn('Bob');
  const created = await alice.req('POST', '/api/rooms', { teamId: 'MI' });
  check('create room → 201 with a 6-character code', created.status === 201 && /^[A-Z0-9]{6}$/.test(created.data?.id), JSON.stringify(created.data));
  const roomId = created.data.id;
  check('join an unknown room → 404', (await bob.req('POST', '/api/rooms/ZZZZZZ/join', {})).status === 404);
  check('bob joins with the code in lower case', (await bob.req('POST', `/api/rooms/${roomId.toLowerCase()}/join`, {})).status === 200);

  const stranger = new TestClient(base);
  check('a socket without a session is refused', await stranger.connect().then(() => false, err => err.message === 'unauthorized'));

  await alice.connect();
  await bob.connect();
  const aliceJoin = await alice.join(roomId);
  check('room:join returns the room in the waiting state', aliceJoin.ok && aliceJoin.state.status === 'waiting' && aliceJoin.state.hostId === alice.user.id);
  await bob.join(roomId);
  check('both managers show online', await eventually(alice, () => alice.state.players.length === 2 && alice.state.players.every(p => p.isOnline), 3000, 'online'));
  check('bob picks CSK', (await bob.emit('team:select', { roomId, teamId: 'CSK' })).ok);
  check('the pick reaches alice live', await eventually(alice, () => alice.state.players.find(p => p.id === bob.user.id)?.team === 'CSK', 3000, 'pick'));
  check('a taken franchise is refused', /already taken/.test((await bob.emit('team:select', { roomId, teamId: 'MI' })).error || ''));
  check('an unknown franchise is refused', /Unknown franchise/.test((await bob.emit('team:select', { roomId, teamId: 'XYZ' })).error || ''));

  // ─── Chat ───
  check('a member sends a message', (await bob.emit('chat:send', { roomId, text: 'hello room', type: 'text' })).ok);
  check('it reaches the room with name and time', await eventually(alice, () => alice.messages().some(m => m.text === 'hello room' && m.userName === 'Bob' && m.timestamp > 0), 3000, 'chat'));
  check('sending again at once is slowed down', /Slow down/.test((await bob.emit('chat:send', { roomId, text: 'again', type: 'text' })).error || ''));
  await new Promise(r => setTimeout(r, 600));
  check('a 151-character message is refused', /1–150/.test((await bob.emit('chat:send', { roomId, text: 'x'.repeat(151), type: 'text' })).error || ''));
  await new Promise(r => setTimeout(r, 600));
  check('an image from outside Giphy is refused', /Invalid GIF/.test((await bob.emit('chat:send', { roomId, text: 'https://evil.example/a.gif', type: 'gif' })).error || ''));
  check('a look-alike domain ending in giphy.com is refused', /Invalid GIF/.test((await bob.emit('chat:send', { roomId, text: 'https://evilgiphy.com/a.gif', type: 'gif' })).error || ''));
  check('a Giphy GIF is accepted', (await alice.emit('chat:send', { roomId, text: 'https://media.giphy.com/media/abc/giphy.gif', type: 'gif' })).ok);
  const watcher = await signedIn('Watcher');
  await watcher.connect();
  const watch = await watcher.join(roomId);
  check('history arrives on join, oldest first', watch.ok && watch.messages.map(m => m.text).join('|') === 'hello room|https://media.giphy.com/media/abc/giphy.gif');
  check('someone who has not joined cannot chat', /Join the room first/.test((await watcher.emit('chat:send', { roomId, text: 'hi', type: 'text' })).error || ''));
  check('someone following the room without joining counts as watching', await eventually(alice, () => alice.state.spectatorCount === 1, 3000, 'watching'));
  watcher.disconnect();
  check('they stop counting when they leave', await eventually(alice, () => alice.state.spectatorCount === 0, 3000, 'left'));

  // ─── Host controls ───
  check('only the host changes the bid timer', /Only the host/.test((await bob.emit('settings:update', { roomId, bidTimer: 5 })).error || ''));
  for (const bad of [2, 61, 'ten']) {
    check(`bid timer ${JSON.stringify(bad)} is refused`, /between 3 and 60/.test((await alice.emit('settings:update', { roomId, bidTimer: bad })).error || ''));
  }
  check('host sets a 3s bid timer', (await alice.emit('settings:update', { roomId, bidTimer: 3 })).ok);
  check('the new timer reaches everyone', await eventually(bob, () => bob.state.settings.bidTimer === 3, 3000, 'timer'));

  const carol = await signedIn('Carol');
  await carol.req('POST', `/api/rooms/${roomId}/join`, { teamId: 'KKR' });
  await carol.connect();
  await carol.join(roomId);
  check('a non-host cannot remove anyone', /Only the host/.test((await bob.emit('member:kick', { roomId, userId: carol.user.id })).error || ''));
  check('the host cannot remove themselves', /remove yourself/.test((await alice.emit('member:kick', { roomId, userId: alice.user.id })).error || ''));
  check('host removes carol', (await alice.emit('member:kick', { roomId, userId: carol.user.id })).ok);
  check('carol is told she was removed', await eventually(carol, () => carol.events.some(e => e.event === 'room:kicked' && e.payload.roomId === roomId), 3000, 'kicked'));
  check('carol is gone and KKR is open again', await eventually(alice, () => !alice.state.players.some(p => p.id === carol.user.id) && alice.state.bannedPlayers.includes(carol.user.id), 3000, 'removed'));
  const rejoin = await carol.req('POST', `/api/rooms/${roomId}/join`, {});
  check('carol cannot rejoin by link', rejoin.status === 403 && rejoin.data?.code === 'kicked', JSON.stringify(rejoin.data));
  check('carol cannot follow the room again', (await carol.emit('room:join', { roomId })).code === 'kicked');
  carol.disconnect();

  // ─── Bidding ───
  check('only the host starts the auction', /Only the host/.test((await bob.emit('auction:start', { roomId })).error || ''));
  check('host starts the auction', (await alice.emit('auction:start', { roomId })).ok);
  check('everyone sees it go live', await eventually(bob, () => bob.state.status === 'active' && bob.state.currentAuction?.status === 'bidding', 3000, 'live'));
  check('the first lot gets 15 seconds', Math.abs(bob.state.currentAuction.timerEndsAt - Date.now() - 15000) < 2000, String(bob.state.currentAuction.timerEndsAt - Date.now()));
  const order = bob.state.playerOrder;
  check('every player is in the order once', order.length === IPL_PLAYERS.length && new Set(order).size === IPL_PLAYERS.length);
  check('the marquee set comes first', IPL_PLAYERS[order[0]].set === 'Marquee Set 1');
  check('starting twice is refused', /already started/.test((await alice.emit('auction:start', { roomId })).error || ''));

  const first = IPL_PLAYERS[order[0]];

  // Arriving after the start: watch, or claim a franchise nobody holds
  const latecomer = await signedIn('Dev');
  await latecomer.connect();
  await latecomer.join(roomId);
  check('a latecomer following the live auction counts as watching', await eventually(alice, () => alice.state.spectatorCount === 1, 3000, 'late watcher'));
  check('a spectator cannot bid', /Join the room first/.test((await latecomer.emit('bid:place', { roomId, amount: first.basePrice })).error || ''));
  check('a latecomer cannot claim a franchise someone holds', (await latecomer.req('POST', `/api/rooms/${roomId}/join`, { teamId: 'CSK' })).status === 409);
  check('a latecomer claims a free franchise mid-auction', (await latecomer.req('POST', `/api/rooms/${roomId}/join`, { teamId: 'RR' })).status === 200);
  check('they join the board with a full purse and stop counting as watching', await eventually(alice, () => alice.state.teams.some(t => t.teamId === 'RR' && t.userId === latecomer.user.id && t.budgetRemaining === 120) && alice.state.spectatorCount === 0, 3000, 'late claim'));
  latecomer.disconnect();
  check('a bid at a moved price is refused', /price has moved/.test((await bob.emit('bid:place', { roomId, amount: first.basePrice + 1 })).error || ''));
  check('the opening bid is the base price', (await bob.emit('bid:place', { roomId, amount: first.basePrice })).currentBid === first.basePrice);
  check('the leader cannot outbid themselves', /already the highest/.test((await bob.emit('bid:place', { roomId, amount: step(first.basePrice) })).error || ''));
  check('alice raises by one step', (await alice.emit('bid:place', { roomId, amount: step(first.basePrice) })).ok);
  const price = step(step(first.basePrice));
  check('bob raises again', (await bob.emit('bid:place', { roomId, amount: price })).ok);
  check('the lot sells when the clock runs out', await eventually(alice, () => alice.state.currentAuction?.status === 'sold', 6000, 'sold'));
  check('a bid during the SOLD card is refused', /not accepting bids/.test((await alice.emit('bid:place', { roomId, amount: step(price) })).error || ''));
  const csk = alice.state.teams.find(t => t.teamId === 'CSK');
  check('bob gets the player at his price', csk.squad.length === 1 && csk.squad[0].id === first.id && csk.squad[0].bid === price, JSON.stringify(csk.squad));
  check("bob's purse goes down by the price", Math.abs(csk.budgetRemaining - (120 - price)) < 1e-9, String(csk.budgetRemaining));
  check('a SOLD card message goes to the room', alice.messages().some(m => m.type === 'sold_card' && m.metadata?.playerId === first.id));
  check('the next player comes up after the SOLD card', await eventually(alice, () => alice.state.currentIndex === 1 && alice.state.currentAuction?.status === 'bidding', 8000, 'next'));
  check('with no bids the lot goes unsold', await eventually(alice, () => alice.state.currentAuction?.status === 'unsold', 6000, 'unsold'));
  check('a buyer cannot switch franchise', /after buying players/.test((await bob.emit('team:select', { roomId, teamId: 'RCB' })).error || ''));

  // ─── Pause, resume, restart, end ───
  check('the third lot opens', await eventually(alice, () => alice.state.currentIndex === 2 && alice.state.currentAuction?.status === 'bidding', 6000, 'lot 3'));
  check('only the host pauses', /Only the host/.test((await bob.emit('auction:pause', { roomId })).error || ''));
  const lot3 = IPL_PLAYERS[order[2]];
  check('bob opens the third lot', (await bob.emit('bid:place', { roomId, amount: lot3.basePrice })).ok);
  check('host pauses', (await alice.emit('auction:pause', { roomId })).ok);
  check('everyone sees the pause', await eventually(bob, () => bob.state.currentAuction?.status === 'paused', 3000, 'paused'));
  check('a bid while paused is refused', /not accepting bids/.test((await alice.emit('bid:place', { roomId, amount: step(lot3.basePrice) })).error || ''));
  await new Promise(r => setTimeout(r, 3500));
  check('the clock does not run out while paused', alice.state.currentAuction?.status === 'paused');
  check('pausing twice is refused', /Only live bidding/.test((await alice.emit('auction:pause', { roomId })).error || ''));
  check('host resumes', (await alice.emit('auction:resume', { roomId })).ok);
  check('the bid stands and the clock restarts in full', await eventually(bob, () => {
    const live = bob.state.currentAuction;
    return live?.status === 'bidding' && live.highBidderId === bob.user.id && live.timerEndsAt - Date.now() > 2000;
  }, 3000, 'resumed'));
  check('resuming a running lot is refused', /not paused/.test((await alice.emit('auction:resume', { roomId })).error || ''));
  check('pause and resume are logged', ['Auction PAUSED by the host', 'Auction RESUMED by the host'].every(text => alice.messages().some(m => m.text === text)));

  // Stop the server mid-auction and start it again: the room carries on
  await alice.emit('auction:pause', { roomId });
  alice.disconnect();
  bob.disconnect();
  await server.stop();
  server = await startServer({ port: PORT, env: SERVER_ENV });
  await alice.connect();
  const after = await alice.join(roomId);
  check('after a restart the auction is still running', after.ok && after.state.status === 'active' && after.state.currentAuction?.playerId === lot3.id, JSON.stringify(after.state?.currentAuction));
  check('the paused lot, its bid and the squads survive the restart', after.state.currentAuction.status === 'paused' && after.state.currentAuction.highBidderId === bob.user.id && after.state.teams.find(t => t.teamId === 'CSK')?.squad.length === 1);
  check('chat history survives the restart', after.messages.some(m => m.text === 'hello room'));
  check('the host resumes after the restart', (await alice.emit('auction:resume', { roomId })).ok);
  check('only the host ends the auction', /Only the host/.test((await bob.connect().then(() => bob.emit('auction:end', { roomId }))).error || ''));
  check('host ends the auction', (await alice.emit('auction:end', { roomId })).ok);
  check('the room is completed for everyone', await eventually(alice, () => alice.state.status === 'completed', 3000, 'completed'));
  check('bids after the end are refused', /not accepting bids/.test((await bob.emit('bid:place', { roomId, amount: lot3.basePrice })).error || ''));
  alice.disconnect();
  bob.disconnect();

  // ─── Squad, overseas and purse rules ───
  // Squads are seeded straight into the database before anyone opens the room
  const host = await signedIn('RulesHost');
  const full = await signedIn('FullSquad');
  const abroad = await signedIn('OverseasFull');
  const skint = await signedIn('Skint');
  const rulesRoom = (await host.req('POST', '/api/rooms', { teamId: 'MI' })).data.id;
  const late = IPL_PLAYERS.filter(p => !p.set.startsWith('Marquee') && !/^Set \d/.test(p.set));
  const seed = async (client, teamId, players, budgetRemaining = 12000) => {
    const member = await prisma.roomMember.create({
      data: { roomId: rulesRoom, userId: client.user.id, displayName: client.user.name, teamId, budgetRemaining },
    });
    for (const p of players) await prisma.purchase.create({ data: { roomId: rulesRoom, memberId: member.id, playerId: p.id, price: 30 } });
  };
  await seed(full, 'CSK', late.filter(p => !isOverseas(p)).slice(0, 25));
  await seed(abroad, 'RCB', late.filter(isOverseas).slice(0, 8));
  await seed(skint, 'KKR', [], 100);

  for (const client of [host, full, abroad, skint]) {
    await client.connect();
    await client.join(rulesRoom);
  }
  await host.emit('settings:update', { roomId: rulesRoom, bidTimer: 3 });
  await host.emit('auction:start', { roomId: rulesRoom });

  const tested = { squad: false, budget: false, overseas: false };
  for (let lot = 0; lot < 10 && !(tested.squad && tested.budget && tested.overseas); lot++) {
    if (!await eventually(host, () => host.state.currentIndex === lot && host.state.currentAuction?.status === 'bidding', 10000, `lot ${lot}`)) break;
    const player = IPL_PLAYERS[host.state.playerOrder[lot]];
    if (!tested.squad) {
      check('a full squad cannot bid', /squad limit of 25/.test((await full.emit('bid:place', { roomId: rulesRoom, amount: player.basePrice })).error || ''));
      tested.squad = true;
    }
    if (!tested.budget && player.basePrice > 1) {
      check(`₹1 Cr left cannot open ₹${player.basePrice} Cr`, (await skint.emit('bid:place', { roomId: rulesRoom, amount: player.basePrice })).error === 'Insufficient Budget');
      tested.budget = true;
    }
    if (!tested.overseas && isOverseas(player)) {
      check('a 9th overseas player is refused', /overseas quota of 8/.test((await abroad.emit('bid:place', { roomId: rulesRoom, amount: player.basePrice })).error || ''));
      tested.overseas = true;
    }
    // The first lot runs 15 seconds, the rest the 3-second timer
    await eventually(host, () => host.state.currentAuction?.status === 'unsold', 20000, 'unsold');
  }
  check('every rule came up within ten lots', tested.squad && tested.budget && tested.overseas, JSON.stringify(tested));

  // ─── Fantasy XI ───
  const fantasyPath = `/api/rooms/${rulesRoom}/fantasy/squad`;
  const fullIds = late.filter(p => !isOverseas(p)).slice(0, 25).map(p => p.id);
  const abroadIds = late.filter(isOverseas).slice(0, 8).map(p => p.id);
  check('a fantasy XI needs at least 5 players', /at least 5/.test((await full.req('PUT', fantasyPath, { players: fullIds.slice(0, 4), captain: fullIds[0], viceCaptain: fullIds[1] })).data?.error || ''));
  check('only players you bought can be picked', /players you bought/.test((await full.req('PUT', fantasyPath, { players: abroadIds.slice(0, 5), captain: abroadIds[0], viceCaptain: abroadIds[1] })).data?.error || ''));
  check('at most 4 overseas in the XI', /4 overseas/.test((await abroad.req('PUT', fantasyPath, { players: abroadIds.slice(0, 5), captain: abroadIds[0], viceCaptain: abroadIds[1] })).data?.error || ''));
  check('captain and vice-captain must differ', /two different players/.test((await full.req('PUT', fantasyPath, { players: fullIds.slice(0, 11), captain: fullIds[0], viceCaptain: fullIds[0] })).data?.error || ''));
  check('the impact player must come from outside the XI', /outside the XI/.test((await full.req('PUT', fantasyPath, { players: fullIds.slice(0, 11), captain: fullIds[0], viceCaptain: fullIds[1], impactPlayer: fullIds[2] })).data?.error || ''));
  const saved = await full.req('PUT', fantasyPath, { players: fullIds.slice(0, 11), captain: fullIds[0], viceCaptain: fullIds[1], impactPlayer: fullIds[11] });
  check('a valid XI is saved', saved.status === 200 && saved.data.squad.players.length === 11, JSON.stringify(saved.data));
  const league = await host.req('GET', `/api/rooms/${rulesRoom}/fantasy`);
  check('the league shows the saved XI to the room', league.status === 200 && league.data.squads.some(sq => sq.teamId === 'CSK' && sq.captain === fullIds[0]) && typeof league.data.playerStats === 'object');
  check('someone without a franchise cannot enter', /part of a franchise/.test((await (await signedIn('NoTeam')).req('PUT', fantasyPath, { players: fullIds.slice(0, 5), captain: fullIds[0], viceCaptain: fullIds[1] })).data?.error || ''));
  check('fantasy player stats load', (await host.req('GET', '/api/fantasy/player-stats')).status === 200);
  check('admin endpoints are forbidden for everyone else', (await host.req('POST', `/api/admin/player-stats/${fullIds[0]}/match`, { points: 10 })).status === 403);
  check('me says a guest is not an admin', (await host.req('GET', '/api/auth/me')).data.user.isAdmin === false);

  // ─── Batting order ───
  const saveLineup = (client, playerIds) => client.emit('lineup:save', { roomId: rulesRoom, playerIds });
  const cskOrder = () => host.state.teams.find(t => t.teamId === 'CSK')?.battingOrder.join();
  check('a batting order waits for the end of the auction', /once the auction is over/.test((await saveLineup(full, fullIds.slice(0, 11))).error || ''));
  await host.emit('auction:end', { roomId: rulesRoom });
  await eventually(host, () => host.state.status === 'completed', 5000, 'rules room ended');
  check('the XI must be full', /needs 11 players/.test((await saveLineup(full, fullIds.slice(0, 10))).error || ''));
  check('a player can only bat once', /only bat once/.test((await saveLineup(full, [...fullIds.slice(0, 10), fullIds[0]])).error || ''));
  check('only players you bought can bat', /players you bought/.test((await saveLineup(full, [...fullIds.slice(0, 10), abroadIds[0]])).error || ''));
  check('a list that is not player ids is refused', /Invalid batting order/.test((await saveLineup(full, 'not a list')).error || ''));
  const outsider = await signedIn('Outsider');
  await outsider.connect();
  check('someone outside the room has no batting order', /Join the room first/.test((await saveLineup(outsider, fullIds.slice(0, 11))).error || ''));
  outsider.disconnect();
  const myOrder = fullIds.slice(0, 11).reverse();
  const savedOrder = await saveLineup(full, myOrder);
  check('a manager saves their XI in batting order', savedOrder.ok && savedOrder.battingOrder.join() === myOrder.join(), JSON.stringify(savedOrder));
  check('the room sees the batting order', await eventually(host, () => cskOrder() === myOrder.join(), 3000, 'batting order'));
  check('the batting order is stored', (await prisma.roomMember.findFirst({ where: { roomId: rulesRoom, teamId: 'CSK' } }))?.battingOrder.join() === myOrder.join());
  check('an all-overseas squad fields an XI as big as the overseas cap', (await saveLineup(abroad, abroadIds.slice(0, 4))).ok);
  check('an empty list goes back to the suggested XI', (await saveLineup(full, [])).ok && await eventually(host, () => cskOrder() === '', 3000, 'reset'));

  // The rules on their own: 8 Indians and 5 overseas players in a 25-player squad with 8 overseas allowed
  const indians = late.filter(p => !isOverseas(p)).slice(0, 8);
  const overseas = late.filter(isOverseas).slice(0, 5);
  const mixed = [...indians, ...overseas];
  check('the XI is capped at 4 overseas', lineupProblem([...indians.slice(0, 6), ...overseas].map(p => p.id), mixed, 25, 8) === 'At most 4 overseas players in the XI');
  check('7 Indians and 4 overseas make a legal XI', lineupProblem([...indians.slice(0, 7), ...overseas.slice(0, 4)].map(p => p.id), mixed, 25, 8) === null);
  check('a 5-player mode wants an XI of 5', lineupProblem(indians.slice(0, 5).map(p => p.id), indians, 5, 2) === null && /needs 5/.test(lineupProblem(indians.slice(0, 4).map(p => p.id), indians, 5, 2)));
  const ranks = { open: 0, top: 1, middle: 2, finish: 3, tail: 4 };
  const suggested = suggestBattingOrder(fullIds.slice(0, 11).map(id => IPL_PLAYERS.find(p => p.id === id)));
  const suggestedRanks = suggested.map(p => ranks[profileOf(p).order]).filter(r => r !== undefined);
  check('the suggested order runs openers to tail', suggestedRanks.every((r, i) => i === 0 || r >= suggestedRanks[i - 1]), JSON.stringify(suggested.map(p => profileOf(p).order)));
  const shown = lineupFor(mixed, mixed.slice(0, 11), [overseas[0].id, 'someone-sold-elsewhere']);
  check('a saved order with an unknown player falls back to the suggested XI', !shown.custom && shown.xi.length === 11 && shown.bench.length === 2);

  // ─── Fantasy admin ───
  // Admins have to come through Google, so the test makes that account directly and signs its token
  const adminUser = await prisma.user.upsert({
    where: { googleId: 'test-google-admin' },
    create: { name: 'Test Admin', email: ADMIN_EMAIL, googleId: 'test-google-admin' },
    update: { email: ADMIN_EMAIL },
  });
  const admin = new TestClient(base);
  admin.cookies.set('access_token', signAccessToken(adminUser));
  check('me says the Google admin is an admin', (await admin.req('GET', '/api/auth/me')).data?.user?.isAdmin === true);
  const tuned = IPL_PLAYERS.at(-1);
  const original = await prisma.playerStat.findUnique({ where: { playerId: tuned.id } });
  const before = original ?? { totalPoints: 0, matches: 0 };
  const added = await admin.req('POST', `/api/admin/player-stats/${tuned.id}/match`, { points: 40 });
  check('the admin adds one match of points', added.status === 200 && added.data.stat.totalPoints === before.totalPoints + 40 && added.data.stat.matches === before.matches + 1, JSON.stringify(added.data));
  const corrected = await admin.req('PUT', `/api/admin/player-stats/${tuned.id}`, { average: 50 });
  check('a corrected average keeps the match count', corrected.data?.stat?.matches === before.matches + 1 && corrected.data.stat.totalPoints === 50 * (before.matches + 1), JSON.stringify(corrected.data));
  const recounted = await admin.req('PUT', `/api/admin/player-stats/${tuned.id}`, { matches: 4 });
  check('a corrected match count keeps the average', recounted.data?.stat?.matches === 4 && recounted.data.stat.totalPoints === 200, JSON.stringify(recounted.data));
  check('match points outside the allowed range are refused', (await admin.req('POST', `/api/admin/player-stats/${tuned.id}/match`, { points: 5000 })).status === 400);
  check('an unknown player is a 404', (await admin.req('POST', '/api/admin/player-stats/nobody/match', { points: 10 })).status === 404);
  // Leave the dev database's stats as they were
  if (original) await prisma.playerStat.update({ where: { playerId: tuned.id }, data: { totalPoints: original.totalPoints, matches: original.matches } });
  else await prisma.playerStat.delete({ where: { playerId: tuned.id } });

  // ─── Fantasy scoring (the scripts' shared library) ───
  // 52 off 30 with 4 fours and 2 sixes, caught: 52 + 16 + 12 + 8 (fifty) + 6 (SR 173) + 4 (in the XI)
  check('an innings scores as the rules say', calculatePoints({ batting: { r: 52, b: 30, fours: 4, sixes: 2, dismissal: 'caught' }, announced: true }, 'Batsman').points === 98);
  // 4-0-24-3 with 10 dots and an LBW: 10 + 90 + 8 + 4 (3 wickets) + 2 (economy 6) + 4 (in the XI)
  check('a spell scores as the rules say', calculatePoints({ bowling: { w: 3, m: 0, r: 24, o: 4, dot: 10, lbw_bowled: 1 }, announced: true }, 'Bowler').points === 118);
  check('economy counts 3.4 overs as 3 overs and 4 balls', calculatePoints({ bowling: { w: 0, m: 0, r: 18, o: 3.4, dot: 0 } }, 'Bowler').points === 6);
  check('a bowler is not docked for a duck', calculatePoints({ batting: { r: 0, b: 2, dismissal: 'bowled' } }, 'Bowler').points === 0);
  check('CricAPI spellings map to our players', findPlayer('philipsalt')?.name === 'Phil Salt' && findPlayer('mohammedsiraj')?.name === 'Mohammad Siraj' && findPlayer('nobodyatall') === null);
  const scorecard = { scorecard: [{ batting: [{ batsman: { name: 'Virat Kohli' }, r: 52, b: 30, fours: 4, sixes: 2, dismissal: 'caught' }], bowling: [{ bowler: { name: 'Jasprit Bumrah' }, w: 3, m: 0, r: 24, o: 4, dot: 10, lbw_bowled: 1 }] }] };
  const matchPlayers = collectMatchPlayers(scorecard, [{ name: 'Virat Kohli' }, { name: 'Jasprit Bumrah' }, { name: 'Shubman Gill' }, { name: 'Not A Real Player' }]);
  check('everyone in the XI is collected, even without a score', Object.keys(matchPlayers).length === 4 && matchPlayers.shubmangill?.announced === true);
  const kohli = IPL_PLAYERS.find(p => p.name === 'Virat Kohli');
  const statBefore = (await prisma.playerStat.findUnique({ where: { playerId: kohli.id } })) ?? { totalPoints: 0, matches: 0 };
  const match = { id: `test-${ts}`, name: `Test match ${ts}` };
  const saved1 = await saveMatch(prisma, match, matchPlayers);
  check('a match is saved with unknown names reported', saved1.matched === 3 && saved1.unmapped.join() === 'notarealplayer', JSON.stringify(saved1));
  const statAfter = await prisma.playerStat.findUnique({ where: { playerId: kohli.id } });
  check("the player's running total goes up by the match points", statAfter.totalPoints - statBefore.totalPoints === 98 && statAfter.matches - statBefore.matches === 1);
  const again = await saveMatch(prisma, match, matchPlayers).then(() => 'saved', () => 'refused');
  const statAgain = await prisma.playerStat.findUnique({ where: { playerId: kohli.id } });
  check('the same match is never counted twice', again === 'refused' && statAgain.totalPoints === statAfter.totalPoints && statAgain.matches === statAfter.matches);
  for (const client of [host, full, abroad, skint]) client.disconnect();

  // ─── Two bids at the same moment ───
  const raceHost = await signedIn('RaceHost');
  const racers = [await signedIn('RacerOne'), await signedIn('RacerTwo')];
  const raceRoom = (await raceHost.req('POST', '/api/rooms', { teamId: 'MI', auctionType: 'sprint5' })).data.id;
  await racers[0].req('POST', `/api/rooms/${raceRoom}/join`, { teamId: 'CSK' });
  await racers[1].req('POST', `/api/rooms/${raceRoom}/join`, { teamId: 'RCB' });
  for (const client of [raceHost, ...racers]) {
    await client.connect();
    await client.join(raceRoom);
  }
  await raceHost.emit('auction:start', { roomId: raceRoom });
  await eventually(raceHost, () => raceHost.state.currentAuction?.status === 'bidding', 3000, 'race lot');
  const racePrice = IPL_PLAYERS[raceHost.state.playerOrder[0]].basePrice;
  const raceBids = await Promise.all(racers.map(client => client.emit('bid:place', { roomId: raceRoom, amount: racePrice })));
  check('two bids at the same price at once: exactly one wins', raceBids.filter(r => r.ok).length === 1, JSON.stringify(raceBids));
  await raceHost.emit('auction:end', { roomId: raceRoom });
  for (const client of [raceHost, ...racers]) client.disconnect();

  // ─── Session rotation and sign-out ───
  const oldRefresh = alice.cookies.get('refresh_token');
  const rotated = await alice.req('POST', '/api/auth/refresh');
  check('a refresh hands out a new refresh token', rotated.status === 200 && alice.cookies.get('refresh_token') !== oldRefresh);
  const replay = new TestClient(base);
  replay.cookies.set('refresh_token', oldRefresh);
  check('the old token straight back again → 409 retry', (await replay.req('POST', '/api/auth/refresh')).status === 409);
  const currentRefresh = alice.cookies.get('refresh_token');
  const signedOut = await alice.req('POST', '/api/auth/logout');
  check('signing out clears both cookies', signedOut.status === 200 && !alice.cookies.has('access_token') && !alice.cookies.has('refresh_token'));
  const afterSignOut = new TestClient(base);
  afterSignOut.cookies.set('refresh_token', currentRefresh);
  check('the refresh token is dead after signing out → 401', (await afterSignOut.req('POST', '/api/auth/refresh')).status === 401);
} catch (err) {
  check('the run finished without an error', false, err.stack);
} finally {
  await prisma.$disconnect();
  await server.stop();
  if (failedCount()) console.log(`\n--- server log ---\n${server.logs().slice(-3000)}`);
  printSummary();
  process.exit(failedCount() ? 1 : 0);
}
