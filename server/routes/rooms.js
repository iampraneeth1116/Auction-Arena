import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { HttpError, parseBody } from '../validation.js';
import { MAX_BID_TIMER, MIN_BID_TIMER, TEAMS_BY_ID, toCrores } from '../auctionRules.js';
import { createRoom, getRuntime, joinRoom, listPublicRooms, selectTeam } from '../realtime/roomManager.js';

const router = Router();

const createSchema = z.object({
  teamId: z.string(),
  auctionType: z.enum(['mega', 'sprint11', 'sprint5', 'blitz5']).default('mega'),
  // Listed in Open rooms for anyone to join or watch
  isPublic: z.boolean().optional(),
  quickPool: z.boolean().optional(),
  rotateUnsold: z.boolean().optional(),
  // 0 to the squad size (= no limit); checked against the mode when the room is made
  overseasLimit: z.number().int().min(0).max(25).optional(),
  // Seconds per bid; without it the mode's own default applies
  bidTimer: z.number().int().min(MIN_BID_TIMER).max(MAX_BID_TIMER).optional(),
});
const joinSchema = z.object({ teamId: z.string().optional() });

router.post('/rooms', requireAuth, async (req, res) => {
  const { teamId, auctionType, isPublic, quickPool, rotateUnsold, bidTimer, overseasLimit } = parseBody(createSchema, req.body);
  const id = await createRoom({ user: req.user, teamId, auctionType, isPublic, quickPool, rotateUnsold, bidTimer, overseasLimit });
  res.status(201).json({ id });
});

// Becomes a member of the room, optionally claiming a franchise in the same step.
// The room's live state then comes over Socket.IO.
router.post('/rooms/:id/join', requireAuth, async (req, res) => {
  const { teamId } = parseBody(joinSchema, req.body);
  const rt = await getRuntime(req.params.id.trim().toUpperCase());
  if (!rt) throw new HttpError(404, 'Room not found!');

  await joinRoom(rt, req.user);
  if (teamId) await selectTeam(rt, req.user.id, teamId);
  res.json({ id: rt.room.id });
});

// Rooms their hosts listed for anyone to join or watch
router.get('/rooms/public', (req, res) => {
  res.json({ rooms: listPublicRooms() });
});

// ─── History ───

// Every auction the user ran a franchise in, newest first
router.get('/me/history', requireAuth, async (req, res) => {
  const memberships = await prisma.roomMember.findMany({
    where: { userId: req.user.id, teamId: { not: null }, hiddenAt: null },
    include: {
      room: { include: { _count: { select: { members: true } } } },
      purchases: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { joinedAt: 'desc' },
    take: 50,
  });

  res.json({
    sessions: memberships.map(m => ({
      id: m.id,
      roomId: m.roomId,
      teamId: m.teamId,
      teamName: TEAMS_BY_ID.get(m.teamId)?.name || m.teamId,
      budgetRemaining: toCrores(m.budgetRemaining),
      spent: toCrores(m.room.budget - m.budgetRemaining),
      squad: m.purchases.map(p => ({ id: p.playerId, bid: toCrores(p.price) })),
      status: m.room.status,
      isHost: m.room.hostId === req.user.id,
      mode: m.room.auctionType,
      squadLimit: m.room.squadLimit,
      overseasLimit: m.room.overseasLimit,
      playerCount: m.room._count.members,
      createdAt: m.joinedAt.getTime(),
    })),
  });
});

// Removing an auction only hides it from this user's history: the room and everyone
// else's squads are untouched, so it can be brought back
async function ownSession(req) {
  const member = await prisma.roomMember.findUnique({ where: { id: req.params.id }, include: { room: true } });
  if (!member || member.userId !== req.user.id) throw new HttpError(404, 'Auction not found in your history');
  return member;
}

router.delete('/me/history/:id', requireAuth, async (req, res) => {
  const member = await ownSession(req);
  if (member.room.status === 'active') {
    throw new HttpError(409, 'This auction is still live. Remove it once it has finished.');
  }
  await prisma.roomMember.update({ where: { id: member.id }, data: { hiddenAt: new Date() } });
  res.json({ ok: true });
});

router.post('/me/history/:id/restore', requireAuth, async (req, res) => {
  const member = await ownSession(req);
  await prisma.roomMember.update({ where: { id: member.id }, data: { hiddenAt: null } });
  res.json({ ok: true });
});

export default router;
