import React from 'react';
import TeamCrest from '../ui/TeamCrest';
import { TEAMS_BY_ID } from '../../lib/catalog';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/format';

// Segmented countdown: one block per second of the room's bid timer
const TimerBar = ({ timeLeft, total }) => {
  const segments = Math.max(5, Math.min(total, 30));
  const lit = timeLeft === null ? segments : Math.round((Math.min(timeLeft, total) / total) * segments);
  const urgent = timeLeft !== null && timeLeft <= Math.max(1, Math.min(3, Math.floor(total / 3)));
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-0.5" aria-hidden>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 flex-1 -skew-x-12 transition-colors duration-200',
              i < lit ? (urgent ? 'bg-flare' : 'bg-signal') : 'bg-ink-700',
            )}
          />
        ))}
      </div>
      <span
        className={cn('tabular w-12 text-right font-display text-3xl font-bold leading-none', urgent ? 'text-flare animate-live' : 'text-snow')}
        aria-live="off"
        aria-label={`${timeLeft ?? total} seconds left`}
      >
        {timeLeft ?? '–'}
      </span>
    </div>
  );
};

// Current price and who holds it, broadcast scoreboard style
const PriceBoard = ({ live, timeLeft, bidTimer, leaderName, basePrice }) => {
  const leader = TEAMS_BY_ID.get(live?.highBidderTeamId);
  const hasBid = Boolean(live?.currentBid);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-haze">
            {hasBid ? 'Current bid' : 'Opening at'}
          </div>
          <div className={cn('tabular font-display text-5xl font-extrabold leading-none sm:text-6xl', hasBid ? 'text-signal' : 'text-snow/80')}>
            {formatPrice(hasBid ? live.currentBid : basePrice)}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 text-right">
          {leader ? (
            <>
              <div className="min-w-0">
                <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-haze">Leading</div>
                <div className="truncate font-display text-xl font-bold uppercase">{leader.id}</div>
                <div className="truncate text-xs text-mist">{leaderName}</div>
              </div>
              <TeamCrest teamId={leader.id} size="lg" />
            </>
          ) : (
            <div className="font-display text-sm uppercase tracking-wider text-haze">No bids yet</div>
          )}
        </div>
      </div>
      <TimerBar timeLeft={timeLeft} total={bidTimer} />
    </div>
  );
};

export default PriceBoard;
