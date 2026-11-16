// Smoke test for the desktop app on Windows and Linux, run by .github/workflows/desktop-smoke-test.yml
// (it also runs on a Mac, for trying the script out). Drives the app over the DevTools protocol.
//
//   installed <app>                      the released app as people install it, on the live site
//                                        (read-only): the site opens, sound and the voice work with
//                                        no click, a notification, invite links through the system,
//                                        and Continue with Google opening the browser
//   appimage <file.AppImage>             the Linux AppImage starts and opens the live site
//   auction <electron> <appDir> <site>   the same app code from source against a test server, so a
//                                        real auction creates nothing on the live database: a quick
//                                        auction with a bot, its voice and sound, notifications,
//                                        the screen kept awake, closing the window mid-auction and
//                                        coming back
//
// Prints PASS / FAIL / INFO lines and exits 1 on any FAIL. Screenshots and logs go to SMOKE_OUT.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [mode, ...args] = process.argv.slice(2);
const OUT = path.resolve(process.env.SMOKE_OUT ?? 'smoke-out');
fs.mkdirSync(OUT, { recursive: true });
const LIVE = 'https://auction-arena-g1ot.onrender.com';
const ON_CI = Boolean(process.env.CI);
const PLATFORM = process.platform;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${mode}] ${name}${!ok && detail ? `  —  ${detail}` : ''}`);
};
const info = (name, value) => console.log(`INFO  [${mode}] ${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

// Electron must not run as plain Node (VS Code's terminal sets this)
const ENV = { ...process.env };
delete ENV.ELECTRON_RUN_AS_NODE;
// On a Mac the test copy gets its own profile, so it never shares one with an installed app
const PROFILE_ARGS = ON_CI ? [] : [`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'aa-smoke-'))}`];

function launch(bin, appArgs, label) {
  const child = spawn(bin, appArgs, { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const logFile = path.join(OUT, `${label}.log`);
  child.stdout.on('data', d => fs.appendFileSync(logFile, d));
  child.stderr.on('data', d => fs.appendFileSync(logFile, d));
  return child;
}

async function connect(port, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120_000 });
    } catch (err) {
      if (Date.now() > until) throw new Error(`no DevTools on port ${port}: ${err.message}`);
      await sleep(1000);
    }
  }
}

async function findPage(browser, origin, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    for (const page of await browser.pages()) if (page.url().startsWith(origin)) return page;
    await sleep(1000);
  }
  // Never got there: say what the window shows instead (the loading screen's status, an error)
  for (const page of await browser.pages()) {
    const text = await page.evaluate(() => document.body?.innerText.replace(/\s+/g, ' ').slice(0, 200)).catch(err => `unreadable: ${err.message}`);
    info('window shows', { url: page.url(), text });
  }
  screenshot(`no-site-${mode}`);
  return null;
}

// The whole screen, to see what a person would (a notification, the tray)
function screenshot(name) {
  const file = path.join(OUT, `${name}.png`);
  try {
    if (PLATFORM === 'win32') {
      execFileSync('powershell', ['-NoProfile', '-Command', `
        Add-Type -AssemblyName System.Windows.Forms,System.Drawing
        $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
        [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
        $bmp.Save('${file}')`]);
    } else if (PLATFORM === 'linux') {
      execFileSync('import', ['-window', 'root', file]);
    } else {
      return; // not on someone's own Mac screen
    }
    info('screenshot', path.basename(file));
  } catch (err) {
    info(`screenshot ${name} failed`, err.message.split('\n')[0]);
  }
}

