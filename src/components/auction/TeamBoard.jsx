import React, { memo, useMemo, useState } from 'react';
import { Bot, ChevronDown, Crown } from 'lucide-react';
import TeamCrest from '../ui/TeamCrest';
import RatingBadge from '../ui/RatingBadge';
import Tag from '../ui/Tag';
import PlayerPhoto from '../ui/PlayerPhoto';
import { TEAMS } from '../../data/teams';
import { teamStrength, withPlayer } from '../../lib/catalog';
import { cn } from '../../lib/cn';
import { ROLES, ROLE_META, formatPrice, isOverseas, overseasUsage } from '../../lib/format';

// Every franchise in the room, ranked live by Arena Strength
const TeamBoard = ({ roomTeams, players, squadLimit, overseasLimit, myId }) => {
  const [openTeam, setOpenTeam] = useState(null);

  const rows = useMemo(() => TEAMS.map(t => {
    const entry = roomTeams.find(rt => rt.teamId === t.id);
    const manager = entry ? players.find(p => p.id === entry.userId) : null;
    const squad = entry?.squad ?? [];
    return { team: t, entry, manager, squad, strength: teamStrength(squad, squadLimit, overseasLimit) };
  })
    .filter(r => r.entry)
    .sort((a, b) => b.strength.score - a.strength.score || b.squad.length - a.squad.length), [roomTeams, players, squadLimit, overseasLimit]);

  const expanded = openTeam ?? rows.find(r => r.entry.userId === myId)?.team.id;

  return (
    <ol className="divide-y divide-white/6">
      {rows.map(({ team, entry, manager, squad, strength }, rank) => {
        const isOpen = expanded === team.id;
        const mine = entry.userId === myId;
        const roster = squad.map(withPlayer).filter(Boolean);
        const overseas = roster.filter(isOverseas).length;
        return (
          <li key={team.id} className={cn(mine && 'bg-volt/[0.04]')}>
            <button
              onClick={() => setOpenTeam(isOpen ? '' : team.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] cursor-pointer"
              aria-expanded={isOpen}
            >
              <span className="w-4 text-center font-display text-sm font-bold text-haze tabular">{rank + 1}</span>
              <TeamCrest teamId={team.id} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-display text-base font-bold uppercase">{team.id}</span>
                  {mine && <Tag tone="volt">You</Tag>}
                  {manager?.isBot && <Tag icon={Bot}>Bot</Tag>}
                  {manager?.isHost && <Crown size={12} className="text-gold" aria-label="Host" />}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-haze">
                  {!manager?.isBot && <span className={cn('size-1.5 rounded-full', manager?.isOnline ? 'bg-volt' : 'bg-ink-500')} />}
                  <span className="truncate">{manager?.name ?? 'Manager'}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block tabular font-display text-sm font-bold">{formatPrice(entry.budgetRemaining)}</span>
                <span className="block tabular text-[11px] text-haze">{squad.length}/{squadLimit} · OS {overseasUsage(overseas, overseasLimit, squadLimit)}</span>
              </span>
              {squad.length > 0 ? (
                <RatingBadge rating={strength.score} size="sm" />
              ) : (
                <span className="w-7 text-center font-display text-sm text-haze" aria-label="No strength yet">–</span>
              )}
              <ChevronDown size={14} className={cn('text-haze transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="space-y-3 px-3 pb-3">
                {strength.gaps.length > 0 && (
                  <div className="flex flex-wrap gap-1">{strength.gaps.map(g => <Tag key={g} tone="flare">{g}</Tag>)}</div>
                )}
                {roster.length === 0 ? (
                  <p className="text-xs text-haze">No players yet.</p>
                ) : (
                  ROLES.map(role => {
                    const group = roster.filter(p => p.role === role);
                    if (group.length === 0) return null;
                    return (
                      <div key={role}>
                        <div className="mb-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">
                          {ROLE_META[role].plural} · {group.length}
                        </div>
                        <ul className="space-y-1">
                          {group.map(p => (
                            <li key={p.id} className="flex items-center gap-2 text-sm">
                              <PlayerPhoto player={p} className="size-6" rounded="rounded-sm" />
                              <span className="min-w-0 flex-1 truncate">{p.name}{isOverseas(p) && <span className="ml-1 text-gold" title="Overseas">✈</span>}</span>
                              <RatingBadge rating={p.rating} size="sm" />
                              <span className="w-16 text-right tabular font-display text-sm text-mist">{formatPrice(p.bid)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default memo(TeamBoard);
