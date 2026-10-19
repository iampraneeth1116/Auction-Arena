import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { HttpError, parseBody } from '../validation.js';
import { MAX_BID_TIMER, MIN_BID_TIMER } from '../auctionRules.js';
import { createRoom, getRuntime, joinRoom, selectTeam } from '../realtime/roomManager.js';

const router = Router();

const createSchema = z.object({
  teamId: z.string(),
  auctionType: z.enum(['mega', 'sprint11', 'sprint5', 'blitz5']).default('mega'),
  quickPool: z.boolean().optional(),
  rotateUnsold: z.boolean().optional(),
  // 0 to the squad size (= no limit); checked against the mode when the room is made
  overseasLimit: z.number().int().min(0).max(25).optional(),
  // Seconds per bid; without it the mode's own default applies
  bidTimer: z.number().int().min(MIN_BID_TIMER).max(MAX_BID_TIMER).optional(),
});
const joinSchema = z.object({ teamId: z.string().optional() });

router.post('/rooms', requireAuth, async (req, res) => {
  const { teamId, auctionType, quickPool, rotateUnsold, bidTimer, overseasLimit } = parseBody(createSchema, req.body);
  const id = await createRoom({ user: req.user, teamId, auctionType, quickPool, rotateUnsold, bidTimer, overseasLimit });
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

export default router;
