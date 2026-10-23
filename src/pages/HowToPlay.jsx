import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  Gauge,
  Gavel,
  Hand,
  Layers,
  ListOrdered,
  LogIn,
  Pause,
  Plane,
  Rocket,
  Scale,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Tag, { LiveTag } from '../components/ui/Tag';
import Stat from '../components/ui/Stat';
import RatingBadge from '../components/ui/RatingBadge';
import TeamCrest from '../components/ui/TeamCrest';
import { buttonClasses } from '../components/ui/styles';
import Footer from '../components/Footer';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../lib/cn';
import { MODE_META, ROLE_META, formatCrores, formatPrice, maxBidFor, nextBid } from '../lib/format';
import { RATINGS, TEAMS_BY_ID } from '../lib/catalog';
import { ratingTier } from '../lib/playerRating';
import { IPL_PLAYERS } from '../data/players';
import { TEAMS } from '../data/teams';

// ─── Facts the guide is built from ───

const SECTIONS = [
  { id: 'quick-start', label: 'Quick start', icon: Rocket },
  { id: 'modes', label: 'Auction modes', icon: Layers },
  { id: 'bidding', label: 'Bidding', icon: Gavel },
  { id: 'squad-rules', label: 'Squad rules', icon: Wallet },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'public-rooms', label: 'Public rooms & spectating', icon: Eye },
  { id: 'ratings', label: 'Arena Rating & Strength', icon: Gauge },
  { id: 'power-rankings', label: 'AI power rankings', icon: Sparkles },
  { id: 'fantasy', label: 'Fantasy league', icon: Trophy },
  { id: 'faq', label: 'FAQ', icon: CircleHelp },
];
const SECTION_IDS = SECTIONS.map(s => s.id);

const FULL_LIST = IPL_PLAYERS.length;

// Mirrors AUCTION_MODES in server/auctionRules.js (pool: null = the full list)
const MODES = [
  { id: 'mega', squad: 25, overseas: 8, purse: 120, pool: null },
  { id: 'sprint11', squad: 11, overseas: 4, purse: 90, pool: 150 },
  { id: 'sprint5', squad: 5, overseas: 2, purse: 60, pool: 80 },
  { id: 'blitz5', squad: 5, overseas: 2, purse: 30, pool: 80, timer: 3 },
];
const byMode = (key, format = String) => MODES.map(m => format(m[key])).join(' / ');
const crores = (value) => `₹${formatCrores(value)} Cr`;

// Mirrors server/auctionRules.js
const FIRST_LOT_SECONDS = 15;
const DEFAULT_TIMER = 10;
const MIN_TIMER = 3;
const MAX_TIMER = 60;
const SOLD_CARD_SECONDS = 5;
const UNSOLD_CARD_SECONDS = 2;

// A ₹2 Cr player's ladder, worked out with the same increments the server uses
const LADDER = [];
for (let price = nextBid(0, 2); price <= 5.5; price = nextBid(price, 2)) LADDER.push(price);
const LADDER_SHOWN = [...LADDER.slice(0, 3), null, ...LADDER.slice(-4)];

// Max-bid hint example: Classic 11, two players bought, ₹8 Cr left
const HINT_EXAMPLE = (() => {
  const squadLimit = 11;
  const bought = 2;
  const purse = 8;
  const max = maxBidFor({ budgetRemaining: purse, squad: Array.from({ length: bought }, () => ({})) }, squadLimit);
  return { squadLimit, bought, purse, max, open: squadLimit - bought, reserve: purse - max };
})();

// Mirrors STYLES in server/bots.js
const BOT_STYLES = [
  { teamId: 'MI', favours: 'Bowler', boldness: 1.1 },
  { teamId: 'CSK', favours: 'All-Rounder', boldness: 0.9 },
  { teamId: 'RCB', favours: 'Batsman', boldness: 1.15 },
  { teamId: 'KKR', favours: 'All-Rounder', boldness: 1.0 },
  { teamId: 'DC', favours: 'Batsman', boldness: 0.95 },
  { teamId: 'PBKS', favours: 'Bowler', boldness: 1.05 },
  { teamId: 'RR', favours: 'All-Rounder', boldness: 0.95 },
  { teamId: 'SRH', favours: 'Batsman', boldness: 1.1 },
  { teamId: 'GT', favours: 'Bowler', boldness: 0.9 },
  { teamId: 'LSG', favours: 'Wicket-Keeper', boldness: 1.0 },
];
const temperament = (boldness) =>
  boldness >= 1.1 ? { label: 'Bold', tone: 'gold' } : boldness <= 0.95 ? { label: 'Careful', tone: 'signal' } : { label: 'Steady', tone: 'neutral' };

const TIERS = [
  { id: 'elite', label: 'Elite', floor: 90, range: '90–99' },
  { id: 'star', label: 'Star', floor: 80, range: '80–89' },
  { id: 'solid', label: 'Solid', floor: 65, range: '65–79' },
  { id: 'squad', label: 'Squad', floor: 50, range: '50–64' },
  { id: 'prospect', label: 'Prospect', floor: 1, range: '1–49' },
];
const TIER_COUNTS = (() => {
  const counts = {};
  for (const rating of RATINGS.values()) {
    const tier = ratingTier(rating);
    counts[tier] = (counts[tier] || 0) + 1;
  }
  return counts;
})();

// Mirrors GRADES in server/routes/powerRankings.js
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

