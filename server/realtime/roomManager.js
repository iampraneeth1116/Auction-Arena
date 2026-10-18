import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { IPL_PLAYERS } from '../../src/data/players.js';
import { HttpError } from '../validation.js';
import { botHesitates, botName, botOffer, botThinkMs, botUserId, readMarket, rollMood } from '../bots.js';
import {
  AUCTION_MODES,
  DEFAULT_BID_TIMER,
  FIRST_PLAYER_MS,
  MAX_BID_TIMER,
  MIN_BID_TIMER,
  PLAYERS_BY_ID,
  SOLD_CARD_MS,
  TEAMS_BY_ID,
  UNSOLD_CARD_MS,
  buildPlayerOrder,
  isOverseas,
  nextBidLakhs,
  toCrores,
  toLakhs,
} from '../auctionRules.js';

// The server owns every auction: it runs the countdown, takes bids, sells
// players and moves to the next one. Each room lives in memory while in use and
// every change is written to Postgres first. This is single-process state:
// running more than one server instance would need a shared store (e.g. Redis) first.

const MESSAGE_HISTORY = 200;
const CHAT_MIN_INTERVAL_MS = 500;
// No 0/O or 1/I, so codes are easy to read out to friends
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let io = null;
export const attachIo = (server) => { io = server; };
export const roomChannel = (roomId) => `room:${roomId}`;
export const userChannel = (userId) => `user:${userId}`;

const runtimes = new Map();
const pendingLoads = new Map();

// ─── Loading ───

function toRuntime(row) {
  return {
    room: {
      id: row.id,
      hostId: row.hostId,
      status: row.status,
      auctionType: row.auctionType,
      squadLimit: row.squadLimit,
      overseasLimit: row.overseasLimit,
      budget: row.budget,
      bidTimer: row.bidTimer,
      playerOrder: row.playerOrder,
      currentIndex: row.currentIndex,
      bannedUserIds: row.bannedUserIds,
      createdAt: row.createdAt,
    },
    members: new Map(row.members.map(m => [m.userId, m])),
    purchases: row.purchases,
    // The player under the hammer: bid, high bidder, deadline and status
    live: row.liveState ?? null,
    timer: null,
    botTimer: null,
    // Each bot's mood for the current lot, so it can't change its mind mid-bidding
    botMoods: new Map(),
    market: null,
    // userId → open connections, so a second tab doesn't flip someone offline
    presence: new Map(),
    lastChatAt: new Map(),
    queue: Promise.resolve(),
  };
}

export const getCachedRuntime = (roomId) => runtimes.get(roomId);

export async function getRuntime(roomId) {
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{4,12}$/.test(roomId)) return null;
  if (runtimes.has(roomId)) return runtimes.get(roomId);
  // Two people opening the same room at once share one load
  if (!pendingLoads.has(roomId)) {
    pendingLoads.set(roomId, loadRuntime(roomId).finally(() => pendingLoads.delete(roomId)));
  }
  return pendingLoads.get(roomId);
}

async function loadRuntime(roomId) {
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    include: { members: true, purchases: { orderBy: { createdAt: 'asc' } } },
  });
  if (!row) return null;

  const rt = toRuntime(row);
  runtimes.set(roomId, rt);
  // After a restart, a running auction picks up where it left off: the saved
  // deadline still stands (an expired one resolves at once), or the lot reopens
  if (rt.room.status === 'active') {
    if (rt.live) {
      scheduleNext(rt);
      scheduleBots(rt);
    } else await exclusive(rt, () => startPlayer(rt, rt.room.currentIndex, FIRST_PLAYER_MS));
  }
  return rt;
}

// Serialises every change to one room, so an await (a DB write) can't let a
// second request slip in between a check and its update
function exclusive(rt, task) {
  const run = rt.queue.then(task);
  rt.queue = run.catch(() => {});
  return run;
}

// ─── What clients see ───

