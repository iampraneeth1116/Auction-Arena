import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { parseBody } from '../validation.js';
import { REFRESH_COOKIE, clearAuthCookies, endSession, rotateSession, startSession } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const guestSchema = z.object({ name: z.string().trim().min(1, 'Enter a name').max(24, 'Name is too long') });

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  isGuest: user.isGuest,
});

// Play straight away with just a name
router.post('/guest', authLimiter, async (req, res) => {
  const { name } = parseBody(guestSchema, req.body);
  const user = await prisma.user.create({ data: { name, isGuest: true } });
  await startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/refresh', async (req, res) => {
  const result = await rotateSession(res, req.cookies[REFRESH_COOKIE]);
  if (result.status === 'retry') return res.status(409).json({ error: 'Session refresh in progress' });
  if (result.status !== 'ok') {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  res.json({ user: publicUser(result.user) });
});

router.post('/logout', async (req, res) => {
  await endSession(res, req.cookies[REFRESH_COOKIE]);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Not signed in' });
  }
  res.json({ user: publicUser(user) });
});

export default router;
