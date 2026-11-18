// End-to-end: the banner the site shows inside an older copy of the desktop app. Covers reading
// the app's version from its browser identification, comparing versions, and the server's
// lookup of the newest release, against a stand-in for GitHub's Releases page.
import http from 'node:http';
import { createChecker, startServer } from './helpers.mjs';
import { desktopAppVersion, isNewerVersion } from '../src/lib/desktopApp.js';

const { check, failedCount, printSummary } = createChecker();

// ─── The app's version and comparing versions ───
// What the v0.1.1 Mac app really sends (read from it with its debugger)
const APP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) AuctionArena/0.1.1 Chrome/152.0.7977.167 Electron/44.9.3 Safari/537.36';
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
check('the app\'s version is read from its browser identification', desktopAppVersion(APP_UA) === '0.1.1', desktopAppVersion(APP_UA));
check('an ordinary browser has no app version', desktopAppVersion(CHROME_UA) === null);
check('a missing identification has no app version', desktopAppVersion(undefined) === null);
check('0.1.2 is newer than 0.1.1', isNewerVersion('0.1.2', '0.1.1'));
check('0.1.10 is newer than 0.1.9 (compared as numbers)', isNewerVersion('0.1.10', '0.1.9'));
check('0.2.0 is newer than 0.1.9, and 1.0.0 than 0.9.9', isNewerVersion('0.2.0', '0.1.9') && isNewerVersion('1.0.0', '0.9.9'));
check('the same version isn\'t newer', !isNewerVersion('0.1.1', '0.1.1'));
check('an older version isn\'t newer', !isNewerVersion('0.1.0', '0.1.1') && !isNewerVersion('0.1.9', '0.1.10'));

// ─── The newest release, from a stand-in for GitHub ───
// Like GitHub: /releases/latest redirects to the release's own page, which answers with JSON
// only when asked for it. /down is broken and /untagged has a tag that isn't a version.
let requests = 0;
const github = http.createServer((req, res) => {
  requests++;
  if (req.url === '/releases/latest') {
    res.writeHead(302, { Location: '/releases/tag/v0.1.2' }).end();
  } else if (req.url === '/releases/tag/v0.1.2' && req.headers.accept === 'application/json') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 1, tag_name: 'v0.1.2' }));
  } else if (req.url === '/untagged') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 1, tag_name: 'nightly' }));
  } else if (req.url === '/down') {
    res.writeHead(503).end();
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>a release page</html>');
  }
});
await new Promise(resolve => github.listen(0, resolve));
const GITHUB = `http://localhost:${github.address().port}`;

const servers = [];
const latest = async (server) => (await fetch(`${server.url}/api/desktop/latest`)).json();
try {
  const server = await startServer({ port: 3096, env: { DESKTOP_RELEASE_URL: `${GITHUB}/releases/latest` } });
  servers.push(server);
  const first = await latest(server);
  check('the newest version comes from the Releases page, following its redirect', first.version === '0.1.2', JSON.stringify(first));
  const asked = requests;
  const again = await latest(server);
  check('…and is remembered, not asked for on every page', again.version === '0.1.2' && requests === asked, `${requests - asked} more requests`);
  const together = await Promise.all([1, 2, 3].map(() => latest(server)));
  check('…including when several pages ask at once', together.every(r => r.version === '0.1.2') && requests === asked);

  const down = await startServer({ port: 3097, env: { DESKTOP_RELEASE_URL: `${GITHUB}/down` } });
  servers.push(down);
  const unknown = await latest(down);
  check('when GitHub can\'t be reached there\'s no version (and no banner)', unknown.version === null, JSON.stringify(unknown));
  check('…and the server notes why', /Couldn't find the latest release: the Releases page answered 503/.test(down.logs()), down.logs().slice(-300));

  const untagged = await startServer({ port: 3098, env: { DESKTOP_RELEASE_URL: `${GITHUB}/untagged` } });
  servers.push(untagged);
  check('a latest release whose tag isn\'t a version is ignored', (await latest(untagged)).version === null);
} catch (err) {
  check(`unexpected error: ${err.stack}`, false);
} finally {
  for (const server of servers) await server.stop();
  github.close();
  printSummary();
  if (failedCount()) for (const server of servers) console.log(`\n--- server log ---\n${server.logs().slice(-2000)}`);
  process.exit(failedCount() ? 1 : 0);
}
