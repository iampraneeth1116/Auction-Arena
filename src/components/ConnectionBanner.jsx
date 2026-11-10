import React from 'react';
import { Loader2, LogIn, RotateCw, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

// Tells a player when their own connection has dropped, so a frozen screen never looks like a
// stuck auction. The app reconnects by itself and the room catches up when it does.
const ConnectionBanner = () => {
  const status = useConnectionStatus();
  if (status !== 'reconnecting' && status !== 'signed-out') return null;
  const signedOut = status === 'signed-out';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-flare/40 bg-ink-900/95 py-2 pl-3 pr-2 text-sm shadow-xl backdrop-blur"
      >
        {signedOut
          ? <WifiOff size={16} className="shrink-0 text-flare" aria-hidden />
          : <Loader2 size={16} className="shrink-0 animate-spin text-flare" aria-hidden />}
        <span className="min-w-0 text-snow">
          {signedOut
            ? 'You were signed out. Sign in again to keep bidding.'
            : 'Connection lost. Reconnecting…'}
        </span>
        <button
          onClick={() => window.location.reload()}
          className="flex shrink-0 items-center gap-1 rounded px-2 py-1 font-display text-xs font-semibold uppercase tracking-wider text-mist hover:bg-white/5 hover:text-snow cursor-pointer"
        >
          {signedOut ? <LogIn size={13} aria-hidden /> : <RotateCw size={13} aria-hidden />}
          {signedOut ? 'Sign in' : 'Reload'}
        </button>
      </div>
    </div>
  );
};

export default ConnectionBanner;
