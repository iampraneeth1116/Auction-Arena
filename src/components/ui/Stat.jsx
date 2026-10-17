import React from 'react';
import { cn } from '../../lib/cn';

// A label over a big tabular number, like a scoreboard cell
const Stat = ({ label, value, hint, tone, size = 'md', className }) => (
  <div className={cn('min-w-0', className)}>
    <div className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">{label}</div>
    <div
      className={cn(
        'tabular font-display font-bold leading-tight truncate',
        size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl',
        tone === 'signal' ? 'text-signal' : tone === 'volt' ? 'text-volt' : tone === 'flare' ? 'text-flare' : 'text-snow',
      )}
    >
      {value}
    </div>
    {hint && <div className="text-xs text-haze truncate">{hint}</div>}
  </div>
);

export default Stat;
