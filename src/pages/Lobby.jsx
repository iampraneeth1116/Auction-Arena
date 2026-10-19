import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, BotOff, Check, Copy, Crown, Eye, EyeOff, Gavel, Globe, Hourglass, House, Loader2, Lock, MessageCircle, MessageSquare, Plane, RotateCw,
  SearchX, Share2, ShieldX, Timer, TrendingUp, UserMinus, UserPlus, UserRound, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuction } from '../hooks/useAuction';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { TEAMS } from '../data/teams';
import { TEAMS_BY_ID, auctionPoolSize } from '../lib/catalog';
import { BID_TIMER_PRESETS, MODE_META, formatCrores, hasOverseasLimit, overseasLimitLabel } from '../lib/format';
import { cn } from '../lib/cn';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Toggle from '../components/ui/Toggle';
import OverseasLimitPicker from '../components/OverseasLimitPicker';
import PageLoader from '../components/PageLoader';
import Stat from '../components/ui/Stat';
import Tag from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import { buttonClasses } from '../components/ui/styles';
import TextChat from '../components/TextChat';
import SignInOptions from '../components/SignInOptions';

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

// ─── Signed out: the invite card ───

const SignInGate = ({ roomCode, watching }) => (
  <PageShell showUser={false} className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6 py-10">
    <Panel as={motion.section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} accent="signal" className="w-full max-w-md" bodyClassName="p-6 sm:p-8">
      <span className="clip-slant-r inline-block bg-signal py-0.5 pl-2.5 pr-6 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-950">
        {watching ? 'Watch invite' : "You're invited"}
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-wide text-snow">
        Room <span className="tabular tracking-[0.12em] text-signal">{roomCode}</span>
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-mist">
        {watching
          ? 'Sign in to follow every bid live from the stands.'
          : 'Sign in to pick a franchise and start bidding.'}
      </p>
      <div className="mt-6">
        <SignInOptions />
      </div>
    </Panel>
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-haze transition-colors hover:text-snow">
      <House size={14} /> Back to home
    </Link>
  </PageShell>
);

// ─── Lobby sections ───

