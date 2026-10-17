import React from 'react';
import { cn } from '../../lib/cn';

const TONES = {
  neutral: 'bg-white/6 text-mist',
  signal: 'bg-signal/15 text-signal',
  volt: 'bg-volt/15 text-volt',
  flare: 'bg-flare/15 text-flare',
  gold: 'bg-gold/15 text-gold',
  solid: 'bg-snow text-ink-950',
};

// Small condensed label: roles, statuses, counts
const Tag = ({ tone = 'neutral', icon: Icon, className, children }) => (
  <span className={cn('inline-flex h-5 items-center gap-1 rounded-sm px-1.5 font-display text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap', TONES[tone], className)}>
    {Icon && <Icon size={11} strokeWidth={2.5} />}
    {children}
  </span>
);

export const LiveTag = ({ label = 'Live', className }) => (
  <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-sm bg-flare px-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white', className)}>
    <span className="size-1.5 rounded-full bg-white animate-live" aria-hidden />
    {label}
  </span>
);

export default Tag;