// Minimises or restores the app's window the way a person would, through the system
function windowState(pid, minimise) {
  try {
    if (PLATFORM === 'win32') {
      execFileSync('powershell', ['-NoProfile', '-Command', `
        Add-Type -Namespace Smoke -Name Win -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);'
        Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.Id -eq ${pid} -or $_.Path -like '*Auction Arena*') } | ForEach-Object {
          [Smoke.Win]::ShowWindow($_.MainWindowHandle, ${minimise ? 6 : 9}) | Out-Null
          ${minimise ? '' : '[Smoke.Win]::SetForegroundWindow($_.MainWindowHandle) | Out-Null'}
        }`]);
    } else if (PLATFORM === 'linux') {
      const ids = execFileSync('xdotool', ['search', '--pid', String(pid)]).toString().trim().split('\n');
      for (const id of ids) execFileSync('xdotool', [minimise ? 'windowminimize' : 'windowactivate', id], { stdio: 'ignore' });
    }
  } catch (err) {
    info(`${minimise ? 'minimise' : 'restore'} through the system failed`, err.message.split('\n')[0]);
  }
}

// Opens a link the way clicking it in another app does: the system hands it to the app. On Linux
// the tool is what desktops use: gio (GNOME and most others), or bare xdg-open on a desktop xdg-utils
// doesn't recognise.
function openThroughSystem(link, tool = 'gio') {
  try {
    if (PLATFORM === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Start-Process '${link}'`]);
    else if (PLATFORM === 'linux') {
      const command = tool === 'gio' ? ['gio', ['open', link]] : ['xdg-open', [link]];
      execFileSync(command[0], command[1], { env: ENV, timeout: 15_000, stdio: 'pipe' });
    }
  } catch (err) {
    const output = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    fs.appendFileSync(path.join(OUT, `open-${tool}.log`), `${link}\n${err.message}\n${output}\n\n`);
    info(`${tool} could not open ${link}`, `${err.message.split('\n')[0]} ${output.split('\n')[0]}`.trim());
  }
}

const dbusLog = () => (process.env.DBUS_LOG && fs.existsSync(process.env.DBUS_LOG) ? fs.readFileSync(process.env.DBUS_LOG, 'utf8') : '');

const pathOf = (page) => page.evaluate(() => location.pathname + location.search);
const waitForPath = (page, pattern, timeout) =>
  page.waitForFunction((source) => new RegExp(source).test(location.pathname + location.search), { timeout, polling: 250 }, pattern.source)
    .then(() => true, () => false);

// Moves around the site without a reload, like the app's own menu does
const goTo = (page, route) => page.evaluate((to) => {
  history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
}, route);

const clickButton = (page, text, { exact = false, within = 'button' } = {}) => page.evaluate((wanted, isExact, selector) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const button = [...document.querySelectorAll(selector)].find((el) => {
    const label = norm(el.getAttribute('aria-label') || el.textContent);
    return isExact ? label === norm(wanted) : label.includes(norm(wanted));
  });
  if (!button || button.disabled) return false;
  button.click();
  return true;
}, text, exact, within);

const waitForButton = (page, text, timeout = 30_000) => page.waitForFunction((wanted) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return [...document.querySelectorAll('button')].some(b => !b.disabled && norm(b.getAttribute('aria-label') || b.textContent).includes(norm(wanted)));
}, { timeout, polling: 250 }, text).then(() => true, () => false);

// Sound needs no click in the app: an AudioContext made with no user gesture runs
async function soundWithoutClick(page) {
  const cdp = await page.createCDPSession();
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: '(async () => { const c = new AudioContext(); await new Promise(r => setTimeout(r, 800)); const s = c.state; c.close(); return s; })()',
    awaitPromise: true, userGesture: false, returnByValue: true,
  });
  await cdp.detach();
  return result.value;
}

// The voice: which voices the system offers, and whether one sentence is spoken to the end
const speakOnce = (page) => page.evaluate(() => new Promise((resolve) => {
  let started = false;
  let asked = false;
  const finish = (outcome) => resolve({ voices: speechSynthesis.getVoices().map(v => `${v.name} (${v.lang})`), started, ...outcome });
  const speak = () => {
    if (asked) return;
    asked = true;
    const utterance = new SpeechSynthesisUtterance('Sold, to Mumbai Indians, for two crore.');
    utterance.onstart = () => { started = true; };
    utterance.onend = () => finish({ ended: true });
    utterance.onerror = (e) => finish({ error: e.error });
    speechSynthesis.speak(utterance);
    setTimeout(() => finish({ timedOut: true }), 30_000);
  };
  if (speechSynthesis.getVoices().length) speak();
  else {
    speechSynthesis.addEventListener('voiceschanged', speak);
    setTimeout(speak, 10_000);
  }
}));

// ─── The released app, on the live site ───
async function installed(bin, { quick = false } = {}) {
  const app = launch(bin, ['--remote-debugging-port=9222', ...PROFILE_ARGS], quick ? 'appimage-app' : 'installed-app');
  let browser;
  try {
    browser = await connect(9222);
    // The free Render server may be asleep: the app's loading screen waits for it
    const page = await findPage(browser, LIVE, 240_000);
    check('the app opens the live site', page, (await browser.pages()).map(p => p.url()).join(' | '));
    if (!page) return;
    // Past the site's pre-show intro, as someone who has seen it once
    await page.evaluate(() => { sessionStorage.setItem('aa_intro_seen', 'true'); location.reload(); });
    await page.waitForFunction(() => document.body.innerText.length > 200 && !document.body.innerText.includes('PRE-SHOW'), { timeout: 90_000 }).catch(() => {});
    const site = await page.evaluate(() => ({
      title: document.title,
      platform: window.auctionArenaDesktop?.platform,
      google: typeof window.auctionArenaDesktop?.signInWithGoogle,
      notify: typeof window.auctionArenaDesktop?.notify,
      text: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
    }));
    info('page', site);
    check(`the site knows it's in the desktop app on ${PLATFORM}`, site.platform === PLATFORM && site.notify === 'function', JSON.stringify(site));
    check('…with Google sign-in through the browser', site.google === 'function');
    await page.screenshot({ path: path.join(OUT, `${quick ? 'appimage' : 'installed'}-window.png`) });
    if (quick) return;

    const sound = await soundWithoutClick(page);
    check('sound plays with no click first (AudioContext running)', sound === 'running', sound);

    const voice = await speakOnce(page);
    info('voices', voice.voices.length ? voice.voices.slice(0, 6) : 'none');
    check('the voice speaks a sentence to the end', voice.ended, JSON.stringify({ ...voice, voices: voice.voices.length }));

    // A notification while the window is minimised (the app only notifies when you're away)
    windowState(app.pid, true);
    await sleep(1500);
    await page.evaluate(() => window.auctionArenaDesktop.notify('Smoke test', 'A notification from the desktop app'));
    await sleep(2500);
    screenshot('installed-notification');
    if (PLATFORM === 'linux') check('the notification reaches the desktop (D-Bus Notify)', /Smoke test/.test(dbusLog()), 'not in the D-Bus log');
    windowState(app.pid, false);
    await sleep(1000);

    if (!ON_CI) return; // the steps below go through the system and the browser
    // Invite links, opened through the system as a click in WhatsApp or a browser would
    await goTo(page, '/');
    openThroughSystem('auctionarena://lobby/ZZ9Q7X?watch=1');
    check('an invite link opened through the system lands on that room in the app',
      await waitForPath(page, /^\/lobby\/ZZ9Q7X\?watch=1$/, 30_000), await pathOf(page));
    openThroughSystem('auctionarena://settings/../../evil');
    await sleep(4000);
    check('…and a link to anything else is ignored', (await pathOf(page)) === '/lobby/ZZ9Q7X?watch=1', await pathOf(page));
    if (PLATFORM === 'linux') {
      // A bare window manager, with no desktop xdg-utils knows: xdg-open runs the launcher itself
      openThroughSystem('auctionarena://summary/ZZ9Q7X', 'xdg-open');
      info('the same link with bare xdg-open (no desktop environment)', (await waitForPath(page, /^\/summary\/ZZ9Q7X$/, 15_000)) ? 'works' : `doesn't arrive (still ${await pathOf(page)})`);
    }

    // Continue with Google opens the system browser on the site's desktop sign-in
    await goTo(page, '/');
    await page.evaluate(() => sessionStorage.setItem('aa_intro_seen', 'true'));
    if (await waitForButton(page, 'Continue with Google', 30_000)) {
      await clickButton(page, 'Continue with Google');
      const note = await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.includes('Your browser has opened'), { timeout: 10_000 }).then(() => true, () => false);
      check('Continue with Google shows "finish in your browser"', note);
      await sleep(6000);
      const errorToast = await page.evaluate(() => document.body.innerText.match(/Couldn.t open your browser[^\n]*/)?.[0] ?? null);
      info('browser launch', errorToast ?? 'no error from the app');
      screenshot('installed-google-browser');
    } else {
      check('Continue with Google is on the home page', false);
    }
  } finally {
    browser?.disconnect();
    app.kill();
    await sleep(2000);
  }
}

