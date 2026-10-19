import React, { useMemo } from 'react';
import { Pencil, Plane, Users, Zap } from 'lucide-react';
import { PLAYERS_BY_ID } from '../../lib/catalog';
import { ROLES, ROLE_META, isOverseas } from '../../lib/format';
import { cn } from '../../lib/cn';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PlayerPhoto from '../ui/PlayerPhoto';
import Stat from '../ui/Stat';

const statFor = (playerStats, id) => playerStats[id] || { totalPoints: 0, matches: 0 };
const avgOf = (stat) => (stat.matches > 0 ? (stat.totalPoints / stat.matches).toFixed(1) : null);

const OverseasMark = () => (
  <span className="shrink-0 text-signal" title="Overseas player">
    <Plane size={12} aria-hidden />
    <span className="sr-only">Overseas</span>
  </span>
);

const SquadPreview = ({
  currentSquad = null,
  playerStats = {},
  onEdit,
  isLocked = false,
}) => {
  // The saved XI in batting-card order: batters, keepers, all-rounders, bowlers
  const selectedPlayers = useMemo(() => {
    if (!currentSquad?.players) return [];
    return currentSquad.players
      .map(id => PLAYERS_BY_ID.get(id))
      .filter(Boolean)
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  }, [currentSquad]);

  const impactPlayer = currentSquad?.impactPlayer ? PLAYERS_BY_ID.get(currentSquad.impactPlayer) : null;

  if (!currentSquad) {
    return (
      <Panel>
        <EmptyState icon={Users} title="No fantasy XI yet">
          <p>Pick a playing XI from the players you bought to start scoring fantasy points.</p>
          <Button variant="volt" size="sm" className="mt-4" onClick={onEdit}>Pick your XI</Button>
        </EmptyState>
      </Panel>
    );
  }

  const multiplier = (id) => (id === currentSquad.captain ? 2 : id === currentSquad.viceCaptain ? 1.5 : 1);
  const totalPoints = Math.round(
    selectedPlayers.reduce((sum, p) => sum + (statFor(playerStats, p.id).totalPoints || 0) * multiplier(p.id), 0)
    + (impactPlayer ? statFor(playerStats, impactPlayer.id).totalPoints || 0 : 0),
  );
  const nameOf = (id) => PLAYERS_BY_ID.get(id)?.name ?? '—';

  return (
    <Panel
      accent="volt"
      label="Your fantasy XI"
      actions={(
        <Button variant="outline" size="sm" icon={Pencil} disabled={isLocked} onClick={onEdit}>
          {isLocked ? 'Locked' : 'Edit XI'}
        </Button>
      )}
      bodyClassName="p-0"
    >
      <div className="grid grid-cols-2 gap-3 border-b border-white/6 px-4 py-3 sm:grid-cols-4">
        <Stat size="sm" label="Total points" value={totalPoints} tone="volt" />
        <Stat size="sm" label="Captain · 2x" value={nameOf(currentSquad.captain)} />
        <Stat size="sm" label="Vice-captain · 1.5x" value={nameOf(currentSquad.viceCaptain)} />
        <Stat size="sm" label="Impact player" value={impactPlayer?.name ?? 'None'} />
      </div>

      <ol className="divide-y divide-white/6">
        {selectedPlayers.map((player, index) => {
          const stat = statFor(playerStats, player.id);
          const avg = avgOf(stat);
          const mult = multiplier(player.id);
          return (
            <li key={player.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-5 shrink-0 text-right font-display text-sm font-semibold text-haze tabular">{index + 1}</span>
              <PlayerPhoto player={player} className="size-9 shrink-0 text-xs" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{player.name}</span>
                  {isOverseas(player) && <OverseasMark />}
                  {mult > 1 && (
                    <span className={cn('shrink-0 rounded-sm px-1 font-display text-[10px] font-bold leading-4 text-ink-950', mult === 2 ? 'bg-gold' : 'bg-snow')}>
                      {mult === 2 ? 'C' : 'VC'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-haze">
                  {ROLE_META[player.role]?.label} · {avg ? <span className="tabular">{avg} pts a match</span> : 'No matches yet'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-lg font-bold leading-none tabular">{Math.round(stat.totalPoints * mult)}</div>
                <div className="font-display text-[10px] uppercase tracking-wider text-haze">{mult > 1 ? `pts · ${mult}x` : 'pts'}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {impactPlayer && (
        <div className="flex items-center gap-3 border-t border-signal/25 bg-signal/[0.05] px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-signal text-ink-950" aria-hidden>
            <Zap size={16} fill="currentColor" />
          </span>
          <PlayerPhoto player={impactPlayer} className="size-9 shrink-0 text-xs" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{impactPlayer.name}</span>
              {isOverseas(impactPlayer) && <OverseasMark />}
            </div>
            <p className="text-xs text-haze">Impact player · {ROLE_META[impactPlayer.role]?.label}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-bold leading-none tabular">{Math.round(statFor(playerStats, impactPlayer.id).totalPoints)}</div>
            <div className="font-display text-[10px] uppercase tracking-wider text-haze">pts</div>
          </div>
        </div>
      )}
    </Panel>
  );
};

export default SquadPreview;
