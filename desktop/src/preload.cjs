// The site runs sandboxed, with no Node.js. All it learns from the desktop app is that
// it's running inside it, and on which system.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('auctionArenaDesktop', {
  platform: process.platform,
});