// The main process of a copy run from source, through Node's inspector
async function mainProcess(port) {
  let list;
  for (let i = 0; i < 60 && !list; i++) {
    list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json(), () => null);
    if (!list) await sleep(1000);
  }
  const socket = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, ({ result }) => (result?.exceptionDetails
      ? reject(new Error(result.exceptionDetails.exception?.description ?? 'main process error'))
      : resolve(result?.result?.value)));
    socket.send(JSON.stringify({ id: callId, method: 'Runtime.evaluate', params: { expression, includeCommandLineAPI: true, awaitPromise: true, returnByValue: true } }));
  });
  return { evaluate, close: () => socket.close() };
}

// What the operating system says about keeping the screen on
function screenAwakeRequests() {
  try {
    if (PLATFORM === 'win32') return execFileSync('powercfg', ['/requests']).toString();
    if (PLATFORM === 'darwin') return execFileSync('pmset', ['-g', 'assertions']).toString();
    return dbusLog().split('\n').filter(l => /Inhibit|ScreenSaver|PowerManagement/.test(l)).join('\n');
  } catch (err) {
    return `unavailable: ${err.message.split('\n')[0]}`;
  }
}

// ─── A quick auction, from source against a test server ───
async function auction(electron, appDir, site) {
  const appArgs = [appDir, `--url=${site}`, ...PROFILE_ARGS];
  const app = launch(electron, [...appArgs, '--remote-debugging-port=9223', '--inspect=9229'], 'auction-app');
  let browser;
  let main;
  try {
    main = await mainProcess(9229);
    // Records every notification the app shows (or the system refuses)
    await main.evaluate(`(() => {
      globalThis.smoke = { shown: [], failed: [] };
      const { Notification } = require('electron');
      const show = Notification.prototype.show;
      Notification.prototype.show = function () {
        this.once('show', () => globalThis.smoke.shown.push(this.title));
        this.once('failed', (_event, error) => globalThis.smoke.failed.push(this.title + ': ' + error));
        return show.call(this);
      };
      return true;
    })()`);
    const notes = () => main.evaluate('globalThis.smoke');
    const win = (call) => main.evaluate(`(() => { const w = require('electron').BrowserWindow.getAllWindows()[0]; return w ? ${call} : null; })()`);
    const waitForNote = async (pattern, ms = 8000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const { shown, failed } = await notes();
        if (shown.some(t => pattern.test(t))) return 'shown';
        const refused = failed.find(t => pattern.test(t));
        if (refused) return `refused (${refused})`;
        await sleep(300);
      }
      return 'not shown';
    };

    browser = await connect(9223);
    const page = await findPage(browser, site, 120_000);
    check('the app opens the test server', page);
    if (!page) return;

    // Sign in as a guest and host a quick Sprint 5 room
    await page.evaluate(() => { sessionStorage.setItem('aa_intro_seen', 'true'); location.reload(); });
    await waitForButton(page, 'Play as a guest');
    await clickButton(page, 'Play as a guest');
    await page.waitForSelector('input', { timeout: 10_000 });
    await page.type('input', 'Smoke Host');
    await clickButton(page, 'Start playing');
    await waitForButton(page, 'Create room');
    await clickButton(page, '5-Player Sprint', { within: 'button[aria-pressed]' });
    await page.evaluate(() => {
      const label = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Quick pool'));
      const toggle = label?.querySelector('[role=switch]');
      if (toggle?.getAttribute('aria-checked') === 'false') toggle.click();
    });
    await clickButton(page, '5s', { exact: true, within: '[role=radio]' });
    await clickButton(page, 'Create room');
    const inLobby = await waitForPath(page, /^\/lobby\/\w+$/, 20_000);
    check('a guest hosts a quick Sprint 5 room', inLobby, await pathOf(page));
    if (!inLobby) return;
    const code = (await pathOf(page)).split('/')[2];
    await waitForButton(page, 'Add a bot');
    await clickButton(page, 'Add a bot');
    check('a bot takes a franchise and the host can start', await waitForButton(page, 'Start auction', 15_000));

    // Listen to the room: everything the voice says, and every sound
    await page.evaluate(() => {
      window.smoke = { spoken: [], ended: 0, errors: [], plays: 0, contexts: [], beeps: 0 };
      const speak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (utterance) => {
        window.smoke.spoken.push(utterance.text);
        utterance.addEventListener('end', () => { window.smoke.ended += 1; });
        utterance.addEventListener('error', (e) => { window.smoke.errors.push(`voice: ${e.error}`); });
        return speak(utterance);
      };
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        window.smoke.plays += 1;
        return play.call(this).catch((err) => { window.smoke.errors.push(`play: ${err.name}`); throw err; });
      };
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        constructor(...a) { super(...a); window.smoke.contexts.push(this); }
        createOscillator() { window.smoke.beeps += 1; return super.createOscillator(); }
      };
    });

    // Start while the window is minimised: "The auction has started" is for people who are away
    await win('w.minimize()');
    await sleep(800);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start auction'))?.click());
    // With fewer than ten franchises the lobby asks first
    await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent.trim() === 'Start anyway'), { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Start anyway')?.click());
    const inRoom = await waitForPath(page, new RegExp(`^/auction/${code}$`), 20_000);
    check('the auction starts', inRoom, await pathOf(page));
    if (!inRoom) return;
    check('"The auction has started" notification while minimised', (await waitForNote(/auction has started/)) === 'shown', await waitForNote(/auction has started/, 100));
    await win('(w.restore(), w.focus(), true)');

    // The voice calls the lots and the room plays its sounds, with no click anywhere
    await page.waitForFunction(() => window.smoke.spoken.length >= 2 && window.smoke.ended >= 1, { timeout: 90_000, polling: 500 }).catch(() => {});
    const listen = () => page.evaluate(() => ({
      spoken: window.smoke.spoken.slice(0, 4), ended: window.smoke.ended, errors: window.smoke.errors.slice(0, 5),
      plays: window.smoke.plays, beeps: window.smoke.beeps, contexts: window.smoke.contexts.map(c => c.state),
    }));
    const heard = await listen();
    info('heard in the room', heard);
    check('the voice auctioneer calls the lots out loud', heard.spoken.length >= 2 && heard.ended >= 1, JSON.stringify(heard));
    // The room's effects (countdown beeps, anthems, the unsold sting) start on the first click or
    // key press in the room; a lot's last seconds always beep
    await sleep(12_000);
    const untouched = await listen();
    info('sound effects before any click or key in the room', { beeps: untouched.beeps, plays: untouched.plays, contexts: untouched.contexts });
    await page.keyboard.press('Shift');
    await page.waitForFunction(() => window.smoke.beeps > 0 || window.smoke.plays > 0, { timeout: 45_000, polling: 300 }).catch(() => {});
    const effects = await listen();
    check('after a key press the room\'s sound effects play (beeps / anthem)', (effects.beeps > 0 || effects.plays > 0) && effects.contexts.includes('running'), JSON.stringify(effects));

    // The screen stays awake while the room is on screen
    const awake = screenAwakeRequests();
    fs.writeFileSync(path.join(OUT, 'screen-awake.txt'), awake);
    // powercfg lists requests under DISPLAY:, SYSTEM:, AWAYMODE: …; only DISPLAY keeps the screen on
    const displaySection = awake.split(/\r?\n(?=[A-Z]+:)/).find(section => section.startsWith('DISPLAY:')) ?? '';
    const holding = PLATFORM === 'win32' ? /electron/i.test(displaySection)
      : PLATFORM === 'darwin' ? /NoDisplaySleepAssertion/.test(awake)
        : /Inhibit/.test(awake);
    if (PLATFORM === 'linux') info('screen kept awake (D-Bus inhibit seen)', holding);
    else check('the system is asked to keep the screen on during the auction', holding, awake.slice(0, 400));

    // Outbid while away: bid on a lot, minimise, and wait for the bot to go higher
    for (let attempt = 0; attempt < 6; attempt++) {
      const bid = await page.waitForFunction(() => {
        const button = document.querySelector('button[aria-keyshortcuts="b"]');
        return button && !button.disabled ? true : null;
      }, { timeout: 30_000, polling: 300 }).then(() => true, () => false);
      if (!bid) break;
      await page.evaluate(() => document.querySelector('button[aria-keyshortcuts="b"]')?.click());
      await win('w.minimize()');
      if ((await waitForNote(/^Outbid/, 12_000)) === 'shown') break;
      await win('(w.restore(), true)');
    }
    const outbid = await waitForNote(/^Outbid/, 100);
    if (outbid === 'not shown') info('outbid notification', 'the bot never went higher, so nothing to show');
    else check('"Outbid on …" notification while minimised', outbid === 'shown', outbid);
    await win('(w.restore(), w.focus(), true)');
    await sleep(1000);
    screenshot('auction-room');
    await page.screenshot({ path: path.join(OUT, 'auction-window.png') });

    // Closing the window mid-auction keeps you in the room
    await win('w.close()');
    await sleep(2500);
    const afterClose = await win('({ exists: !w.isDestroyed(), visible: w.isVisible(), minimised: w.isMinimized() })');
    info('window after close', afterClose);
    const stayed = PLATFORM === 'linux' ? afterClose?.minimised : afterClose && !afterClose.visible;
    check(`closing the window mid-auction keeps the room (${PLATFORM === 'linux' ? 'minimised' : 'hidden, tray icon'})`, stayed, JSON.stringify(afterClose));
    check('…and says so in a notification', (await waitForNote(/Still in the auction/)) === 'shown', await waitForNote(/Still in the auction/, 100));
    screenshot('auction-closed-tray');
    const stillLive = await page.evaluate(() => location.pathname).catch(() => null);
    check('…while the room keeps running behind it', stillLive === `/auction/${code}`, String(stillLive));

    // Opening the app again (Start menu, Dock, launcher) brings the room back
    const again = launch(electron, appArgs, 'auction-second-launch');
    await new Promise(resolve => again.once('exit', resolve));
    await sleep(2000);
    const back = await win('({ visible: w.isVisible(), minimised: w.isMinimized() })');
    check('opening the app again brings the room back', back?.visible && !back.minimised, JSON.stringify(back));

    // The host ends it while away: "The auction has ended"
    await win('w.minimize()');
    await page.evaluate(() => document.querySelector('button[aria-label="End auction"]')?.click());
    await sleep(800);
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'End auction')?.click());
    const ended = await waitForPath(page, new RegExp(`^/summary/${code}$`), 20_000);
    check('the host ends the auction and the results open', ended, await pathOf(page));
    if (ended) check('"The auction has ended" notification while minimised', (await waitForNote(/auction has ended/)) === 'shown', await waitForNote(/auction has ended/, 100));
    await win('(w.restore(), true)');
    info('all notifications', await notes());
  } finally {
    browser?.disconnect();
    if (main) {
      await main.evaluate('(require("electron").app.exit(0), true)').catch(() => {});
      main.close();
    }
    app.kill();
    await sleep(1500);
  }
}

try {
  if (mode === 'installed') await installed(args[0]);
  else if (mode === 'appimage') await installed(args[0], { quick: true });
  else if (mode === 'auction') await auction(args[0], args[1], args[2]);
  else throw new Error(`unknown mode ${mode}`);
} catch (err) {
  check(`unexpected error: ${err.stack}`, false);
}
console.log(`\n[${mode}] ${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.includes(false) ? 1 : 0);
