import React from 'react';
import { cn } from '../../lib/cn';
import { inputClasses } from './styles';

// A labelled input; pass any <input> props through
const Field = ({ label, hint, className, inputClassName, ...props }) => (
  <label className={cn('block space-y-1.5', className)}>
    {label && <span className="block font-display text-xs font-semibold uppercase tracking-[0.14em] text-mist">{label}</span>}
    <input className={cn(inputClasses, inputClassName)} {...props} />
    {hint && <span className="block text-xs text-haze">{hint}</span>}
  </label>
);

export default Field;