export function getSnapshot(rt) {
  const { room } = rt;
  const members = [...rt.members.values()];
  const teamName = (teamId) => TEAMS_BY_ID.get(teamId)?.name || 'Unknown';

  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    auctionType: room.auctionType,
    squadLimit: room.squadLimit,
    overseasLimit: room.overseasLimit,
    settings: { bidTimer: room.bidTimer, budget: toCrores(room.budget) },
    playerOrder: room.playerOrder,
    currentIndex: room.currentIndex,
    bannedPlayers: room.bannedUserIds,
    players: members.map(m => ({
      id: m.userId,
      name: m.displayName,
      team: m.teamId || '',
      teamName: teamName(m.teamId),
      isHost: m.userId === room.hostId,
      isBot: m.isBot,
      isOnline: m.isBot || rt.presence.has(m.userId),
    })),
    teams: members.filter(m => m.teamId).map(m => ({
      id: `${room.id}_${m.userId}`,
      auctionId: room.id,
      userId: m.userId,
      teamId: m.teamId,
      teamName: teamName(m.teamId),
      budgetRemaining: toCrores(m.budgetRemaining),
      squad: squadOf(rt, m).map(p => ({ id: p.playerId, bid: toCrores(p.price) })),
    })),
    currentAuction: rt.live ? { ...rt.live, currentBid: toCrores(rt.live.currentBid) } : null,
  };
}

function broadcast(rt) {
  io?.to(roomChannel(rt.room.id)).emit('room:state', getSnapshot(rt));
}

const toClientMessage = (row) => ({
  id: row.id,
  roomId: row.roomId,
  userId: row.userId ?? 'system',
  userName: row.userName,
  text: row.text,
  type: row.type,
  metadata: row.metadata,
  timestamp: row.createdAt.getTime(),
});

export async function getRecentMessages(roomId) {
  const rows = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_HISTORY,
  });
  return rows.reverse().map(toClientMessage);
}

async function addMessage(rt, { userId = null, userName = 'System', type = 'log', text, metadata }) {
  const row = await prisma.message.create({
    data: { roomId: rt.room.id, userId, userName, type, text, metadata },
  });
  io?.to(roomChannel(rt.room.id)).emit('chat:message', toClientMessage(row));
}

// ─── Presence ───

export function addPresence(rt, userId) {
  rt.presence.set(userId, (rt.presence.get(userId) || 0) + 1);
  broadcast(rt);
}

export function removePresence(rt, userId) {
  const count = (rt.presence.get(userId) || 0) - 1;
  if (count > 0) rt.presence.set(userId, count);
  else rt.presence.delete(userId);
  broadcast(rt);

  // Free memory for rooms nobody has open; the next visitor loads them again.
  // A running auction stays: its clock keeps going with nobody watching.
  rt.queue.then(() => {
    if (rt.presence.size === 0 && rt.room.status !== 'active' && runtimes.get(rt.room.id) === rt) {
      clearTimer(rt);
      runtimes.delete(rt.room.id);
    }
  });
}

// ─── The auction clock ───

function clearTimer(rt) {
  if (rt.timer) {
    clearTimeout(rt.timer);
    rt.timer = null;
  }
  clearBotTimer(rt);
}

function clearBotTimer(rt) {
  if (rt.botTimer) {
    clearTimeout(rt.botTimer);
    rt.botTimer = null;
  }
}

// Arms the one timer a room needs for what it's doing now: closing bidding on
// the current player, or moving on from the SOLD / UNSOLD card
function scheduleNext(rt) {
  clearTimer(rt);
  const { live, room } = rt;
  if (room.status !== 'active' || !live) return;

  let dueAt;
  let task;
  if (live.status === 'bidding') {
    dueAt = live.timerEndsAt;
    task = resolvePlayer;
  } else if (live.status === 'sold' || live.status === 'unsold') {
    dueAt = live.resolvedAt + (live.status === 'sold' ? SOLD_CARD_MS : UNSOLD_CARD_MS);
    task = advance;
  } else {
    return; // paused: nothing runs until the host resumes
  }

  rt.timer = setTimeout(() => {
    rt.timer = null;
    exclusive(rt, () => task(rt)).catch((err) => {
      console.error(`[room ${room.id}] ${task.name} failed, retrying`, err);
      rt.timer = setTimeout(() => scheduleNext(rt), 2000);
    });
  }, Math.max(0, dueAt - Date.now()));
}

