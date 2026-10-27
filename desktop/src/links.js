// Invite links that open in the app: auctionarena://lobby/AB12CD, and the same for auction/
// and summary/, with ?watch=1 to watch. A bare auctionarena:// opens the home page. Nothing
// else is accepted, so a link from any website can only land on one of these pages.
export const PROTOCOL = 'auctionarena';

const ROOM_PAGE = /^\/(lobby|auction|summary)\/([a-z0-9]{4,12})\/?$/i;

// The site path a link opens (e.g. "/lobby/AB12CD?watch=1"), or null to ignore it
export function routeFromLink(link) {
  if (typeof link !== 'string') return null;
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== `${PROTOCOL}:`) return null;
  // auctionarena://lobby/AB12CD parses as host "lobby" + path "/AB12CD"
  const path = `/${url.host}${url.pathname}`.replace(/^\/+/, '/');
  if (path === '/') return '/';
  const match = path.match(ROOM_PAGE);
  if (!match) return null;
  const watch = url.searchParams.get('watch') === '1' ? '?watch=1' : '';
  return `/${match[1].toLowerCase()}/${match[2].toUpperCase()}${watch}`;
}

// Windows and Linux hand the link over as a command-line argument
export const linkInArgs = (argv) => argv.find(arg => arg.startsWith(`${PROTOCOL}:`));
