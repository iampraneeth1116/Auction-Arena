import React, { useState } from 'react';
import { Bot, Crown, Eye, UserMinus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import TeamCrest from '../ui/TeamCrest';
import Tag from '../ui/Tag';
import { cn } from '../../lib/cn';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Who's in the room during the auction; the host can remove people (bots stay until it ends)
const ParticipantsModal = ({ open, onClose, players, spectatorCount, isHost, onKick }) => {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const people = players.filter(p => !p.isBot).length;
  // Host first, people before bots
  const ordered = [...players].sort((a, b) => Number(b.isHost) - Number(a.isHost) || Number(a.isBot) - Number(b.isBot));

  const kick = async () => {
    setBusy(true);
    try {
      await onKick(target);
    } finally {
      setBusy(false);
      setTarget(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="In the room"
        subtitle={`${people === 1 ? '1 person' : `${people} people`} · ${plural(players.length - people, 'bot')} · ${spectatorCount} watching`}
      >
        <ul className="divide-y divide-white/6">
          {ordered.map(p => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <TeamCrest teamId={p.team} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.isHost && <Crown size={13} className="shrink-0 text-gold" aria-label="Host" />}
                  {p.isBot && <Tag icon={Bot}>Bot</Tag>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-haze">
                  <span className={cn('size-1.5 rounded-full', p.isOnline ? 'bg-volt' : 'bg-ink-500')} aria-hidden />
                  {p.team ? p.teamName : 'No franchise'}
                </div>
              </div>
              {isHost && !p.isHost && !p.isBot && (
                <Button variant="danger" size="sm" icon={UserMinus} onClick={() => setTarget(p)}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
        {spectatorCount > 0 && (
          <p className="mt-2 flex items-center gap-2 border-t border-white/6 pt-3 text-xs text-haze">
            <Eye size={13} aria-hidden /> {spectatorCount} watching without a franchise
          </p>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(target)}
        title={`Remove ${target?.name}?`}
        message="They'll be taken out of the auction, their squad goes with them, and they can't rejoin this room."
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        onConfirm={kick}
        onCancel={() => setTarget(null)}
      />
    </>
  );
};

export default ParticipantsModal;
