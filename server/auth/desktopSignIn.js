// Google sign-in for the desktop app. Google refuses to sign in inside app windows, so the app
// opens the person's own browser instead:
//   1. The app makes a secret (the verifier) and opens /api/auth/google/desktop in the browser
//      with its SHA-256 fingerprint (the challenge). The secret never leaves the app until 4.
//   2. The browser signs in with Google and comes back to the callback, which checks the
//      one-time `state` and the Google account.
//   3. The callback gives the browser a one-time code tied to that challenge, which the return
//      page passes to the app on an auctionarena://signed-in link.
//   4. The app trades code + verifier for a session. Only the app that started the sign-in
//      holds the verifier, so a code that turns up anywhere else is no use to anyone.
// Both live in memory for minutes: the server runs as a single instance, and a restart only
// means pressing "Continue with Google" again.
import crypto from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
// Sign-ins started and never finished stay at most this many, so they can't pile up
const MAX_STARTED = 1000;

const started = new Map(); // state → { challenge, redirectUri, expiresAt }
const codes = new Map(); // SHA-256 of the code → { userId, challenge, expiresAt }

const randomToken = () => crypto.randomBytes(32).toString('base64url');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('base64url');

// A SHA-256 in base64url, as the app sends it; codes and states have the same shape
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const isToken = (value) => typeof value === 'string' && TOKEN.test(value);

function dropExpired(map, now) {
  for (const [key, entry] of map) {
    if (entry.expiresAt <= now) map.delete(key);
  }
}

// Step 1: returns the state to send to Google, or null when too many are waiting
export function startDesktopSignIn(challenge, redirectUri, now = Date.now()) {
  dropExpired(started, now);
  if (started.size >= MAX_STARTED) return null;
  const state = randomToken();
  started.set(state, { challenge, redirectUri, expiresAt: now + STATE_TTL_MS });
  return state;
}

// Step 2: the sign-in this state started ({ challenge, redirectUri }), once only, or null
export function takeDesktopSignIn(state, now = Date.now()) {
  if (!isToken(state)) return null;
  const entry = started.get(state);
  started.delete(state);
  return entry && entry.expiresAt > now ? entry : null;
}

// Step 3: a one-time code for this user, which only the challenge's verifier can redeem
export function issueDesktopCode(userId, challenge, now = Date.now()) {
  dropExpired(codes, now);
  const code = randomToken();
  codes.set(sha256(code), { userId, challenge, expiresAt: now + CODE_TTL_MS });
  return code;
}

// Step 4: the user id, or null. Any attempt uses the code up, right or wrong, so nobody gets
// a second guess at the verifier.
export function redeemDesktopCode(code, verifier, now = Date.now()) {
  if (!isToken(code) || typeof verifier !== 'string') return null;
  const key = sha256(code);
  const entry = codes.get(key);
  codes.delete(key);
  if (!entry || entry.expiresAt <= now) return null;
  const presented = Buffer.from(sha256(verifier));
  const expected = Buffer.from(entry.challenge);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected) ? entry.userId : null;
}
