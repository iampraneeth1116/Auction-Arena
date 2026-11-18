import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import { desktopAppVersion, isNewerVersion } from '../lib/desktopApp';

const RELEASES_PAGE = 'https://github.com/iampraneeth1116/Auction-Arena/releases/latest';
const DISMISSED_KEY = 'aa_update_dismissed';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000; // as often as the app checks for itself

const runningVersion = () => (window.auctionArenaDesktop ? desktopAppVersion(navigator.userAgent) : null);

const dismissedVersion = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};

// Inside an older copy of the desktop app: says a newer version is out, with a link to it. The
// app checks for itself too, but on macOS it can only say so in a notification, which macOS
// doesn't always show for an app without Apple's paid developer signature. Every page comes from
// the live site, so copies of the app from before this banner existed get it as well. It stays
// out of the auction room, and Later hides it until the app is next opened.
const DesktopUpdateBanner = () => {
  const { pathname } = useLocation();
  const [current] = useState(runningVersion);
  const [latest, setLatest] = useState(null);
  const [dismissed, setDismissed] = useState(dismissedVersion);

  useEffect(() => {
    if (!current) return undefined;
    let cancelled = false;
    const check = () => api('/api/desktop/latest')
      .then(({ version }) => { if (!cancelled && version) setLatest(version); })
      .catch(() => {}); // no answer, no banner
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [current]);

  if (!current || !latest || !isNewerVersion(latest, current) || dismissed === latest) return null;
  if (pathname.startsWith('/auction/')) return null;

  const later = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, latest);
    } catch {
      // storage blocked: hidden until the page reloads
    }
    setDismissed(latest);
  };
  // Windows downloads it in the background and installs it on quitting
  const installsItself = window.auctionArenaDesktop.platform === 'win32';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-signal/40 bg-ink-900/95 py-2 pl-3 pr-2 text-sm shadow-xl backdrop-blur"
      >
        <Download size={16} className="shrink-0 text-signal" aria-hidden />
        <span className="min-w-0 text-snow">
          Auction Arena {latest} is out{installsItself ? ' and installs itself when you quit the app' : ''}. You have {current}.
        </span>
        <a
          href={RELEASES_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded px-2 py-1 font-display text-xs font-semibold uppercase tracking-wider text-signal hover:bg-signal/10"
        >
          Download
        </a>
        <button
          onClick={later}
          className="shrink-0 cursor-pointer rounded px-2 py-1 font-display text-xs font-semibold uppercase tracking-wider text-mist hover:bg-white/5 hover:text-snow"
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default DesktopUpdateBanner;