async function startPlayer(rt, index, durationMs) {
  const player = IPL_PLAYERS[rt.room.playerOrder[index]];
  const live = {
    playerId: player.id,
    currentBid: 0,
    highBidderId: '',
    highBidderName: 'No Bids',
    highBidderTeamId: '',
    timerEndsAt: Date.now() + durationMs,
    status: 'bidding',
    resolvedAt: null,
  };
  await prisma.room.update({ where: { id: rt.room.id }, data: { currentIndex: index, liveState: live } });
  rt.room.currentIndex = index;
  rt.live = live;
  rt.botMoods.clear();
  broadcast(rt);
  scheduleNext(rt);
  scheduleBots(rt);
}

async function resolvePlayer(rt) {
  const { live, room } = rt;
  if (room.status !== 'active' || live?.status !== 'bidding') return;
  // A bid that landed after this timer was armed moved the deadline
  if (live.timerEndsAt > Date.now()) return scheduleNext(rt);
  clearBotTimer(rt);

  const player = PLAYERS_BY_ID.get(live.playerId);
  const buyer = live.highBidderId ? rt.members.get(live.highBidderId) : null;
  const resolvedAt = Date.now();

  if (buyer?.teamId && buyer.budgetRemaining >= live.currentBid) {
    const soldLive = { ...live, status: 'sold', resolvedAt };
    // One transaction, so a crash can never record the sale without charging the purse or vice versa
    const [purchase] = await prisma.$transaction([
      prisma.purchase.create({
        data: { roomId: room.id, memberId: buyer.id, playerId: player.id, price: live.currentBid },
      }),
      prisma.roomMember.update({
        where: { id: buyer.id },
        data: { budgetRemaining: { decrement: live.currentBid } },
      }),
      prisma.room.update({ where: { id: room.id }, data: { liveState: soldLive } }),
    ]);
    rt.purchases.push(purchase);
    buyer.budgetRemaining -= live.currentBid;
    rt.live = soldLive;

    const team = TEAMS_BY_ID.get(buyer.teamId);
    await addMessage(rt, {
      type: 'sold_card',
      text: `${player.name} SOLD to ${team?.name || buyer.displayName} for ₹${toCrores(live.currentBid)} Cr`,
      metadata: {
        playerId: player.id,
        teamId: buyer.teamId,
        bid: toCrores(live.currentBid),
        buyerId: buyer.userId,
        buyerName: buyer.displayName,
      },
    });
  } else {
    const unsoldLive = { ...live, status: 'unsold', resolvedAt };
    await prisma.room.update({ where: { id: room.id }, data: { liveState: unsoldLive } });
    rt.live = unsoldLive;
    await addMessage(rt, { text: `${player.name} UNSOLD` });
  }

  broadcast(rt);
  scheduleNext(rt);
}

async function advance(rt) {
  const { live, room } = rt;
  if (room.status !== 'active' || (live?.status !== 'sold' && live?.status !== 'unsold')) return;

  const nextIndex = room.currentIndex + 1;
  if (nextIndex >= room.playerOrder.length) {
    return completeRoom(rt, 'Auction completed — every player has gone under the hammer');
  }
  await startPlayer(rt, nextIndex, room.bidTimer * 1000);
}

async function completeRoom(rt, text) {
  clearTimer(rt);
  await prisma.room.update({ where: { id: rt.room.id }, data: { status: 'completed' } });
  rt.room.status = 'completed';
  await addMessage(rt, { text });
  broadcast(rt);
}

// ─── Bids ───

const squadOf = (rt, member) => rt.purchases.filter(p => p.memberId === member.id);

// Why this member can't buy the player at this price, or null if they can
function bidProblem(rt, member, player, amount) {
  const squad = squadOf(rt, member);
  if (squad.length >= rt.room.squadLimit) {
    return `You have reached the squad limit of ${rt.room.squadLimit} players!`;
  }
  const overseasCount = squad.filter(p => isOverseas(PLAYERS_BY_ID.get(p.playerId))).length;
  if (isOverseas(player) && overseasCount >= rt.room.overseasLimit) {
    return `You have reached the overseas quota of ${rt.room.overseasLimit} players!`;
  }
  if (member.budgetRemaining < amount) return 'Insufficient Budget';
  return null;
}

