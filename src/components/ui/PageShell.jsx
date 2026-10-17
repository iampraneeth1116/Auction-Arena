import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { cn } from '../../lib/cn';

// Page frame: top bar with the wordmark and optional centre/right content, then the page
const PageShell = ({ children, right, center, className, wide = false }) => (
  <div className="relative min-h-dvh bg-grid">
    <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-950/80 backdrop-blur-md">
      <div className={cn('mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-6xl')}>
        <Link to="/" className="shrink-0" aria-label="Auction Arena home">
          <Logo size="sm" />
        </Link>
        {center && <div className="hidden min-w-0 flex-1 justify-center md:flex">{center}</div>}
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
    <main className={cn('mx-auto px-4 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-6xl', className)}>{children}</main>
  </div>
);

export default PageShell;
