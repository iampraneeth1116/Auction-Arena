import React from 'react';
import { cn } from '../../lib/cn';

const Toggle = ({ checked, onChange, label, description, disabled, className }) => (
  <label className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-50', className)}>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-snow">{label}</span>
      {description && <span className="block text-xs text-haze">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer', checked ? 'border-signal bg-signal/25' : 'border-ink-500 bg-ink-800')}
    >
      <span className={cn('absolute top-0.5 size-4.5 rounded-full transition-all', checked ? 'left-5.5 bg-signal' : 'left-0.5 bg-mist')} />
    </button>
  </label>
);

export default Toggle;
