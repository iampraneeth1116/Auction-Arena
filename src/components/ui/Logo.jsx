import React from 'react';
import { cn } from '../../lib/cn';

const SIZES = {
  sm: { bar: 'h-4 w-1.5', text: 'text-base' },
  md: { bar: 'h-5 w-2', text: 'text-xl' },
  lg: { bar: 'h-9 w-3', text: 'text-4xl sm:text-5xl' },
};

// The wordmark: a slanted signal bar, then AUCTION ARENA in condensed caps
const Logo = ({ size = 'md', className }) => {
  const s = SIZES[size];
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)} aria-label="Auction Arena">
      <span className={cn(s.bar, '-skew-x-12 bg-signal shadow-[0_0_18px_rgb(34_211_238/0.6)]')} aria-hidden />
      <span className={cn(s.text, 'font-display font-extrabold uppercase leading-none tracking-wide')}>
        Auction <span className="text-signal">Arena</span>
      </span>
    </span>
  );
};

export default Logo;
