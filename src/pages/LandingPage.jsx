import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BookOpen, Bot, Check, ChevronDown, CircleAlert, Clock, Eye, Gavel, History, LogIn, Radar, RefreshCw, Search, Timer, Trash2,
  Trophy, Users,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Tag, { LiveTag } from '../components/ui/Tag';
import Segmented from '../components/ui/Segmented';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import Toggle from '../components/ui/Toggle';
import Stat from '../components/ui/Stat';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { buttonClasses } from '../components/ui/styles';
import SignInOptions from '../components/SignInOptions';
import OverseasLimitPicker from '../components/OverseasLimitPicker';
import AuctionActivityFeed from '../components/AuctionActivityFeed';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuction } from '../hooks/useAuction';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { PLAYERS_BY_ID, TEAMS_BY_ID, auctionPoolSize, ratingOf, teamStrength, withPlayer } from '../lib/catalog';
import { BID_TIMER_PRESETS, MODE_META, ROLES, ROLE_META, formatPrice, isOverseas, nextBid, overseasLimitLabel } from '../lib/format';
import { TEAMS } from '../data/teams';

const LABEL = 'font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze';
const MODES = ['mega', 'sprint11', 'sprint5', 'blitz5'];
const POLL_MS = 20000;
const PLAYER_COUNT = `${Math.floor(PLAYERS_BY_ID.size / 100) * 100}+`;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const joinError = (err) =>
  err?.code === 'kicked' ? 'The host removed you from that room.' : err?.message || 'Something went wrong. Please try again.';

const LoadError = ({ message, onRetry }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
    <CircleAlert size={22} className="text-flare" />
    <p className="text-sm text-mist">{message}</p>
    <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Button>
  </div>
);

// ─── Page ───

const LandingPage = () => {
  useDocumentTitle();
  const { user } = useAuth();
  return user ? <ControlRoom /> : <SignedOut />;
};

// ─── Signed out: what this is, a sample lot, and how to get in ───

// The sign-in panel's heading follows the step it's on
const SIGN_IN_TITLES = { choose: 'Start playing', email: 'Sign in with email', guest: 'Play as a guest' };

const SignedOut = () => {
  const [signInView, setSignInView] = useState('choose');
  return (
    <PageShell
      right={
        <Link to="/guide" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          <BookOpen size={15} /> How to play
        </Link>
      }
    >
      <AuctionActivityFeed className="mt-4" />

      <section className="grid items-center gap-10 pb-12 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 lg:pb-16">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-signal">
            <span className="h-3.5 w-1 -skew-x-12 bg-signal" aria-hidden />
            Live IPL auction game
          </p>
          <h1 className="mt-3 font-display text-[2.5rem] font-bold uppercase leading-[0.95] tracking-wide text-snow sm:text-6xl">
            Run the IPL auction
            <span className="block text-signal">with your friends</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
            Friends claim IPL franchises and bid live on {PLAYER_COUNT} real players, with bots filling any empty teams.
            Afterwards, AI power rankings grade every squad and your team plays on in a fantasy league.
          </p>
          <dl className="mt-5 grid max-w-md grid-cols-3 gap-2 sm:flex sm:max-w-none sm:flex-wrap">
            {[
              [PLAYER_COUNT, 'Players'],
              [TEAMS.length, 'Franchises'],
              [MODES.length, 'Formats'],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col rounded-md border border-white/8 bg-ink-900/60 px-3 py-1.5 sm:flex-row sm:items-baseline sm:gap-1.5">
                <dt className={LABEL}>{label}</dt>
                <dd className="order-first font-display text-lg font-bold tabular text-snow">{value}</dd>
              </div>
            ))}
          </dl>

          <Panel label={SIGN_IN_TITLES[signInView]} accent="signal" className="mt-8 max-w-lg" bodyClassName="p-4 sm:p-5">
            <SignInOptions onViewChange={setSignInView} />
          </Panel>
        </div>

        <LotCard />
      </section>

      <HowItWorks />
      <Footer />
    </PageShell>
  );
};

