import { ACCESS_COOKIE, readAccessToken } from './tokens.js';

export function requireAuth(req, res, next) {
  const user = readAccessToken(req.cookies?.[ACCESS_COOKIE]);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
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
