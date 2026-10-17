import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A rotated refresh token that comes back within this window is treated as a
// harmless race (two tabs refreshing at once), not as a stolen token.
const REUSE_GRACE_MS = 30 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const baseCookie = { httpOnly: true, secure: config.isProduction, sameSite: 'lax' };
const accessCookie = { ...baseCookie, path: '/' };
// The refresh token is only ever sent to the auth endpoints
const refreshCookie = { ...baseCookie, path: '/api/auth' };

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, guest: user.isGuest },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: ACCESS_TTL_SECONDS }
  );
}

// Returns { id, name, isGuest } or null for a missing, expired or forged token
export function readAccessToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return { id: payload.sub, name: payload.name, isGuest: payload.guest };
  } catch {
    return null;
  }
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, accessCookie);
  res.clearCookie(REFRESH_COOKIE, refreshCookie);
}

export async function startSession(res, user) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  res.cookie(ACCESS_COOKIE, signAccessToken(user), { ...accessCookie, maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookie, maxAge: REFRESH_TTL_MS });
}

// status: 'ok' (new cookies set) | 'retry' (lost a benign race) | 'invalid'
export async function rotateSession(res, presentedToken) {
  if (!presentedToken) return { status: 'invalid' };

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
    include: { user: true },
  });
  if (!record || record.expiresAt < new Date()) return { status: 'invalid' };

  if (record.revokedAt) {
    if (Date.now() - record.revokedAt.getTime() < REUSE_GRACE_MS) return { status: 'retry' };
    // An old, already-rotated token came back: assume it leaked and end every session
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { status: 'invalid' };
  }

  // Claim atomically so two concurrent requests can't both rotate the same token
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) return { status: 'retry' };

  await startSession(res, record.user);
  return { status: 'ok', user: record.user };
}

export async function endSession(res, presentedToken) {
  if (presentedToken) {
    // Delete rather than revoke: a revoked token counts as "just rotated" for a few
    // seconds, and a logged-out token must be refused outright
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(presentedToken) } });
  }
  clearAuthCookies(res);
}
