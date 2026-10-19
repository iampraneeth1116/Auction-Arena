import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Modal from '../ui/Modal';
import Segmented from '../ui/Segmented';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import TeamCrest from '../ui/TeamCrest';
import EmptyState from '../ui/EmptyState';
import { inputClasses } from '../ui/styles';
import { IPL_PLAYERS } from '../../data/players';
import { ratingOf } from '../../lib/catalog';
import { cn } from '../../lib/cn';
import { ROLES, ROLE_META, formatPrice, isOverseas } from '../../lib/format';

// Everyone in this auction's pool: what's coming, what sold, what didn't
// footer: optional content pinned under the list (the live bid bar, so bidding never stops)
const PlayerPoolModal = ({ open, onClose, playerOrder, currentIndex, currentPlayerId, roomTeams, footer }) => {
  const [tab, setTab] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');

  const groups = useMemo(() => {
    const sold = new Map();
    roomTeams.forEach(t => t.squad.forEach(s => sold.set(s.id, { bid: s.bid, teamId: t.teamId })));
    const order = playerOrder?.length ? playerOrder : IPL_PLAYERS.map((_, i) => i);
    const currentPos = currentIndex ?? order.findIndex(i => IPL_PLAYERS[i].id === currentPlayerId);
    // Unsold players can come back in a later round, so a player may appear twice:
    // the latest appearance decides where they're listed
    const latest = new Map();
    order.forEach((index, pos) => latest.set(IPL_PLAYERS[index].id, { index, pos }));
    const result = { upcoming: [], sold: [], unsold: [] };
    [...latest.values()].sort((a, b) => a.pos - b.pos).forEach(({ index, pos }) => {
      const player = { ...IPL_PLAYERS[index], rating: ratingOf(IPL_PLAYERS[index].id) };
      if (sold.has(player.id)) result.sold.push({ ...player, ...sold.get(player.id) });
      else if (pos < currentPos) result.unsold.push(player);
      else if (player.id !== currentPlayerId) result.upcoming.push(player);
    });
    result.sold.sort((a, b) => b.bid - a.bid);
    return result;
  }, [playerOrder, currentIndex, currentPlayerId, roomTeams]);

  const list = groups[tab].filter(p =>
    (role === 'all' || p.role === role) && (!query || p.name.toLowerCase().includes(query.toLowerCase())));

  return (
    <Modal open={open} onClose={onClose} title="Player pool" subtitle={`${new Set(playerOrder?.length ? playerOrder : IPL_PLAYERS.map((_, i) => i)).size} players in this auction`} wide footer={footer}>
      <div className="space-y-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'upcoming', label: 'Up next', count: groups.upcoming.length },
            { id: 'sold', label: 'Sold', count: groups.sold.length },
            { id: 'unsold', label: 'Unsold', count: groups.unsold.length },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-haze" />
            <input className={cn(inputClasses, 'h-10 pl-9')} placeholder="Search players" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search players" />
          </label>
          <div className="flex gap-1 overflow-x-auto">
            {['all', ...ROLES].map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn('h-10 shrink-0 rounded-md border px-3 font-display text-xs font-semibold uppercase tracking-wider cursor-pointer',
                  role === r ? 'border-signal bg-signal/10 text-signal' : 'border-ink-600 text-haze hover:text-mist')}
              >
                {r === 'all' ? 'All' : ROLE_META[r].short}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState title="No players here">{tab === 'sold' ? 'Nobody has been bought yet.' : tab === 'unsold' ? 'No lot has gone unsold yet.' : 'Nothing matches.'}</EmptyState>
        ) : (
          <ul className="divide-y divide-white/6">
            {list.slice(0, 200).map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {tab === 'upcoming' && <span className="w-6 text-right font-display text-xs text-haze tabular">{i + 1}</span>}
                <PlayerPhoto player={p} className="size-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}{isOverseas(p) && <span className="ml-1 text-gold">✈</span>}</div>
                  <div className="truncate text-xs text-haze">{ROLE_META[p.role]?.label} · {p.set}</div>
                </div>
                <RatingBadge rating={p.rating} size="sm" />
                {tab === 'sold' && <TeamCrest teamId={p.teamId} size="xs" />}
                <span className="w-20 text-right tabular font-display text-sm font-semibold">{formatPrice(tab === 'sold' ? p.bid : p.basePrice)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default PlayerPoolModal;
