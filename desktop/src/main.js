// The Auction Arena desktop app: the live site in its own window. The pages, the API and
// the live rooms all stay on the server, so every deploy reaches the app at once.
import path from 'node:path';
import { app, BrowserWindow, session, shell } from 'electron';

const PRODUCTION_URL = 'https://auction-arena-g1ot.onrender.com';

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

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Auction Arena',
    backgroundColor: '#05070c',
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

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(START_URL.href);
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
