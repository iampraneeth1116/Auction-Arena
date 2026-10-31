// The site runs sandboxed, with no Node.js. All it gets from the desktop app is knowing it's
// running inside it, on which system, and a way to ask for a notification.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auctionArenaDesktop', {
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('desktop:notify', title, body),
});