async function commitBid(rt, member, amount) {
  const nextLive = {
    ...rt.live,
    currentBid: amount,
    highBidderId: member.userId,
    highBidderName: member.displayName,
    highBidderTeamId: member.teamId,
    // Every bid gives the room the full timer again
    timerEndsAt: Date.now() + rt.room.bidTimer * 1000,
  };
  await prisma.room.update({ where: { id: rt.room.id }, data: { liveState: nextLive } });
  rt.live = nextLive;
  broadcast(rt);
  scheduleNext(rt);
  scheduleBots(rt);
}

// ─── Bots ───

const botsIn = (rt) => [...rt.members.values()].filter(m => m.isBot && m.teamId);

// Every bid the bots would make on the current player, keenest first
function botOffers(rt) {
  const { live, room } = rt;
  const player = PLAYERS_BY_ID.get(live.playerId);
  // The market only changes when a lot changes hands, so read it once per lot
  if (rt.market?.playerId !== live.playerId) {
    const managers = [...rt.members.values()].filter(m => m.teamId);
    rt.market = {
      playerId: live.playerId,
      ...readMarket({
        playerOrder: room.playerOrder,
        currentIndex: room.currentIndex,
        openSlotsByTeam: managers.map(m => room.squadLimit - squadOf(rt, m).length),
      }),
    };
  }
  const offers = [];
  for (const bot of botsIn(rt)) {
    const moodKey = `${live.playerId}:${bot.userId}`;
    if (!rt.botMoods.has(moodKey)) rt.botMoods.set(moodKey, rollMood());
    const squadPlayers = squadOf(rt, bot).map(p => PLAYERS_BY_ID.get(p.playerId));
    const offer = botOffer({ live, member: bot, squadPlayers, room, market: rt.market, mood: rt.botMoods.get(moodKey) });
    if (offer && !bidProblem(rt, bot, player, offer.amount)) offers.push({ bot, ...offer });
  }
  return offers.sort((a, b) => b.eagerness - a.eagerness);
}

// After every change to live bidding, give the bots one chance to respond
function scheduleBots(rt) {
  clearBotTimer(rt);
  const { live, room } = rt;
  if (room.status !== 'active' || live?.status !== 'bidding' || botsIn(rt).length === 0) return;

  const remainingMs = live.timerEndsAt - Date.now();
  const offers = botOffers(rt);
  if (remainingMs < 1000 || offers.length === 0) return;
  rt.botTimer = setTimeout(() => {
    rt.botTimer = null;
    exclusive(rt, () => botTurn(rt)).catch(err => console.error(`[room ${room.id}] bot turn failed`, err));
  }, botThinkMs(room.bidTimer, remainingMs, offers[0].eagerness));
}

async function botTurn(rt) {
  const { live, room } = rt;
  if (room.status !== 'active' || live?.status !== 'bidding' || live.timerEndsAt - Date.now() < 300) return;

  const offers = botOffers(rt).filter(offer => !botHesitates(offer));
  if (offers.length === 0) return;
  // The keener a bot is, the likelier it is to be the one that raises
  let pick = Math.random() * offers.reduce((sum, o) => sum + o.eagerness + 0.1, 0);
  const chosen = offers.find(o => (pick -= o.eagerness + 0.1) <= 0) ?? offers[0];
  await commitBid(rt, chosen.bot, chosen.amount);
}

async function ensureBotUser(teamId) {
  const id = botUserId(teamId);
  await prisma.user.upsert({
    where: { id },
    create: { id, name: botName(teamId), isBot: true },
    update: {},
  });
  return id;
}

// ─── Guards ───

function assertNotBanned(rt, userId) {
  if (rt.room.bannedUserIds.includes(userId)) {
    throw new HttpError(403, 'You have been kicked from this room and cannot rejoin.', 'kicked');
  }
}

