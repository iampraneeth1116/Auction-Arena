import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check, Copy, Eye, History, Home, List, MessageSquare, Pause, Play, Radio, Settings, ShieldAlert, Square, Trophy, Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuction } from '../hooks/useAuction';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRoomSounds } from '../hooks/useRoomSounds';
import { useAuctioneer } from '../hooks/useAuctioneer';
import { IPL_PLAYERS } from '../data/players';
import { PLAYERS_BY_ID } from '../lib/catalog';
import { MODE_META, formatPrice, isOverseas, maxBidFor, nextBid } from '../lib/format';
import { cn } from '../lib/cn';
import Logo from '../components/ui/Logo';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Segmented from '../components/ui/Segmented';
import PageLoader from '../components/PageLoader';
import Tag, { LiveTag } from '../components/ui/Tag';
import Ticker, { TickerItem } from '../components/ui/Ticker';
import TeamCrest from '../components/ui/TeamCrest';
import { buttonClasses } from '../components/ui/styles';
import TextChat from '../components/TextChat';
import LotCard from '../components/auction/LotCard';
import PriceBoard from '../components/auction/PriceBoard';
import BidConsole from '../components/auction/BidConsole';
import ResultBanner from '../components/auction/ResultBanner';
import RoomSettingsModal from '../components/auction/RoomSettingsModal';
import PlayerPoolModal from '../components/auction/PlayerPoolModal';
import ParticipantsModal from '../components/auction/ParticipantsModal';
import ClaimFranchise from '../components/auction/ClaimFranchise';
import LiveBidBar from '../components/auction/LiveBidBar';
import BidTrail from '../components/auction/BidTrail';
import UpNext from '../components/auction/UpNext';
import TeamBoard from '../components/auction/TeamBoard';
import ActivityFeed from '../components/auction/ActivityFeed';

const IconButton = ({ icon: Icon, label, onClick, className }) => (
  <button
    onClick={onClick}
    className={cn('flex size-9 items-center justify-center rounded-md text-mist hover:bg-white/5 hover:text-snow cursor-pointer', className)}
    aria-label={label}
    title={label}
  >
    <Icon size={18} />
  </button>
);

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

