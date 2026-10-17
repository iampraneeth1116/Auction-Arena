import React from 'react';
import { cn } from '../../lib/cn';

const ACCENTS = {
  signal: 'bg-signal',
  volt: 'bg-volt',
  flare: 'bg-flare',
  gold: 'bg-gold',
};

// The basic surface: dark glass with an optional coloured top rule and a header strip
const Panel = ({ label, actions, accent, className, bodyClassName, children, as: Tag = 'section', ...props }) => (
  <Tag className={cn('relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85 backdrop-blur-sm', className)} {...props}>
    {accent && <span className={cn('absolute inset-x-0 top-0 h-0.5', ACCENTS[accent] ?? accent)} aria-hidden />}
    {(label || actions) && (
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-white/6 px-4 py-2">
        {label && <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-mist">{label}</h2>}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={bodyClassName}>{children}</div>
  </Tag>
);

export default Panel;
