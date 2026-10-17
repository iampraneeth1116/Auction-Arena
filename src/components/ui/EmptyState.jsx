import React from 'react';
import { cn } from '../../lib/cn';

const EmptyState = ({ icon: Icon, title, children, className }) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
    {Icon && (
      <span className="mb-1 flex size-12 items-center justify-center rounded-md border border-white/8 bg-ink-800 text-haze">
        <Icon size={22} />
      </span>
    )}
    <p className="font-display text-lg font-semibold uppercase tracking-wide text-snow">{title}</p>
    {children && <div className="max-w-sm text-sm text-haze">{children}</div>}
  </div>
);

export default EmptyState;
