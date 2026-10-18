import React, { useState } from 'react';
import { Plane } from 'lucide-react';
import Logo from './ui/Logo';
import RatingBadge from './ui/RatingBadge';
import { cn } from '../lib/cn';
import { TEAMS_BY_ID, teamStrength, withPlayer } from '../lib/catalog';
import { MODE_META, ROLES, ROLE_META, formatCrores, formatPrice, isOverseas } from '../lib/format';

// A fixed 1080×1350 (4:5 portrait) graphic for one franchise, rendered off-screen
// and exported to PNG. Sizes are in pixels on purpose: no responsive classes, so
// the image looks the same whatever device makes it.
const WIDTH = 1080;
const HEIGHT = 1350;
const GRID_GAP = 10;

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// "Ravichandran Ashwin" → "R. Ashwin" for the tightest layout; short names stay whole
const shortName = (name = '') => {
  if (name.length <= 14) return name;
  const [first, ...rest] = name.split(/\s+/);
  if (!rest.length) return name;
  const lead = first.length <= 3 && first === first.toUpperCase() ? first : `${first[0]}.`;
  return [lead, ...rest].join(' ');
};

// Initials sit behind the photo: if a cross-origin photo can't be copied into the
// export (it becomes a transparent placeholder) or fails to load, they show through
const PosterImage = ({ src, alt, fallback, className, style, imgClassName }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden', className)} style={style}>
      <span className="font-display font-bold uppercase text-mist" aria-hidden>{fallback}</span>
      {src && !failed && (
        <img src={src} alt={alt} className={cn('absolute inset-0 size-full', imgClassName)} onError={() => setFailed(true)} />
      )}
    </span>
  );
};

// How the squad grid packs: one roomy column for small squads, three tight ones for a
// full 25. Rows share whatever height is left above the footer, up to a cap.
function gridLayout(count) {
  const cols = count <= 6 ? 1 : count <= 12 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(count / cols));
  const cap = cols === 1 ? 112 : cols === 2 ? 100 : 90;
  const tier = cols === 1 ? 'roomy' : cols === 2 ? 'regular' : 'compact';
  return { cols, rows, cap, tier };
}

const TIER = {
  roomy: { gap: 'gap-5', name: 'text-[38px]', meta: 'text-[20px]', chip: 'text-[18px] px-2.5 py-0.5', badge: 'lg', price: 'text-[36px]' },
  regular: { gap: 'gap-4', name: 'text-[28px]', meta: 'text-[18px]', chip: 'text-[16px] px-2 py-0.5', badge: 'md', price: 'text-[22px]' },
  compact: { gap: 'gap-3', name: 'text-[20px]', meta: 'text-[15px]', chip: 'text-[13px] px-1.5', badge: 'md', price: 'text-[17px]' },
};

const PlayerCard = ({ player, team, tier }) => {
  const t = TIER[tier];
  const overseas = isOverseas(player);
  const price = formatPrice(player.bid);
  return (
    <div
      className={cn('relative flex h-full min-w-0 items-center overflow-hidden rounded-md border border-white/10 bg-ink-900/85 pr-4', t.gap)}
    >
      <span className="w-1.5 self-stretch" style={{ background: team?.colors.primary }} aria-hidden />
      <PosterImage
        src={player.image}
        alt={player.name}
        fallback={initials(player.name)}
        className="rounded-sm bg-ink-700 text-[18px]"
        imgClassName="object-cover object-top"
        style={{ height: 'calc(100% - 14px)', aspectRatio: '1 / 1' }}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-display font-bold uppercase leading-none tracking-wide text-snow', t.name)}>
          {tier === 'compact' ? shortName(player.name) : player.name}
        </p>
        <div className={cn('mt-2 flex items-center gap-2 font-display font-semibold uppercase tracking-wider text-mist', t.meta)}>
          <span className={cn('rounded-sm bg-white/10 leading-tight text-snow', t.chip)}>{ROLE_META[player.role]?.short ?? player.role}</span>
          {overseas && (
            <span className="inline-flex items-center gap-1">
              <Plane size={tier === 'compact' ? 13 : 16} strokeWidth={2.5} aria-hidden />
              {tier === 'compact' ? 'OS' : 'Overseas'}
            </span>
          )}
          {tier !== 'roomy' && <span className={cn('ml-auto font-bold normal-case tabular text-snow', t.price)}>{price}</span>}
        </div>
      </div>
      <RatingBadge rating={player.rating} size={t.badge} />
      {tier === 'roomy' && <span className={cn('w-52 text-right font-display font-bold tabular text-snow', t.price)}>{price}</span>}
    </div>
  );
};

const PosterStat = ({ label, value, unit, tone }) => (
  <div className="min-w-0 rounded-lg border border-white/10 bg-ink-950/70 px-5 py-3.5">
    <div className="font-display text-[17px] font-semibold uppercase tracking-[0.18em] text-haze">{label}</div>
    <div className={cn('mt-1 whitespace-nowrap font-display text-[48px] font-bold leading-none tabular', tone === 'signal' ? 'text-signal' : 'text-snow')}>
      {value}
      {unit && <span className="ml-1.5 text-[24px] font-semibold text-mist">{unit}</span>}
    </div>
  </div>
);