// A sample lot that plays on a loop, drawn like the live auction graphic
const BIDS_PER_LOT = 5;
const CALL_TICKS = 2; // "going once", "going twice"
const SOLD_TICKS = 2;
const CYCLE = BIDS_PER_LOT + CALL_TICKS + SOLD_TICKS;
const TICK_MS = 1500;

const bidLadder = (opening) => {
  const bids = [opening];
  while (bids.length < BIDS_PER_LOT) bids.push(nextBid(bids[bids.length - 1], opening));
  return bids;
};

const SAMPLE_LOTS = (() => {
  const lots = [
    { playerId: 'virat-kohli', lot: 7, opening: 16.5, bidders: ['RCB', 'MI', 'CSK'] },
    { playerId: 'jasprit-bumrah', lot: 12, opening: 14.75, bidders: ['MI', 'GT', 'KKR'] },
    { playerId: 'heinrich-klaasen', lot: 18, opening: 10.5, bidders: ['SRH', 'DC', 'LSG'] },
    { playerId: 'rashid-khan', lot: 23, opening: 11.25, bidders: ['GT', 'RR', 'PBKS'] },
  ]
    .map(lot => ({ ...lot, player: PLAYERS_BY_ID.get(lot.playerId) }))
    .filter(lot => lot.player);
  if (lots.length === 0) {
    const player = PLAYERS_BY_ID.values().next().value;
    lots.push({ playerId: player.id, lot: 1, opening: player.basePrice, bidders: ['MI', 'CSK', 'RCB'], player });
  }
  return lots.map(lot => ({ ...lot, bids: bidLadder(lot.opening) }));
})();

// Where the timer bar starts and ends in each phase of a lot
const timerFor = (phase) => {
  if (phase < BIDS_PER_LOT) return { from: 1, to: 0.62, tone: 'bg-signal', call: 'Bidding', callTone: 'text-mist' };
  if (phase === BIDS_PER_LOT) return { from: 0.62, to: 0.3, tone: 'bg-gold', call: 'Going once', callTone: 'text-gold' };
  if (phase === BIDS_PER_LOT + 1) return { from: 0.3, to: 0, tone: 'bg-flare', call: 'Going twice', callTone: 'text-flare' };
  return { from: 0, to: 0, tone: 'bg-volt', call: 'Sold', callTone: 'text-volt' };
};

