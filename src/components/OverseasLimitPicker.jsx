import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { hasOverseasLimit } from '../lib/format';

const stepClass =
  'flex size-9 items-center justify-center rounded-md border border-white/8 text-mist hover:border-ink-500 hover:text-snow cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

// Overseas players allowed per squad: a number from 0, or "No limit" (stored as the squad size)
const OverseasLimitPicker = ({ value, squadLimit, defaultLimit, onChange, disabled }) => {
  const limited = hasOverseasLimit(value, squadLimit);
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={stepClass} disabled={disabled || value <= 0} onClick={() => onChange(Math.min(value, squadLimit) - 1)} aria-label="Fewer overseas players">
        <Minus size={14} />
      </button>
      <span className="w-16 text-center font-display text-lg font-bold tabular" aria-live="polite">
        {limited ? value : '∞'}
      </span>
      <button type="button" className={stepClass} disabled={disabled || !limited} onClick={() => onChange(value + 1)} aria-label="More overseas players">
        <Plus size={14} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(limited ? squadLimit : defaultLimit)}
        className={cn(
          'ml-auto h-9 rounded-md border px-2.5 font-display text-xs font-semibold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
          limited ? 'border-white/8 text-mist hover:border-ink-500' : 'border-signal bg-signal/15 text-signal',
        )}
        aria-pressed={!limited}
      >
        No limit
      </button>
    </div>
  );
};

export default OverseasLimitPicker;