const RoomHeader = ({ room, roomCode, isHost, hostName, managedCount, onlineCount, copied, onCopy, whatsappHref, canShare, onShare }) => {
  const mode = MODE_META[room.auctionType];
  return (
    <Panel as={motion.section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} accent="signal" aria-label={`Room ${roomCode}`}>
      <div className="pointer-events-none absolute inset-0 bg-stripes" aria-hidden />
      <div className="relative flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="clip-slant-r bg-signal py-0.5 pl-2.5 pr-6 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-950">
              Lobby
            </span>
            <Tag tone={room.isPublic ? 'signal' : 'neutral'} icon={room.isPublic ? Globe : Lock}>
              {room.isPublic ? 'Public' : 'Private'}
            </Tag>
            <Tag icon={Eye}>{room.spectatorCount ?? 0} watching</Tag>
          </div>
          <p className={cn(labelClasses, 'mt-4')}>Room code</p>
          <h1 className="tabular font-display text-5xl font-bold leading-none tracking-[0.14em] text-snow sm:text-7xl">{roomCode}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={onCopy}>
              {copied ? 'Copied' : 'Copy invite link'}
            </Button>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              <MessageCircle size={16} strokeWidth={2.5} /> WhatsApp
            </a>
            {canShare && <Button variant="ghost" size="sm" icon={Share2} onClick={onShare}>Share</Button>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6 sm:gap-x-8">
          <Stat label="Mode" value={mode?.short ?? room.auctionType} />
          <Stat label="Purse" value={`₹${formatCrores(room.settings?.budget)} Cr`} hint="per franchise" />
          <Stat label="Squad" value={room.squadLimit} hint="players" />
          <Stat
            label="Overseas"
            value={overseasLimitLabel(room.overseasLimit, room.squadLimit)}
            hint={hasOverseasLimit(room.overseasLimit, room.squadLimit) ? 'max per squad' : 'any number'}
          />
          <Stat label="Bid timer" value={`${room.settings?.bidTimer ?? 10}s`} hint="per bid" tone="signal" />
          <Stat
            label="Players"
            value={auctionPoolSize({ auctionType: room.auctionType, quickPool: room.quickPool, franchises: managedCount, squadLimit: room.squadLimit })}
            hint={room.quickPool ? 'quick pool' : 'in the pool'}
          />
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

const FranchiseTile = ({ team, holder, mine, hasTeam, isHost, busy, onPick, onAddBot, onRemoveBot }) => {
  const state = mine ? 'mine' : !holder ? 'open' : holder.isBot ? 'bot' : 'taken';
  const locked = Boolean(busy);
  const picking = busy === `team:${team.id}`;
  const botBusy = busy === `bot:${team.id}`;

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
          {state === 'bot' && <span>Bids on its own</span>}
          {state === 'open' && (
            <span>
              {team.city} · <span className="text-signal">Open</span>
            </span>
          )}
        </div>
      </div>
      {state === 'mine' && <Tag tone="volt">You</Tag>}
      {state === 'bot' && <Tag icon={Bot}>Bot</Tag>}
      {state === 'open' && (
        <span className="clip-slant inline-flex h-6 min-w-14 items-center justify-center bg-signal/15 px-3 font-display text-xs font-bold uppercase tracking-wider text-signal">
          {picking ? <Loader2 size={13} className="animate-spin" /> : hasTeam ? 'Switch' : 'Pick'}
        </span>
      )}
    </>
  );

  const showFooter = state === 'bot' || (state === 'open' && isHost);

  return (
    <li
      className={cn(
        'relative flex flex-col overflow-hidden rounded-md border transition-colors',
        state === 'mine' && 'border-volt/60 bg-volt/[0.07]',
        state === 'open' && 'border-dashed border-ink-500 bg-ink-900/40 hover:border-signal/60',
        (state === 'taken' || state === 'bot') && 'border-white/8 bg-ink-900/60',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: team.colors.primary }} aria-hidden />
      {state === 'open' ? (
        <button
          type="button"
          onClick={onPick}
          disabled={locked}
          aria-label={`${hasTeam ? 'Switch to' : 'Pick'} ${team.name}`}
          className="flex w-full items-center gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-signal/[0.05] disabled:cursor-default cursor-pointer"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-3 pl-4 pr-3">{content}</div>
      )}

      {showFooter && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/6 bg-ink-950/30 py-1.5 pl-4 pr-2">
          {state === 'bot' && (
            <Button variant="outline" size="sm" icon={UserPlus} loading={picking} disabled={locked} onClick={onPick} aria-label={`Take over ${team.name} from its bot`}>
              Take over
            </Button>
          )}
          {state === 'bot' && isHost && (
            <Button variant="ghost" size="sm" icon={BotOff} loading={botBusy} disabled={locked} onClick={onRemoveBot} aria-label={`Remove the ${team.name} bot`}>
              Remove bot
            </Button>
          )}
          {state === 'open' && isHost && (
            <Button variant="ghost" size="sm" icon={Bot} loading={botBusy} disabled={locked} onClick={onAddBot} aria-label={`Add a bot to manage ${team.name}`}>
              Add bot
            </Button>
          )}
        </div>
      )}
    </li>
  );
};

const WaitingPanel = ({ isHost, hostName, myTeam }) => (
  <Panel label={isHost ? 'Your room' : 'Up next'} className="order-2" bodyClassName="space-y-4 p-4">
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

const HostControls = ({
  room, busy, managedCount, openCount, botCount, canStart, onStart, onFillBots, onClearBots, onTimer, onListed, onQuickPool, onRotate, onHideUpcoming, onOverseas,
}) => {
  const bidTimer = room.settings?.bidTimer;
  return (
    <Panel label="Host controls" accent="signal" className="order-2" bodyClassName="divide-y divide-white/6">
      <div className="space-y-2 p-4">
        <Button variant="volt" size="lg" slant block icon={Gavel} loading={busy === 'start'} disabled={!canStart || Boolean(busy)} onClick={onStart}>
          Start auction
        </Button>
        <p className="text-center text-xs text-haze">
          {canStart
            ? `${managedCount} of ${TEAM_COUNT} franchises will take part.`
            : 'You need at least 2 managed franchises to start. Invite friends or add bots.'}
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-signal" aria-hidden />
          <h3 className={labelClasses}>Bots</h3>
        </div>
        <p className="text-sm leading-relaxed text-mist">
          Bots run franchises nobody picked and bid on their own under the same purse and squad rules. Anyone can take
          over a bot's franchise before the start.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={Bot} loading={busy === 'bots:fill'} disabled={openCount === 0 || Boolean(busy)} onClick={onFillBots}>
            Fill empty with bots
          </Button>
          <Button variant="ghost" size="sm" icon={BotOff} loading={busy === 'bots:clear'} disabled={botCount === 0 || Boolean(busy)} onClick={onClearBots}>
            Remove all bots
          </Button>
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={cn(labelClasses, 'flex items-center gap-2')}>
            <Timer size={15} className="text-signal" aria-hidden /> Bid timer
          </h3>
          <span className="tabular text-sm text-mist">{bidTimer}s per bid</span>
        </div>
        <div role="group" aria-label="Bid timer in seconds" className="grid grid-cols-6 gap-1">
          {BID_TIMER_PRESETS.map((seconds) => {
            const active = seconds === bidTimer;
            return (
              <button
                key={seconds}
                type="button"
                aria-pressed={active}
                disabled={Boolean(busy)}
                onClick={() => !active && onTimer(seconds)}
                className={cn(
                  'flex h-9 items-center justify-center rounded-md border font-display text-sm font-semibold tabular transition-colors cursor-pointer disabled:cursor-default',
                  active ? 'border-signal bg-signal/15 text-signal' : 'border-ink-500 text-mist hover:border-signal/60 hover:text-snow',
                )}
              >
                {busy === `timer:${seconds}` ? <Loader2 size={14} className="animate-spin" /> : `${seconds}s`}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-haze">The clock resets to this on every bid.</p>
      </div>
      <div className="p-4">
        <Toggle
          checked={Boolean(room.isPublic)}
          onChange={onListed}
          disabled={Boolean(busy)}
          label="Listed in open rooms"
          description="Anyone signed in can find this room on the home page to join or watch."
        />
        <Toggle
          className="mt-4"
          checked={Boolean(room.quickPool)}
          onChange={onQuickPool}
          disabled={Boolean(busy)}
          label="Quick pool"
          description={`Players auctioned = ${managedCount} franchise${managedCount === 1 ? '' : 's'} × ${room.squadLimit} squad slots + 10 spares = ${auctionPoolSize({ auctionType: room.auctionType, quickPool: true, franchises: managedCount, squadLimit: room.squadLimit })}, instead of ${auctionPoolSize({ auctionType: room.auctionType, quickPool: false })}. Counted when you press Start.`}
        />
        <Toggle
          className="mt-4"
          checked={room.rotateUnsold !== false}
          onChange={onRotate}
          disabled={Boolean(busy)}
          label="Unsold come back"
          description="After the last player, unsold players return in rounds until squads fill or a round sells nobody."
        />
        <Toggle
          className="mt-4"
          checked={Boolean(room.hideUpcoming)}
          onChange={onHideUpcoming}
          disabled={Boolean(busy)}
          label="Hide upcoming players"
          description="Nobody sees who's coming next, so every lot is a surprise. Players already called stay listed."
        />
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-snow">Overseas per squad</span>
            <span className="text-xs text-haze">usual: {MODE_META[room.auctionType]?.overseas ?? room.overseasLimit}</span>
          </div>
          <OverseasLimitPicker
            value={room.overseasLimit}
            squadLimit={room.squadLimit}
            defaultLimit={MODE_META[room.auctionType]?.overseas ?? room.overseasLimit}
            onChange={onOverseas}
            disabled={Boolean(busy)}
          />
        </div>
      </div>
    </Panel>
  );
};

const MembersPanel = ({ players, uid, isHost, spectatorCount, onKick }) => {
  const people = players.filter((p) => !p.isBot).length;
  const bots = players.length - people;
  // Host first, people before bots, otherwise in join order
  const ordered = [...players].sort((a, b) => Number(b.isHost) - Number(a.isHost) || Number(a.isBot) - Number(b.isBot));
  return (
    <Panel
      label="In the room"
      actions={<span className="tabular text-xs text-haze">{people === 1 ? '1 person' : `${people} people`} · {bots === 1 ? '1 bot' : `${bots} bots`}</span>}
      className="order-3"
    >
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
                  {p.isBot && <Tag icon={Bot}>Bot</Tag>}
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-haze">
                  <OnlineDot online={p.isOnline} />
                  <span className="shrink-0">{p.isBot ? 'Ready' : p.isOnline ? 'Online' : 'Away'}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{team ? team.name : 'No franchise yet'}</span>
                </div>
              </div>
              {isHost && !p.isBot && p.id !== uid && (
                <button
                  type="button"
                  onClick={() => onKick(p)}
                  aria-label={`Remove ${p.name} from the room`}
                  title="Remove from room"
                  className="shrink-0 rounded-md p-2 text-haze transition-colors hover:bg-flare/10 hover:text-flare cursor-pointer"
                >
                  <UserMinus size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {spectatorCount > 0 && (
        <p className="flex items-center gap-2 border-t border-white/6 px-4 py-2.5 text-xs text-haze">
          <Eye size={13} aria-hidden /> {spectatorCount} watching without a franchise
        </p>
      )}
    </Panel>
  );
};

const RulesPanel = ({ room }) => {
  const rules = [
    { icon: Users, label: 'Squad', text: `Up to ${room.squadLimit} players` },
    { icon: Plane, label: 'Overseas', text: hasOverseasLimit(room.overseasLimit, room.squadLimit) ? `Max ${room.overseasLimit} per squad` : 'No limit' },
    { icon: Wallet, label: 'Purse', text: `₹${formatCrores(room.settings?.budget)} Cr per franchise` },
    { icon: TrendingUp, label: 'Bid steps', text: '+₹20 L under ₹5 Cr, +₹25 L above' },
    { icon: Timer, label: 'Clock', text: `Resets to ${room.settings?.bidTimer}s on every bid` },
    { icon: Users, label: 'Unsold', text: room.rotateUnsold === false ? 'Out once unsold' : 'Come back in later rounds' },
    { icon: room.hideUpcoming ? EyeOff : Eye, label: 'Up next', text: room.hideUpcoming ? 'Hidden: every lot is a surprise' : 'Shown, so you can plan your purse' },
  ];
  return (
    <Panel label="Rules" className="order-5" bodyClassName="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {rules.map(({ icon: Icon, label, text }) => (
        <div key={label} className="flex items-start gap-3 rounded-md border border-white/6 bg-ink-900/50 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-signal/10 text-signal">
            <Icon size={15} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={labelClasses}>{label}</p>
            <p className="text-sm text-snow">{text}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
};

// ─── Page ───

const Lobby = () => {
  const { id = '' } = useParams();
  const roomCode = id.trim().toUpperCase();
  // ?watch=1: follow the room without becoming a member of it
  const [searchParams] = useSearchParams();
  const watching = searchParams.get('watch') === '1';
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    currentAuction, loading: roomLoading, roomError, joinAuction, joinRoom, selectTeam, addBots, removeBots, startAuction, updateRoomSettings, kickPlayer,
  } = useAuction();
  useDocumentTitle(`Lobby ${roomCode}`);

  const uid = user?.uid ?? null;
  // Join results and load failures belong to one room + one signed-in user
  const sessionKey = uid && roomCode ? `${roomCode}:${uid}` : null;

  const [join, setJoin] = useState(null); // { key, status: 'ok' | 'kicked' | 'missing' | 'failed' }
  const [stalledKey, setStalledKey] = useState(null);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [confirmStart, setConfirmStart] = useState(false);

  const joined = join?.key === sessionKey ? join.status : null;
  const room = currentAuction?.id === roomCode ? currentAuction : null;

  // Become a member of the room (a no-op if already in it); spectators skip this
  useEffect(() => {
    if (!sessionKey || watching) return undefined;
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
  }, [sessionKey, watching, roomCode, joinRoom, toast]);

  // Then follow the room live (spectators straight away). A join that failed still follows it, so
  // an old link to a finished auction moves on to its results. If it never arrives, stop waiting.
  const canSubscribe = Boolean(sessionKey) && (watching || joined === 'ok' || joined === 'failed');
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
  const spectatorView = watching && !myTeamId;
  const holders = new Map(players.filter((p) => p.team).map((p) => [p.team, p]));
  const status = room?.status;

  // Everyone moves to the auction room together once the host starts (spectators keep watching there);
  // a finished room shows its results
  useEffect(() => {
    if (status === 'active') navigate(`/auction/${roomCode}${spectatorView ? '?watch=1' : ''}`, { replace: true });
    else if (status === 'completed') navigate(`/summary/${roomCode}`, { replace: true });
  }, [status, roomCode, spectatorView, navigate]);

  const run = async (key, action, onDone) => {
    setBusy(key);
    try {
      const result = await action();
      onDone?.(result);
    } catch (err) {
      if (err.code === 'kicked') setJoin({ key: sessionKey, status: 'kicked' });
      else toast({ message: err.message || 'Something went wrong. Please try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const leaveWatchMode = () => navigate(`/lobby/${roomCode}`, { replace: true });
  const justWatch = () => navigate(`/lobby/${roomCode}?watch=1`, { replace: true });

  const joinAsManager = () =>
    run('join', () => joinRoom(roomCode), () => {
      setJoin({ key: sessionKey, status: 'ok' });
      leaveWatchMode();
    });

  const claimTeam = (teamId) => {
    const team = TEAMS_BY_ID.get(teamId);
    const fromBot = Boolean(holders.get(teamId)?.isBot);
    return run(
      `team:${teamId}`,
      // A spectator joins and claims in one step
      () => (me ? selectTeam(roomCode, teamId) : joinRoom(roomCode, { teamId })),
      () => {
        if (!me) setJoin({ key: sessionKey, status: 'ok' });
        if (watching) leaveWatchMode();
        toast({ message: fromBot ? `You took over ${team.name} from its bot` : `You're managing ${team.name}`, tone: 'success' });
      },
    );
  };

  const addBot = (teamId) => run(`bot:${teamId}`, () => addBots(roomCode, teamId));
  const removeBot = (teamId) => run(`bot:${teamId}`, () => removeBots(roomCode, teamId));

  const startNow = () =>
    run('start', () => startAuction(roomCode), () => {
      setConfirmStart(false);
      navigate(`/auction/${roomCode}`, { replace: true });
    });

  const fillWithBots = () =>
    run('bots:fill', () => addBots(roomCode), (res) => {
      const count = res?.added?.length ?? 0;
      toast({ message: `${count} bot${count === 1 ? '' : 's'} joined the room`, tone: 'success' });
    });

  const clearBots = () =>
    run('bots:clear', () => removeBots(roomCode), (res) => {
      const count = res?.removed?.length ?? 0;
      toast({ message: `${count} bot${count === 1 ? '' : 's'} left the room`, tone: 'success' });
    });

  const setQuickPool = (quickPool) =>
    run('quickPool', () => updateRoomSettings(roomCode, { quickPool }), () => {
      toast({ message: quickPool ? 'Quick pool on: a shorter auction' : 'Quick pool off: the full pool for this mode', tone: 'success' });
    });
  const setHideUpcoming = (hideUpcoming) =>
    run('hideUpcoming', () => updateRoomSettings(roomCode, { hideUpcoming }), () => {
      toast({ message: hideUpcoming ? "Upcoming players are hidden: nobody will see who's next" : 'Upcoming players are shown again', tone: 'success' });
    });
  const setRotate = (rotateUnsold) =>
    run('rotate', () => updateRoomSettings(roomCode, { rotateUnsold }), () => {
      toast({ message: rotateUnsold ? 'Unsold players will come back in later rounds' : 'Unsold players are out once unsold', tone: 'success' });
    });
  const setOverseas = (overseasLimit) => run('overseas', () => updateRoomSettings(roomCode, { overseasLimit }));

  const setBidTimer = (bidTimer) => run(`timer:${bidTimer}`, () => updateRoomSettings(roomCode, { bidTimer }));
  const setListed = (isPublic) =>
    run('listed', () => updateRoomSettings(roomCode, { isPublic }), () => {
      toast({
        message: isPublic ? 'Your room is listed in open rooms' : 'Your room is private. Only people with the link can join.',
        tone: 'success',
      });
    });

  const confirmKick = () => {
    const target = kickTarget;
    if (!target) return;
    run('kick', () => kickPlayer(roomCode, target), () => {
      setKickTarget(null);
      toast({ message: `${target.name} was removed from the room`, tone: 'success' });
    });
  };

  const inviteLink = `${window.location.origin}/lobby/${roomCode}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Join my Auction Arena room ${roomCode}: ${inviteLink}`)}`;
  const canShare = typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ message: "Couldn't copy the link. Share the room code instead.", tone: 'error' });
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ title: 'Auction Arena', text: `Join my auction room ${roomCode}`, url: inviteLink });
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ message: "Couldn't open sharing. Copy the link instead.", tone: 'error' });
    }
  };

  const scrollToBoard = () => document.getElementById('franchise-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ─── Gates ───

  if (!user) return <SignInGate roomCode={roomCode} watching={watching} />;

  if (joined === 'kicked' || roomError?.code === 'kicked' || Boolean(room?.bannedPlayers?.includes(uid))) {
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

  if (!room && stalledKey === sessionKey) {
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

  if (!room || roomLoading || room.status !== 'waiting') return <PageLoader />;

  // ─── Lobby ───

  const isHost = room.hostId === uid;
  const hostName = players.find((p) => p.isHost)?.name ?? 'the host';
  const managedCount = holders.size;
  const onlineCount = players.filter((p) => !p.isBot && p.isOnline).length;
  const botCount = players.filter((p) => p.isBot).length;
  const myTeam = TEAMS_BY_ID.get(myTeamId) ?? null;
  const allTakenByPeople = TEAMS.every((t) => holders.has(t.id) && !holders.get(t.id).isBot);
  const canStart = managedCount >= 2;

  const requestStart = () => {
    if (!canStart) return;
    if (managedCount < TEAM_COUNT) setConfirmStart(true);
    else startNow();
  };

  return (
    <PageShell wide className="pb-28 pt-4 sm:pt-6 lg:pb-12">
      {spectatorView && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-signal/30 bg-signal/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-start gap-3 sm:items-center">
            <Tag tone="signal" icon={Eye} className="mt-0.5 sm:mt-0">Watching</Tag>
            <p className="text-sm text-mist">You're watching this room live. Join as a manager to pick a franchise, bid and chat.</p>
          </div>
          <Button variant="primary" size="sm" icon={UserPlus} loading={busy === 'join'} disabled={Boolean(busy)} onClick={joinAsManager} className="shrink-0">
            Join as a manager
          </Button>
        </div>
      )}

      <RoomHeader
        room={room}
        roomCode={roomCode}
        isHost={isHost}
        hostName={hostName}
        managedCount={managedCount}
        onlineCount={onlineCount}
        copied={copied}
        onCopy={copyLink}
        whatsappHref={whatsappHref}
        canShare={canShare}
        onShare={shareLink}
      />

      {/* Phones: one column in the order you need it. Desktop: board and rules | controls, people and chat */}
      <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Panel
            id="franchise-board"
            label="Franchises"
            actions={<span className="tabular text-xs text-haze">{TEAM_COUNT - managedCount} open · {botCount === 1 ? '1 bot' : `${botCount} bots`}</span>}
            className="order-1 scroll-mt-20"
            bodyClassName="p-3 sm:p-4"
          >
            {!myTeamId && !spectatorView && (
              <div className="mb-3 flex flex-col gap-2 rounded-md border border-signal/25 bg-signal/[0.06] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-mist">
                  {allTakenByPeople
                    ? 'Every franchise has a manager. You can stay and chat, or just watch the auction.'
                    : `Pick an open franchise${botCount > 0 ? ' or take one over from a bot' : ''}. You can switch until the auction starts.`}
                </p>
                {allTakenByPeople && (
                  <Button variant="outline" size="sm" icon={Eye} onClick={justWatch} className="shrink-0">
                    Just watch
                  </Button>
                )}
              </div>
            )}
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEAMS.map((team) => (
                <FranchiseTile
                  key={team.id}
                  team={team}
                  holder={holders.get(team.id)}
                  mine={team.id === myTeamId}
                  hasTeam={Boolean(myTeamId)}
                  isHost={isHost}
                  busy={busy}
                  onPick={() => claimTeam(team.id)}
                  onAddBot={() => addBot(team.id)}
                  onRemoveBot={() => removeBot(team.id)}
                />
              ))}
            </ul>
          </Panel>
          <RulesPanel room={room} />
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <WaitingPanel isHost={isHost} hostName={hostName} myTeam={myTeam} />
          {isHost && (
            <HostControls
              room={room}
              busy={busy}
              managedCount={managedCount}
              openCount={TEAM_COUNT - managedCount}
              botCount={botCount}
              canStart={canStart}
              onStart={requestStart}
              onFillBots={fillWithBots}
              onClearBots={clearBots}
              onTimer={setBidTimer}
              onListed={setListed}
              onQuickPool={setQuickPool}
              onRotate={setRotate}
              onHideUpcoming={setHideUpcoming}
              onOverseas={setOverseas}
            />
          )}
          <MembersPanel players={players} uid={uid} isHost={isHost} spectatorCount={room.spectatorCount ?? 0} onKick={setKickTarget} />
          <Panel label="Room chat" actions={<MessageSquare size={14} className="text-haze" aria-hidden />} className="order-4" bodyClassName="h-[420px]">
            <TextChat roomId={roomCode} canChat={Boolean(me)} />
          </Panel>
        </div>
      </div>

      {/* Phones: your franchise and the next step stay in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-ink-950/90 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
          {spectatorView ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-mist">
              <Eye size={16} className="shrink-0 text-signal" aria-hidden /> Watching
            </span>
          ) : (
            <button type="button" onClick={scrollToBoard} className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer">
              <TeamCrest teamId={myTeam?.id} size="sm" />
              <span className="min-w-0">
                <span className={cn(labelClasses, 'block text-[10px]')}>Your franchise</span>
                <span className={cn('block truncate font-display text-sm font-semibold uppercase tracking-wide', myTeam ? 'text-snow' : allTakenByPeople ? 'text-mist' : 'text-signal')}>
                  {myTeam ? myTeam.name : allTakenByPeople ? 'All taken' : 'Pick one'}
                </span>
              </span>
            </button>
          )}

          {spectatorView ? (
            <Button variant="primary" size="md" icon={UserPlus} loading={busy === 'join'} disabled={Boolean(busy)} onClick={joinAsManager}>
              Join
            </Button>
          ) : isHost ? (
            <Button variant="volt" size="md" slant icon={Gavel} loading={busy === 'start'} disabled={!canStart || Boolean(busy)} onClick={requestStart}>
              Start
            </Button>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-haze">
              <Hourglass size={14} className="animate-pulse text-signal" aria-hidden /> Waiting for host
            </span>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmStart}
        title={`Start with ${managedCount} franchises?`}
        message={`${TEAM_COUNT - managedCount} franchise${TEAM_COUNT - managedCount === 1 ? ' has' : 's have'} no manager and won't take part in this auction. To play all ${TEAM_COUNT}, cancel and use “Fill empty with bots” first.`}
        confirmLabel="Start anyway"
        tone="primary"
        busy={busy === 'start'}
        onConfirm={startNow}
        onCancel={() => setConfirmStart(false)}
      />

      <ConfirmDialog
        open={Boolean(kickTarget)}
        title={`Remove ${kickTarget?.name ?? 'player'}?`}
        message="They'll be taken out of the room and can't rejoin it with this account."
        confirmLabel="Remove"
        tone="danger"
        busy={busy === 'kick'}
        onConfirm={confirmKick}
        onCancel={() => setKickTarget(null)}
      />
    </PageShell>
  );
};

export default Lobby;
