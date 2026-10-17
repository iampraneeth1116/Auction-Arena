import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from './Logo';
import Tag from './Tag';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/cn';

export const UserChip = ({ compact = false }) => {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initial = (user.displayName || '?').trim()[0]?.toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 rounded-md border border-white/8 bg-ink-850/80 py-1 pl-1 pr-2.5">
        <span className="flex size-6 items-center justify-center rounded-sm bg-signal/20 font-display text-sm font-bold text-signal">{initial}</span>
        {!compact && <span className="max-w-32 truncate text-sm font-semibold">{user.displayName}</span>}
        {user.isGuest && !compact && <Tag>Guest</Tag>}
      </span>
      <button onClick={logout} className="rounded-md p-2 text-haze hover:bg-white/5 hover:text-snow cursor-pointer" title="Sign out" aria-label="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
};

// Page frame: top bar with the wordmark and optional centre/right content, then the page
const PageShell = ({ children, right, center, className, wide = false, showUser = true }) => (
  <div className="relative min-h-dvh bg-grid">
    <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-950/80 backdrop-blur-md">
      <div className={cn('mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-6xl')}>
        <Link to="/" className="shrink-0" aria-label="Auction Arena home">
          <Logo size="sm" />
        </Link>
        {center && <div className="hidden min-w-0 flex-1 justify-center md:flex">{center}</div>}
        <div className="flex items-center gap-2">
          {right}
          {showUser && <UserChip compact={Boolean(right)} />}
        </div>
      </div>
    </header>
    <main className={cn('mx-auto px-4 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-6xl', className)}>{children}</main>
  </div>
);

export default PageShell;