// Mirrors calculatePoints in scripts/lib/fantasyScoring.js
const SCORING = [
  {
    title: 'Batting',
    rows: [
      ['Each run', '+1'],
      ['Each four, on top of the runs', '+4'],
      ['Each six, on top of the runs', '+6'],
      ['25 / 50 / 75 / 100 runs (highest only)', '+4 / +8 / +12 / +16'],
      ['Out for a duck*', '−2'],
      ['Strike rate over 170 / 150 / 130*', '+6 / +4 / +2'],
      ['Strike rate 60–70 / 50–60 / under 50*', '−2 / −4 / −6'],
    ],
    note: '*Not for bowlers. Strike rate counts from 10 balls faced.',
  },
  {
    title: 'Bowling',
    rows: [
      ['Each wicket', '+30'],
      ['Bowled or LBW, extra', '+8'],
      ['Each dot ball', '+1'],
      ['Each maiden over', '+12'],
      ['3 / 4 / 5 wickets (highest only)', '+4 / +8 / +12'],
      ['Economy under 5 / 6 / 7', '+6 / +4 / +2'],
      ['Economy 10–11 / 11–12 / over 12', '−2 / −4 / −6'],
    ],
    note: 'Economy counts from 2 overs bowled.',
  },
  {
    title: 'Fielding',
    rows: [
      ['Each catch', '+8'],
      ['3 or more catches, extra', '+4'],
      ['Each stumping', '+12'],
      ['Run out, direct hit', '+12'],
      ['Run out, shared', '+6'],
    ],
  },
  {
    title: 'Selection',
    rows: [['Named in the announced line-up', '+4']],
  },
];

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Which section is currently at the top of the screen
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => visible.set(entry.target.id, entry.isIntersecting));
        const first = ids.find(id => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: '-120px 0px -55% 0px' },
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return [active, setActive];
}

// ─── Page ───

const HowToPlay = () => {
  useDocumentTitle('Game guide');
  const { hash } = useLocation();
  const [active, setActive] = useActiveSection(SECTION_IDS);
  const [menuOpen, setMenuOpen] = useState(false);

  // Arriving at /guide#bots: jump to that section once the page is on screen
  useEffect(() => {
    if (!hash) return;
    // Section ids are plain ASCII, so the hash needs no decoding
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goTo = (id) => (e) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    // Collapse the mobile menu first, or the content would shift after the scroll starts
    flushSync(() => {
      setMenuOpen(false);
      setActive(id);
    });
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.querySelector('h2')?.focus({ preventScroll: true });
    window.history.replaceState(window.history.state, '', `#${id}`);
  };

  const activeSection = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <PageShell>
      <Hero />

      {/* Phones and tablets: a collapsible contents bar that stays under the top bar */}
      <div className="sticky top-14 z-30 -mx-4 border-y border-white/6 bg-ink-950/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        <button
          type="button"
          className="flex h-11 w-full cursor-pointer items-center gap-2 text-left"
          aria-expanded={menuOpen}
          aria-controls="guide-contents"
          onClick={() => setMenuOpen(open => !open)}
        >
          <ListOrdered size={16} className="shrink-0 text-signal" />
          <span className="shrink-0 font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">On this page</span>
          <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold uppercase tracking-wide text-snow">
            {activeSection.label}
          </span>
          <ChevronDown size={18} className={cn('shrink-0 text-mist transition-transform', menuOpen && 'rotate-180')} />
        </button>
        {menuOpen && (
          <nav id="guide-contents" aria-label="Guide sections" className="max-h-[60dvh] overflow-y-auto scrollbar-thin pb-3">
            <SectionLinks active={active} onNavigate={goTo} />
          </nav>
        )}
      </div>

      <div className="grid gap-10 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="Guide sections" className="sticky top-20">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">On this page</p>
            <SectionLinks active={active} onNavigate={goTo} className="mt-3" />
          </nav>
        </aside>

        <div className="min-w-0 space-y-16">
          <QuickStart />
          <Modes />
          <Bidding />
          <SquadRules />
          <Bots />
          <PublicRooms />
          <Ratings />
          <PowerRankings />
          <Fantasy />
          <Faq />

          <Panel accent="signal" bodyClassName="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Ready when you are</h2>
              <p className="mt-1 text-sm text-mist">Create a room, share the code and pick your franchise.</p>
            </div>
            <Link to="/" className={cn(buttonClasses({ variant: 'primary', size: 'lg', slant: true }), 'shrink-0')}>
              Create or join a room
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </Panel>
        </div>
      </div>

      <Footer />
    </PageShell>
  );
};

const SectionLinks = ({ active, onNavigate, className }) => (
  <ol className={cn('space-y-0.5 border-l border-white/8', className)}>
    {SECTIONS.map((section, i) => {
      const current = section.id === active;
      return (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            onClick={onNavigate(section.id)}
            aria-current={current ? 'location' : undefined}
            className={cn(
              '-ml-px flex items-center gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors',
              current ? 'border-signal text-snow' : 'border-transparent text-haze hover:text-mist',
            )}
          >
            <span className={cn('w-5 shrink-0 font-display text-xs font-bold tabular', current ? 'text-signal' : 'text-haze')}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {section.label}
          </a>
        </li>
      );
    })}
  </ol>
);

// ─── Building blocks ───

