import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { HttpError, parseBody } from '../validation.js';
import { createRoom, getRuntime, joinRoom, selectTeam } from '../realtime/roomManager.js';

const router = Router();

const createSchema = z.object({ teamId: z.string(), auctionType: z.enum(['mega']).default('mega') });
const joinSchema = z.object({ teamId: z.string().optional() });

router.post('/rooms', requireAuth, async (req, res) => {
  const { teamId, auctionType } = parseBody(createSchema, req.body);
  const id = await createRoom({ user: req.user, teamId, auctionType });
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
