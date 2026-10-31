// What the app does when you're not looking at it: native notifications, and the tray icon
// shown while a closed window stays in a live auction.
import path from 'node:path';
import { Menu, Notification, Tray, app, nativeImage } from 'electron';

const ASSETS = path.join(import.meta.dirname, '../assets');

// Kept so the click still works, and replaced by the next one so they never pile up
let latestNotification = null;

export function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  latestNotification?.close();
  latestNotification = new Notification({ title, body, icon: path.join(ASSETS, 'icon.png') });
  latestNotification.on('click', onClick);
  // macOS can refuse (notifications turned off, or an unsigned copy): bounce the Dock icon instead
  latestNotification.on('failed', () => app.dock?.bounce());
  latestNotification.show();
}

let tray = null;

export function showTray({ onOpen, onQuit }) {
  if (tray) return;
  // macOS tints a "Template" image to suit the menu bar; Windows shows the full-colour icon
  const image = process.platform === 'darwin'
    ? nativeImage.createFromPath(path.join(ASSETS, 'trayTemplate.png'))
    : nativeImage.createFromPath(path.join(ASSETS, 'icon.png')).resize({ width: 32, height: 32 });
  tray = new Tray(image);
  tray.setToolTip('Auction Arena: still in the auction');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Auction Arena', click: onOpen },
    { type: 'separator' },
    { label: 'Leave and Quit', click: onQuit },
  ]));
  tray.on('click', onOpen);
}

export function removeTray() {
  tray?.destroy();
  tray = null;
}