const Section = ({ id, title, intro, children }) => {
  const number = String(SECTION_IDS.indexOf(id) + 1).padStart(2, '0');
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 lg:scroll-mt-20">
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <span className="clip-slant bg-signal/15 px-3.5 py-0.5 font-display text-sm font-bold tabular text-signal" aria-hidden>
            {number}
          </span>
          <h2
            id={`${id}-title`}
            tabIndex={-1}
            className="font-display text-2xl font-bold uppercase leading-tight tracking-wide focus:outline-none sm:text-3xl"
          >
            {title}
          </h2>
        </div>
        {intro && <p className="mt-2 max-w-2xl text-mist">{intro}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
};

const TONE_BAR = { signal: 'bg-signal', volt: 'bg-volt', flare: 'bg-flare', gold: 'bg-gold' };
const TONE_TEXT = { signal: 'text-signal', volt: 'text-volt', flare: 'text-flare', gold: 'text-gold' };

// A short rule or fact with a coloured left rule
const Note = ({ icon: Icon, title, tone = 'signal', children, className }) => (
  <div className={cn('relative rounded-lg border border-white/8 bg-ink-850/85 py-4 pl-5 pr-4', className)}>
    <span className={cn('absolute inset-y-4 left-0 w-0.5', TONE_BAR[tone])} aria-hidden />
    <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-snow">
      {Icon && <Icon size={16} strokeWidth={2.4} className={cn('shrink-0', TONE_TEXT[tone])} />}
      {title}
    </h3>
    <div className="mt-1.5 text-sm leading-relaxed text-mist">{children}</div>
  </div>
);

const Small = ({ children, tone, className }) => (
  <span className={cn('font-display text-[11px] font-semibold uppercase tracking-[0.14em]', tone ? TONE_TEXT[tone] : 'text-haze', className)}>
    {children}
  </span>
);

// ─── Hero ───

const Hero = () => (
  <header className="relative pb-8 pt-8 sm:pt-12">
    <Tag tone="signal" icon={BookOpen}>Game guide</Tag>
    <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none tracking-wide sm:text-5xl">
      How Auction <span className="text-signal">Arena</span> works
    </h1>
    <p className="mt-3 max-w-2xl text-mist">
      Auction Arena runs a live IPL auction for you and your friends. This guide covers rooms, bidding, squad rules and
      bots, then what happens after the last lot: ratings, AI power rankings and the fantasy league.
    </p>
    <Panel className="mt-6" bodyClassName="grid grid-cols-2 divide-white/6 sm:grid-cols-4 sm:divide-x">
      <Stat className="px-4 py-3" label="Franchises" value={TEAMS.length} />
      <Stat className="px-4 py-3" label="Auction modes" value={MODES.length} />
      <Stat className="px-4 py-3" label="Players in the full list" value={FULL_LIST} tone="signal" />
      <Stat className="px-4 py-3" label="Bid timer" value={`${MIN_TIMER}–${MAX_TIMER} s`} hint={`${DEFAULT_TIMER} s by default, 3 s in Blitz`} />
    </Panel>
  </header>
);

// ─── 01 Quick start ───

const STEPS = [
  {
    icon: LogIn,
    title: 'Sign in',
    text: 'Use Google, an email and password, or carry on as a guest.',
  },
  {
    icon: Users,
    title: 'Open a room',
    text: 'Pick a mode and your franchise, then share the six-character room code. Or join a friend’s code, or a room from Open rooms.',
  },
  {
    icon: Bot,
    title: 'Fill the lobby',
    text: 'Friends choose their franchises. The host can hand empty ones to bots and set the bid timer.',
  },
  {
    icon: Gavel,
    title: 'Start bidding',
    text: 'The host starts once at least two franchises have a manager, person or bot. Players come up one at a time; press Bid to raise. After the last lot you get the summary.',
  },
];

const QuickStart = () => (
  <Section id="quick-start" title="Quick start" intro="From sign-in to your first bid in four steps.">
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((step, i) => (
        <li key={step.title} className="relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85 p-4">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-signal/60" aria-hidden />
          <div className="flex items-center justify-between">
            <span className="font-display text-3xl font-bold tabular leading-none text-signal">{String(i + 1).padStart(2, '0')}</span>
            <step.icon size={18} className="text-haze" aria-hidden />
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold uppercase tracking-wide">{step.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-mist">{step.text}</p>
        </li>
      ))}
    </ol>
  </Section>
);

// ─── 02 Modes ───

