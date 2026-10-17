import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { HttpError } from '../validation.js';
import { AUCTION_MODES, DEFAULT_BID_TIMER, MAX_BID_TIMER, MIN_BID_TIMER, TEAMS_BY_ID, toCrores } from '../auctionRules.js';

// The server owns every room. Each room lives in memory while someone is in it
// and every change is written to Postgres first, so nothing is lost on a restart.
// This is single-process state: running more than one server instance would
// need a shared store (e.g. Redis) first.

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
      bannedUserIds: row.bannedUserIds,
      createdAt: row.createdAt,
    },
    members: new Map(row.members.map(m => [m.userId, m])),
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
  const row = await prisma.room.findUnique({ where: { id: roomId }, include: { members: true } });
  if (!row) return null;
  const rt = toRuntime(row);
  runtimes.set(roomId, rt);
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
    bannedPlayers: room.bannedUserIds,
    players: members.map(m => ({
      id: m.userId,
      name: m.displayName,
      team: m.teamId || '',
      teamName: teamName(m.teamId),
      isHost: m.userId === room.hostId,
      isOnline: rt.presence.has(m.userId),
    })),
    teams: members.filter(m => m.teamId).map(m => ({
      id: `${room.id}_${m.userId}`,
      auctionId: room.id,
      userId: m.userId,
      teamId: m.teamId,
      teamName: teamName(m.teamId),
      budgetRemaining: toCrores(m.budgetRemaining),
      squad: [],
    })),
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

  // Free memory for rooms nobody has open; the next visitor loads them again
  rt.queue.then(() => {
    if (rt.presence.size === 0 && runtimes.get(rt.room.id) === rt) runtimes.delete(rt.room.id);
  });
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

    const bannedUserIds = [...new Set([...rt.room.bannedUserIds, targetUserId])];
    await prisma.$transaction([
      prisma.roomMember.delete({ where: { id: target.id } }),
      prisma.room.update({ where: { id: rt.room.id }, data: { bannedUserIds } }),
    ]);
    rt.members.delete(targetUserId);
    rt.room.bannedUserIds = bannedUserIds;
    rt.presence.delete(targetUserId);

    // Every tab they have open leaves the room at once
    io?.to(userChannel(targetUserId)).emit('room:kicked', { roomId: rt.room.id });
    io?.in(userChannel(targetUserId)).socketsLeave(roomChannel(rt.room.id));
    await addMessage(rt, { text: `${target.displayName} has been removed from the room.` });
    broadcast(rt);
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
