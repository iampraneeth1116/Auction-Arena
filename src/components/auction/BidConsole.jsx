import React from 'react';
import { motion } from 'framer-motion';
import { Gavel, Trophy } from 'lucide-react';
import Button from '../ui/Button';
import { cn } from '../../lib/cn';
import { bidButtonLabel, formatPrice, overseasUsage } from '../../lib/format';

const Readout = ({ label, value, warn }) => (
  <div className="min-w-0 border-l border-white/8 pl-2.5 first:border-l-0 first:pl-0">
    <div className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">{label}</div>
    <div className={cn('tabular truncate font-display text-base font-bold leading-tight', warn ? 'text-flare' : 'text-snow')}>{value}</div>
  </div>
);

// Your side of the desk: the bid button and the numbers that decide whether to press it
const BidConsole = ({ team, squadLimit, overseasLimit, overseasCount, maxBid, nextAmount, state, onBid, busy }) => {
  // Bidding past this leaves too little to fill the rest of the squad
  const overMax = state === 'open' && nextAmount > maxBid;

  const label = bidButtonLabel(state, nextAmount);

  return (
    <div className="space-y-3">
      <motion.div whileTap={state === 'open' ? { scale: 0.98 } : undefined}>
        <Button
          variant={state === 'leading' ? 'outline' : 'volt'}
          size="xl"
          block
          slant
          loading={busy}
          disabled={state !== 'open'}
          icon={state === 'leading' ? Trophy : Gavel}
          onClick={onBid}
          className={cn('h-16 text-2xl', state === 'leading' && 'border-volt text-volt opacity-100')}
          aria-keyshortcuts="b"
        >
          {label}
        </Button>
      </motion.div>
      <div className="grid grid-cols-4 gap-2 rounded-md bg-ink-900/70 px-3 py-2">
        <Readout label="Purse" value={formatPrice(team?.budgetRemaining ?? 0)} />
        <Readout label="Squad" value={`${team?.squad?.length ?? 0}/${squadLimit}`} warn={state === 'full'} />
        <Readout label="Overseas" value={overseasUsage(overseasCount, overseasLimit, squadLimit)} warn={state === 'overseas'} />
        <Readout label="Max bid" value={formatPrice(maxBid)} warn={state === 'budget' || overMax} />
      </div>
      <p className="hidden text-center text-xs text-haze lg:block">
        Press <kbd className="rounded border border-ink-500 px-1 font-display text-mist">B</kbd> to bid · max bid keeps ₹30 L for each slot you still need to fill
      </p>
    </div>
  );
};

export default BidConsole;