// ₹128.75 + "Cr", or ₹75 + "L" below a crore
const splitPrice = (crores) => (crores > 0 && crores < 1
  ? { value: `₹${Math.round(crores * 100)}`, unit: 'L' }
  : { value: `₹${formatCrores(crores)}`, unit: 'Cr' });

// Props: team (a roomTeams entry), managerName, squadLimit, mode (auctionType), roomId
const SquadPoster = ({ team, managerName, squadLimit = 25, mode, roomId }) => {
  const franchise = TEAMS_BY_ID.get(team.teamId);
  const primary = franchise?.colors.primary ?? '#22d3ee';
  const secondary = franchise?.colors.secondary ?? '#a3e635';
  const name = franchise?.name ?? team.teamName ?? team.teamId;

  const roleOrder = (role) => (ROLES.includes(role) ? ROLES.indexOf(role) : ROLES.length);
  const players = (team.squad || [])
    .map(withPlayer)
    .filter(Boolean)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || b.bid - a.bid);
  const spent = players.reduce((sum, p) => sum + p.bid, 0);
  const overseas = players.filter(isOverseas).length;
  const { score } = teamStrength(team.squad || [], squadLimit);
  const { cols, rows, cap, tier } = gridLayout(players.length);
  const spentLabel = splitPrice(spent);

  return (
    <div className="relative flex flex-col overflow-hidden bg-ink-950 font-sans text-snow" style={{ width: WIDTH, height: HEIGHT }}>
      {/* Team colour wash, darkened towards the squad so every kit colour stays readable */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(160deg, ${primary} 0%, ${primary}b3 24%, #0a0f1f 60%, #05070f 100%)` }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgb(5 7 15 / 0.2) 0%, rgb(5 7 15 / 0.45) 35%, rgb(5 7 15 / 0.85) 70%)' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-stripes" aria-hidden />
      <div
        className="absolute -right-24 -top-10 h-[620px] w-[300px] -skew-x-12 opacity-35"
        style={{ background: `linear-gradient(180deg, ${secondary}, transparent 85%)` }}
        aria-hidden
      />

      {/* Masthead */}
      <div className="relative flex items-center justify-between px-16 pt-14">
        <Logo size="lg" className="[&>span:last-child]:text-[44px]" />
        <span className="clip-slant bg-snow px-9 py-2 font-display text-[22px] font-bold uppercase tracking-[0.2em] text-ink-950">
          Squad sheet
        </span>
      </div>

      {/* Franchise lower-third */}
      <div className="relative mt-10 flex items-center gap-10 px-16">
        <PosterImage
          src={franchise?.logo}
          alt={name}
          fallback={team.teamId}
          className="rounded-xl border border-white/15 text-[48px]"
          imgClassName="object-contain p-6"
          style={{ width: 210, height: 210, background: `linear-gradient(145deg, ${primary}, #0a0f1f 80%)` }}
        />
        <div className="min-w-0 flex-1">
          <div className="clip-slant-r bg-ink-950/80 py-5 pl-7 pr-16" style={{ borderLeft: `8px solid ${secondary}` }}>
            <p className="font-display text-[24px] font-semibold uppercase tracking-[0.22em] text-mist">Final squad</p>
            <h1
              className="mt-1 font-display font-extrabold uppercase leading-[0.92] tracking-wide text-snow"
              style={{ fontSize: name.length > 20 ? 64 : 80 }}
            >
              {name}
            </h1>
            <p className="mt-3 truncate text-[24px] text-mist">
              Managed by <span className="font-semibold text-snow">{managerName || 'Unknown manager'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Numbers */}
      <div className="relative mt-8 grid grid-cols-[1fr_1.35fr_1fr_0.9fr] gap-4 px-16">
        <PosterStat label="Arena Strength" value={score} tone="signal" />
        <PosterStat label="Spent" value={spentLabel.value} unit={spentLabel.unit} />
        <PosterStat label="Players" value={`${players.length}/${squadLimit}`} />
        <PosterStat label="Overseas" value={overseas} />
      </div>

      {/* Squad */}
      <div className="relative mt-8 min-h-0 flex-1 px-16 pb-7">
        {players.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 font-display text-[32px] uppercase tracking-[0.2em] text-haze">
            No players bought
          </div>
        ) : (
          <div
            className="grid h-full content-center"
            style={{
              gap: GRID_GAP,
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, ${cap}px))`,
            }}
          >
            {players.map(player => (
              <PlayerCard key={player.id} player={player} team={franchise} tier={tier} />
            ))}
          </div>
        )}
      </div>

      {/* Footer strip */}
      <div
        className="relative flex h-[88px] shrink-0 items-center justify-between gap-6 bg-ink-950/95 px-16"
        style={{ borderTop: `4px solid ${primary}` }}
      >
        <div className="flex min-w-0 items-center gap-5">
          <span className="clip-slant-r bg-signal py-1.5 pl-4 pr-8 font-display text-[22px] font-bold uppercase tracking-[0.18em] text-ink-950">
            Room
          </span>
          <span className="font-display text-[34px] font-bold tracking-[0.14em] tabular">{roomId}</span>
          <span className="truncate font-display text-[24px] font-semibold uppercase tracking-wider text-mist">
            {MODE_META[mode]?.label ?? mode}
          </span>
        </div>
        <span className="shrink-0 font-display text-[20px] font-semibold uppercase tracking-wider text-haze">
          Chips show Arena Rating 1–99
        </span>
      </div>
    </div>
  );
};

export default SquadPoster;
