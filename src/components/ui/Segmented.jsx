import React from 'react';
import { cn } from '../../lib/cn';

// Broadcast-style tabs: condensed caps with a signal underline on the active one
const Segmented = ({ options, value, onChange, className, size = 'md', stretch = false }) => (
  <div role="tablist" className={cn('flex items-stretch gap-1 overflow-x-auto scrollbar-thin', className)}>
    {options.map(({ id, label, icon: Icon, count }) => {
      const active = id === value;
      return (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={cn(
            'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-display font-semibold uppercase tracking-wider transition-colors cursor-pointer',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
            stretch && 'flex-1',
            active ? 'text-snow' : 'text-haze hover:text-mist',
          )}
        >
          {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.4} />}
          {label}
          {count !== undefined && <span className={cn('tabular text-[11px]', active ? 'text-signal' : 'text-haze')}>{count}</span>}
          <span className={cn('absolute inset-x-1 bottom-0 h-0.5 transition-colors', active ? 'bg-signal' : 'bg-transparent')} aria-hidden />
        </button>
      );
    })}
  </div>
);

export default Segmented;