function requireHost(rt, userId) {
  if (rt.room.hostId !== userId) throw new HttpError(403, 'Only the host can do that');
}

function requireMember(rt, userId) {
  const member = rt.members.get(userId);
  if (!member) throw new HttpError(403, 'Join the room first');
  return member;
}

// ─── Actions ───

function randomRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

// The host creates the room and claims a franchise in one step
export async function createRoom({ user, teamId, auctionType }) {
  const mode = AUCTION_MODES[auctionType];
  if (!mode) throw new HttpError(400, 'Unknown auction mode');
  if (!TEAMS_BY_ID.has(teamId)) throw new HttpError(400, 'Unknown franchise');

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomRoomCode();
    try {
      await prisma.room.create({
        data: {
          id,
          hostId: user.id,
          auctionType,
          squadLimit: mode.squadLimit,
          overseasLimit: mode.overseasLimit,
          budget: mode.budgetLakhs,
          bidTimer: DEFAULT_BID_TIMER,
          playerOrder: [],
          members: {
            create: { userId: user.id, displayName: user.name, teamId, budgetRemaining: mode.budgetLakhs },
          },
        },
      });
      return id;
    } catch (err) {
      if (err.code !== 'P2002') throw err; // room code already used: try another
    }
  }
  throw new HttpError(500, 'Could not create a room. Please try again.');
}

// Makes the user a member of the room (a no-op if they already are)
export function joinRoom(rt, user) {
  return exclusive(rt, async () => {
    assertNotBanned(rt, user.id);
    if (rt.members.has(user.id)) return;
    if (rt.room.status === 'completed') throw new HttpError(409, 'This auction has already ended.');

    const member = await prisma.roomMember.create({
      data: { roomId: rt.room.id, userId: user.id, displayName: user.name, budgetRemaining: rt.room.budget },
    });
    rt.members.set(user.id, member);
    broadcast(rt);
  });
}

// Claims a franchise, or switches to another one while the room is still waiting
export function selectTeam(rt, userId, teamId) {
  return exclusive(rt, async () => {
    assertNotBanned(rt, userId);
    const member = requireMember(rt, userId);
    if (!TEAMS_BY_ID.has(teamId)) throw new HttpError(400, 'Unknown franchise');
    if (rt.room.status === 'completed') throw new HttpError(409, 'This auction has already ended.');
    if (member.teamId === teamId) return;
    if (squadOf(rt, member).length > 0) {
      throw new HttpError(409, "You can't switch franchises after buying players");
    }
    if ([...rt.members.values()].some(m => m.teamId === teamId)) {
      throw new HttpError(409, 'That franchise is already taken');
    }

    let updated;
    try {
      updated = await prisma.roomMember.update({
        where: { id: member.id },
        data: { teamId, budgetRemaining: rt.room.budget },
      });
    } catch (err) {
      // The unique (roomId, teamId) index catches a race the check above can't see
      if (err.code === 'P2002') throw new HttpError(409, 'That franchise is already taken');
      throw err;
    }
    rt.members.set(userId, updated);
    broadcast(rt);
  });
}

// Room settings the host can change in the lobby; anything left out keeps its value
export function updateSettings(rt, userId, { bidTimer = rt.room.bidTimer }) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (!Number.isInteger(bidTimer) || bidTimer < MIN_BID_TIMER || bidTimer > MAX_BID_TIMER) {
      throw new HttpError(400, `Bid timer must be between ${MIN_BID_TIMER} and ${MAX_BID_TIMER} seconds`);
    }
    if (rt.room.status === 'completed') throw new HttpError(409, 'This auction has already ended.');
    await prisma.room.update({ where: { id: rt.room.id }, data: { bidTimer } });
    rt.room.bidTimer = bidTimer;
    broadcast(rt);
  });
}

