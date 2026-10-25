import React, { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, Minus, Plane, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Tag from './ui/Tag';
import RatingBadge from './ui/RatingBadge';
import { cn } from '../lib/cn';
import { judgeXI } from '../lib/catalog';
import { ROLES, ROLE_META, isOverseas } from '../lib/format';
import { profileLines } from '../lib/playerProfile';
import { lineupProblem, lineupRules, suggestBattingOrder } from '../lib/lineup';

const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-haze transition-colors hover:bg-white/5 hover:text-snow cursor-pointer disabled:pointer-events-none disabled:opacity-30';

const roleOrder = (role) => (ROLES.includes(role) ? ROLES.indexOf(role) : ROLES.length);

// "Left-hand bat · Opener" for batters, the bowling line for bowlers
const PlayerLine = ({ player }) => (
  <span className="min-w-0 flex-1">
    <span className="flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight">
      <span className="truncate">{player.name}</span>
      {isOverseas(player) && <Plane size={12} className="shrink-0 text-signal" aria-label="Overseas" />}
    </span>
    <span className="block truncate text-xs text-haze">{profileLines(player)[0] ?? ROLE_META[player.role]?.label}</span>
  </span>
);

const XIRow = ({ player, slot, count, onMove, onBench }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={player}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-1.5 rounded-md border border-white/6 bg-ink-900 py-1 pl-1 pr-1.5"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 28px -8px rgb(0 0 0 / 0.6)', zIndex: 10 }}
    >
      <button
        type="button"
        className={cn(iconButton, 'cursor-grab touch-none active:cursor-grabbing')}
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${player.name}`}
        tabIndex={-1}
      >
        <GripVertical size={16} />
      </button>
      <span className="w-6 shrink-0 text-center font-display text-lg font-bold tabular text-signal">{slot}</span>
      <PlayerLine player={player} />
      <button type="button" className={iconButton} onClick={() => onMove(slot - 1, -1)} disabled={slot === 1} aria-label={`Move ${player.name} up`}>
        <ChevronUp size={16} />
      </button>
      <button type="button" className={iconButton} onClick={() => onMove(slot - 1, 1)} disabled={slot === count} aria-label={`Move ${player.name} down`}>
        <ChevronDown size={16} />
      </button>
      <button type="button" className={cn(iconButton, 'hover:text-flare')} onClick={() => onBench(player)} aria-label={`Move ${player.name} to the bench`}>
        <Minus size={16} />
      </button>
    </Reorder.Item>
  );
};

// Props: open, onClose, team (a results team: players, strength, battingOrder), lineup (from lineupFor),
// squadLimit, overseasLimit, onSave(playerIds) → Promise
const LineupEditor = ({ open, onClose, team, lineup, squadLimit, overseasLimit, onSave }) => {
  const [order, setOrder] = useState(lineup.xi);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { size, overseasCap } = lineupRules(team.players, squadLimit, overseasLimit);
  const ids = order.map(p => p.id);
  const inXI = new Set(ids);
  const bench = team.players.filter(p => !inXI.has(p.id)).sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || b.rating - a.rating);
  const overseasInXI = order.filter(isOverseas).length;
  const problem = lineupProblem(ids, team.players, squadLimit, overseasLimit);
  const unchanged = ids.join() === lineup.xi.map(p => p.id).join();
  const { gaps } = judgeXI(order, Math.min(11, squadLimit));

  const move = (index, by) => {
    const next = [...order];
    const [player] = next.splice(index, 1);
    next.splice(index + by, 0, player);
    setOrder(next);
  };
  const toBench = (player) => setOrder(order.filter(p => p !== player));
  const toXI = (player) => setOrder([...order, player]);
  const benchBlock = (player) => {
    if (order.length >= size) return 'XI full';
    if (isOverseas(player) && overseasInXI >= overseasCap) return 'Overseas full';
    return null;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(ids);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save your batting order.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="space-y-2">
      {(error || (problem && order.length === size)) && <p className="text-sm text-flare" role="alert">{error || problem}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setOrder(suggestBattingOrder(team.strength.bestXI).map(p => team.players.find(q => q.id === p.id)))}>
          Suggested
        </Button>
        <Button variant="volt" size="sm" onClick={save} loading={saving} disabled={Boolean(problem) || unchanged}>
          {order.length < size ? `Pick ${size - order.length} more` : 'Save batting order'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Your XI" subtitle="Drag or use the arrows to set your batting order." footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={order.length === size ? 'volt' : 'neutral'}>XI {order.length}/{size}</Tag>
          <Tag tone={overseasInXI > overseasCap ? 'flare' : 'signal'} icon={Plane}>Overseas {overseasInXI}/{overseasCap}</Tag>
          {order.length === size && gaps.map(gap => <Tag key={gap} tone="flare" icon={TriangleAlert}>{gap}</Tag>)}
        </div>

        {order.length > 0 ? (
          <Reorder.Group as="ol" axis="y" values={order} onReorder={setOrder} className="space-y-1.5" aria-label="Batting order">
            {order.map((player, index) => (
              <XIRow key={player.id} player={player} slot={index + 1} count={order.length} onMove={move} onBench={toBench} />
            ))}
          </Reorder.Group>
        ) : (
          <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-sm text-haze">Add players from the bench.</p>
        )}

        {bench.length > 0 && (
          <section>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-haze">
              Bench <span className="tabular text-mist">{bench.length}</span>
              <span className="h-px flex-1 bg-white/6" aria-hidden />
            </h3>
            <ul className="space-y-1">
              {bench.map(player => {
                const blocked = benchBlock(player);
                return (
                  <li key={player.id} className="flex items-center gap-2 rounded-md bg-white/[0.02] py-1 pl-2.5 pr-1.5">
                    <PlayerLine player={player} />
                    <RatingBadge rating={player.rating} size="sm" />
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Plus}
                      onClick={() => toXI(player)}
                      disabled={Boolean(blocked)}
                      aria-label={blocked ? `${player.name}: ${blocked}` : `Add ${player.name} to the XI`}
                      className="w-[5.5rem] shrink-0"
                    >
                      {blocked ?? 'XI'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs text-haze">
          Your XI and order show on your squad card and poster for everyone in the room. Arena Strength and the standings
          still judge your best XI.
        </p>
      </div>
    </Modal>
  );
};

export default LineupEditor;
