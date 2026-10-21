import React from 'react';
import { Plane, TrendingDown, TrendingUp } from 'lucide-react';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import Tag from '../ui/Tag';
import { ratingOf } from '../../lib/catalog';
import { TIER_LABELS, outlookOf, ratingTier } from '../../lib/playerRating';
import { profileLines } from '../../lib/playerProfile';
import { ROLE_META, formatPrice, formatStat, isOverseas } from '../../lib/format';

const STATS = [
  ['matches', 'Matches'],
  ['runs', 'Runs'],
  ['sr', 'Strike rate'],
  ['avg', 'Average'],
  ['wickets', 'Wickets'],
  ['econ', 'Economy'],
];

const labelClasses = 'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze';

// Everything we know about one player: rating, auction details, playing profile and career numbers.
// note: an optional line about this player in this auction, e.g. "Lot 14 of 80"
const PlayerDetail = ({ player, note }) => {
  const rating = ratingOf(player.id);
  const profile = profileLines(player);
  const outlook = outlookOf(player.id);
  const stats = player.stats || {};

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <div className="clip-notch relative aspect-[4/5] w-24 overflow-hidden rounded-md border border-white/10 bg-ink-800 sm:w-28">
            <span className="absolute inset-0 bg-stripes" aria-hidden />
            <PlayerPhoto player={player} className="relative size-full" rounded="rounded-none" />
          </div>
          <RatingBadge rating={rating} size="lg" className="absolute -bottom-3 -right-3 shadow-lg" />
        </div>
        <div className="min-w-0 py-0.5">
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="signal">{ROLE_META[player.role]?.label ?? player.role}</Tag>
            <Tag>{player.country}</Tag>
            {isOverseas(player) && <Tag tone="gold" icon={Plane}>Overseas</Tag>}
          </div>
          <h3 className="mt-2 font-display text-2xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-3xl">{player.name}</h3>
          <p className="mt-1 text-sm text-mist">
            {TIER_LABELS[ratingTier(rating)]} · Arena Rating <span className="tabular font-semibold text-snow">{rating}</span>
          </p>
          {note && <p className="mt-1 text-sm text-signal">{note}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-md border border-white/6 bg-ink-900/60 p-3">
        <div>
          <dt className={labelClasses}>Base price</dt>
          <dd className="tabular font-display text-lg font-bold">{formatPrice(player.basePrice)}</dd>
        </div>
        <div className="min-w-0">
          <dt className={labelClasses}>Auction set</dt>
          <dd className="truncate font-display text-lg font-bold">{player.set}</dd>
        </div>
      </dl>

      {outlook && (
        <section className={`rounded-md border px-3 py-2.5 ${outlook.change >= 0 ? 'border-volt/30 bg-volt/[0.06]' : 'border-flare/30 bg-flare/[0.06]'}`}>
          <h4 className={`${labelClasses} flex items-center gap-1.5`}>
            {outlook.change >= 0
              ? <TrendingUp size={13} className="text-volt" aria-hidden />
              : <TrendingDown size={13} className="text-flare" aria-hidden />}
            Next IPL outlook
            <span className={`tabular ${outlook.change >= 0 ? 'text-volt' : 'text-flare'}`}>
              {outlook.change > 0 ? '+' : ''}{outlook.change} rating
            </span>
          </h4>
          <p className="mt-1 text-sm text-snow">{outlook.note}</p>
        </section>
      )}

      <section>
        <h4 className={labelClasses}>Playing profile</h4>
        {profile.length > 0 ? (
          <ul className="mt-1.5 space-y-1 text-sm text-snow">
            {profile.map(line => <li key={line}>{line}</li>)}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-haze">Not known for this player.</p>
        )}
      </section>

      <section>
        <h4 className={labelClasses}>Career numbers</h4>
        <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-3">
          {STATS.map(([key, label]) => (
            <div key={key} className="border-l-2 border-ink-600 pl-2">
              <dt className={labelClasses}>{label}</dt>
              <dd className="tabular font-display text-lg font-bold leading-tight">{formatStat(stats[key])}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
};

export default PlayerDetail;