// Removes someone from the room for good: they can't rejoin with the same account
export function kickMember(rt, hostId, targetUserId) {
  return exclusive(rt, async () => {
    requireHost(rt, hostId);
    if (targetUserId === hostId) throw new HttpError(400, "You can't remove yourself");
    const target = rt.members.get(targetUserId);
    if (!target) throw new HttpError(404, 'That player is not in this room');
    if (target.isBot) throw new HttpError(400, 'Remove bots with the bot controls instead');

    const bannedUserIds = [...new Set([...rt.room.bannedUserIds, targetUserId])];
    // A removed manager can't stay the high bidder
    const nextLive = rt.live?.highBidderId === targetUserId && rt.live.status !== 'sold'
      ? { ...rt.live, currentBid: 0, highBidderId: '', highBidderName: 'No Bids', highBidderTeamId: '' }
      : rt.live;
    await prisma.$transaction([
      prisma.roomMember.delete({ where: { id: target.id } }),
      prisma.room.update({
        where: { id: rt.room.id },
        data: { bannedUserIds, ...(nextLive !== rt.live && { liveState: nextLive }) },
      }),
    ]);
    rt.members.delete(targetUserId);
    // Their purchases go with them (the database cascade deletes them too)
    rt.purchases = rt.purchases.filter(p => p.memberId !== target.id);
    rt.room.bannedUserIds = bannedUserIds;
    rt.live = nextLive;
    rt.presence.delete(targetUserId);

    // Every tab they have open leaves the room at once
    io?.to(userChannel(targetUserId)).emit('room:kicked', { roomId: rt.room.id });
    io?.in(userChannel(targetUserId)).socketsLeave(roomChannel(rt.room.id));
    await addMessage(rt, { text: `${target.displayName} has been removed from the room.` });
    broadcast(rt);
  });
}

// Puts a bot in every franchise nobody has claimed, or just the one asked for
export function addBots(rt, userId, teamId = null) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (rt.room.status !== 'waiting') throw new HttpError(409, 'Bots can only be added before the auction starts');
    const taken = new Set([...rt.members.values()].map(m => m.teamId).filter(Boolean));
    const teamIds = teamId ? [teamId] : [...TEAMS_BY_ID.keys()].filter(id => !taken.has(id));
    if (teamId && !TEAMS_BY_ID.has(teamId)) throw new HttpError(400, 'Unknown franchise');
    if (teamId && taken.has(teamId)) throw new HttpError(409, 'That franchise is already taken');
    if (teamIds.length === 0) throw new HttpError(409, 'Every franchise already has a manager');

    for (const id of teamIds) {
      const member = await prisma.roomMember.create({
        data: {
          roomId: rt.room.id,
          userId: await ensureBotUser(id),
          displayName: botName(id),
          teamId: id,
          budgetRemaining: rt.room.budget,
          isBot: true,
        },
      });
      rt.members.set(member.userId, member);
    }
    await addMessage(rt, { text: teamIds.length === 1 ? `${botName(teamIds[0])} joined` : `${teamIds.length} bots joined the room` });
    broadcast(rt);
    return { added: teamIds };
  });
}

// Removes one bot (by franchise), or every bot when no franchise is given
export function removeBots(rt, userId, teamId = null) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (rt.room.status !== 'waiting') throw new HttpError(409, 'Bots can only be removed before the auction starts');
    const bots = [...rt.members.values()].filter(m => m.isBot && (!teamId || m.teamId === teamId));
    if (bots.length === 0) throw new HttpError(404, 'No bot to remove');

    await prisma.roomMember.deleteMany({ where: { id: { in: bots.map(b => b.id) } } });
    bots.forEach(b => rt.members.delete(b.userId));
    broadcast(rt);
    return { removed: bots.map(b => b.teamId) };
  });
}

export function startAuction(rt, userId) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (rt.room.status !== 'waiting') throw new HttpError(409, 'The auction has already started');
    const managed = [...rt.members.values()].filter(m => m.teamId).length;
    if (managed < 2) throw new HttpError(409, 'At least 2 franchises need a manager to start');

    const playerOrder = buildPlayerOrder();
    await prisma.room.update({
      where: { id: rt.room.id },
      data: { status: 'active', playerOrder, currentIndex: 0 },
    });
    rt.room.status = 'active';
    rt.room.playerOrder = playerOrder;
    await addMessage(rt, { text: 'Auction has started!' });
    await startPlayer(rt, 0, FIRST_PLAYER_MS);
  });
}

