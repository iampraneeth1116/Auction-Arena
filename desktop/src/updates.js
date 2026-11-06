// New versions come from the Releases page of the public Auction-Arena repo. Windows and the
// Linux AppImage update themselves: the new version downloads in the background and installs
// the next time you quit, so a live auction is never interrupted. macOS (an app can only
// replace itself there when Apple has signed it, and the free build isn't) and the Linux .deb
// (installed system-wide) get a notification with a link to download it instead.
import { app, dialog, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { notify } from './background.js';

const { autoUpdater } = electronUpdater;
const RELEASES_PAGE = 'https://github.com/iampraneeth1116/Auction-Arena/releases/latest';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const updatesItself = () => process.platform === 'win32' || (process.platform === 'linux' && Boolean(process.env.APPIMAGE));

export function startUpdateChecks() {
  // A development copy has nothing to update
  if (!app.isPackaged) return;
  autoUpdater.logger = null; // its own log prints a full error trace even for "no new version"
  autoUpdater.autoDownload = updatesItself();
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    if (updatesItself()) return; // it downloads now and says so once it's ready
    notify(`Auction Arena ${info.version} is out`, 'Click to download the new version.', () => shell.openExternal(RELEASES_PAGE));
  });
  autoUpdater.on('update-downloaded', (info) => {
    notify(`Auction Arena ${info.version} is ready`, 'It installs the next time you quit the app.', () => {});
  });
  autoUpdater.on('error', (err) => console.warn('[updates]', err.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, CHECK_EVERY_MS);
}

// Help > Check for Updates: says what it found (a new version is announced as above)
export async function checkForUpdatesNow() {
  if (!app.isPackaged) {
    dialog.showMessageBox({ message: 'Updates are for the installed app', detail: 'This copy runs from the source code.' });
    return;
  }
  const result = await autoUpdater.checkForUpdates().catch(err => ({ error: err }));
  // Before the first release GitHub has nothing to offer, which isn't a connection problem
  if (result?.error && /No published versions/.test(result.error.message)) {
    dialog.showMessageBox({ message: "You're up to date", detail: `Auction Arena ${app.getVersion()} is the newest version.` });
  } else if (!result || result.error) {
    dialog.showMessageBox({ type: 'warning', message: "Couldn't check for updates", detail: 'Check your internet connection and try again.' });
  } else if (!result.isUpdateAvailable) {
    dialog.showMessageBox({ message: "You're up to date", detail: `Auction Arena ${app.getVersion()} is the newest version.` });
  }
}