const LotCard = () => {
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(2);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const lot = SAMPLE_LOTS[Math.floor(tick / CYCLE) % SAMPLE_LOTS.length];
  const phase = tick % CYCLE;
  const step = Math.min(phase, BIDS_PER_LOT - 1);
  const sold = phase >= BIDS_PER_LOT + CALL_TICKS;
  const bid = lot.bids[step];
  const leaderId = lot.bidders[step % lot.bidders.length];
  const leader = TEAMS_BY_ID.get(leaderId);
  const { player } = lot;
  const [firstName, ...rest] = player.name.split(' ');
  const timer = timerFor(phase);

  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-none"
      role="img"
      aria-label="Example lot: a player on the block with the current bid, the leading team and the countdown"
    >
      {/* Offset plate behind the card */}
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg border border-signal/25 bg-stripes" aria-hidden />

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-ink-900 pr-3">
          <span className="clip-slant-r flex h-8 items-center gap-2 bg-signal pl-3 pr-6 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-950">
            <Gavel size={13} strokeWidth={2.5} /> On the block
          </span>
          <span className="truncate font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze tabular">
            Lot {lot.lot} · {player.set}
          </span>
        </div>

        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-md border border-white/8 transition-colors"
            style={{ background: `linear-gradient(160deg, ${leader?.colors.primary ?? '#25335c'}99, #0a0f1f 85%)` }}
          >
            <div className="absolute inset-0 bg-stripes" aria-hidden />
            <PlayerPhoto player={player} className="absolute inset-0 size-full bg-transparent!" rounded="rounded-none" />
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap gap-1.5">
              <Tag>{ROLE_META[player.role]?.short ?? player.role}</Tag>
              <Tag tone={isOverseas(player) ? 'gold' : 'neutral'}>{isOverseas(player) ? 'Overseas' : 'India'}</Tag>
            </div>
            <p className="mt-2.5 font-display text-2xl font-bold uppercase leading-[0.95] tracking-wide text-mist sm:text-3xl">
              {firstName}
              <span className="block truncate text-snow">{rest.join(' ')}</span>
            </p>
            <div className="mt-auto flex items-center gap-2.5 pt-3">
              <RatingBadge rating={ratingOf(player.id)} size="lg" />
              <span className="font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-haze">
                Arena
                <br />
                Rating
              </span>
            </div>
            <p className="mt-2 text-xs text-haze">
              Base price <span className="font-display font-semibold tabular text-mist">{formatPrice(player.basePrice)}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-white/6 bg-ink-900/70 px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className={LABEL}>{sold ? `Sold to ${leaderId}` : 'Current bid'}</div>
              <motion.div
                key={`${lot.playerId}-${bid}-${sold}`}
                initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={cn('font-display text-4xl font-bold leading-none tabular', sold ? 'text-volt' : 'text-snow')}
              >
                {formatPrice(bid)}
              </motion.div>
            </div>

            {sold ? (
              <span className="clip-slant bg-volt px-6 py-1.5 font-display text-2xl font-extrabold uppercase tracking-[0.14em] text-ink-950">
                Sold
              </span>
            ) : (
              <div
                className="flex items-center gap-2 rounded-md border border-white/8 bg-ink-850 py-1 pl-1 pr-3"
                style={{ boxShadow: `inset 3px 0 0 ${leader?.colors.primary ?? '#22d3ee'}` }}
              >
                <TeamCrest teamId={leaderId} size="sm" />
                <div className="leading-tight">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">Leading</div>
                  <div className="font-display text-sm font-bold uppercase tracking-wide">{leaderId}</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Timer size={14} className="shrink-0 text-haze" aria-hidden />
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
              <motion.div
                key={tick}
                className={cn('absolute inset-0 origin-left rounded-full', timer.tone)}
                initial={reduceMotion ? false : { scaleX: timer.from }}
                animate={{ scaleX: reduceMotion ? 0.62 : timer.to }}
                transition={{ duration: TICK_MS / 1000, ease: 'linear' }}
              />
            </div>
            <span className={cn('w-20 shrink-0 text-right font-display text-xs font-bold uppercase tracking-[0.12em]', timer.callTone)}>
              {timer.call}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const STEPS = [
  {
    icon: Users,
    title: 'Claim a franchise',
    text: 'Host a room, pick one of the ten IPL teams and send friends the six-character code. Bots can take any team nobody claims.',
  },
  {
    icon: Gavel,
    title: 'Bid live',
    text: 'Players go under the hammer one at a time. Outbid the room before the clock runs out, and keep an eye on your purse.',
  },
  {
    icon: Trophy,
    title: 'Compare squads',
    text: 'When the last lot is sold, AI power rankings grade every squad and your team carries on into a fantasy league.',
  },
];

const HowItWorks = () => (
  <section aria-labelledby="how-it-works" className="border-t border-white/6 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 id="how-it-works" className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">How it works</h2>
      <Link to="/guide" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-cyan-300">
        Read the game guide <ArrowRight size={14} />
      </Link>
    </div>
    <ol className="mt-6 grid gap-3 md:grid-cols-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85 p-5">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-signal" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <span className="font-display text-5xl font-bold leading-none tabular text-ink-600" aria-hidden>0{i + 1}</span>
            <span className="flex size-10 items-center justify-center rounded-md bg-signal/10 text-signal">
              <step.icon size={20} />
            </span>
          </div>
          <h3 className="mt-4 font-display text-xl font-bold uppercase tracking-wide text-snow">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mist">{step.text}</p>
        </li>
      ))}
    </ol>
  </section>
);

// ─── Signed in: the control room ───

const TABS = [
  { id: 'host', label: 'Host', icon: Gavel },
  { id: 'join', label: 'Join', icon: LogIn },
  { id: 'history', label: 'History', icon: History },
];
const TAB_KEY = 'aa_control_room_tab';

const readSavedTab = () => {
  try {
    const saved = sessionStorage.getItem(TAB_KEY);
    return TABS.some(t => t.id === saved) ? saved : 'host';
  } catch {
    return 'host'; // storage blocked
  }
};

