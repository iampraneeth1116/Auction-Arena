import React from 'react';
import { cn } from '../../lib/cn';

// A looping news-ticker strip. Content is rendered twice so the loop is seamless;
// with loop off (too few items to fill the strip) it simply sits still.
const Ticker = ({ label = 'Latest', loop = true, children, className }) => (
  <div className={cn('flex h-9 items-stretch overflow-hidden border-y border-white/8 bg-ink-900/90', className)}>
    <span className="clip-slant-r z-10 flex shrink-0 items-center bg-signal pl-3 pr-6 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-950">
      {label}
    </span>
    <div className="group relative min-w-0 flex-1 overflow-hidden">
      {loop ? (
        <div className="flex w-max animate-ticker items-center group-hover:[animation-play-state:paused]">
          <div className="flex items-center">{children}</div>
          <div className="flex items-center" aria-hidden>{children}</div>
        </div>
      ) : (
        <div className="flex h-full items-center">{children}</div>
      )}
    </div>
  </div>
);

export const TickerItem = ({ children }) => (
  <span className="flex items-center gap-2 whitespace-nowrap px-5 text-sm text-mist">
    <span className="size-1 -skew-x-12 bg-signal" aria-hidden />
    {children}
  </span>
);

export default Ticker;
