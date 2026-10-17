import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { HttpError, parseBody } from '../validation.js';
import { AUCTION_MODES, DEFAULT_BID_TIMER, TEAMS_BY_ID, toCrores } from '../auctionRules.js';

const router = Router();

// No 0/O or 1/I, so codes are easy to read out to friends
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomRoomCode = () =>
  Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)]).join('');

const createSchema = z.object({ teamId: z.string(), auctionType: z.enum(['mega']).default('mega') });
const joinSchema = z.object({ teamId: z.string().optional() });

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

async function loadRoom(code) {
  const room = await prisma.room.findUnique({ where: { id: normalizeCode(code) }, include: { members: true } });
  if (!room) throw new HttpError(404, 'Room not found!');
  return room;
}

const toClientRoom = (room) => ({
  id: room.id,
  hostId: room.hostId,
  status: room.status,
  auctionType: room.auctionType,
  squadLimit: room.squadLimit,
  overseasLimit: room.overseasLimit,
  budget: toCrores(room.budget),
  bidTimer: room.bidTimer,
  members: room.members.map(m => ({
    id: m.userId,
    name: m.displayName,
    team: m.teamId,
    isHost: m.userId === room.hostId,
  })),
});

// The host creates the room and claims a franchise in one step
router.post('/rooms', requireAuth, async (req, res) => {
  const { teamId, auctionType } = parseBody(createSchema, req.body);
  if (!TEAMS_BY_ID.has(teamId)) throw new HttpError(400, 'Unknown franchise');
  const mode = AUCTION_MODES[auctionType];

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomRoomCode();
    try {
      await prisma.room.create({
        data: {
          id,
          hostId: req.user.id,
          auctionType,
          squadLimit: mode.squadLimit,
          overseasLimit: mode.overseasLimit,
          budget: mode.budgetLakhs,
          bidTimer: DEFAULT_BID_TIMER,
          playerOrder: [],
          members: {
            create: { userId: req.user.id, displayName: req.user.name, teamId, budgetRemaining: mode.budgetLakhs },
          },
        },
      });
      return res.status(201).json({ id });
    } catch (err) {
      if (err.code !== 'P2002') throw err; // code already used: try another
    }
  }
  throw new HttpError(500, 'Could not create a room. Please try again.');
});

// Becomes a member of the room, optionally claiming a franchise in the same step
router.post('/rooms/:id/join', requireAuth, async (req, res) => {
  const { teamId } = parseBody(joinSchema, req.body);
  const room = await loadRoom(req.params.id);
  if (room.status === 'completed') throw new HttpError(409, 'This auction has already ended.');
  if (teamId && !TEAMS_BY_ID.has(teamId)) throw new HttpError(400, 'Unknown franchise');

  let member = room.members.find(m => m.userId === req.user.id);
  if (!member) {
    member = await prisma.roomMember.create({
      data: { roomId: room.id, userId: req.user.id, displayName: req.user.name, budgetRemaining: room.budget },
    });
  }
  if (teamId && member.teamId !== teamId) {
    try {
      await prisma.roomMember.update({ where: { id: member.id }, data: { teamId } });
    } catch (err) {
      if (err.code === 'P2002') throw new HttpError(409, 'That franchise is already taken');
      throw err;
    }
  }
  res.json({ id: room.id });
});

router.get('/rooms/:id', requireAuth, async (req, res) => {
  res.json({ room: toClientRoom(await loadRoom(req.params.id)) });
});

export default router;
