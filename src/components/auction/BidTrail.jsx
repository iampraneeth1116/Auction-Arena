import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TeamCrest from '../ui/TeamCrest';
import { formatPrice } from '../../lib/format';

// Every raise on this lot, newest first
const BidTrail = ({ trail, myId }) => {
  if (trail.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1" aria-label="Bids on this player">
      <span className="shrink-0 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">Bids</span>
      <AnimatePresence initial={false}>
        {[...trail].reverse().slice(0, 12).map((bid, i) => (
          <motion.span
            key={`${bid.amount}-${bid.teamId}`}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: i === 0 ? 1 : 0.65, x: 0 }}
            className={`flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 ${bid.bidderId === myId ? 'border-volt/40 bg-volt/10' : 'border-white/8 bg-ink-800'}`}
          >
            <TeamCrest teamId={bid.teamId} size="xs" className="border-0" />
            <span className="tabular font-display text-sm font-semibold">{formatPrice(bid.amount)}</span>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BidTrail;