const ControlRoom = () => {
  const [tab, setTab] = useState(readSavedTab);

  const changeTab = (next) => {
    setTab(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      // storage blocked: the tab just won't be remembered
    }
  };

  return (
    <PageShell>
      <AuctionActivityFeed className="mt-4" />

      <div className="flex flex-wrap items-end justify-between gap-3 pt-6 sm:pt-8">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-snow sm:text-4xl">Control room</h1>
          <p className="mt-1 text-sm text-mist">Host a new auction, join one, or look back at your squads.</p>
        </div>
        <Link to="/guide" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          <BookOpen size={14} /> Game guide
        </Link>
      </div>

      <div className="mt-5 border-b border-white/8">
        <Segmented options={TABS} value={tab} onChange={changeTab} stretch className="sm:max-w-sm" />
      </div>

      <div role="tabpanel" aria-label={TABS.find(t => t.id === tab)?.label} className="py-6">
        {tab === 'host' && <HostTab />}
        {tab === 'join' && <JoinTab />}
        {tab === 'history' && <HistoryTab />}
      </div>

      <Footer />
    </PageShell>
  );
};

// ─── Host ───

const FranchiseTile = ({ team, selected, onSelect }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    className={cn(
      'relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-md border p-2 text-left transition-colors cursor-pointer',
      'md:flex-col md:gap-2 md:px-2 md:pb-3 md:pt-3 md:text-center',
      selected ? 'border-transparent text-snow' : 'border-white/8 bg-ink-900/60 text-mist hover:border-ink-500 hover:text-snow',
    )}
    style={selected ? {
      background: `linear-gradient(150deg, ${team.colors.primary}80, ${team.colors.primary}1a 75%)`,
      boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${team.colors.primary} 70%, white)`,
    } : undefined}
  >
    <span className="relative shrink-0">
      <TeamCrest teamId={team.id} size="md" />
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex size-4.5 items-center justify-center rounded-full bg-snow text-ink-950 ring-2 ring-ink-850">
          <Check size={11} strokeWidth={3.5} />
        </span>
      )}
    </span>
    <span className="min-w-0 flex-1 break-words font-display text-[13px] font-semibold uppercase leading-tight tracking-wide md:flex-none">
      {team.name}
    </span>
    {selected && (
      <span className="absolute inset-x-0 bottom-0 flex h-1" aria-hidden>
        <span className="flex-1" style={{ background: team.colors.primary }} />
        <span className="flex-1" style={{ background: team.colors.secondary }} />
      </span>
    )}
  </button>
);

const ModeCard = ({ mode, selected, onSelect }) => {
  const meta = MODE_META[mode];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-left transition-colors cursor-pointer',
        selected ? 'border-signal bg-signal/10' : 'border-white/8 bg-ink-900/60 hover:border-ink-500',
      )}
    >
      <span className={cn('w-9 shrink-0 font-display text-4xl font-bold leading-none tabular', selected ? 'text-signal' : 'text-ink-500')} aria-hidden>
        {meta.squad}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-display text-base font-bold uppercase tracking-wide text-snow">
          {meta.label}
          {selected && <Check size={14} strokeWidth={3} className="text-signal" />}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-haze">{meta.blurb}</span>
      </span>
    </button>
  );
};

const HostTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createRoom } = useAuction();
  const [teamId, setTeamId] = useState(TEAMS[0].id);
  const [mode, setMode] = useState('mega');
  const [isPublic, setIsPublic] = useState(false);
  const [quickPool, setQuickPool] = useState(false);
  const [rotateUnsold, setRotateUnsold] = useState(true);
  const [hideUpcoming, setHideUpcoming] = useState(false);
  // null until the host picks one: then each mode's own value applies
  const [timerChoice, setTimerChoice] = useState(null);
  const [overseasChoice, setOverseasChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const team = TEAMS_BY_ID.get(teamId);
  const bidTimer = timerChoice ?? MODE_META[mode].timer;
  const squadSize = MODE_META[mode].squad;
  // A choice made for a bigger squad can't exceed this mode's squad size
  const overseasLimit = Math.min(overseasChoice ?? MODE_META[mode].overseas, squadSize);

  const create = async () => {
    setBusy(true);
    try {
      const id = await createRoom({ teamId, auctionType: mode, isPublic, quickPool, rotateUnsold, hideUpcoming, bidTimer, overseasLimit });
      navigate(`/lobby/${id}`);
    } catch (err) {
      toast({ message: err.message || 'Could not create the room. Please try again.', tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <Panel label="Pick your franchise" bodyClassName="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {TEAMS.map(t => (
              <FranchiseTile key={t.id} team={t} selected={t.id === teamId} onSelect={() => setTeamId(t.id)} />
            ))}
          </div>
        </Panel>

        <Panel label="Choose a format" bodyClassName="p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Format">
            {MODES.map(m => <ModeCard key={m} mode={m} selected={m === mode} onSelect={() => setMode(m)} />)}
          </div>
        </Panel>
      </div>

      <Panel label="Your room" accent="signal" className="lg:sticky lg:top-20" bodyClassName="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <TeamCrest teamId={teamId} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-snow">{team.name}</p>
            <p className="text-sm text-haze">“{team.motto}”</p>
          </div>
        </div>
        <div className="rounded-md border border-white/6 bg-ink-900/60 px-3 py-2">
          <div className={LABEL}>Format</div>
          <p className="font-display text-base font-bold uppercase tracking-wide text-snow">{MODE_META[mode].label}</p>
          <p className="text-xs text-haze">{MODE_META[mode].blurb}</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={LABEL}>Time per bid</span>
            <span className="text-xs text-haze">{bidTimer <= 5 ? 'Fast game' : 'Relaxed game'}</span>
          </div>
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Time per bid">
            {BID_TIMER_PRESETS.map(seconds => (
              <button
                key={seconds}
                type="button"
                role="radio"
                aria-checked={seconds === bidTimer}
                onClick={() => setTimerChoice(seconds)}
                className={cn(
                  'h-9 rounded-md border font-display text-sm font-semibold tabular transition-colors cursor-pointer',
                  seconds === bidTimer ? 'border-signal bg-signal/15 text-signal' : 'border-white/8 text-mist hover:border-ink-500',
                )}
              >
                {seconds}s
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-haze">Every bid restarts the clock. You can change this in the lobby too.</p>
        </div>
        <Toggle
          checked={isPublic}
          onChange={setIsPublic}
          label="List in open rooms"
          description="Anyone signed in can find it under Join to take a franchise or watch."
        />
        <Toggle
          checked={quickPool}
          onChange={setQuickPool}
          label="Quick pool"
          description={`Players auctioned = franchises playing × ${squadSize} squad slots + 10 spares. With all ten teams that's ${auctionPoolSize({ auctionType: mode, quickPool: true, franchises: 10, squadLimit: squadSize })}, instead of ${auctionPoolSize({ auctionType: mode, quickPool: false })}.`}
        />
        <Toggle
          checked={rotateUnsold}
          onChange={setRotateUnsold}
          label="Unsold come back"
          description="After the last player, unsold players return in rounds until squads fill or a round sells nobody."
        />
        <Toggle
          checked={hideUpcoming}
          onChange={setHideUpcoming}
          label="Hide upcoming players"
          description="Nobody sees who's coming next, so every lot is a surprise. Players already called stay listed."
        />
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={LABEL}>Overseas per squad</span>
            <span className="text-xs text-haze">{overseasLimitLabel(overseasLimit, squadSize)}{overseasLimit === MODE_META[mode].overseas ? ' (usual)' : ''}</span>
          </div>
          <OverseasLimitPicker value={overseasLimit} squadLimit={squadSize} defaultLimit={MODE_META[mode].overseas} onChange={setOverseasChoice} />
        </div>
        <Button size="lg" block slant icon={Gavel} loading={busy} onClick={create}>Create room</Button>
        <p className="text-xs leading-relaxed text-haze">
          You get a six-character code to share. Empty franchises can be filled with bots from the lobby.
        </p>
      </Panel>
    </div>
  );
};

