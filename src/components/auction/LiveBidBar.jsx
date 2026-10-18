import React from 'react';
import { Gavel, Trophy } from 'lucide-react';
import Button from '../ui/Button';
import PlayerPhoto from '../ui/PlayerPhoto';
import TeamCrest from '../ui/TeamCrest';
import { cn } from '../../lib/cn';
import { bidButtonLabel, formatPrice } from '../../lib/format';

// A compact bid console for overlays like the player list, so a manager can keep
// bidding on the current lot while browsing instead of missing it
const LiveBidBar = ({ player, live, timeLeft, state, nextAmount, onBid }) => {
  if (!player || !live) return null;
  const hasBid = Boolean(live.currentBid);
  const urgent = live.status === 'bidding' && timeLeft !== null && timeLeft <= 3;
  return (
    <div className="flex items-center gap-3" aria-label="Current lot">
      <PlayerPhoto player={player} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{player.name}</div>
        <div className="flex items-center gap-2 text-xs text-haze">
          <span className={cn('tabular font-display text-base font-bold', hasBid ? 'text-signal' : 'text-mist')}>
            {formatPrice(hasBid ? live.currentBid : player.basePrice)}
          </span>
          {live.highBidderTeamId && <TeamCrest teamId={live.highBidderTeamId} size="xs" className="border-0" />}
          {live.status === 'bidding' && (
            <span className={cn('tabular font-display text-sm font-semibold', urgent ? 'text-flare' : 'text-mist')}>
              {timeLeft ?? '–'}s
            </span>
          )}
        </div>
      </div>
      <Button
        variant={state === 'leading' ? 'outline' : 'volt'}
        slant
        icon={state === 'leading' ? Trophy : Gavel}
        disabled={state !== 'open'}
        onClick={onBid}
        className={cn('shrink-0', state === 'leading' && 'border-volt text-volt opacity-100')}
      >
        {bidButtonLabel(state, nextAmount)}
      </Button>
    </div>
  );
};

export default LiveBidBar;
