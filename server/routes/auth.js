import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { parseBody } from '../validation.js';
import { REFRESH_COOKIE, clearAuthCookies, endSession, rotateSession, startSession } from '../auth/tokens.js';
import { isAdminUser, requireAuth } from '../auth/middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// 'postmessage' is the redirect URI for codes from the Google popup flow
const googleClient = new OAuth2Client({
  clientId: config.googleClientId,
  clientSecret: config.googleClientSecret,
  redirectUri: 'postmessage',
});

// Compared against when an email has no account, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('no-account-for-this-email', 12);

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(40, 'Name is too long'),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password').max(128) });
const guestSchema = z.object({ name: z.string().trim().min(1, 'Enter a name').max(24, 'Name is too long') });
const googleSchema = z.object({ code: z.string().min(1) });

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  isGuest: user.isGuest,
  isAdmin: isAdminUser(user),
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = parseBody(registerSchema, req.body);
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  });
  await startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  await startSession(res, user);
  res.json({ user: publicUser(user) });
});

// The popup returns a one-time code; we exchange it and verify Google's ID token
router.post('/google', authLimiter, async (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server' });
  }
  const { code } = parseBody(googleSchema, req.body);

  let payload;
  try {
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Your Google account email is not verified' });
  }

  const email = payload.email.toLowerCase();
  const profile = { name: payload.name || email.split('@')[0], avatarUrl: payload.picture ?? null };

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (user) {
    user = await prisma.user.update({ where: { id: user.id }, data: profile });
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    user = existing
      // Google has proven this person owns the email. The existing password was never
      // verified, so remove it: otherwise whoever registered the address first keeps access.
      ? await prisma.user.update({ where: { id: existing.id }, data: { ...profile, googleId: payload.sub, passwordHash: null } })
      : await prisma.user.create({ data: { ...profile, email, googleId: payload.sub } });
  }

  await startSession(res, user);
  res.json({ user: publicUser(user) });
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
