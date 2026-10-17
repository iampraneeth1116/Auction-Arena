import React from 'react';
import { Plane } from 'lucide-react';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import Tag from '../ui/Tag';
import { ratingOf } from '../../lib/catalog';
import { ratingTier } from '../../lib/playerRating';
import { ROLE_META, formatPrice, isOverseas } from '../../lib/format';

const statValue = (value) => (value === undefined || value === null || value === '-' || value === '' ? '—' : value);

// Bowlers lead with bowling numbers, everyone else with batting
function statLine(player) {
  const s = player.stats || {};
  const batting = [['Runs', s.runs], ['Strike rate', s.sr], ['Average', s.avg]];
  const bowling = [['Wickets', s.wickets], ['Economy', s.econ]];
  const lines = player.role === 'Bowler'
    ? [...bowling, ['Average', s.avg]]
    : player.role === 'All-Rounder'
      ? [['Runs', s.runs], ['Strike rate', s.sr], ...bowling]
      : batting;
  return [['Matches', s.matches], ...lines]
    .map(([label, value]) => ({ label, value: statValue(value) }))
    .filter(({ value }) => value !== '—')
    .slice(0, 4);
}

const TIER_LABEL = { elite: 'Elite', star: 'Star', solid: 'Solid', squad: 'Squad player', prospect: 'Prospect' };

// The player "on the block": photo, name, role, Arena Rating and key numbers
const LotCard = ({ player, lot, lots }) => {
  const rating = ratingOf(player.id);
  return (
    <div className="relative grid grid-cols-[7.5rem_1fr] gap-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <div className="relative">
        <div className="clip-notch relative aspect-[4/5] overflow-hidden rounded-md border border-white/10 bg-ink-800">
          <span className="absolute inset-0 bg-stripes" aria-hidden />
          <PlayerPhoto player={player} className="relative size-full" rounded="rounded-none" />
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/90 to-transparent" aria-hidden />
        </div>
        <RatingBadge rating={rating} size="lg" className="absolute -bottom-3 -right-3 shadow-lg" />
      </div>

      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone="signal">{ROLE_META[player.role]?.label ?? player.role}</Tag>
          <Tag>{player.country}</Tag>
          {isOverseas(player) && <Tag tone="gold" icon={Plane}>Overseas</Tag>}
          <Tag className="hidden sm:inline-flex">{player.set}</Tag>
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {player.name}
        </h2>
        <p className="mt-1.5 text-sm text-mist">
          {TIER_LABEL[ratingTier(rating)]} · Base {formatPrice(player.basePrice)}
          {lot ? <span className="text-haze"> · Lot {lot}{lots ? ` of ${lots}` : ''}</span> : null}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:mt-4 sm:grid-cols-4">
          {statLine(player).map(({ label, value }) => (
            <div key={label} className="border-l-2 border-ink-600 pl-2">
              <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">{label}</dt>
              <dd className="tabular font-display text-lg font-bold leading-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};

export default LotCard;
