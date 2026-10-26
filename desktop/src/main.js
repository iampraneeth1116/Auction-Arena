// The Auction Arena desktop app: the live site in its own window. The pages, the API and
// the live rooms all stay on the server, so every deploy reaches the app at once.
import path from 'node:path';
import { app, BrowserWindow, net, session, shell } from 'electron';
import { buildMenu } from './menu.js';

const PRODUCTION_URL = 'https://auction-arena-g1ot.onrender.com';
const ICON_PATH = path.join(import.meta.dirname, '../assets/icon.png');
const LOADING_PAGE = path.join(import.meta.dirname, 'loading.html');

// `--url=http://localhost:5173` (or AUCTION_ARENA_URL) points the app at a local server,
// to try a change before it's deployed. Anything else must be https.
function startUrl() {
  const asked = process.argv.find(arg => arg.startsWith('--url='))?.slice('--url='.length)
    || process.env.AUCTION_ARENA_URL;
  if (!asked) return new URL(PRODUCTION_URL);
  try {
    const url = new URL(asked);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol === 'https:' || (local && url.protocol === 'http:')) return url;
  } catch {
    // not a URL: fall through
  }
  console.warn(`[desktop] Ignoring ${asked}: only https or a localhost address. Opening ${PRODUCTION_URL}.`);
  return new URL(PRODUCTION_URL);
}

const START_URL = startUrl();

const isAppPage = (url) => {
  try {
    return new URL(url).origin === START_URL.origin;
  } catch {
    return false;
  }
};

// Links to other sites (a WhatsApp share, a photo's source, the contact email) open in
// the person's own browser or mail app, never inside the app
function openOutside(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

// What the site may ask for: notifications, copying a room code, full screen. Nothing else,
// and only from the site itself.
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);

function lockDownSession() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppPage(webContents.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
    ALLOWED_PERMISSIONS.has(permission) && requestingOrigin === START_URL.origin);
}

const HEALTH_URL = new URL('/api/health', START_URL).href;
const SLOW_AFTER_MS = 90_000;

// Is the server up? Its health check answers {"ok":true} once the server and its database
// are ready. While Render's free plan wakes a sleeping server, Render's own waiting page
// answers instead.
async function checkServer() {
  if (!net.isOnline()) return 'offline';
  try {
    const res = await net.fetch(HEALTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    const body = await res.json().catch(() => null);
    return body?.ok === true ? 'ready' : 'waking';
  } catch {
    return net.isOnline() ? 'waking' : 'offline';
  }
}

// Window id → the site page to open once the server answers
const waiting = new Map();

// Shows the loading screen until the server answers, then opens `url`, a page of the site.
// The app's own screen replaces Render's "waking up" page and says when you're offline.
async function openWhenServerReady(win, url) {
  const id = win.id;
  const alreadyWaiting = waiting.has(id);
  waiting.set(id, url);
  if (alreadyWaiting) return; // the wait already running opens the newest address

  await win.loadFile(LOADING_PAGE).catch(() => {});
  const started = Date.now();
  for (;;) {
    if (win.isDestroyed()) {
      waiting.delete(id);
      return;
    }
    const state = await checkServer();
    if (state === 'ready') break;
    const shown = state === 'waking' && Date.now() - started > SLOW_AFTER_MS ? 'slow' : state;
    win.webContents.executeJavaScript(`window.showStatus?.(${JSON.stringify(shown)})`).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, state === 'offline' ? 3000 : 2000));
  }

  // Hand over before loading: if this load fails too, did-fail-load starts a fresh wait
  const target = waiting.get(id);
  waiting.delete(id);
  if (win.isDestroyed()) return;
  const opened = await win.loadURL(target).then(() => true, () => false);
  // Back from the first page must not return to the loading screen
  if (opened && !win.isDestroyed()) win.webContents.navigationHistory.clear();
}

let mainWindow = null;

// Moves to a page of the site without reloading it, so a live room stays connected
function goTo(route) {
  if (!mainWindow) return;
  if (waiting.has(mainWindow.id)) {
    waiting.set(mainWindow.id, new URL(route, START_URL).href);
    return;
  }
  const { webContents } = mainWindow;
  if (!isAppPage(webContents.getURL())) return;
  webContents.executeJavaScript(
    `history.pushState(null, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'));`,
  ).catch(() => {});
}

// Back and forward through the site's pages, never back onto the loading screen
function goInHistory(step) {
  const history = mainWindow?.webContents.navigationHistory;
  const entry = history?.getEntryAtIndex(history.getActiveIndex() + step);
  if (entry && isAppPage(entry.url)) history.goToOffset(step);
}

function openInBrowser() {
  const current = mainWindow?.webContents.getURL();
  shell.openExternal(current && isAppPage(current) ? current : START_URL.href);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Auction Arena',
    icon: ICON_PATH,
    backgroundColor: '#05070f',
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // A live auction keeps running at full speed behind other windows: Chromium would
      // otherwise slow the page's timers there (down to once a minute after a while),
      // and the countdown and the voice auctioneer would fall behind the room
      backgroundThrottling: false,
    },
  });
  const { webContents } = mainWindow;

  // A link meant for a new tab: the site's own pages stay in this window, others go outside
  webContents.setWindowOpenHandler(({ url }) => {
    if (isAppPage(url)) webContents.loadURL(url);
    else openOutside(url);
    return { action: 'deny' };
  });
  const keepInside = (event, url) => {
    if (isAppPage(url)) return;
    event.preventDefault();
    openOutside(url);
  };
  webContents.on('will-navigate', keepInside);
  webContents.on('will-redirect', keepInside);

  // A page of the site didn't load (offline, or the server fell asleep): wait, then retry it
  webContents.on('did-fail-load', (_event, errorCode, _description, url, isMainFrame) => {
    const aborted = errorCode === -3; // a navigation replaced by another one
    if (isMainFrame && !aborted && isAppPage(url)) openWhenServerReady(mainWindow, url);
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  openWhenServerReady(mainWindow, START_URL.href);
}

// One copy of the app at a time: opening it again brings the open window forward
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // No page may embed other web content in a <webview>
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', event => event.preventDefault());
  });

  app.whenReady().then(() => {
    lockDownSession();
    app.setAboutPanelOptions({
      applicationName: 'Auction Arena',
      applicationVersion: app.getVersion(),
      credits: 'Live IPL auctions with friends',
      website: PRODUCTION_URL,
      iconPath: ICON_PATH,
    });
    // An installed app has its icon built in; while developing, the Dock shows Electron's
    if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(ICON_PATH);
    buildMenu({ goTo, goBack: () => goInHistory(-1), goForward: () => goInHistory(1), openInBrowser });
    createWindow();
    // macOS keeps the app running with no windows; clicking the Dock icon opens one again
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
