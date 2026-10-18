import React, { useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import Logo from '../ui/Logo';
import PlayerPhoto from '../ui/PlayerPhoto';
import RatingBadge from '../ui/RatingBadge';
import TeamCrest from '../ui/TeamCrest';
import { useToast } from '../../hooks/useToast';
import { PLAYERS_BY_ID, TEAMS_BY_ID, ratingOf } from '../../lib/catalog';
import { ROLE_META, formatPrice } from '../../lib/format';
import { shareElementAsImage } from '../../lib/shareImage';

// A signing graphic in the buyer's colours that can be shared from the feed
const SoldCard = ({ message }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { playerId, teamId, bid, buyerName } = message.metadata;
  const player = PLAYERS_BY_ID.get(playerId);
  const team = TEAMS_BY_ID.get(teamId);
  if (!player || !team) return null;

  const share = async () => {
    setBusy(true);
    try {
      await shareElementAsImage(ref.current, `${player.name.replace(/\s+/g, '-')}-${team.id}.png`, `${player.name} to ${team.name}`);
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ message: "Couldn't create the image. Try again.", tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-md border border-white/10 p-3"
        style={{ background: `linear-gradient(120deg, ${team.colors.primary}, #0a0f1f 70%)` }}
      >
        <span className="absolute inset-0 bg-stripes" aria-hidden />
        <div className="relative flex items-center gap-3">
          <PlayerPhoto player={player} className="size-16 shrink-0 border border-white/15" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Sold · {ROLE_META[player.role]?.short}</div>
            <div className="truncate font-display text-xl font-extrabold uppercase leading-tight">{player.name}</div>
            <div className="flex items-center gap-2">
              <span className="tabular font-display text-lg font-bold text-volt">{formatPrice(bid)}</span>
              <RatingBadge rating={ratingOf(player.id)} size="sm" />
            </div>
          </div>
          <TeamCrest teamId={team.id} size="md" className="border-white/20" />
        </div>
        <div className="relative mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/70">
          <span className="truncate">{team.name} · {buyerName} · #{team.motto.replace(/\s+/g, '')}</span>
          <Logo size="sm" className="origin-right scale-75" />
        </div>
      </div>
      <button
        onClick={share}
        disabled={busy}
        className="absolute right-2 top-2 rounded-sm bg-ink-950/70 p-1.5 text-mist opacity-100 transition hover:text-snow sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 cursor-pointer"
        aria-label={`Share ${player.name}'s signing`}
      >
        <Share2 size={14} className={busy ? 'animate-pulse' : ''} />
      </button>
    </div>
  );
};

export default SoldCard;