// expectedAmount is the price (in crores) the bidder saw on their button
export function placeBid(rt, userId, expectedAmount) {
  return exclusive(rt, async () => {
    const { room, live } = rt;
    assertNotBanned(rt, userId);
    const member = requireMember(rt, userId);
    if (!member.teamId) throw new HttpError(400, 'Pick a franchise in the lobby to take part');
    if (room.status !== 'active' || live?.status !== 'bidding' || live.timerEndsAt <= Date.now()) {
      throw new HttpError(409, 'Auction is not accepting bids right now.');
    }
    if (live.highBidderId === userId) throw new HttpError(409, 'You are already the highest bidder!');

    const player = PLAYERS_BY_ID.get(live.playerId);
    const amount = nextBidLakhs(live.currentBid, player);
    const problem = bidProblem(rt, member, player, amount);
    if (problem) throw new HttpError(409, problem);
    // Someone bid first: never charge more than the price the bidder's button showed
    if (expectedAmount !== undefined && toLakhs(expectedAmount) !== amount) {
      throw new HttpError(409, 'Bid not accepted — the price has moved. Try again.');
    }

    await commitBid(rt, member, amount);
    return { currentBid: toCrores(amount) };
  });
}

export function pauseAuction(rt, userId) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    // Only live bidding can pause: pausing on a SOLD card would reopen a sold player on resume
    if (rt.room.status !== 'active' || rt.live?.status !== 'bidding') {
      throw new HttpError(409, 'Only live bidding can be paused');
    }
    const pausedLive = { ...rt.live, status: 'paused' };
    await prisma.room.update({ where: { id: rt.room.id }, data: { liveState: pausedLive } });
    rt.live = pausedLive;
    clearTimer(rt);
    await addMessage(rt, { text: 'Auction PAUSED by the host' });
    broadcast(rt);
  });
}

export function resumeAuction(rt, userId) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (rt.room.status !== 'active' || rt.live?.status !== 'paused') {
      throw new HttpError(409, 'The auction is not paused');
    }
    // The current bid stands and the clock restarts in full
    const resumedLive = { ...rt.live, status: 'bidding', timerEndsAt: Date.now() + rt.room.bidTimer * 1000 };
    await prisma.room.update({ where: { id: rt.room.id }, data: { liveState: resumedLive } });
    rt.live = resumedLive;
    await addMessage(rt, { text: 'Auction RESUMED by the host' });
    broadcast(rt);
    scheduleNext(rt);
    scheduleBots(rt);
  });
}

// Ends the auction early; squads bought so far are final
export function endAuction(rt, userId) {
  return exclusive(rt, async () => {
    requireHost(rt, userId);
    if (rt.room.status === 'completed') return;
    await completeRoom(rt, 'Auction ended by the host');
  });
}

// Chat doesn't touch room state, so it skips the room queue
export async function sendChat(rt, userId, { text, type }) {
  assertNotBanned(rt, userId);
  const member = requireMember(rt, userId);

  const now = Date.now();
  if (now - (rt.lastChatAt.get(userId) || 0) < CHAT_MIN_INTERVAL_MS) {
    throw new HttpError(429, 'Slow down a little');
  }

  const content = typeof text === 'string' ? text.trim() : '';
  if (type === 'text') {
    if (!content || content.length > 150) throw new HttpError(400, 'Messages must be 1–150 characters');
  } else if (type === 'gif') {
    let url;
    try {
      url = new URL(content);
    } catch {
      throw new HttpError(400, 'Invalid GIF');
    }
    // Only Giphy media, so chat can't be used to load arbitrary tracking images
    if (url.protocol !== 'https:' || !url.hostname.endsWith('giphy.com') || content.length > 500) {
      throw new HttpError(400, 'Invalid GIF');
    }
  } else {
    throw new HttpError(400, 'Unknown message type');
  }

  rt.lastChatAt.set(userId, now);
  await addMessage(rt, { userId, userName: member.displayName, type, text: content });
}
