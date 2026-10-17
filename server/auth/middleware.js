import { ACCESS_COOKIE, readAccessToken } from './tokens.js';

export function requireAuth(req, res, next) {
  const user = readAccessToken(req.cookies?.[ACCESS_COOKIE]);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
}
