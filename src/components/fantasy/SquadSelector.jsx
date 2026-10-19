import React, { useState } from 'react';
import { Check, Lock, LockOpen, Plane, Plus, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ROLES, ROLE_META, isOverseas } from '../../lib/format';
import { useToast } from '../../hooks/useToast';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import Tag from '../ui/Tag';
import PlayerPhoto from '../ui/PlayerPhoto';

const MAX_XI = 11;
const MIN_XI = 5;
const MAX_OVERSEAS = 4;

const avgPoints = (stat) => (stat && stat.matches > 0 ? (stat.totalPoints / stat.matches).toFixed(1) : null);

const toggleClasses = (active, activeTone) => cn(
  'inline-flex h-8 items-center justify-center gap-1 rounded-md border font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
  'disabled:cursor-not-allowed disabled:opacity-35',
  active ? activeTone : 'border-ink-500 bg-ink-900/60 text-mist hover:border-mist hover:text-snow',
);

const Summary = ({ label, value, ok }) => (
  <div className="min-w-0 rounded-md border border-white/6 bg-ink-900/50 px-3 py-2">
    <div className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">{label}</div>
    <div className={cn('truncate font-display text-base font-bold tabular', ok ? 'text-snow' : 'text-haze')}>{value}</div>
  </div>
);

