import React from 'react';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import { ratingOf } from '../../lib/catalog';
import { ROLE_META, formatPrice } from '../../lib/format';

// The next few lots, so managers can plan their purse
const UpNext = ({ players, onShowAll }) => {
  if (players.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">Up next</span>
        <button onClick={onShowAll} className="font-display text-xs font-semibold uppercase tracking-wider text-signal hover:text-cyan-300 cursor-pointer">
          Full list
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        {players.map((p, i) => (
          <div key={p.id} className="flex min-w-0 items-center gap-2 rounded-md border border-white/6 bg-ink-900/60 p-1.5">
            <span className="w-3 shrink-0 text-center font-display text-xs text-haze">{i + 1}</span>
            <PlayerPhoto player={p} className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{p.name}</div>
              <div className="text-[11px] text-haze">{ROLE_META[p.role]?.short} · {formatPrice(p.basePrice)}</div>
            </div>
            <RatingBadge rating={ratingOf(p.id)} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpNext;
