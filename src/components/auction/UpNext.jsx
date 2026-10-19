import React from 'react';
import { EyeOff } from 'lucide-react';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import { ratingOf } from '../../lib/catalog';
import { ROLE_META, formatPrice } from '../../lib/format';

const headingClasses = 'font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze';
const linkClasses = 'font-display text-xs font-semibold uppercase tracking-wider text-signal hover:text-cyan-300 cursor-pointer';

// The next few lots, so managers can plan their purse. Tap one for the full player card.
// hidden: the host keeps upcoming players secret, so there's only a note
const UpNext = ({ players, hidden, onSelect, onShowAll }) => {
  if (hidden) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-ink-500 bg-ink-900/40 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm text-haze">
          <EyeOff size={15} className="shrink-0 text-signal" aria-hidden />
          The host has hidden who&rsquo;s coming next. Every lot is a surprise.
        </p>
        <button onClick={onShowAll} className={`${linkClasses} shrink-0`}>Sold &amp; unsold</button>
      </div>
    );
  }
  if (players.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={headingClasses}>Up next</span>
        <button onClick={onShowAll} className={linkClasses}>Full list</button>
      </div>
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        {players.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p, i)}
            aria-label={`See ${p.name}'s player card`}
            className="flex min-w-0 items-center gap-2 rounded-md border border-white/6 bg-ink-900/60 p-1.5 text-left transition-colors hover:border-signal/50 hover:bg-ink-800/80 cursor-pointer"
          >
            <span className="w-3 shrink-0 text-center font-display text-xs text-haze">{i + 1}</span>
            <PlayerPhoto player={p} className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{p.name}</div>
              <div className="text-[11px] text-haze">{ROLE_META[p.role]?.short} · {formatPrice(p.basePrice)}</div>
            </div>
            <RatingBadge rating={ratingOf(p.id)} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default UpNext;