// ─── Join ───

const ROOM_CODE_LENGTH = 6;

const JoinTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { joinRoom } = useAuction();
  const [joining, setJoining] = useState(null); // the room code being joined

  const join = async (code) => {
    setJoining(code);
    try {
      const id = await joinRoom(code);
      navigate(`/lobby/${id}`);
    } catch (err) {
      toast({ message: joinError(err), tone: 'error' });
      setJoining(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <JoinByCode onJoin={join} joining={joining} />
      <OpenRooms onJoin={join} joining={joining} />
    </div>
  );
};

const JoinByCode = ({ onJoin, joining }) => {
  const [code, setCode] = useState('');
  const ready = code.length === ROOM_CODE_LENGTH;

  const submit = (e) => {
    e.preventDefault();
    if (ready) onJoin(code);
  };

  return (
    <Panel label="Join with a code" accent="volt" bodyClassName="p-4">
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="block font-display text-xs font-semibold uppercase tracking-[0.14em] text-mist">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
            maxLength={ROOM_CODE_LENGTH}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-14 w-full rounded-md border border-ink-500 bg-ink-900/70 px-3 text-center font-display text-3xl font-bold uppercase tracking-[0.35em] text-snow tabular placeholder:text-ink-600 transition-colors focus:border-signal focus:outline-none"
          />
          <span className="block text-xs text-haze">Six letters and numbers. The host can copy it from their lobby.</span>
        </label>
        <Button type="submit" variant="volt" size="lg" block icon={LogIn} disabled={!ready || Boolean(joining)} loading={ready && joining === code}>
          Join room
        </Button>
      </form>
    </Panel>
  );
};

const MODE_FILTERS = [{ id: 'all', label: 'All' }, ...MODES.map(m => ({ id: m, label: MODE_META[m].short }))];

const OpenRooms = ({ onJoin, joining }) => {
  const [rooms, setRooms] = useState(null); // null until the first load
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');

  const load = useCallback(
    () => api('/api/rooms/public')
      .then(({ rooms: list }) => {
        setRooms(list);
        setError('');
      })
      .catch((err) => setError(err.message || 'Could not load open rooms.')),
    [],
  );

  // Keeps refreshing while the Join tab is open (this component only exists then)
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const needle = query.trim().toLowerCase();
  const visible = (rooms ?? []).filter(room =>
    (modeFilter === 'all' || room.auctionType === modeFilter) &&
    (!needle || room.id.toLowerCase().includes(needle) || room.hostName.toLowerCase().includes(needle)),
  );

  let body;
  if (rooms === null) {
    body = error ? <LoadError message={error} onRetry={refresh} /> : <Spinner label="Looking for open rooms" />;
  } else if (rooms.length === 0) {
    body = (
      <EmptyState icon={Radar} title="No open rooms right now">
        Host one with “List in open rooms” switched on, or join a friend with their code.
      </EmptyState>
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState icon={Search} title="No rooms match">
        Try another code, host name or format.
      </EmptyState>
    );
  } else {
    body = (
      <ul className="divide-y divide-white/6">
        {visible.map(room => <RoomRow key={room.id} room={room} onJoin={onJoin} joining={joining} />)}
      </ul>
    );
  }

  return (
    <Panel
      label={rooms?.length ? `Open rooms · ${rooms.length}` : 'Open rooms'}
      actions={<Button variant="ghost" size="sm" icon={RefreshCw} loading={refreshing} onClick={refresh}>Refresh</Button>}
    >
      <div className="flex flex-col gap-2 border-b border-white/6 p-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search open rooms by code or host</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-haze" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or host"
            className="h-10 w-full rounded-md border border-ink-500 bg-ink-900/70 pl-9 pr-3 text-sm text-snow placeholder:text-haze transition-colors focus:border-signal focus:outline-none"
          />
        </label>
        <Segmented options={MODE_FILTERS} value={modeFilter} onChange={setModeFilter} size="sm" />
      </div>
      {body}
      {error && rooms !== null && (
        <p className="border-t border-white/6 px-4 py-2 text-xs text-flare" role="status">Couldn’t refresh just now. Showing the last list.</p>
      )}
    </Panel>
  );
};

const RoomRow = ({ room, onJoin, joining }) => {
  const live = room.status === 'active';
  const canJoin = !live && room.openTeams > 0;
  const watchHref = `/${live ? 'auction' : 'lobby'}/${room.id}?watch=1`;

  return (
    <li className="relative flex flex-col gap-3 py-3 pl-5 pr-3 sm:flex-row sm:items-center sm:pr-4">
      <span className={cn('absolute inset-y-3 left-0 w-1 rounded-r-sm', live ? 'bg-flare' : 'bg-signal')} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-display text-lg font-bold tracking-[0.12em] text-snow tabular">{room.id}</span>
          <Tag tone="signal">{MODE_META[room.auctionType]?.short ?? room.auctionType}</Tag>
          {live ? (
            <span className="inline-flex items-center gap-1.5">
              <LiveTag />
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-mist tabular">
                Lot {room.lot}{room.lots ? `/${room.lots}` : ''}
              </span>
            </span>
          ) : (
            <Tag tone={room.openTeams > 0 ? 'volt' : 'neutral'} icon={Clock}>
              Waiting · {room.openTeams > 0 ? `${room.openTeams} open` : 'full'}
            </Tag>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-mist">Hosted by <span className="font-semibold text-snow">{room.hostName}</span></p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-haze">
          <span className="inline-flex items-center gap-1"><Users size={13} aria-hidden /> {plural(room.humans, 'person', 'people')}</span>
          <span className="inline-flex items-center gap-1"><Bot size={13} aria-hidden /> {plural(room.bots, 'bot')}</span>
          <span className="inline-flex items-center gap-1"><Eye size={13} aria-hidden /> {room.spectators} watching</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 *:flex-1 sm:*:flex-none">
        {canJoin && (
          <Button variant="volt" size="sm" icon={LogIn} loading={joining === room.id} disabled={Boolean(joining)} onClick={() => onJoin(room.id)}>
            Join
          </Button>
        )}
        <Link to={watchHref} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          <Eye size={14} /> Watch
        </Link>
      </div>
    </li>
  );
};

// ─── History ───

const StatusTag = ({ status }) => {
  if (status === 'active') return <LiveTag />;
  if (status === 'waiting') return <Tag tone="signal" icon={Clock}>Waiting</Tag>;
  return <Tag icon={Check}>Finished</Tag>;
};

const sessionHref = (session) => {
  if (session.status === 'completed') return `/summary/${session.roomId}`;
  if (session.status === 'active') return `/auction/${session.roomId}`;
  return `/lobby/${session.roomId}`;
};

const formatDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const HistoryTab = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState(null); // null until the first load
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(
    () => api('/api/me/history')
      .then(({ sessions: list }) => {
        setSessions(list);
        setError('');
      })
      .catch((err) => setError(err.message || 'Could not load your history.')),
    [],
  );

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const restore = async (session) => {
    try {
      await api(`/api/me/history/${session.id}/restore`, { method: 'POST' });
      await load();
      toast({ message: `${session.teamName} is back in your history.`, tone: 'success' });
    } catch (err) {
      toast({ message: err.message || 'Could not bring it back. Please try again.', tone: 'error' });
    }
  };

  const remove = async () => {
    const session = removeTarget;
    if (!session) return;
    setRemoving(true);
    try {
      await api(`/api/me/history/${session.id}`, { method: 'DELETE' });
      setSessions(list => (list ?? []).filter(s => s.id !== session.id));
      toast({
        message: `Removed ${session.teamName} from your history.`,
        tone: 'success',
        duration: 6000,
        action: { label: 'Undo', onClick: () => restore(session) },
      });
    } catch (err) {
      toast({ message: err.message || 'Could not remove it. Please try again.', tone: 'error' });
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  if (sessions === null) {
    return error ? <Panel><LoadError message={error} onRetry={load} /></Panel> : <Spinner label="Loading your auctions" />;
  }

  return (
    <>
      {sessions.length === 0 ? (
        <Panel>
          <EmptyState icon={History} title="No auctions yet">
            Host or join a room and your squads will show up here.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <p className={cn(LABEL, 'mb-3')}>{plural(sessions.length, 'auction')}</p>
          <ul className="space-y-2">
            {sessions.map(session => (
              <HistoryRow
                key={session.id}
                session={session}
                expanded={expandedId === session.id}
                onToggle={() => setExpandedId(id => (id === session.id ? null : session.id))}
                onRemove={() => setRemoveTarget(session)}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove from history?"
        message={removeTarget
          ? `This hides your ${removeTarget.teamName} squad from ${formatDate(removeTarget.createdAt)}. The room and the other managers' squads stay as they are, and you can undo it straight after.`
          : ''}
        confirmLabel="Remove"
        tone="danger"
        busy={removing}
        onConfirm={remove}
        onCancel={() => !removing && setRemoveTarget(null)}
      />
    </>
  );
};

const HistoryRow = ({ session, expanded, onToggle, onRemove }) => {
  const team = TEAMS_BY_ID.get(session.teamId);
  const live = session.status === 'active';
  const detailId = `session-${session.id}`;

  return (
    <li className="relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: team?.colors.primary ?? '#3a4a7a' }} aria-hidden />
      <div className="flex flex-col gap-3 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:pl-5 sm:pr-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={expanded ? detailId : undefined}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left cursor-pointer"
        >
          <TeamCrest teamId={session.teamId} size="md" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-snow">{session.teamName}</span>
              <StatusTag status={session.status} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-haze">
              {MODE_META[session.mode]?.label ?? session.mode} · {formatDate(session.createdAt)}
              {session.isHost ? ' · You hosted' : ''}
            </span>
          </span>
          <ChevronDown size={18} className={cn('shrink-0 text-haze transition-transform group-hover:text-snow', expanded && 'rotate-180')} aria-hidden />
          <span className="sr-only">{expanded ? 'Hide squad' : 'Show squad'}</span>
        </button>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="flex gap-5">
            <Stat label="Players" value={session.squad.length} size="sm" />
            <Stat label="Spent" value={formatPrice(session.spent)} size="sm" />
          </div>
          <div className="flex items-center gap-1">
            <Link to={sessionHref(session)} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              Open <ArrowRight size={14} />
            </Link>
            {!live && (
              <Button variant="ghost" size="sm" icon={Trash2} onClick={onRemove} aria-label={`Remove ${session.teamName} from history`}>
                <span className="hidden sm:inline">Remove</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {expanded && <SquadDetail id={detailId} session={session} />}
    </li>
  );
};

const SquadDetail = ({ id, session }) => {
  const players = session.squad.map(withPlayer).filter(Boolean);
  const strength = teamStrength(session.squad, session.squadLimit, session.overseasLimit);
  const groups = ROLES
    .map(role => ({ role, players: players.filter(p => p.role === role).sort((a, b) => b.bid - a.bid) }))
    .filter(group => group.players.length > 0);

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="border-t border-white/6 bg-ink-900/50 px-4 py-4 sm:px-5"
    >
      <div className="grid max-w-xl grid-cols-3 gap-3">
        <Stat label="Arena Strength" value={players.length ? strength.score : '–'} tone="signal" />
        <Stat label="Purse left" value={formatPrice(session.budgetRemaining)} tone="volt" />
        <Stat label="Squad" value={`${players.length}/${session.squadLimit}`} />
      </div>
      {strength.gaps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {strength.gaps.map(gap => <Tag key={gap} tone="flare">{gap}</Tag>)}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-haze">No players bought in this auction.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map(group => (
            <div key={group.role} className="min-w-0">
              <h3 className={cn(LABEL, 'mb-1.5 flex items-center gap-1.5')}>
                {ROLE_META[group.role].plural}
                <span className="tabular text-mist">{group.players.length}</span>
              </h3>
              <ul className="space-y-1">
                {group.players.map(p => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-md bg-ink-850/80 py-1.5 pl-1.5 pr-2.5">
                    <PlayerPhoto player={p} className="size-8 shrink-0" rounded="rounded-sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-snow">{p.name}</span>
                    <RatingBadge rating={p.rating} size="sm" />
                    <span className="w-[4.5rem] shrink-0 text-right font-display text-sm font-semibold text-mist tabular">{formatPrice(p.bid)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default LandingPage;
