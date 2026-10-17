import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Copy, Crown, Hourglass, House, Loader2, MessageSquare, RotateCw, SearchX, ShieldX, UserRound, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuction } from '../hooks/useAuction';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { TEAMS } from '../data/teams';
import { TEAMS_BY_ID } from '../lib/catalog';
import { MODE_META, formatCrores } from '../lib/format';
import { cn } from '../lib/cn';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Stat from '../components/ui/Stat';
import Tag from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import { buttonClasses } from '../components/ui/styles';
import TextChat from '../components/TextChat';

const TEAM_COUNT = TEAMS.length;
// Give up waiting for the room after this long and offer a retry
const LOAD_TIMEOUT_MS = 12000;

const labelClasses = 'font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze';

const OnlineDot = ({ online }) => (
  <span
    className={cn('inline-block size-2 shrink-0 rounded-full', online ? 'bg-volt shadow-[0_0_6px_rgb(163_230_53/0.8)]' : 'bg-ink-500')}
    aria-hidden
  />
);

const HomeLink = ({ variant = 'primary' }) => (
  <Link to="/" className={buttonClasses({ variant, size: 'md' })}>
    <House size={16} strokeWidth={2.5} /> Back to home
  </Link>
);

// A single centred card for the dead ends: wrong code, removed from the room, room won't load
const StateScreen = ({ icon: Icon, tone = 'signal', title, children, actions }) => (
  <PageShell className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center py-10">
    <Panel accent={tone} className="w-full max-w-md" bodyClassName="p-6 text-center sm:p-8">
      <span
        className={cn(
          'mx-auto flex size-14 items-center justify-center rounded-lg border',
          tone === 'flare' ? 'border-flare/30 bg-flare/10 text-flare' : 'border-signal/30 bg-signal/10 text-signal',
        )}
      >
        <Icon size={26} />
      </span>
      <h1 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-snow">{title}</h1>
      <div className="mt-2 text-sm leading-relaxed text-mist">{children}</div>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>
    </Panel>
  </PageShell>
);

// ─── Lobby sections ───

