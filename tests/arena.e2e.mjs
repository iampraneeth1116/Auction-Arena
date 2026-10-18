// End-to-end: bots. Adding and removing them in the lobby, then an auction where
// they bid on their own under the same purse, squad and overseas rules as people.
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { IPL_PLAYERS } from '../src/data/players.js';
import { isOverseas } from '../server/auctionRules.js';

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
  check('a person cannot pick a bot\'s franchise yet', /already taken/.test((await friend.emit('team:select', { roomId, teamId: 'CSK' })).error || ''));
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
  check('removing a bot that isn\'t there is refused', /No bot/.test((await host.emit('bots:remove', { roomId, teamId: 'RCB' })).error || ''));

  // ─── Bots bid on their own ───
  await host.emit('settings:update', { roomId, bidTimer: 3 });
  check('the auction starts with 8 bots and 2 people', (await host.emit('auction:start', { roomId })).ok);
  check('bots cannot be added once the auction is running', /before the auction starts/.test((await host.emit('bots:add', { roomId, teamId: 'RCB' })).error || ''));
  check('bots cannot be removed once the auction is running', /before the auction starts/.test((await host.emit('bots:remove', { roomId })).error || ''));
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
} catch (err) {
  check('the run finished without an error', false, err.stack);
} finally {
  await server.stop();
  if (failedCount()) console.log(`\n--- server log ---\n${server.logs().slice(-3000)}`);
  printSummary();
  process.exit(failedCount() ? 1 : 0);
}
