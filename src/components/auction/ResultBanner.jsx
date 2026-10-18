import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gavel, PauseCircle } from 'lucide-react';
import TeamCrest from '../ui/TeamCrest';
import { TEAMS_BY_ID } from '../../lib/catalog';
import { formatPrice } from '../../lib/format';

// The hammer moment: SOLD slams in over the stage in the buyer's colours
const ResultBanner = ({ live, player, buyerName }) => {
  const status = live?.status;
  const team = TEAMS_BY_ID.get(live?.highBidderTeamId);
  const show = status === 'sold' || status === 'unsold' || status === 'paused';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={`${live.playerId}-${status}`}
          className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg bg-ink-950/75 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {status === 'sold' && team && (
            <motion.div
              className="relative w-full overflow-hidden py-6"
              style={{ background: `linear-gradient(100deg, ${team.colors.primary}, ${team.colors.primary}dd 55%, ${team.colors.secondary}aa)` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <span className="absolute inset-0 bg-stripes" aria-hidden />
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/20 animate-sweep" aria-hidden />
              <div className="relative flex items-center justify-center gap-4 px-4 sm:gap-6">
                <TeamCrest teamId={team.id} size="xl" className="hidden border-white/30 sm:inline-flex" />
                <div className="text-center sm:text-left">
                  <motion.div
                    className="flex items-center justify-center gap-2 font-display text-6xl font-extrabold uppercase leading-none text-white drop-shadow sm:justify-start sm:text-7xl"
                    initial={{ scale: 1.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.12, type: 'spring', stiffness: 500, damping: 22 }}
                  >
                    <Gavel size={44} strokeWidth={2.5} /> Sold
                  </motion.div>
                  <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-white/95">
                    {player?.name} · {formatPrice(live.currentBid)}
                  </p>
                  <p className="text-sm text-white/85">to {team.name}{buyerName ? ` (${buyerName})` : ''}</p>
                </div>
              </div>
            </motion.div>
          )}

          {status === 'unsold' && (
            <motion.div
              className="text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <div className="font-display text-6xl font-extrabold uppercase leading-none text-haze line-through decoration-flare decoration-4">Unsold</div>
              <p className="mt-2 font-display text-lg uppercase tracking-wide text-mist">No bids for {player?.name}</p>
            </motion.div>
          )}

          {status === 'paused' && (
            <motion.div className="text-center" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <PauseCircle size={48} className="mx-auto text-gold" />
              <div className="mt-2 font-display text-4xl font-extrabold uppercase">Paused</div>
              <p className="text-sm text-mist">The host paused bidding. The clock restarts when they resume.</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResultBanner;
