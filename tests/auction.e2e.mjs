// End-to-end: auth, rooms, the live lobby, chat, host controls, server-run bidding,
// pause / resume / end, restart recovery and the squad / overseas / purse rules,
// against a real server and database.
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { prisma } from '../server/db.js';
import { IPL_PLAYERS } from '../src/data/players.js';

const PORT = 3099;
// Keep Google sign-in unconfigured for this run, whatever .env contains
const SERVER_ENV = { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' };

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
  check('a Giphy GIF is accepted', (await alice.emit('chat:send', { roomId, text: 'https://media.giphy.com/media/abc/giphy.gif', type: 'gif' })).ok);
  const watcher = await signedIn('Watcher');
  await watcher.connect();
  const watch = await watcher.join(roomId);
  check('history arrives on join, oldest first', watch.ok && watch.messages.map(m => m.text).join('|') === 'hello room|https://media.giphy.com/media/abc/giphy.gif');
  check('someone who has not joined cannot chat', /Join the room first/.test((await watcher.emit('chat:send', { roomId, text: 'hi', type: 'text' })).error || ''));
  watcher.disconnect();

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
  const order = bob.state.playerOrder;
  check('every player is in the order once', order.length === IPL_PLAYERS.length && new Set(order).size === IPL_PLAYERS.length);
  check('the marquee set comes first', IPL_PLAYERS[order[0]].set === 'Marquee Set 1');
  check('starting twice is refused', /already started/.test((await alice.emit('auction:start', { roomId })).error || ''));

  const first = IPL_PLAYERS[order[0]];
  check('a bid at a moved price is refused', /price has moved/.test((await bob.emit('bid:place', { roomId, amount: first.basePrice + 1 })).error || ''));
  check('the opening bid is the base price', (await bob.emit('bid:place', { roomId, amount: first.basePrice })).currentBid === first.basePrice);
  check('the leader cannot outbid themselves', /already the highest/.test((await bob.emit('bid:place', { roomId, amount: step(first.basePrice) })).error || ''));
  check('alice raises by one step', (await alice.emit('bid:place', { roomId, amount: step(first.basePrice) })).ok);
  const price = step(step(first.basePrice));
  check('bob raises again', (await bob.emit('bid:place', { roomId, amount: price })).ok);
  check('the lot sells when the clock runs out', await eventually(alice, () => alice.state.currentAuction?.status === 'sold', 6000, 'sold'));
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
  for (const client of [host, full, abroad, skint]) client.disconnect();
} catch (err) {
  check('the run finished without an error', false, err.stack);
} finally {
  await prisma.$disconnect();
  await server.stop();
  if (failedCount()) console.log(`\n--- server log ---\n${server.logs().slice(-3000)}`);
  printSummary();
  process.exit(failedCount() ? 1 : 0);
}
