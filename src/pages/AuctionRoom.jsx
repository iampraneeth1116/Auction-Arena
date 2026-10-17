import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Gavel, House, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuction } from '../hooks/useAuction';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PLAYERS_BY_ID, TEAMS_BY_ID, ratingOf } from '../lib/catalog';
import { ROLE_META, bidButtonLabel, formatPrice, isOverseas, maxBidFor, nextBid } from '../lib/format';
import { cn } from '../lib/cn';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Stat from '../components/ui/Stat';
import Tag, { LiveTag } from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import { buttonClasses } from '../components/ui/styles';

// The countdown bar and number, from the server's deadline
const Countdown = ({ secondsLeft, bidTimer }) => {
  const share = Math.max(0, Math.min(1, secondsLeft / bidTimer));
  return (
    <div className="flex items-center gap-4">
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-ink-700" aria-hidden>
        <div
          className={cn('h-full transition-[width] duration-200', secondsLeft <= 3 ? 'bg-flare' : 'bg-signal')}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className={cn('w-10 text-right font-display text-3xl font-bold tabular', secondsLeft <= 3 && 'text-flare')} aria-live="off">
        {secondsLeft}
      </span>
    </div>
  );
};

const AuctionRoom = () => {
  const { id = '' } = useParams();
  const roomCode = id.trim().toUpperCase();
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentAuction, roomTeams, team, roomError, joinAuction, placeBid, getSyncedTime } = useAuction();
  useDocumentTitle(`Auction ${roomCode}`);
  const [timeLeft, setTimeLeft] = useState(0);
  const [bidding, setBidding] = useState(false);

  useEffect(() => (user ? joinAuction(roomCode) : undefined), [user, roomCode, joinAuction]);

  const room = currentAuction?.id === roomCode ? currentAuction : null;
  const live = room?.currentAuction ?? null;

  // Count down to the server's deadline, using the server's clock
  useEffect(() => {
    if (live?.status !== 'bidding') return undefined;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((live.timerEndsAt - getSyncedTime()) / 1000)));
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [live?.status, live?.timerEndsAt, getSyncedTime]);
  const secondsLeft = live?.status === 'bidding' ? timeLeft : 0;

  if (!user) {
    return (
      <PageShell className="py-16">
        <p className="text-mist">Sign in on the <Link to="/" className="text-signal">home page</Link> to follow room {roomCode}.</p>
      </PageShell>
    );
  }
  if (roomError) {
    return (
      <PageShell className="space-y-4 py-16">
        <p className="font-display text-3xl font-bold uppercase">{roomError.message}</p>
        <Link to="/" className={buttonClasses({ variant: 'outline' })}><House size={16} /> Home</Link>
      </PageShell>
    );
  }
  if (!room) return <Spinner className="min-h-dvh" />;

  if (room.status === 'completed') {
    return (
      <PageShell className="py-10">
        <Panel accent="gold" bodyClassName="space-y-4 p-6 text-center">
          <Trophy size={32} className="mx-auto text-gold" />
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Auction complete</h1>
          <ul className="mx-auto max-w-md divide-y divide-white/6 text-left">
            {roomTeams.map(t => (
              <li key={t.teamId} className="flex items-center gap-3 py-2">
                <TeamCrest teamId={t.teamId} size="sm" />
                <span className="flex-1 font-display font-semibold uppercase">{t.teamName}</span>
                <span className="tabular text-sm text-mist">{t.squad.length} players · {formatPrice(t.budgetRemaining)} left</span>
              </li>
            ))}
          </ul>
          <Link to="/" className={buttonClasses({ variant: 'outline' })}><House size={16} /> Home</Link>
        </Panel>
      </PageShell>
    );
  }

  const player = PLAYERS_BY_ID.get(live?.playerId);
  const bidTimer = room.settings?.bidTimer ?? 10;
  const lot = (room.currentIndex ?? 0) + 1;
  const lots = room.playerOrder?.length ?? 0;
  const leaderTeam = TEAMS_BY_ID.get(live?.highBidderTeamId);
  const nextAmount = player ? nextBid(live?.currentBid || 0, player.basePrice) : 0;

  // Your desk: what the next bid costs and whether you can make it (the server checks the same rules)
  const squadLimit = room.squadLimit;
  const overseasLimit = room.overseasLimit;
  const overseasCount = (team?.squad ?? []).filter(s => isOverseas(PLAYERS_BY_ID.get(s.id))).length;
  let bidState = 'open';
  if (!team) bidState = 'spectating';
  else if (live?.status !== 'bidding' || secondsLeft === 0) bidState = 'closed';
  else if (live.highBidderId === user.uid) bidState = 'leading';
  else if (team.squad.length >= squadLimit) bidState = 'full';
  else if (isOverseas(player) && overseasCount >= overseasLimit) bidState = 'overseas';
  else if (team.budgetRemaining < nextAmount) bidState = 'budget';

  const handleBid = async () => {
    if (bidState !== 'open') return;
    setBidding(true);
    try {
      await placeBid(nextAmount);
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
    } finally {
      setBidding(false);
    }
  };

  return (
    <PageShell wide className="space-y-4 py-4 sm:py-6" right={<LiveTag />}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold uppercase tracking-[0.12em]">Room {roomCode}</h1>
        <span className="tabular text-sm text-haze">Lot {lot} of {lots}</span>
      </div>

      {player ? (
        <Panel accent={live.status === 'sold' ? 'volt' : live.status === 'unsold' ? 'flare' : 'signal'} bodyClassName="grid gap-6 p-4 sm:grid-cols-[11rem_1fr] sm:p-6">
          <div className="relative w-32 sm:w-44">
            <PlayerPhoto player={player} className="aspect-[4/5] w-full" />
            <RatingBadge rating={ratingOf(player.id)} size="lg" className="absolute -bottom-3 -right-3" />
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="signal">{ROLE_META[player.role]?.label ?? player.role}</Tag>
                <Tag>{player.country}</Tag>
                {isOverseas(player) && <Tag tone="gold">Overseas</Tag>}
                <Tag>{player.set}</Tag>
              </div>
              <h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-6xl">{player.name}</h2>
              <p className="mt-1 text-sm text-mist">Base {formatPrice(player.basePrice)}</p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <Stat label="Current bid" size="lg" tone="signal" value={live.currentBid ? formatPrice(live.currentBid) : '—'} />
              <div className="flex items-center gap-2 text-right">
                <div>
                  <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">Leading</p>
                  <p className="font-display text-lg font-bold uppercase">{live.currentBid ? live.highBidderName : 'No bids'}</p>
                </div>
                {leaderTeam && <TeamCrest teamId={leaderTeam.id} size="md" />}
              </div>
            </div>

            {live.status === 'bidding' ? (
              <Countdown secondsLeft={secondsLeft} bidTimer={bidTimer} />
            ) : (
              <p className={cn('font-display text-4xl font-extrabold uppercase', live.status === 'sold' ? 'text-volt' : 'text-flare')}>
                {live.status === 'sold' ? `Sold · ${formatPrice(live.currentBid)}` : 'Unsold'}
              </p>
            )}
          </div>
        </Panel>
      ) : (
        <Spinner label="Bringing out the first player" />
      )}

      <Panel bodyClassName="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <TeamCrest teamId={team?.teamId} size="md" />
          <div className="grid flex-1 grid-cols-2 gap-4 sm:max-w-xl sm:grid-cols-4">
            <Stat label="Your purse" value={team ? formatPrice(team.budgetRemaining) : '—'} tone="volt" />
            <Stat label="Squad" value={team ? `${team.squad.length}/${squadLimit}` : '—'} />
            <Stat label="Overseas" value={team ? `${overseasCount}/${overseasLimit}` : '—'} tone={bidState === 'overseas' ? 'flare' : undefined} />
            <Stat
              label="Max bid"
              value={team ? formatPrice(maxBidFor(team, squadLimit)) : '—'}
              hint="keeps ₹30 L a slot"
            />
          </div>
        </div>
        <Button
          variant="volt"
          size="lg"
          slant
          icon={Gavel}
          loading={bidding}
          disabled={bidState !== 'open'}
          onClick={handleBid}
          className="sm:min-w-64"
        >
          {bidButtonLabel(bidState, nextAmount)}
        </Button>
      </Panel>
    </PageShell>
  );
};

export default AuctionRoom;