const AuctionRoom = () => {
  const { id: rawId } = useParams();
  const id = rawId.toUpperCase();
  // ?watch=1: follow the auction from the stands without joining it
  const [searchParams] = useSearchParams();
  const wantsToWatch = searchParams.get('watch') === '1';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const {
    currentAuction, roomTeams, team, loading, roomError, messages, bidTrail,
    joinAuction, joinRoom, placeBid, pauseAuction, resumeAuction, endAuction, updateRoomSettings, kickPlayer, getSyncedTime,
  } = useAuction();
  const spectating = wantsToWatch && !team;
  useDocumentTitle(`${spectating ? 'Watching' : 'Live'} ${id}`);

  const [optimistic, setOptimistic] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState('stage');
  const [sideTab, setSideTab] = useState('feed');
  const [overlay, setOverlay] = useState(null); // 'pool' | 'people' | 'settings' | 'end'
  const wideScreen = useMediaQuery('(min-width: 1280px)');

  // Follow the room live. Arriving here doesn't make you a member: a latecomer only joins by
  // claiming a franchise, so anyone who chooses to watch counts as watching.
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

  const sounds = useRoomSounds({ live, timeLeft: secondsLeft });
  const voice = useAuctioneer({ live, roomStatus: currentAuction?.status });

  const player = PLAYERS_BY_ID.get(live?.playerId);
  const playerOrder = useMemo(() => currentAuction?.playerOrder ?? [], [currentAuction?.playerOrder]);
  const lotIndex = currentAuction?.currentIndex ?? -1;
  const round = currentAuction?.round ?? 1;
  const upNext = useMemo(
    () => (lotIndex >= 0 ? playerOrder.slice(lotIndex + 1, lotIndex + 5).map(i => IPL_PLAYERS[i]) : []),
    [playerOrder, lotIndex],
  );
  const players = currentAuction?.players ?? [];
  const isHost = currentAuction?.hostId === user?.uid;
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
  else if (!live || live.status === 'paused') bidState = 'paused';
  else if (live.status !== 'bidding' || secondsLeft === 0) bidState = 'closed';
  else if (live.highBidderId === user?.uid) bidState = 'leading';
  else if ((team.squad?.length ?? 0) >= squadLimit) bidState = 'full';
  else if (isOverseas(player) && overseasCount >= overseasLimit) bidState = 'overseas';
  else if (team.budgetRemaining < nextAmount) bidState = 'budget';

  const handleBid = async () => {
    if (bidState !== 'open' || !team) return;
    sounds.beep(760, 0.07);
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
      sounds.beep(220, 0.25);
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

  const recentSales = useMemo(
    () => messages.filter(m => m.type === 'sold_card').slice(-12).reverse(),
    [messages],
  );

  const runHostAction = async (action) => {
    try {
      await action(id);
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
    }
  };
  const setBidTimer = (seconds) => runHostAction(roomId => updateRoomSettings(roomId, { bidTimer: seconds }));
  const removePerson = (person) => runHostAction(roomId => kickPlayer(roomId, person));

  // A latecomer claims a free franchise and goes straight onto the bidding desk
  const claimFranchise = async (teamId) => {
    try {
      await joinRoom(id, { teamId });
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
    }
  };

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
  if (authLoading) return <PageLoader />;
  if (!user) return <Navigate to={`/lobby/${id}${wantsToWatch ? '?watch=1' : ''}`} replace />;
  if (roomError?.code === 'kicked' || currentAuction?.bannedPlayers?.includes(user.uid)) {
    return <FullScreenNotice icon={ShieldAlert} title="Removed from room">The host removed you from this auction.</FullScreenNotice>;
  }
  if (roomError && !currentAuction) {
    return <FullScreenNotice icon={Radio} title="Room not found">There's no auction with the code {id}. Check the code and try again.</FullScreenNotice>;
  }
  if (loading || !currentAuction) return <PageLoader />;
  if (currentAuction.status === 'waiting') return <Navigate to={`/lobby/${id}${wantsToWatch ? '?watch=1' : ''}`} replace />;
  if (currentAuction.status === 'completed') return <Navigate to={`/summary/${id}`} replace />;
  // Arrived after the start without a franchise: claim a free one or watch
  if (!spectating && !team) {
    return (
      <ClaimFranchise
        takenTeamIds={new Set(roomTeams.map(t => t.teamId))}
        onClaim={claimFranchise}
        onWatch={() => navigate(`/auction/${id}?watch=1`, { replace: true })}
      />
    );
  }

  // ─── The stage ───
  const stage = (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
      <Panel accent="signal" className="relative" bodyClassName="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="clip-slant-r bg-signal/15 py-1 pl-2.5 pr-5 font-display text-xs font-bold uppercase tracking-[0.18em] text-signal">
            On the block
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {round > 1 && <Tag tone="gold">Round {round}</Tag>}
            <span className="truncate font-display text-xs uppercase tracking-wider text-haze">
              {player?.set}{lotIndex >= 0 && ` · Lot ${lotIndex + 1}/${playerOrder.length}`}
            </span>
          </span>
        </div>
        {player && <LotCard player={player} lot={null} />}
        <div className="h-px bg-white/6" />
        <PriceBoard live={live} timeLeft={live?.status === 'bidding' ? timeLeft : 0} bidTimer={bidTimer} leaderName={leaderName} basePrice={player?.basePrice} />
        <BidTrail trail={bidTrail} myId={user.uid} />
        <ResultBanner live={live} player={player} buyerName={leaderName} />
      </Panel>

      <div className="sticky bottom-16 z-10 -mx-3 bg-ink-950/90 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <BidConsole
          watching={spectating}
          onJoin={() => navigate(`/auction/${id}`, { replace: true })}
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

      <UpNext players={upNext} onShowAll={() => setOverlay('pool')} />
    </div>
  );

  const teamBoard = (
    <TeamBoard roomTeams={roomTeams} players={players} squadLimit={squadLimit} overseasLimit={overseasLimit} myId={user.uid} />
  );
  // Wide screens show the franchises in their own column; narrower ones get a Teams tab
  const sideOptions = [
    { id: 'feed', label: 'Feed', icon: History },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    ...(wideScreen ? [] : [{ id: 'teams', label: 'Teams', icon: Trophy }]),
  ];
  const activeSideTab = !wideScreen || sideTab !== 'teams' ? sideTab : 'feed';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-grid">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/6 bg-ink-950/90 px-2 backdrop-blur sm:px-4">
        <Link to="/" aria-label="Auction Arena home" className="flex items-center">
          <span className="h-5 w-2 -skew-x-12 bg-signal sm:hidden" aria-hidden />
          <span className="hidden sm:inline-flex"><Logo size="sm" /></span>
        </Link>
        <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden />
        {spectating ? <Tag tone="signal" icon={Eye}>Watching</Tag> : <LiveTag />}
        <button onClick={copyCode} className="flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-base font-bold tracking-[0.2em] hover:bg-white/5 cursor-pointer" aria-label="Copy room code">
          {id} {copied ? <Check size={14} className="text-volt" /> : <Copy size={14} className="text-haze" />}
        </button>
        <span className="hidden font-display text-sm uppercase tracking-wider text-haze md:inline">
          {MODE_META[currentAuction.auctionType]?.short}
        </span>
        <span className="hidden items-center gap-1 text-sm text-haze sm:flex" title="Watching">
          <Eye size={14} aria-hidden />
          <span className="tabular">{currentAuction.spectatorCount ?? 0}</span>
          <span className="sr-only">watching</span>
        </span>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {isHost && (
            <>
              {live?.status === 'paused' ? (
                <Button size="sm" variant="volt" icon={Play} onClick={() => runHostAction(resumeAuction)}>Resume</Button>
              ) : (
                <Button size="sm" variant="outline" icon={Pause} onClick={() => runHostAction(pauseAuction)} disabled={live?.status !== 'bidding'}>
                  <span className="hidden sm:inline">Pause</span>
                </Button>
              )}
              <Button size="sm" variant="danger" icon={Square} onClick={() => setOverlay('end')} aria-label="End auction">
                <span className="hidden sm:inline">End</span>
              </Button>
            </>
          )}
          <IconButton icon={List} label="Player pool" onClick={() => setOverlay('pool')} />
          <IconButton icon={Users} label="People in the room" onClick={() => setOverlay('people')} />
          <IconButton icon={Settings} label="Settings" onClick={() => setOverlay('settings')} />
          {team && (
            <>
              <TeamCrest teamId={team.teamId} size="sm" className="ml-1" />
              <span className="hidden font-display text-sm font-semibold uppercase tracking-wide xl:inline">{team.teamName}</span>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Franchises (wide screens) */}
        <aside className="hidden w-80 shrink-0 flex-col border-r border-white/6 bg-ink-900/50 xl:flex">
          <div className="flex h-11 items-center justify-between border-b border-white/6 px-4">
            <span className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-mist">Franchises</span>
            <span className="font-display text-xs uppercase tracking-wider text-haze">by strength</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{teamBoard}</div>
        </aside>

        {/* Stage (always on large screens; one of the tabs on phones) */}
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pb-16 lg:pb-0">
          <div className={cn(mobileTab !== 'stage' && 'hidden lg:block')}>{stage}</div>
          <div className={cn('lg:hidden', mobileTab !== 'teams' && 'hidden')}>{teamBoard}</div>
          <div className={cn('lg:hidden', mobileTab !== 'feed' && 'hidden')}><ActivityFeed messages={messages} /></div>
          {mobileTab === 'chat' && (
            <div className="h-[calc(100dvh-7.5rem)] lg:hidden"><TextChat roomId={id} canChat={Boolean(team)} /></div>
          )}
        </main>

        {/* Feed, chat (and teams below xl) */}
        <aside className="hidden w-96 shrink-0 flex-col border-l border-white/6 bg-ink-900/50 lg:flex">
          <Segmented options={sideOptions} value={activeSideTab} onChange={setSideTab} stretch className="h-11 shrink-0 border-b border-white/6 px-2" />
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {activeSideTab === 'feed' && <ActivityFeed messages={messages} />}
            {activeSideTab === 'chat' && <TextChat roomId={id} canChat={Boolean(team)} className="h-full" />}
            {activeSideTab === 'teams' && teamBoard}
          </div>
        </aside>
      </div>

      {/* Recent sales ticker */}
      {recentSales.length > 0 && (
        <Ticker label="Sold" loop={recentSales.length >= 4} className="hidden lg:flex">
          {recentSales.map(sale => (
            <TickerItem key={sale.id}>
              <TeamCrest teamId={sale.metadata.teamId} size="xs" className="border-0" />
              <span className="font-semibold text-snow">{PLAYERS_BY_ID.get(sale.metadata.playerId)?.name}</span>
              <span className="tabular font-display text-volt">{formatPrice(sale.metadata.bid)}</span>
            </TickerItem>
          ))}
        </Ticker>
      )}

      {/* Phone tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-white/8 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {[
          { id: 'stage', label: 'Stage', icon: Radio },
          { id: 'teams', label: 'Teams', icon: Trophy },
          { id: 'feed', label: 'Feed', icon: History },
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

      <PlayerPoolModal
        open={overlay === 'pool'}
        onClose={() => setOverlay(null)}
        playerOrder={playerOrder}
        currentIndex={lotIndex}
        currentPlayerId={live?.playerId}
        roomTeams={roomTeams}
        footer={team ? (
          <LiveBidBar
            player={player}
            live={live}
            timeLeft={live?.status === 'bidding' ? timeLeft : null}
            state={bidState}
            nextAmount={nextAmount}
            onBid={handleBid}
          />
        ) : null}
      />
      <ParticipantsModal
        open={overlay === 'people'}
        onClose={() => setOverlay(null)}
        players={players}
        spectatorCount={currentAuction.spectatorCount ?? 0}
        isHost={isHost}
        onKick={removePerson}
      />
      <RoomSettingsModal
        open={overlay === 'settings'}
        onClose={() => setOverlay(null)}
        isHost={isHost}
        bidTimer={bidTimer}
        isPublic={currentAuction.isPublic}
        onTimer={setBidTimer}
        onVisibility={(isPublic) => runHostAction(roomId => updateRoomSettings(roomId, { isPublic }))}
        voice={voice}
        sounds={sounds}
      />
      <ConfirmDialog
        open={overlay === 'end'}
        title="End the auction now?"
        message="Bidding stops for everyone and the remaining players won't be auctioned. Squads bought so far are final."
        confirmLabel="End auction"
        onConfirm={() => {
          setOverlay(null);
          runHostAction(endAuction);
        }}
        onCancel={() => setOverlay(null)}
      />
    </div>
  );
};

export default AuctionRoom;
