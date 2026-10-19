import { prisma } from '../db.js';
import { config } from '../config.js';
import { ACCESS_COOKIE, readAccessToken } from './tokens.js';

export function requireAuth(req, res, next) {
  const user = readAccessToken(req.cookies?.[ACCESS_COOKIE]);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
}

// Admin must come through Google: email/password addresses are never verified,
// so anyone could register an account with the admin's email.
export const isAdminUser = (user) =>
  Boolean(config.adminEmail && user.googleId && user.email?.toLowerCase() === config.adminEmail);

export async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !isAdminUser(user)) return res.status(403).json({ error: 'Admin access only' });
  next();
}

// Minimal Cookie header parser for the Socket.IO handshake
export function parseCookieHeader(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // skip malformed cookie values
    }
  }
  return cookies;
}
