import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Check, Copy, Home, MessageSquare, Radio, ShieldAlert, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuction } from '../hooks/useAuction';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PLAYERS_BY_ID } from '../lib/catalog';
import { MODE_META, formatPrice, isOverseas, maxBidFor, nextBid } from '../lib/format';
import { cn } from '../lib/cn';
import Logo from '../components/ui/Logo';
import Panel from '../components/ui/Panel';
import Spinner from '../components/ui/Spinner';
import { LiveTag } from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import { buttonClasses } from '../components/ui/styles';
import TextChat from '../components/TextChat';
import LotCard from '../components/auction/LotCard';
import PriceBoard from '../components/auction/PriceBoard';
import BidConsole from '../components/auction/BidConsole';

const FullScreenNotice = ({ icon: Icon, title, children }) => (
  <div className="flex min-h-dvh items-center justify-center bg-grid px-4">
    <Panel accent="flare" className="w-full max-w-md text-center" bodyClassName="p-8">
      <Icon size={40} className="mx-auto text-flare" />
      <h1 className="mt-4 font-display text-3xl font-extrabold uppercase">{title}</h1>
      <p className="mt-2 text-mist">{children}</p>
      <Link to="/" className={cn(buttonClasses({ variant: 'outline' }), 'mt-6')}><Home size={16} /> Back home</Link>
    </Panel>
  </div>
);

// Until the results page exists, a finished auction shows each franchise's haul here
const AuctionComplete = ({ roomTeams }) => (
  <div className="flex min-h-dvh items-center justify-center bg-grid px-4 py-10">
    <Panel accent="gold" className="w-full max-w-lg" bodyClassName="space-y-4 p-6 text-center">
      <Trophy size={32} className="mx-auto text-gold" />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Auction complete</h1>
      <ul className="divide-y divide-white/6 text-left">
        {roomTeams.map(t => (
          <li key={t.teamId} className="flex items-center gap-3 py-2">
            <TeamCrest teamId={t.teamId} size="sm" />
            <span className="flex-1 font-display font-semibold uppercase">{t.teamName}</span>
            <span className="tabular text-sm text-mist">{t.squad.length} players · {formatPrice(t.budgetRemaining)} left</span>
          </li>
        ))}
      </ul>
      <Link to="/" className={buttonClasses({ variant: 'outline' })}><Home size={16} /> Home</Link>
    </Panel>
  </div>
);