const Modes = () => (
  <Section
    id="modes"
    title="Auction modes"
    intro="The mode is chosen when the room is created. It sets the squad size, the overseas limit, the purse and how many players go under the hammer. Blitz 5 is the quick one: a smaller purse and only 3 seconds per bid."
  >
    <Panel label="Mode settings">
      <ul className="divide-y divide-white/6 sm:hidden">
        {MODES.map(mode => (
          <li key={mode.id} className="px-4 py-3">
            <p className="font-display text-base font-semibold uppercase tracking-wide">{MODE_META[mode.id].label}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Squad" value={mode.squad} size="sm" />
              <Stat label="Overseas" value={mode.overseas} size="sm" />
              <Stat label="Purse" value={crores(mode.purse)} size="sm" tone="volt" />
              <Stat label="Players" value={mode.pool ?? FULL_LIST} size="sm" hint={mode.pool ? 'top players' : 'full list'} />
              <Stat label="Bid timer" value={`${mode.timer ?? DEFAULT_TIMER} s`} size="sm" tone={mode.timer ? 'flare' : undefined} />
            </div>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left sm:table">
        <thead>
          <tr className="border-b border-white/6">
            {['Mode', 'Squad', 'Overseas', 'Purse', 'Players', 'Bid timer'].map((heading, i) => (
              <th
                key={heading}
                scope="col"
                className={cn(
                  'px-2 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-haze sm:px-4',
                  i > 0 && 'text-right',
                )}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {MODES.map(mode => (
            <tr key={mode.id}>
              <th scope="row" className="px-2 py-3 sm:px-4">
                <span className="font-display text-base font-semibold uppercase tracking-wide text-snow">{MODE_META[mode.id].label}</span>
              </th>
              <td className="px-2 py-3 text-right font-display text-base font-bold tabular sm:px-4 sm:text-lg">{mode.squad}</td>
              <td className="px-2 py-3 text-right font-display text-base font-bold tabular sm:px-4 sm:text-lg">{mode.overseas}</td>
              <td className="px-2 py-3 text-right font-display text-base font-bold tabular text-volt sm:px-4 sm:text-lg">
                {crores(mode.purse)}
              </td>
              <td className="px-2 py-3 text-right sm:px-4">
                <span className="block font-display text-base font-bold tabular sm:text-lg">{mode.pool ?? FULL_LIST}</span>
                <span className="block text-[11px] leading-tight text-haze">{mode.pool ? 'drawn from the top' : 'full list'}</span>
              </td>
              <td className={cn('px-2 py-3 text-right font-display text-base font-bold tabular sm:px-4 sm:text-lg', mode.timer && 'text-flare')}>
                {mode.timer ?? DEFAULT_TIMER} s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>

    <div className="grid gap-3 md:grid-cols-3">
      <Note icon={Shuffle} title="Order of play">
        Players come up set by set, starting with the marquee set. The order inside each set is shuffled for every room.
      </Note>
      <Note icon={Layers} title="Shorter pools" tone="volt">
        Classic 11, Sprint 5 and Blitz 5 draw a fresh pool for each room at random from the top-rated players (a group half as
        big again as the pool), keeping the mix of roles, so every room gets a different set of stars. Every franchise gets an
        Indian keeper to go after, and there are enough Indians to fill every squad.
      </Note>
      <Note icon={Users} title="Ten franchises" tone="gold">
        Every room has all ten IPL franchises, each starting with the full purse. Franchises nobody takes can go to bots
        or simply sit out.
      </Note>
    </div>

    <Note icon={Timer} title="Quick pool (any mode)" tone="signal">
      For a shorter auction the host can turn on Quick pool, on the Host screen or in the lobby. Then only one
      squad&rsquo;s worth of players per franchise taking part goes under the hammer, plus 10 spares: four franchises in
      Classic 11 means 4 × 11 + 10 = 54 players, ten franchises in Mega means 260 instead of {FULL_LIST}. The count is
      made when the host presses Start, and the players are drawn from the top in the same way.
    </Note>
  </Section>
);

// ─── 03 Bidding ───

const stepLabel = (from, to) => `+${Math.round((to - from) * 100)} L`;

const BidLadder = () => (
  <div>
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-3" aria-label="Bid ladder for a player with a ₹2 Cr base price">
      {LADDER_SHOWN.map((price, i) => {
        const prev = LADDER_SHOWN[i - 1];
        const big = price !== null && price >= 5;
        return (
          <li key={price ?? 'gap'} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                className={cn(
                  'flex flex-col items-center font-display text-[10px] font-semibold uppercase leading-none tracking-wider',
                  price === null || prev === null ? 'text-haze' : big ? 'text-volt' : 'text-signal',
                )}
                aria-hidden
              >
                <ArrowRight size={12} strokeWidth={2.5} />
                {price !== null && prev !== null && <span className="mt-0.5">{stepLabel(prev, price)}</span>}
              </span>
            )}
            {price === null ? (
              <span className="px-1 font-display text-lg font-bold text-haze">…</span>
            ) : (
              <span
                className={cn(
                  'flex h-9 min-w-14 flex-col items-center justify-center rounded-md border px-2 font-display tabular',
                  i === 0 ? 'border-snow/40 bg-snow/10' : big ? 'border-volt/40 bg-volt/10' : 'border-signal/30 bg-signal/10',
                )}
              >
                <span className="text-base font-bold leading-none">{price.toFixed(2)}</span>
                {i === 0 && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-mist">Base</span>}
              </span>
            )}
          </li>
        );
      })}
    </ol>
    <div className="mt-4 flex flex-wrap gap-2">
      <Tag tone="neutral">Prices in ₹ Cr</Tag>
      <Tag tone="signal">+₹20 L under ₹5 Cr</Tag>
      <Tag tone="volt">+₹25 L from ₹5 Cr</Tag>
    </div>
  </div>
);

const RUNDOWN = [
  { value: `${FIRST_LOT_SECONDS} s`, caption: 'First lot', tone: 'signal', icon: Timer },
  { link: 'Bid' },
  { value: `${DEFAULT_TIMER} s`, caption: 'Clock resets', tone: 'signal', icon: Timer },
  { link: 'Bid' },
  { value: `${DEFAULT_TIMER} s`, caption: 'Resets again', tone: 'signal', icon: Timer },
  { link: 'Time up' },
  { value: 'Sold', caption: `Card for ${SOLD_CARD_SECONDS} s`, tone: 'volt', icon: Gavel, caps: true },
  { link: '' },
  { value: 'Next lot', caption: 'Fresh clock', tone: 'neutral', icon: ArrowRight, caps: true },
];

const LotRundown = () => (
  <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
    {RUNDOWN.map((item, i) =>
      item.link !== undefined ? (
        <li key={i} className="flex flex-col items-center font-display text-[10px] font-semibold uppercase leading-none tracking-wider text-haze" aria-label={item.link || 'then'}>
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
          {item.link && <span className="mt-0.5">{item.link}</span>}
        </li>
      ) : (
        <li key={i} className="flex flex-col items-start">
          <span
            className={cn(
              'clip-notch flex h-9 items-center gap-1.5 pl-2.5 pr-4 font-display text-base font-bold tabular',
              item.caps && 'uppercase tracking-wide',
              item.tone === 'volt' ? 'bg-volt text-ink-950' : item.tone === 'signal' ? 'bg-signal/15 text-signal' : 'bg-ink-700 text-snow',
            )}
          >
            <item.icon size={14} strokeWidth={2.5} aria-hidden />
            {item.value}
          </span>
          <span className="mt-1 text-xs text-haze">{item.caption}</span>
        </li>
      ),
    )}
  </ol>
);

const Bidding = () => (
  <Section id="bidding" title="Bidding" intro="One player at a time. Whoever holds the highest bid when the clock runs out buys the player.">
    <Panel label="Bid steps" accent="signal" bodyClassName="space-y-4 p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-mist">
        The opening bid is always the player&rsquo;s base price. After that each bid adds ₹20 L while the price is under
        ₹5 Cr, and ₹25 L from ₹5 Cr up. Here&rsquo;s a player with a ₹2 Cr base price:
      </p>
      <BidLadder />
    </Panel>

    <Panel label="The clock" bodyClassName="space-y-4 p-4 sm:p-5">
      <LotRundown />
      <ul className="grid gap-x-6 gap-y-2 text-sm leading-relaxed text-mist sm:grid-cols-2">
        <li>
          <strong className="font-semibold text-snow">The first lot gets {FIRST_LOT_SECONDS} seconds</strong> so everyone can
          settle in. Every lot after that starts on the room&rsquo;s bid timer.
        </li>
        <li>
          <strong className="font-semibold text-snow">Every bid resets the clock</strong> to the full bid timer: {DEFAULT_TIMER}{' '}
          seconds by default, anything from {MIN_TIMER} to {MAX_TIMER} if the host changes it.
        </li>
        <li>
          <strong className="font-semibold text-snow">When it hits zero</strong> the top bidder buys the player and the sold
          card stays up for {SOLD_CARD_SECONDS} seconds.
        </li>
        <li>
          <strong className="font-semibold text-snow">No bids?</strong> The player goes unsold ({UNSOLD_CARD_SECONDS}-second
          card). With &ldquo;Unsold come back&rdquo; on (the default), every unsold player returns in another round once
          the last player has been called. Rounds go on until one sells nobody or no franchise can still buy. The host
          can switch this off, and then unsold players are out.
        </li>
      </ul>
    </Panel>

    <div className="grid gap-3 md:grid-cols-3">
      <Note icon={ShieldCheck} title="You pay what you saw" tone="volt">
        Your bid button shows the next price. If someone else gets in first, the server turns your bid down with
        &ldquo;the price has moved&rdquo; rather than charge you more. Check the new price and bid again.
      </Note>
      <Note icon={Hand} title="No bidding against yourself">
        While you hold the top bid, you can&rsquo;t raise it. Wait for someone else to bid.
      </Note>
      <Note icon={Pause} title="Host controls" tone="gold">
        The host can pause live bidding and resume it with a fresh clock, end the auction early, or hide who&rsquo;s
        coming next so every lot is a surprise.
      </Note>
    </div>
  </Section>
);

// ─── 04 Squad rules ───

const PurseBar = () => {
  const { purse, max, reserve, open, bought, squadLimit } = HINT_EXAMPLE;
  return (
    <div className="space-y-3">
      <p className="text-sm text-mist">
        Example: Classic 11, {bought} players bought, {formatPrice(purse)} left. That&rsquo;s {open} open slots, so after
        this player {open - 1} still need filling.
      </p>
      <div className="flex h-10 overflow-hidden rounded-md border border-white/8" aria-hidden>
        <div className="flex items-center bg-volt/20 px-3" style={{ width: `${(max / purse) * 100}%` }}>
          <span className="truncate font-display text-sm font-bold uppercase tracking-wide text-volt">Max bid {formatPrice(max)}</span>
        </div>
        <div className="flex flex-1 items-center justify-center bg-ink-700 bg-stripes">
          <span className="truncate px-1 font-display text-xs font-semibold uppercase tracking-wider text-mist">Kept back</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Purse left" value={formatPrice(purse)} size="sm" />
        <Stat label="Slots after this one" value={`${open - 1} of ${squadLimit}`} size="sm" />
        <Stat label={`Kept back (${open - 1} × ₹30 L)`} value={formatPrice(reserve)} size="sm" />
        <Stat label="Max-bid hint" value={formatPrice(max)} size="sm" tone="volt" />
      </div>
    </div>
  );
};

const SquadRules = () => (
  <Section
    id="squad-rules"
    title="Squad rules"
    intro="Three limits are checked on every bid, for people and bots alike. If a bid would break one, it’s turned down."
  >
    <div className="grid gap-3 md:grid-cols-3">
      <Note icon={Users} title="Squad limit">
        {byMode('squad')} players (Mega / Classic 11 / Sprint 5 / Blitz 5). Once your squad is full you&rsquo;re out of the bidding.
      </Note>
      <Note icon={Plane} title="Overseas quota" tone="gold">
        {byMode('overseas')} players by default. The host can set any number before the start, or no limit at all.
        Anyone not from India counts as overseas. At your quota you can still buy Indian players, just not overseas ones.
      </Note>
      <Note icon={Wallet} title="Purse" tone="volt">
        {byMode('purse', crores)}. You can&rsquo;t bid more than you have left, and money only leaves your purse when you
        win a player.
      </Note>
    </div>

    <Panel label="The max-bid hint" accent="volt" bodyClassName="space-y-4 p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-mist">
        In the auction room you&rsquo;ll see the most you can sensibly bid on the current player. It keeps ₹30 L (the
        lowest base price) back for every slot you still have to fill after this one, so one big buy can&rsquo;t leave you
        unable to finish your squad.
      </p>
      <PurseBar />
    </Panel>
  </Section>
);

// ─── 05 Bots ───

const Bots = () => (
  <Section
    id="bots"
    title="Bots"
    intro="Bots manage franchises nobody has claimed, so you can run a full ten-team auction with a couple of friends, or on your own."
  >
    <div className="grid gap-3 md:grid-cols-2">
      <Note icon={Bot} title="Filling empty franchises">
        Only the host can add bots, and only in the lobby before the start: every open franchise at once, or one at a
        time. They&rsquo;re removed the same way. Bots can&rsquo;t be added after the auction starts.
      </Note>
      <Note icon={Gauge} title="How they value players" tone="volt">
        A bot compares the player&rsquo;s Arena Rating with the pool&rsquo;s average (every 10 points above it doubles
        the value), then scales that by the purse it has per open slot and the roles it still needs. It also rolls a
        mood for each player, set once so it can&rsquo;t change its mind mid-lot.
      </Note>
      <Note icon={ShieldCheck} title="They never break the rules" tone="gold">
        Bots go through the same squad, overseas and purse checks as you. They always keep enough to fill their
        remaining slots, and cap what they&rsquo;ll pay for one star: around 22% of the purse in Mega, up to about 35%
        in the 5-player modes, give or take their mood.
      </Note>
      <Note icon={Timer} title="How they bid">
        Quickly while the price is well under what they think a player is worth, more slowly near their limit, and
        sometimes they drop out just short of it. A bot never bids in the last 0.6 seconds, so a person always gets the
        final say.
      </Note>
    </div>

    <Panel label="Each franchise’s bot" bodyClassName="p-4 sm:p-5">
      <p className="mb-4 text-sm text-mist">
        Every bot aims for a balanced squad but leans towards one role (shown under its name), and some push prices
        harder than others.
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {BOT_STYLES.map(style => {
          const mood = temperament(style.boldness);
          const team = TEAMS_BY_ID.get(style.teamId);
          return (
            <li key={style.teamId} className="flex items-center gap-2.5 rounded-md border border-white/6 bg-ink-900/60 p-2">
              <TeamCrest teamId={style.teamId} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display text-sm font-bold uppercase tracking-wide" title={team?.name}>{style.teamId}</span>
                  <Tag tone={mood.tone}>{mood.label}</Tag>
                </div>
                <p className="mt-0.5 text-xs text-mist">{ROLE_META[style.favours].plural}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>

    <Panel accent="volt" bodyClassName="flex gap-4 p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-volt/15 text-volt">
        <Hand size={20} />
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold uppercase tracking-wide">Taking over from a bot</h3>
        <p className="mt-1 text-sm leading-relaxed text-mist">
          Before the auction starts, pick a bot&rsquo;s franchise in the lobby and it&rsquo;s yours: the bot leaves and
          you start with the full purse. Once the auction is under way, bots can&rsquo;t be added, removed or taken
          over. Bots can&rsquo;t be kicked either; the host removes them from the lobby instead.
        </p>
      </div>
    </Panel>
  </Section>
);

// ─── 06 Public rooms & spectating ───

const ACCESS = [
  ['See the lot, bids and clock live', true, true],
  ['Read the chat', true, true],
  ['Bid', true, false],
  ['Send chat messages', true, false],
];

const Allowed = ({ yes }) => (
  <>
    {yes ? <Check size={16} strokeWidth={3} className="inline text-volt" aria-hidden /> : <X size={16} strokeWidth={3} className="inline text-flare" aria-hidden />}
    <span className="sr-only">{yes ? 'Yes' : 'No'}</span>
  </>
);

const PublicRooms = () => (
  <Section
    id="public-rooms"
    title="Public rooms & spectating"
    intro="Rooms are private unless the host lists them. Anyone who has the room code can watch either way."
  >
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel label="Open rooms" accent="signal" bodyClassName="space-y-4 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-mist">
          Turn on the public option when you create a room, or later in the room settings, and it shows up in Open
          rooms on the home page. A room stays listed while someone has its lobby open or the auction is live, and
          drops off when it finishes.
        </p>
        {/* What a listing looks like */}
        <figure className="rounded-md border border-white/8 bg-ink-900/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <LiveTag />
            <span className="font-display text-base font-semibold uppercase tracking-wide">{MODE_META.mega.label}</span>
            <span className="ml-auto font-display text-sm tabular text-mist">Lot 37 / {FULL_LIST}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag icon={Users}>3 people</Tag>
            <Tag icon={Bot}>6 bots</Tag>
            <Tag tone="volt">1 open</Tag>
            <Tag icon={Eye}>2 watching</Tag>
          </div>
          <figcaption className="mt-2 text-xs text-haze">Example listing: mode, progress, who&rsquo;s in and how many franchises are free.</figcaption>
        </figure>
      </Panel>

      <Panel label="Watching a room" bodyClassName="space-y-4 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-mist">
          Anyone signed in, guests included, can watch: choose Watch in Open rooms, or add{' '}
          <span className="rounded-sm bg-ink-700 px-1 font-display tracking-wide text-snow">?watch=1</span> to a room link.
          Watchers don&rsquo;t take a franchise. To play, use Join as a manager and pick an open one. Arriving after
          the start? You&rsquo;re offered any franchise nobody holds, with the full purse, or you can watch.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6">
              <th scope="col" className="py-2 text-left"><Small>What you can do</Small></th>
              <th scope="col" className="w-20 py-2 text-center"><Small>Manager</Small></th>
              <th scope="col" className="w-20 py-2 text-center"><Small>Watcher</Small></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {ACCESS.map(([label, manager, watcher]) => (
              <tr key={label}>
                <th scope="row" className="py-2 pr-2 text-left font-normal text-mist">{label}</th>
                <td className="py-2 text-center"><Allowed yes={manager} /></td>
                <td className="py-2 text-center"><Allowed yes={watcher} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  </Section>
);

// ─── 07 Arena Rating & Arena Strength ───

const Ratings = () => (
  <Section id="ratings" title="Arena Rating & Arena Strength" intro="Two numbers you’ll see everywhere: one for players, one for squads.">
    <Panel label="Arena Rating" accent="signal" bodyClassName="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-mist">
          Every player has an Arena Rating from 1 to 99. Career numbers alone can be patchy, so the player&rsquo;s auction
          tier sets a band (marquee players rate between 82 and 96, uncapped players mostly below 55), and their T20
          career places them inside it, compared with every other player in the same role. Batting is judged on average ×
          strike rate plus career runs; bowling on economy plus career wickets. All-rounders are judged on both: their
          stronger skill counts 70%, the other 30%. A short record keeps a player near the middle of their band. So the
          best bowler in the marquee set rates as highly as the best batter.
        </p>
        <p className="text-sm leading-relaxed text-mist">
          Last comes the outlook for the next IPL. For about a hundred players, recent IPL and T20 international form,
          retirements, injuries and bans move the rating up or down: Vaibhav Sooryavanshi gains 16 after his 2026
          Orange Cap, and a player who has retired loses 40. Their player card shows the change and the reason.
        </p>
        <div aria-label="Rating bands by auction tier">
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {[['Marquee', '82–96'], ['Set 1', '74–88'], ['Set 2', '68–82'], ['Set 3', '62–76'], ['Set 4', '55–70'], ['Capped overseas', '50–85'], ['Uncapped', '32–62']].map(([tierName, band]) => (
              <span key={tierName} className="rounded-sm border border-white/8 bg-ink-900/60 px-2 py-1 font-display text-xs uppercase tracking-wider text-mist">
                {tierName} <span className="tabular text-signal">{band}</span>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-haze">The band comes from the tier; career stats decide where in the band a player lands, and the outlook can move them past it.</p>
        </div>
      </div>
      <ul className="space-y-1.5" aria-label="Rating tiers">
        {TIERS.map(tier => (
          <li key={tier.id} className="flex items-center gap-3 rounded-md bg-ink-900/60 px-2.5 py-1.5">
            <RatingBadge rating={tier.floor} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-display text-sm font-semibold uppercase tracking-wide">{tier.label}</span>
              <span className="block font-display text-xs tabular text-mist">{tier.range}</span>
            </span>
            <span className="shrink-0 text-right text-[11px] tabular text-haze">{TIER_COUNTS[tier.id] ?? 0} players</span>
          </li>
        ))}
      </ul>
    </Panel>

    <Panel label="Arena Strength" accent="volt" bodyClassName="space-y-4 p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-mist">
        Arena Strength rates a whole squad on paper, judged on the best playing XI it can field (in the 5-player modes,
        the five). The XI&rsquo;s average Arena Rating makes up 75% of it, with an empty place counting as zero, so an
        unfinished squad can&rsquo;t top a full one. The average of your full squad adds 25% for depth. The XI can use
        half your squad&rsquo;s overseas allowance (4 of the usual 8; more if the host allows more overseas), and it&rsquo;s
        picked for fit as well as rating, so a slightly weaker spinner or death bowler can win a place.
      </p>
      <p className="text-sm leading-relaxed text-mist">
        Then the XI&rsquo;s combination is checked, and anything a T20 side needs but doesn&rsquo;t have costs points.
        Every player has a profile (batting hand, position and style, pace or spin, and when they bowl). Where we don&rsquo;t
        know a lesser-known player&rsquo;s profile, they get the benefit of the doubt.
      </p>
      <div className="flex flex-wrap items-center gap-2 font-display" aria-label="Best XI average times 0.75, plus squad average times 0.25, minus combination gaps">
        <span className="rounded-md border border-volt/40 bg-volt/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide">
          Best XI avg <span className="tabular text-volt">× 0.75</span>
        </span>
        <span className="text-lg font-bold text-haze" aria-hidden>+</span>
        <span className="rounded-md border border-signal/30 bg-signal/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide">
          Squad avg <span className="tabular text-signal">× 0.25</span>
        </span>
        <span className="text-lg font-bold text-haze" aria-hidden>−</span>
        <span className="rounded-md border border-flare/40 bg-flare/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide">
          Combination gaps
        </span>
        <span className="text-lg font-bold text-haze" aria-hidden>=</span>
        <span className="clip-slant bg-volt px-5 py-1.5 text-sm font-bold uppercase tracking-wide text-ink-950">Arena Strength</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['No wicketkeeper', 'No keeper in the XI. −8.'],
          ['Short of bowling', 'Fewer than 5 bowling options (2 in the 5-player modes). Bowlers and all-rounders count. −6 each.'],
          ['Short of batting', 'Fewer than 6 batting options (3 in the 5-player modes). Batters, keepers and all-rounders count. −5 each.'],
          ['Openers', 'Two specialist openers (one in the 5-player modes). −3 each missing.'],
          ['Power hitting', 'Three aggressive hitters (one in the 5-player modes). −2 each missing.'],
          ['No anchor up top', 'A top order with nobody to build an innings. −2. Full XIs only.'],
          ['No finisher', 'Nobody to close an innings. −3. Full XIs only.'],
          ['Left/right mix', 'A top order that is all right-handed or all left-handed. −2. Full XIs only.'],
          ['Pace and spin', 'Two pace options and a spinner (one of each in the 5-player modes). −3 each missing.'],
          ['Powerplay and death', 'Two bowlers for the powerplay and two for the death (one each in the 5-player modes). −2 / −3 each missing.'],
          ['No left-arm bowler', 'No left-arm pace or spin for variety. −1. Full XIs only.'],
        ].map(([gap, text]) => (
          <li key={gap} className="rounded-md border border-white/6 bg-ink-900/60 p-3">
            <Tag tone="flare">{gap}</Tag>
            <p className="mt-1.5 text-xs leading-relaxed text-mist">{text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  </Section>
);

// ─── 08 AI power rankings ───

const SkeletonLine = ({ className }) => <span className={cn('block h-2 rounded-full bg-ink-600', className)} aria-hidden />;

const RankingAnatomy = () => (
  <figure className="rounded-md border border-white/8 bg-ink-900/70 p-4">
    <div className="flex items-center gap-3">
      <span className="clip-notch flex h-10 w-12 shrink-0 items-center justify-center bg-gold font-display text-xl font-bold text-ink-950">#1</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Small>Franchise · headline</Small>
        <SkeletonLine className="w-3/4" />
      </div>
      <div className="text-right">
        <span className="block font-display text-3xl font-bold leading-none text-volt">A−</span>
        <span className="text-[11px] tabular text-haze">score 0–100</span>
      </div>
    </div>
    <div className="mt-4 space-y-1.5">
      <Small>Summary</Small>
      <SkeletonLine />
      <SkeletonLine className="w-5/6" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Small tone="volt">Strengths</Small>
        <SkeletonLine className="w-4/5" />
        <SkeletonLine className="w-3/5" />
      </div>
      <div className="space-y-1.5">
        <Small tone="flare">Weaknesses</Small>
        <SkeletonLine className="w-4/5" />
        <SkeletonLine className="w-2/3" />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <Tag tone="gold">Best buy</Tag>
      <SkeletonLine className="w-1/3" />
    </div>
    <figcaption className="mt-4 border-t border-white/6 pt-3">
      <Small>Grades</Small>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {GRADES.map(grade => (
          <span key={grade} className="rounded-sm bg-ink-700 px-1.5 py-0.5 font-display text-xs font-bold text-snow">{grade}</span>
        ))}
      </div>
    </figcaption>
  </figure>
);

const PowerRankings = () => (
  <Section id="power-rankings" title="AI power rankings" intro="Once the auction is over, an AI analyst previews how every franchise’s squad would do in the next IPL.">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Note icon={Sparkles} title="Made once per room">
          When the auction is complete, any manager in the room can generate them from the summary page. The result is
          saved, so everyone sees the same rankings. The host can regenerate them for a second opinion.
        </Note>
        <Note icon={Scale} title="What it judges" tone="volt">
          Each squad as a side for the next IPL: its best XI&rsquo;s Arena Ratings, which include form and outlook
          (about half), the XI&rsquo;s combination (openers, a finisher, a left/right mix, power and an anchor, a
          keeper, pace and spin, powerplay and death bowling), then bench cover and value. Strengths and weaknesses
          name the players involved. All-rounders count as both batting and bowling options. The final score is half the
          AI&rsquo;s view and half Arena Strength, and a squad short of players loses points either way: 8 for each empty
          place in the XI, 1 for each missing reserve.
        </Note>
        <Note icon={ShieldCheck} title="What it’s sent" tone="gold">
          Each franchise&rsquo;s best XI with ratings, prices, playing profiles and next-IPL outlook notes, its gaps and
          a summary of its bench.
          Manager names are never sent to the AI.
        </Note>
        <Note icon={Check} title="Checked before it’s shown">
          Scores are kept between 0 and 100, and a best buy only counts if that franchise really signed the player.
          Franchises that bought nobody aren&rsquo;t ranked. Rankings are generated with Groq and need an AI key set up
          on the server.
        </Note>
      </div>
      <RankingAnatomy />
    </div>
  </Section>
);

// ─── 09 Fantasy league ───

const TeamSheet = () => (
  <figure>
    <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden>
      {Array.from({ length: 11 }, (_, i) => {
        const slot = i + 1;
        const badge = slot === 1 ? 'C' : slot === 2 ? 'VC' : null;
        return (
          <span
            key={slot}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-md border font-display tabular',
              slot <= 5 ? 'border-ink-500 bg-ink-800 text-snow' : 'border-dashed border-ink-600 bg-ink-900/40 text-haze',
            )}
          >
            <span className="text-sm font-bold leading-none sm:text-base">{slot}</span>
            {badge && (
              <span className={cn('mt-1 rounded-sm px-1 text-[10px] font-bold leading-tight', badge === 'C' ? 'bg-gold text-ink-950' : 'bg-signal text-ink-950')}>
                {badge}
              </span>
            )}
          </span>
        );
      })}
      <span className="flex aspect-square flex-col items-center justify-center rounded-md border border-volt/50 bg-volt/10 font-display text-volt">
        <span className="text-sm font-bold leading-none sm:text-base">IP</span>
      </span>
    </div>
    <figcaption className="mt-3 flex flex-wrap gap-1.5">
      <Tag tone="gold">C · ×2</Tag>
      <Tag tone="signal">VC · ×1.5</Tag>
      <Tag tone="volt">Impact · ×1</Tag>
      <Tag>Slots 6–11 optional</Tag>
      <Tag icon={Plane}>Max 4 overseas</Tag>
    </figcaption>
  </figure>
);

const Fantasy = () => (
  <Section id="fantasy" title="Fantasy league" intro="Your auction squad carries on into the real IPL season.">
    <Panel accent="gold" bodyClassName="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <ul className="space-y-3 text-sm leading-relaxed text-mist">
        <li>
          <strong className="font-semibold text-snow">Pick your XI</strong> on the summary page&rsquo;s Fantasy tab, from
          the players you bought in that room: at least 5, at most 11, and no more than 4 from overseas.
        </li>
        <li>
          <strong className="font-semibold text-snow">Choose a captain and vice-captain</strong> from your XI. The captain
          scores double points and the vice-captain 1.5×. Both are needed, and they must be different players.
        </li>
        <li>
          <strong className="font-semibold text-snow">Add an impact player</strong> if you like: one more of your players
          from outside the XI, scoring normal points. They can&rsquo;t be overseas if your XI already has four.
        </li>
        <li>
          <strong className="font-semibold text-snow">Points come from real IPL matches.</strong> Every morning, around
          08:00 IST, a job reads the scorecards of finished matches and adds each player&rsquo;s points. Your total is
          your picks&rsquo; points across every match scored so far. The room&rsquo;s own leaderboard ranks managers by
          their average: that total divided by the number of players picked, impact player included.
        </li>
      </ul>
      <TeamSheet />
    </Panel>

    <details className="group rounded-lg border border-white/8 bg-ink-850/85">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-mist">Full points table</span>
        <ChevronDown size={18} className="shrink-0 text-haze transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-x-8 gap-y-6 border-t border-white/6 p-4 md:grid-cols-2">
        {SCORING.map(group => (
          <div key={group.title}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-snow">{group.title}</h3>
            <dl className="mt-2 divide-y divide-white/6">
              {group.rows.map(([what, points]) => (
                <div key={what} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <dt className="text-mist">{what}</dt>
                  <dd className="shrink-0 font-display font-semibold tabular text-snow">{points}</dd>
                </div>
              ))}
            </dl>
            {group.note && <p className="mt-2 text-xs text-haze">{group.note}</p>}
          </div>
        ))}
      </div>
    </details>
  </Section>
);

// ─── 10 FAQ ───

const FAQS = [
  {
    q: 'I lost my connection. What happens?',
    a: 'The app reconnects by itself and puts you back in the room with the current lot, clock and chat. The auction doesn’t wait for you, because the clock runs on the server, so you may have missed a lot or two. Reloading the page does the same thing.',
  },
  {
    q: 'What if the server restarts mid-auction?',
    a: 'Every bid, sale and setting is saved as it happens. When the server is back it reloads the room and carries on from the same lot. If that lot’s clock ran out during the restart, it’s settled straight away: sold to the top bidder, or unsold.',
  },
  {
    q: 'I was removed from a room. Can I get back in?',
    a: 'No. When the host removes someone, that account can’t rejoin or watch that room again. Their squad is taken out of the room, and if they held the top bid on the live lot, it goes back to no bids. You can still create or join other rooms.',
  },
  {
    q: 'Can I switch franchise?',
    a: 'Yes, until you buy your first player. Pick any open franchise in the room. Before the auction starts you can also take a bot’s franchise, and the bot leaves. A franchise held by another person can’t be taken, and after your first signing you’re locked in.',
  },
  {
    q: 'Why did my bid say “the price has moved”?',
    a: 'Someone else’s bid reached the server just before yours. Rather than charge you more than the price on your button, the server turns your bid down. Check the new price and bid again if you still want the player.',
  },
  {
    q: 'What can the host do that others can’t?',
    a: 'Change the bid timer, whether the room is public and whether upcoming players are hidden, add or remove bots before the start, start the auction, pause and resume live bidding, end it early, remove people from the room and regenerate the AI power rankings.',
  },
];

const Faq = () => (
  <Section id="faq" title="FAQ">
    <div className="space-y-2">
      {FAQS.map(({ q, a }) => (
        <details key={q} className="group rounded-lg border border-white/8 bg-ink-850/85 open:border-signal/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-snow">{q}</span>
            <ChevronDown size={18} className="shrink-0 text-haze transition-transform group-open:rotate-180 group-open:text-signal" aria-hidden />
          </summary>
          <p className="border-t border-white/6 px-4 py-3 text-sm leading-relaxed text-mist">{a}</p>
        </details>
      ))}
    </div>
  </Section>
);

export default HowToPlay;