const RoomHeader = ({ room, roomCode, isHost, hostName, managedCount, onlineCount, copied, onCopy }) => {
  const mode = MODE_META[room.auctionType];
  return (
    <Panel as={motion.section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} accent="signal" aria-label={`Room ${roomCode}`}>
      <div className="pointer-events-none absolute inset-0 bg-stripes" aria-hidden />
      <div className="relative flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="clip-slant-r bg-signal py-0.5 pl-2.5 pr-6 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-950">
            Lobby
          </span>
          <p className={cn(labelClasses, 'mt-4')}>Room code</p>
          <h1 className="tabular font-display text-5xl font-bold leading-none tracking-[0.14em] text-snow sm:text-7xl">{roomCode}</h1>
          <div className="mt-4">
            <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={onCopy}>
              {copied ? 'Copied' : 'Copy invite link'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5 sm:gap-x-8">
          <Stat label="Mode" value={mode?.short ?? room.auctionType} />
          <Stat label="Purse" value={`₹${formatCrores(room.settings?.budget)} Cr`} hint="per franchise" />
          <Stat label="Squad" value={room.squadLimit} hint="players" />
          <Stat label="Overseas" value={room.overseasLimit} hint="max per squad" />
          <Stat label="Bid timer" value={`${room.settings?.bidTimer ?? 10}s`} hint="per bid" tone="signal" />
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/6 bg-ink-900/70 px-4 py-2 text-sm text-mist sm:px-6">
        <span className="flex items-center gap-2">
          <Users size={14} className="text-haze" aria-hidden />
          <span>
            <span className="tabular font-semibold text-snow">{managedCount}/{TEAM_COUNT}</span> franchises managed
            <span className="text-haze"> · </span>
            <span className="tabular">{onlineCount}</span> online
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Crown size={14} className="shrink-0 text-gold" aria-hidden />
          <span className="truncate">{isHost ? "You're the host" : `Host: ${hostName}`}</span>
        </span>
      </div>
    </Panel>
  );
};

const FranchiseTile = ({ team, holder, mine, hasTeam, busy, onPick }) => {
  const state = mine ? 'mine' : holder ? 'taken' : 'open';
  const picking = busy === `team:${team.id}`;

  const content = (
    <>
      <TeamCrest teamId={team.id} size="md" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-base font-bold uppercase leading-tight tracking-wide text-snow">{team.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-haze">
          {state === 'mine' && <span className="text-volt">You manage this franchise</span>}
          {state === 'taken' && (
            <>
              <OnlineDot online={holder.isOnline} />
              <span className="truncate text-mist">{holder.name}</span>
              {holder.isHost && <Crown size={12} className="shrink-0 text-gold" aria-hidden />}
              <span className="sr-only">{holder.isHost ? '(host) ' : ''}{holder.isOnline ? 'online' : 'away'}</span>
            </>
          )}
          {state === 'open' && (
            <span>
              {team.city} · <span className="text-signal">Open</span>
            </span>
          )}
        </div>
      </div>
      {state === 'mine' && <Tag tone="volt">You</Tag>}
      {state === 'open' && (
        <span className="clip-slant inline-flex h-6 min-w-14 items-center justify-center bg-signal/15 px-3 font-display text-xs font-bold uppercase tracking-wider text-signal">
          {picking ? <Loader2 size={13} className="animate-spin" /> : hasTeam ? 'Switch' : 'Pick'}
        </span>
      )}
    </>
  );

  return (
    <li
      className={cn(
        'relative overflow-hidden rounded-md border transition-colors',
        state === 'mine' && 'border-volt/60 bg-volt/[0.07]',
        state === 'open' && 'border-dashed border-ink-500 bg-ink-900/40 hover:border-signal/60',
        state === 'taken' && 'border-white/8 bg-ink-900/60',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: team.colors.primary }} aria-hidden />
      {state === 'open' ? (
        <button
          type="button"
          onClick={onPick}
          disabled={Boolean(busy)}
          aria-label={`${hasTeam ? 'Switch to' : 'Pick'} ${team.name}`}
          className="flex w-full items-center gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-signal/[0.05] disabled:cursor-default cursor-pointer"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-3 pl-4 pr-3">{content}</div>
      )}
    </li>
  );
};

const WaitingPanel = ({ isHost, hostName, myTeam }) => (
  <Panel label={isHost ? 'Your room' : 'Up next'} bodyClassName="space-y-4 p-4">
    <div className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 text-signal">
        <Hourglass size={20} className="animate-pulse" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-snow">
          {isHost ? 'Get your friends in' : `Waiting for ${hostName} to start`}
        </p>
        <p className="text-sm text-haze">
          {isHost ? 'Share the invite link. Everyone picks a franchise here.' : 'Pick a franchise and keep this tab open.'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3 rounded-md border border-white/6 bg-ink-900/60 p-3">
      <TeamCrest teamId={myTeam?.id} size="sm" />
      <div className="min-w-0">
        <p className={labelClasses}>Your franchise</p>
        <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-snow">{myTeam ? myTeam.name : 'Not picked yet'}</p>
      </div>
    </div>
  </Panel>
);

const MembersPanel = ({ players, uid }) => {
  // Host first, otherwise in join order
  const ordered = [...players].sort((a, b) => Number(b.isHost) - Number(a.isHost));
  return (
    <Panel label="In the room" actions={<span className="tabular text-xs text-haze">{players.length === 1 ? '1 person' : `${players.length} people`}</span>}>
      <ul className="max-h-96 divide-y divide-white/6 overflow-y-auto scrollbar-thin">
        {ordered.map((p) => {
          const team = TEAMS_BY_ID.get(p.team);
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              {team ? (
                <TeamCrest teamId={team.id} size="sm" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-ink-500 text-haze">
                  <UserRound size={14} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-snow">{p.name}</span>
                  {p.isHost && (
                    <span className="flex shrink-0 items-center text-gold" title="Host">
                      <Crown size={13} aria-hidden />
                      <span className="sr-only">Host</span>
                    </span>
                  )}
                  {p.id === uid && <Tag tone="volt">You</Tag>}
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-haze">
                  <OnlineDot online={p.isOnline} />
                  <span className="shrink-0">{p.isOnline ? 'Online' : 'Away'}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{team ? team.name : 'No franchise yet'}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

// ─── Page ───

const Lobby = () => {
  const { id = '' } = useParams();
  const roomCode = id.trim().toUpperCase();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentAuction, loading: roomLoading, roomError, joinAuction, joinRoom, selectTeam } = useAuction();
  useDocumentTitle(`Lobby ${roomCode}`);

  const uid = user?.uid ?? null;
  // Join results and load failures belong to one room + one signed-in user
  const sessionKey = uid && roomCode ? `${roomCode}:${uid}` : null;

  const [join, setJoin] = useState(null); // { key, status: 'ok' | 'kicked' | 'missing' | 'failed' }
  const [stalledKey, setStalledKey] = useState(null);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(false);

  const joined = join?.key === sessionKey ? join.status : null;
  const room = currentAuction?.id === roomCode ? currentAuction : null;

  // Become a member of the room (a no-op if already in it)
  useEffect(() => {
    if (!sessionKey) return undefined;
    let cancelled = false;
    joinRoom(roomCode).then(
      () => { if (!cancelled) setJoin({ key: sessionKey, status: 'ok' }); },
      (err) => {
        if (cancelled) return;
        if (err.code === 'kicked') setJoin({ key: sessionKey, status: 'kicked' });
        else if (err.status === 404) setJoin({ key: sessionKey, status: 'missing' });
        else {
          setJoin({ key: sessionKey, status: 'failed' });
          toast({ message: err.message, tone: 'error' });
        }
      },
    );
    return () => { cancelled = true; };
  }, [sessionKey, roomCode, joinRoom, toast]);

  // Then follow the room live. If it never arrives, stop waiting after a while.
  const canSubscribe = joined === 'ok';
  useEffect(() => {
    if (!canSubscribe) return undefined;
    const unsubscribe = joinAuction(roomCode);
    const timer = setTimeout(() => setStalledKey(sessionKey), LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [canSubscribe, roomCode, sessionKey, joinAuction]);

  const players = room?.players ?? [];
  const me = players.find((p) => p.id === uid) ?? null;
  const myTeamId = me?.team || '';
  const holders = new Map(players.filter((p) => p.team).map((p) => [p.team, p]));

  const claimTeam = async (teamId) => {
    setBusy(`team:${teamId}`);
    try {
      await selectTeam(roomCode, teamId);
      toast({ message: `You're managing ${TEAMS_BY_ID.get(teamId).name}`, tone: 'success' });
    } catch (err) {
      toast({ message: err.message || 'Something went wrong. Please try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lobby/${roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ message: "Couldn't copy the link. Share the room code instead.", tone: 'error' });
    }
  };

  // ─── Gates ───

  if (!user) {
    return (
      <StateScreen icon={UserRound} title={`Room ${roomCode}`} actions={<HomeLink />}>
        Sign in on the home page, then open this link again to pick a franchise.
      </StateScreen>
    );
  }

  if (joined === 'kicked' || roomError?.code === 'kicked') {
    return (
      <StateScreen icon={ShieldX} tone="flare" title="You were removed from this room" actions={<HomeLink />}>
        The host removed you from room <span className="tabular font-semibold text-snow">{roomCode}</span>, so you can't rejoin it with this account.
      </StateScreen>
    );
  }

  if (!room && (joined === 'missing' || roomError)) {
    return (
      <StateScreen icon={SearchX} title="Room not found" actions={<HomeLink />}>
        There's no room with the code <span className="tabular font-semibold text-snow">{roomCode}</span>. Check the code with whoever invited you, or start a new room from home.
      </StateScreen>
    );
  }

  if (!room && (joined === 'failed' || stalledKey === sessionKey)) {
    return (
      <StateScreen
        icon={RotateCw}
        title="Couldn't load this room"
        actions={
          <>
            <Button variant="primary" icon={RotateCw} onClick={() => window.location.reload()}>Try again</Button>
            <HomeLink variant="outline" />
          </>
        }
      >
        Room <span className="tabular font-semibold text-snow">{roomCode}</span> is taking too long to answer. Check your connection and try again.
      </StateScreen>
    );
  }

  if (!room || roomLoading) return <Spinner className="min-h-dvh" />;

  // ─── Lobby ───

  const isHost = room.hostId === uid;
  const hostName = players.find((p) => p.isHost)?.name ?? 'the host';
  const managedCount = holders.size;
  const onlineCount = players.filter((p) => p.isOnline).length;
  const myTeam = TEAMS_BY_ID.get(myTeamId) ?? null;

  return (
    <PageShell wide className="pb-12 pt-4 sm:pt-6">
      <RoomHeader
        room={room}
        roomCode={roomCode}
        isHost={isHost}
        hostName={hostName}
        managedCount={managedCount}
        onlineCount={onlineCount}
        copied={copied}
        onCopy={copyLink}
      />

      <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
        <Panel
          label="Franchises"
          actions={<span className="tabular text-xs text-haze">{TEAM_COUNT - managedCount} open</span>}
          bodyClassName="p-3 sm:p-4"
        >
          {!myTeamId && (
            <p className="mb-3 rounded-md border border-signal/25 bg-signal/[0.06] px-3 py-2.5 text-sm text-mist">
              Pick an open franchise. You can switch until the auction starts.
            </p>
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TEAMS.map((team) => (
              <FranchiseTile
                key={team.id}
                team={team}
                holder={holders.get(team.id)}
                mine={team.id === myTeamId}
                hasTeam={Boolean(myTeamId)}
                busy={busy}
                onPick={() => claimTeam(team.id)}
              />
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <WaitingPanel isHost={isHost} hostName={hostName} myTeam={myTeam} />
          <MembersPanel players={players} uid={uid} />
          <Panel label="Room chat" actions={<MessageSquare size={14} className="text-haze" aria-hidden />} bodyClassName="h-[420px]">
            <TextChat roomId={roomCode} canChat={Boolean(me)} />
          </Panel>
        </div>
      </div>
    </PageShell>
  );
};

export default Lobby;
