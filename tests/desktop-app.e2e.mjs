// End-to-end: what the site does inside the desktop app. The native notifications it asks the
// app for (outbid, room chat) and how chat ones are spaced out; and the banner in an older copy
// of the app: reading the app's version from its browser identification, comparing versions,
// and the server's lookup of the newest release, against a stand-in for GitHub's Releases page.
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { createChecker, startServer } from './helpers.mjs';
import { desktopAppVersion, isNewerVersion } from '../src/lib/desktopApp.js';
import { chatTiming, clearChatNotifications, notifyChat, notifyDesktop } from '../src/lib/desktopNotify.js';

const { check, failedCount, printSummary } = createChecker();

// ─── Native notifications ───
// The app's bridge, as the page sees it; shorter waits so the test runs quickly
const shown = [];
globalThis.window = { auctionArenaDesktop: { notify: (title, body) => shown.push({ title, body, at: Date.now() }) } };
chatTiming.gapMs = 300;
chatTiming.holdMs = 600;
const TIMER_SLACK_MS = 5;

notifyChat({ userName: 'Rahul', text: 'nice buy!', type: 'text' });
await sleep(50);
check('a chat message is notified straight away, saying who sent it', shown.length === 1 && shown[0].title === 'Rahul in the room chat' && shown[0].body === 'nice buy!', JSON.stringify(shown));
notifyChat({ userName: 'Priya', text: 'what a steal', type: 'text' });
notifyChat({ userName: 'Priya', text: 'https://media.giphy.com/media/abc/giphy.gif', type: 'gif' });
await sleep(100);
check('messages soon after wait their turn', shown.length === 1);
await sleep(300);
check('…then come as one notification, with the latest', shown.length === 2 && shown[1].title === '2 new messages in the room chat' && shown[1].body === 'Priya: sent a GIF', JSON.stringify(shown[1]));
check('…no sooner than the gap between chat notifications', shown[1].at - shown[0].at >= chatTiming.gapMs - TIMER_SLACK_MS, `${shown[1].at - shown[0].at} ms`);

await sleep(400);
notifyDesktop('Outbid on Virat Kohli', 'MI went to ₹15.00 Cr');
const outbid = shown[shown.length - 1];
notifyChat({ userName: 'Rahul', text: 'haha', type: 'text' });
await sleep(100);
check('being outbid is notified straight away', outbid.title === 'Outbid on Virat Kohli' && shown[shown.length - 1] === outbid);
await sleep(600);
const afterOutbid = shown[shown.length - 1];
check('chat just after an outbid waits, so it doesn\'t replace that notification', afterOutbid.title === 'Rahul in the room chat' && afterOutbid.at - outbid.at >= chatTiming.holdMs - TIMER_SLACK_MS, `${afterOutbid.at - outbid.at} ms`);

const before = shown.length;
notifyChat({ userName: 'Priya', text: 'bye', type: 'text' });
clearChatNotifications();
await sleep(chatTiming.holdMs + 100);
check('leaving the room drops chat still waiting', shown.length === before);
delete globalThis.window.auctionArenaDesktop;
notifyChat({ userName: 'Priya', text: 'in a browser', type: 'text' });
notifyDesktop('Outbid', 'in a browser');
await sleep(chatTiming.gapMs + 100);
check('outside the desktop app nothing is sent', shown.length === before);

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
