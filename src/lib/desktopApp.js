// The desktop app names itself and its version in the browser identification every page sees:
// "Mozilla/5.0 (…) AuctionArena/0.1.1 Chrome/… Electron/… Safari/537.36"
const APP_VERSION = /\bAuctionArena\/(\d+\.\d+\.\d+)\b/;

// The version of the desktop app this page runs in, or null outside it
export const desktopAppVersion = (userAgent) => APP_VERSION.exec(userAgent ?? '')?.[1] ?? null;

// Compares numbers part by part, so 0.1.10 is newer than 0.1.9
export const isNewerVersion = (candidate, current) => {
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  const first = a.findIndex((part, i) => part !== b[i]);
  return first !== -1 && a[first] > b[first];
};