const AuctionRoom = () => {
  const { id: rawId } = useParams();
  const id = rawId.toUpperCase();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { currentAuction, roomTeams, team, loading, roomError, joinAuction, placeBid, getSyncedTime } = useAuction();
  useDocumentTitle(`Live ${id}`);

  const [optimistic, setOptimistic] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState('stage');

  useEffect(() => (user?.uid ? joinAuction(id) : undefined), [id, user?.uid, joinAuction]);

  // Show our own bid at once, until the server's state catches up, moves on or stops bidding
  const serverLive = currentAuction?.currentAuction ?? null;
  const optimisticPending = Boolean(optimistic) &&
    serverLive?.playerId === optimistic.playerId &&
    serverLive?.status === 'bidding' &&
    (serverLive?.currentBid || 0) < optimistic.currentBid;
  const live = optimisticPending ? optimistic : serverLive;

  // Countdown from the server's clock
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

  const player = PLAYERS_BY_ID.get(live?.playerId);
  const playerOrder = currentAuction?.playerOrder ?? [];
  const lotIndex = currentAuction?.currentIndex ?? -1;
  const players = currentAuction?.players ?? [];
  const squadLimit = currentAuction?.squadLimit ?? 25;
  const overseasLimit = currentAuction?.overseasLimit ?? 8;
  const bidTimer = currentAuction?.settings?.bidTimer ?? 10;
  const leaderName = players.find(p => p.id === live?.highBidderId)?.name ?? live?.highBidderName;

  // Your desk: what the next bid costs and whether you can make it (the server checks the same rules)
  const overseasCount = (team?.squad ?? []).filter(s => isOverseas(PLAYERS_BY_ID.get(s.id))).length;
  const nextAmount = player ? nextBid(live?.currentBid || 0, player.basePrice) : 0;
  const maxBid = maxBidFor(team, squadLimit);
  let bidState = 'open';
  if (!team) bidState = 'spectating';
  else if (!live || live.status !== 'bidding' || secondsLeft === 0) bidState = 'closed';
  else if (live.highBidderId === user?.uid) bidState = 'leading';
  else if ((team.squad?.length ?? 0) >= squadLimit) bidState = 'full';
  else if (isOverseas(player) && overseasCount >= overseasLimit) bidState = 'overseas';
  else if (team.budgetRemaining < nextAmount) bidState = 'budget';

  const handleBid = async () => {
    if (bidState !== 'open' || !team) return;
    setOptimistic({
      ...live,
      currentBid: nextAmount,
      highBidderId: user.uid,
      highBidderName: user.displayName,
      highBidderTeamId: team.teamId,
      timerEndsAt: getSyncedTime() + bidTimer * 1000,
    });
    try {
      await placeBid(nextAmount);
    } catch (err) {
      setOptimistic(null);
      toast({ message: err.message, tone: 'error' });
    }
  };

  // Press B to bid (ignored while typing)
  const bidRef = useRef(handleBid);
  useEffect(() => {
    bidRef.current = handleBid;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'b' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      bidRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tell a manager the moment someone takes the lead from them
  const lastLeader = useRef(null);
  useEffect(() => {
    if (!serverLive) return;
    const previous = lastLeader.current;
    lastLeader.current = { playerId: serverLive.playerId, leader: serverLive.highBidderId };
    if (
      previous?.playerId === serverLive.playerId && previous.leader === user?.uid &&
      serverLive.highBidderId && serverLive.highBidderId !== user?.uid && serverLive.status === 'bidding'
    ) {
      toast({ message: `Outbid: ${serverLive.highBidderTeamId} went to ${formatPrice(serverLive.currentBid)}`, tone: 'error', duration: 2500 });
    }
  }, [serverLive, user?.uid, toast]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ message: `Room code: ${id}`, tone: 'info' });
    }
  };

  // ─── Before the stage ───
  if (authLoading) return <Spinner className="min-h-dvh" />;
  if (!user) return <Navigate to={`/lobby/${id}`} replace />;
  if (roomError?.code === 'kicked' || currentAuction?.bannedPlayers?.includes(user.uid)) {
    return <FullScreenNotice icon={ShieldAlert} title="Removed from room">The host removed you from this auction.</FullScreenNotice>;
  }
  if (roomError && !currentAuction) {
    return <FullScreenNotice icon={Radio} title="Room not found">There's no auction with the code {id}. Check the code and try again.</FullScreenNotice>;
  }
  if (loading || !currentAuction) return <Spinner className="min-h-dvh" />;
  if (currentAuction.status === 'waiting') return <Navigate to={`/lobby/${id}`} replace />;
  if (currentAuction.status === 'completed') return <AuctionComplete roomTeams={roomTeams} />;

  // ─── The stage ───
  const stage = (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
      <Panel accent="signal" className="relative" bodyClassName="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="clip-slant-r bg-signal/15 py-1 pl-2.5 pr-5 font-display text-xs font-bold uppercase tracking-[0.18em] text-signal">
            On the block
          </span>
          <span className="truncate font-display text-xs uppercase tracking-wider text-haze">
            {player?.set}{lotIndex >= 0 && ` · Lot ${lotIndex + 1}/${playerOrder.length}`}
          </span>
        </div>
        {player && <LotCard player={player} lot={null} />}
        <div className="h-px bg-white/6" />
        <PriceBoard live={live} timeLeft={live?.status === 'bidding' ? timeLeft : 0} bidTimer={bidTimer} leaderName={leaderName} basePrice={player?.basePrice} />
        {(live?.status === 'sold' || live?.status === 'unsold') && (
          <p className={cn('text-center font-display text-4xl font-extrabold uppercase tracking-wide', live.status === 'sold' ? 'text-volt' : 'text-flare')}>
            {live.status === 'sold' ? `Sold to ${live.highBidderTeamId} · ${formatPrice(live.currentBid)}` : 'Unsold'}
          </p>
        )}
      </Panel>

      <div className="sticky bottom-16 z-10 -mx-3 bg-ink-950/90 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <BidConsole
          team={team}
          squadLimit={squadLimit}
          overseasLimit={overseasLimit}
          overseasCount={overseasCount}
          maxBid={maxBid}
          nextAmount={nextAmount}
          state={bidState}
          onBid={handleBid}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-grid">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/6 bg-ink-950/90 px-2 backdrop-blur sm:px-4">
        <Link to="/" aria-label="Auction Arena home" className="flex items-center">
          <span className="h-5 w-2 -skew-x-12 bg-signal sm:hidden" aria-hidden />
          <span className="hidden sm:inline-flex"><Logo size="sm" /></span>
        </Link>
        <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden />
        <LiveTag />
        <button onClick={copyCode} className="flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-base font-bold tracking-[0.2em] hover:bg-white/5 cursor-pointer" aria-label="Copy room code">
          {id} {copied ? <Check size={14} className="text-volt" /> : <Copy size={14} className="text-haze" />}
        </button>
        <span className="hidden font-display text-sm uppercase tracking-wider text-haze md:inline">
          {MODE_META[currentAuction.auctionType]?.short}
        </span>
        {team && (
          <span className="ml-auto flex items-center gap-2">
            <TeamCrest teamId={team.teamId} size="sm" />
            <span className="hidden font-display text-sm font-semibold uppercase tracking-wide sm:inline">{team.teamName}</span>
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Stage (always on large screens; one of the tabs on phones) */}
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pb-16 lg:pb-0">
          <div className={cn(mobileTab !== 'stage' && 'hidden lg:block')}>{stage}</div>
          {mobileTab === 'chat' && (
            <div className="h-[calc(100dvh-7.5rem)] lg:hidden"><TextChat roomId={id} canChat={Boolean(team)} /></div>
          )}
        </main>

        {/* Chat beside the stage on large screens */}
        <aside className="hidden w-96 shrink-0 flex-col border-l border-white/6 bg-ink-900/50 lg:flex">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/6 px-4">
            <MessageSquare size={14} className="text-haze" aria-hidden />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-mist">Room chat</span>
          </div>
          <div className="min-h-0 flex-1">
            <TextChat roomId={id} canChat={Boolean(team)} className="h-full" />
          </div>
        </aside>
      </div>

      {/* Phone tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-2 border-t border-white/8 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {[
          { id: 'stage', label: 'Stage', icon: Radio },
          { id: 'chat', label: 'Chat', icon: MessageSquare },
        ].map(({ id: tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn('relative flex flex-col items-center justify-center gap-0.5 font-display text-xs font-semibold uppercase tracking-wider cursor-pointer',
              mobileTab === tab ? 'text-signal' : 'text-haze')}
            aria-current={mobileTab === tab ? 'page' : undefined}
          >
            {mobileTab === tab && <span className="absolute inset-x-6 top-0 h-0.5 bg-signal" aria-hidden />}
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default AuctionRoom;
