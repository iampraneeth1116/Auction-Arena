// The site runs sandboxed, with no Node.js. All it gets from the desktop app is knowing it's
// running inside it, on which system, a way to ask for a notification, and Google sign-in
// through the person's own browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auctionArenaDesktop', {
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('desktop:notify', title, body),
  // Opens the browser to sign in with Google. Resolves with { code, verifier } for the site to
  // finish with the server, or { error }.
  signInWithGoogle: () => ipcRenderer.invoke('desktop:google-sign-in'),
});