const SquadSelector = ({
  ownedPlayers = [],
  currentSquad = null,
  playerStats = {},
  onSave,
  onCancel,
  isLocked = false,
}) => {
  const { toast } = useToast();
  // Start from the saved squad. FantasyDashboard only mounts the editor after it has loaded.
  const [selectedIds, setSelectedIds] = useState(() => currentSquad?.players || []);
  const [impactId, setImpactId] = useState(() => currentSquad?.impactPlayer || null);
  const [captainId, setCaptainId] = useState(() => currentSquad?.captain || null);
  const [viceCaptainId, setViceCaptainId] = useState(() => currentSquad?.viceCaptain || null);
  const [saving, setSaving] = useState(false);

  const warn = (message) => toast({ message, tone: 'error' });
  const byId = (id) => ownedPlayers.find(p => p.id === id);
  const overseasInXI = selectedIds.filter(id => isOverseas(byId(id))).length;

  const togglePlayer = (id) => {
    if (isLocked) return;
    const player = byId(id);
    if (!player) return;

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(pId => pId !== id));
      if (captainId === id) setCaptainId(null);
      if (viceCaptainId === id) setViceCaptainId(null);
      return;
    }
    if (selectedIds.length >= MAX_XI) return;
    if (isOverseas(player) && overseasInXI >= MAX_OVERSEAS) {
      warn('Maximum 4 overseas players allowed in the XI.');
      return;
    }
    // A player can't be in the XI and be the impact player
    if (impactId === id) setImpactId(null);
    setSelectedIds([...selectedIds, id]);
  };

  const setAsImpact = (id) => {
    if (isLocked) return;
    const player = byId(id);
    if (!player) return;

    // With four overseas players in the XI, the impact player has to be Indian
    if (impactId !== id && isOverseas(player) && overseasInXI >= MAX_OVERSEAS) {
      warn('Impact player cannot be overseas if 4 overseas players are already in the XI.');
      return;
    }
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(pId => pId !== id));
      if (captainId === id) setCaptainId(null);
      if (viceCaptainId === id) setViceCaptainId(null);
    }
    setImpactId(impactId === id ? null : id);
  };

  const handleSave = async () => {
    if (selectedIds.length < MIN_XI) {
      warn('Please select at least 5 players.');
      return;
    }
    if (!captainId || !viceCaptainId) {
      warn('Please select a Captain and Vice-Captain.');
      return;
    }
    if (impactId && isOverseas(byId(impactId)) && overseasInXI >= MAX_OVERSEAS) {
      warn('Impact player cannot be overseas if 4 overseas players are already in the XI.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        players: selectedIds,
        impactPlayer: impactId,
        captain: captainId,
        viceCaptain: viceCaptainId,
      });
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (id) => byId(id)?.name ?? '—';

  return (
    <div className="space-y-3">
      <Panel
        accent="volt"
        label="Pick your fantasy XI"
        actions={isLocked ? <Tag tone="flare" icon={Lock}>Locked</Tag> : <Tag tone="volt" icon={LockOpen}>Edits open</Tag>}
        bodyClassName="space-y-4 p-4"
      >
        <p className="text-sm text-mist">
          Pick {MIN_XI} to {MAX_XI} of the players you bought, with up to {MAX_OVERSEAS} from overseas. Your captain scores
          double and your vice-captain 1.5x. An impact player from outside the XI adds their points too.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Summary label="Playing XI" value={`${selectedIds.length}/${MAX_XI}`} ok={selectedIds.length >= MIN_XI} />
          <Summary label="Overseas" value={`${overseasInXI}/${MAX_OVERSEAS}`} ok />
          <Summary label="Captain" value={captainId ? nameOf(captainId) : 'Not set'} ok={Boolean(captainId)} />
          <Summary label="Vice-captain" value={viceCaptainId ? nameOf(viceCaptainId) : 'Not set'} ok={Boolean(viceCaptainId)} />
          <Summary label="Impact player" value={impactId ? nameOf(impactId) : 'None'} ok={Boolean(impactId)} />
        </div>

        {ownedPlayers.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-500 px-4 py-6 text-center text-sm text-haze">
            You didn&apos;t buy any players, so there&apos;s no one to pick.
          </p>
        )}

        {ROLES.map(role => {
          const players = ownedPlayers.filter(p => p.role === role);
          if (players.length === 0) return null;
          return (
            <section key={role}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-haze">
                {ROLE_META[role].plural}
                <span className="h-px flex-1 bg-white/6" aria-hidden />
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {players.map(player => {
                  const inXI = selectedIds.includes(player.id);
                  const isImpact = impactId === player.id;
                  const isCaptain = captainId === player.id;
                  const isVice = viceCaptainId === player.id;
                  const avg = avgPoints(playerStats[player.id]);
                  return (
                    <li
                      key={player.id}
                      className={cn(
                        'rounded-md border p-2.5 transition-colors',
                        inXI ? 'border-volt/40 bg-volt/[0.05]' : isImpact ? 'border-signal/40 bg-signal/[0.05]' : 'border-white/8 bg-ink-900/50',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="relative shrink-0">
                          <PlayerPhoto player={player} className="size-10 text-xs" />
                          {(isCaptain || isVice) && (
                            <span className={cn('absolute -right-1.5 -top-1.5 rounded-sm px-1 font-display text-[10px] font-bold leading-4', isCaptain ? 'bg-gold text-ink-950' : 'bg-snow text-ink-950')}>
                              {isCaptain ? 'C' : 'VC'}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{player.name}</span>
                            {isOverseas(player) && (
                              <span className="shrink-0 text-signal" title="Overseas player">
                                <Plane size={12} aria-hidden />
                                <span className="sr-only">Overseas</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-haze">
                            {ROLE_META[player.role]?.short} · {avg ? <span className="tabular text-mist">{avg} pts a match</span> : 'No matches yet'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          aria-pressed={inXI}
                          disabled={isLocked || (selectedIds.length >= MAX_XI && !inXI)}
                          onClick={() => togglePlayer(player.id)}
                          className={cn(toggleClasses(inXI, 'border-volt bg-volt text-ink-950'), 'flex-1')}
                        >
                          {inXI ? <><Check size={13} strokeWidth={3} aria-hidden /> In XI</> : <><Plus size={13} strokeWidth={3} aria-hidden /> Add to XI</>}
                        </button>
                        <button
                          type="button"
                          aria-pressed={isCaptain}
                          aria-label={`Make ${player.name} captain`}
                          title="Captain (2x points)"
                          disabled={isLocked || !inXI}
                          onClick={() => { setCaptainId(isCaptain ? null : player.id); if (isVice) setViceCaptainId(null); }}
                          className={cn(toggleClasses(isCaptain, 'border-gold bg-gold text-ink-950'), 'w-9')}
                        >
                          C
                        </button>
                        <button
                          type="button"
                          aria-pressed={isVice}
                          aria-label={`Make ${player.name} vice-captain`}
                          title="Vice-captain (1.5x points)"
                          disabled={isLocked || !inXI}
                          onClick={() => { setViceCaptainId(isVice ? null : player.id); if (isCaptain) setCaptainId(null); }}
                          className={cn(toggleClasses(isVice, 'border-snow bg-snow text-ink-950'), 'w-10')}
                        >
                          VC
                        </button>
                        <button
                          type="button"
                          aria-pressed={isImpact}
                          aria-label={`Make ${player.name} the impact player`}
                          title="Impact player"
                          disabled={isLocked}
                          onClick={() => setAsImpact(player.id)}
                          className={cn(toggleClasses(isImpact, 'border-signal bg-signal text-ink-950'), 'w-9')}
                        >
                          <Zap size={14} fill={isImpact ? 'currentColor' : 'none'} aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </Panel>

      {!isLocked && (
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t border-white/8 bg-ink-900/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border">
          <p className="min-w-0 flex-1 truncate text-xs text-mist">
            <span className="font-semibold tabular text-snow">{selectedIds.length}/{MAX_XI}</span> picked
            <span className="hidden sm:inline"> · captain {captainId ? 'set' : 'missing'} · vice-captain {viceCaptainId ? 'set' : 'missing'}</span>
          </p>
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>}
          <Button variant="volt" size="sm" loading={saving} onClick={handleSave}>Save XI</Button>
        </div>
      )}
    </div>
  );
};

export default SquadSelector;
