// Class recipes shared by components and pages that need the look on other elements (links, selects)
import { cn } from '../../lib/cn';

const VARIANTS = {
  primary: 'bg-signal text-ink-950 hover:bg-cyan-300 shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)]',
  volt: 'bg-volt text-ink-950 hover:bg-lime-300 shadow-[0_0_24px_-6px_rgb(163_230_53/0.7)]',
  outline: 'border border-ink-500 text-snow hover:border-signal hover:text-signal bg-ink-900/40',
  ghost: 'text-mist hover:text-snow hover:bg-white/5',
  danger: 'border border-flare/40 bg-flare/10 text-flare hover:bg-flare/20',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-8 text-lg gap-3',
};

export const buttonClasses = ({ variant = 'primary', size = 'md', slant = false, block = false } = {}) =>
  cn(
    'inline-flex items-center justify-center font-display font-bold uppercase tracking-wider transition-colors',
    'disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:translate-y-px',
    slant ? 'clip-slant px-6' : 'rounded-md',
    block && 'w-full',
    VARIANTS[variant],
    SIZES[size],
  );

export const inputClasses = cn(
  'h-11 w-full rounded-md border border-ink-500 bg-ink-900/70 px-3.5 text-sm text-snow placeholder:text-haze',
  'transition-colors focus:border-signal focus:outline-none',
);

