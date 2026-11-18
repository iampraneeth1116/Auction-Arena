import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const router = Router();

// The desktop app's newest version, for the banner the site shows inside an older copy of the
// app. The app checks for updates itself, but on macOS it can only say so in a notification,
// which macOS doesn't always show for an app without Apple's paid developer signature.
// Asked for with Accept: application/json, the Releases page answers with the latest release's
// tag. It's what the app's own updater reads, and unlike GitHub's API it isn't limited to
// 60 requests an hour from an address the host shares with other sites.
const CHECK_EVERY_MS = 60 * 60 * 1000;
const RETRY_AFTER_MS = 10 * 60 * 1000;
const VERSION = /^v(\d+\.\d+\.\d+)$/;

let known = { version: null, until: 0 };
let checking = null;

async function fetchLatestVersion() {
  const res = await fetch(config.desktopReleaseUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`the Releases page answered ${res.status}`);
  const version = VERSION.exec((await res.json())?.tag_name ?? '')?.[1];
  if (!version) throw new Error('the latest release has no version tag');
  return version;
}

// Resolves to the newest version, or null before it's ever been found. Checks at most once an
// hour, and keeps the last answer while GitHub can't be reached.
function latestVersion() {
  if (Date.now() < known.until) return Promise.resolve(known.version);
  checking ??= fetchLatestVersion()
    .then(version => { known = { version, until: Date.now() + CHECK_EVERY_MS }; })
    .catch(err => {
      console.warn(`[desktop] Couldn't find the latest release: ${err.message}`);
      known = { ...known, until: Date.now() + RETRY_AFTER_MS };
    })
    .then(() => known.version)
    .finally(() => { checking = null; });
  return checking;
}

const latestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

router.get('/desktop/latest', latestLimiter, async (req, res) => {
  res.json({ version: await latestVersion() });
});

export default router;
