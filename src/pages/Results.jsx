import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Crown, Gavel, Gem, House, ListOrdered, LogIn, Pencil, Plane, SearchX, Share2, Sparkles, TriangleAlert, Trophy, Users, Zap,
} from 'lucide-react';
import { useAuction } from '../hooks/useAuction';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLocalSetting } from '../hooks/useLocalSetting';
import SquadPoster from '../components/SquadPoster';
import PowerRankings from '../components/PowerRankings';
import FantasyDashboard from '../components/fantasy/FantasyDashboard';
import LineupEditor from '../components/LineupEditor';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Tag, { LiveTag } from '../components/ui/Tag';
import Stat from '../components/ui/Stat';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import Segmented from '../components/ui/Segmented';
import PreShow from '../components/PreShow';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { buttonClasses } from '../components/ui/styles';
import { cn } from '../lib/cn';
import { TEAMS_BY_ID, teamStrength, withPlayer } from '../lib/catalog';
import { lineupFor } from '../lib/lineup';
import { MODE_META, ROLES, ROLE_META, formatPrice, isOverseas, overseasUsage } from '../lib/format';
import { shareElementAsImage } from '../lib/shareImage';

const TABS = [
  { id: 'standings', label: 'Standings', icon: ListOrdered },
  { id: 'squads', label: 'Squads', icon: Users },
  { id: 'top', label: 'Top buys', icon: Gavel },
  { id: 'ai', label: 'AI rankings', icon: Sparkles },
  { id: 'fantasy', label: 'Fantasy', icon: Zap },
];
const TAB_IDS = new Set(TABS.map(t => t.id));

const franchiseName = (teamId, fallback) => TEAMS_BY_ID.get(teamId)?.name ?? fallback ?? teamId;

// Everything the tabs show, worked out once per render from the room snapshot
function buildResults(auction, roomTeams, userId) {
  const squadLimit = auction.squadLimit || 25;
  const managers = new Map((auction.players || []).map(p => [p.id, p]));

  const teams = roomTeams.map(rt => {
    const players = (rt.squad || []).map(withPlayer).filter(Boolean).map(p => ({ ...p, teamId: rt.teamId }));
    const manager = managers.get(rt.userId);
    const strength = teamStrength(rt.squad || [], squadLimit, auction.overseasLimit);
    return {
      ...rt,
      name: franchiseName(rt.teamId, rt.teamName),
      players,
      spent: players.reduce((sum, p) => sum + p.bid, 0),
      overseas: players.filter(isOverseas).length,
      strength,
      // The manager's XI in batting order, or the best XI in a suggested order
      lineup: lineupFor(players, strength.bestXI, rt.battingOrder),
      isBot: Boolean(manager?.isBot),
      managerName: manager?.name ?? 'Unknown manager',
      isYou: rt.userId === userId,
    };
  });

  const standings = [...teams].sort((a, b) =>
    b.strength.score - a.strength.score || a.spent - b.spent || a.name.localeCompare(b.name));
  const sold = teams.flatMap(t => t.players).sort((a, b) => b.bid - a.bid);

  // Steal: most Arena Rating per crore among genuinely good players (60+), else among everyone
  const priced = sold.filter(p => p.bid > 0);
  const goodOnes = priced.filter(p => p.rating >= 60);
  const stealPool = goodOnes.length ? goodOnes : priced;
  const steal = stealPool.reduce((best, p) => (!best || p.rating / p.bid > best.rating / best.bid ? p : best), null);

  return {
    squadLimit,
    teams,
    standings,
    sold,
    biggestBuy: sold[0] ?? null,
    steal,
    strongest: standings[0]?.players.length ? standings[0] : null,
    totalSpent: sold.reduce((sum, p) => sum + p.bid, 0),
  };
}

// Rating vs price: what similarly rated players (±5) went for in this room
function valueRead(player, sold) {
  const peers = sold.filter(p => p.id !== player.id && Math.abs(p.rating - player.rating) <= 5);
  if (peers.length < 2 || player.bid <= 0) return null;
  const typical = peers.reduce((sum, p) => sum + p.bid, 0) / peers.length;
  const ratio = typical / player.bid;
  if (ratio >= 1.2) return { label: 'Good value', tone: 'volt', typical };
  if (ratio <= 0.8) return { label: 'Paid extra', tone: 'flare', typical };
  return { label: 'Fair price', tone: 'neutral', typical };
}

// The poster is mounted off-screen only while it's being exported; give the
// browser a couple of frames to lay it out before it's copied
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

const OverseasMark = () => (
  <span className="ml-1 inline-block align-[-1px] text-signal" title="Overseas player">
    <Plane size={13} aria-hidden />
    <span className="sr-only">Overseas</span>
  </span>
);

const ManagerLine = ({ team, className }) => (
  <div className={cn('flex min-w-0 items-center gap-1.5 text-sm text-mist', className)}>
    <span className="truncate">{team.managerName}</span>
    {team.isBot && <Tag icon={Bot}>Bot</Tag>}
    {team.isYou && <Tag tone="volt">You</Tag>}
  </div>
);

const HighlightCard = ({ label, icon: Icon, accent, children }) => (
  <Panel accent={accent} className="min-w-0" bodyClassName="p-4">
    <div className="mb-3 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">
      <Icon size={14} strokeWidth={2.4} aria-hidden /> {label}
    </div>
    {children}
  </Panel>
);

const PlayerHighlight = ({ player, children }) => (
  <div className="flex min-w-0 items-center gap-3">
    <PlayerPhoto player={player} className="size-12 shrink-0 text-sm" />
    <div className="min-w-0 flex-1">
      <p className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide">{player.name}</p>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-mist">
        <TeamCrest teamId={player.teamId} size="xs" />
        <span className="truncate">{children}</span>
      </div>
    </div>
    <RatingBadge rating={player.rating} />
  </div>
);

// ─── Standings ───

const StandingsTab = ({ results }) => {
  const { standings, biggestBuy, steal, strongest, squadLimit } = results;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <HighlightCard label="Biggest buy" icon={Gavel} accent="signal">
          {biggestBuy ? (
            <PlayerHighlight player={biggestBuy}>
              <span className="font-semibold text-snow tabular">{formatPrice(biggestBuy.bid)}</span> · {franchiseName(biggestBuy.teamId)}
            </PlayerHighlight>
          ) : <p className="text-sm text-haze">Nobody was sold.</p>}
        </HighlightCard>
        <HighlightCard label="Steal of the auction" icon={Gem} accent="volt">
          {steal ? (
            <PlayerHighlight player={steal}>
              Rated {steal.rating} for <span className="font-semibold text-snow tabular">{formatPrice(steal.bid)}</span>
            </PlayerHighlight>
          ) : <p className="text-sm text-haze">Nobody was sold.</p>}
        </HighlightCard>
        <HighlightCard label="Strongest XI" icon={Crown} accent="gold">
          {strongest ? (
            <div className="flex min-w-0 items-center gap-3">
              <TeamCrest teamId={strongest.teamId} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide">{strongest.name}</p>
                <ManagerLine team={strongest} />
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold leading-none text-gold tabular">{strongest.strength.score}</div>
                <div className="font-display text-[11px] uppercase tracking-wider text-haze">Strength</div>
              </div>
            </div>
          ) : <p className="text-sm text-haze">No squads to compare yet.</p>}
        </HighlightCard>
      </div>

      <p className="text-sm text-mist">
        <span className="font-semibold text-snow">Arena Strength</span> rates each squad on the best playing XI it can field
        (within the overseas cap) from its players&apos; Arena Ratings: the XI counts most (an empty place in it counts as zero)
        and depth adds a little. The XI&apos;s combination matters too: a keeper, enough batting and bowling, openers and a
        finisher, a left/right mix up top, pace and spin, and bowlers for the powerplay and the death. Anything missing costs points.
      </p>

      <Panel label="Standings" bodyClassName="p-0">
        <div className="hidden grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1.3fr)_6.5rem_4.5rem_8rem] gap-x-4 border-b border-white/6 px-4 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze md:grid">
          <span>#</span>
          <span>Franchise</span>
          <span>Arena Strength</span>
          <span>Core / depth</span>
          <span>Players</span>
          <span className="text-right">Spent / left</span>
        </div>
        <ol className="divide-y divide-white/6">
          {standings.map((team, index) => {
            const rank = index + 1;
            const { score, core, depth, gaps } = team.strength;
            return (
              <li
                key={team.id}
                className={cn(
                  'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3',
                  'md:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1.3fr)_6.5rem_4.5rem_8rem] md:gap-x-4',
                  team.isYou && 'bg-volt/[0.04]',
                )}
              >
                <span className={cn('flex items-center gap-1 font-display text-2xl font-bold tabular', rank === 1 ? 'text-gold' : 'text-haze')}>
                  {rank}
                  {rank === 1 && <Trophy size={14} aria-label="Top of the table" />}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <TeamCrest teamId={team.teamId} size="md" />
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold uppercase leading-tight tracking-wide md:truncate">{team.name}</p>
                    <ManagerLine team={team} />
                  </div>
                </div>

                <div className="text-right md:hidden">
                  <div className={cn('font-display text-3xl font-bold leading-none tabular', rank === 1 ? 'text-gold' : 'text-snow')}>{score}</div>
                  <div className="font-display text-[10px] uppercase tracking-wider text-haze">Strength</div>
                </div>

                <div className="col-span-3 min-w-0 md:col-span-1">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-sm bg-ink-700"
                      role="meter"
                      aria-label={`Arena Strength ${score} out of 99`}
                      aria-valuenow={score}
                      aria-valuemin={0}
                      aria-valuemax={99}
                    >
                      <div className={cn('h-full', rank === 1 ? 'bg-gold' : 'bg-signal')} style={{ width: `${Math.min(100, (score / 99) * 100)}%` }} />
                    </div>
                    <span className="hidden w-8 text-right font-display text-xl font-bold tabular md:inline">{score}</span>
                  </div>
                  {gaps.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {gaps.map(gap => <Tag key={gap} tone="flare" icon={TriangleAlert}>{gap}</Tag>)}
                    </div>
                  )}
                </div>

                <div className="hidden text-sm text-mist tabular md:block">
                  <span title="Average Arena Rating of the best XI" className="font-semibold text-snow">{core}</span>
                  <span className="text-haze"> / </span>
                  <span title="Average Arena Rating of the whole squad">{depth}</span>
                </div>
                <div className="hidden font-display text-lg font-semibold tabular md:block">
                  {team.players.length}<span className="text-sm text-haze">/{squadLimit}</span>
                </div>
                <div className="hidden text-right md:block">
                  <div className="font-display text-lg font-semibold tabular">{formatPrice(team.spent)}</div>
                  <div className="text-xs text-haze tabular">{formatPrice(team.budgetRemaining)} left</div>
                </div>

                <div className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-haze tabular md:hidden">
                  <span>Core <b className="font-semibold text-mist">{core}</b> · depth <b className="font-semibold text-mist">{depth}</b></span>
                  <span><b className="font-semibold text-mist">{team.players.length}/{squadLimit}</b> players</span>
                  <span><b className="font-semibold text-mist">{formatPrice(team.spent)}</b> spent · {formatPrice(team.budgetRemaining)} left</span>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
};

// ─── Squads ───

// slot: batting position in the XI; xi: tag the player as in the XI (the by-role view)
const SquadRow = ({ player, slot, xi = false }) => (
  <li className="flex items-center gap-2.5 rounded-md bg-white/[0.02] px-2 py-1.5">
    {slot !== undefined && <span className="w-5 shrink-0 text-center font-display text-base font-bold tabular text-signal">{slot}</span>}
    <PlayerPhoto player={player} className="size-9 shrink-0 text-xs" />
    <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-tight">
      {player.name}
      {isOverseas(player) && <OverseasMark />}
    </span>
    {xi && <Tag tone="signal" className="shrink-0">XI</Tag>}
    <RatingBadge rating={player.rating} size="sm" />
    <span className="w-[4.5rem] shrink-0 text-right font-display text-base font-semibold tabular">{formatPrice(player.bid)}</span>
  </li>
);

const GroupHeading = ({ children, count }) => (
  <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-haze">
    {children}
    {count !== undefined && <span className="text-mist tabular">{count}</span>}
    <span className="h-px flex-1 bg-white/6" aria-hidden />
  </h4>
);

const byRoleThenPrice = (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || b.bid - a.bid;

// view: 'order' (the XI in batting order, then the bench) or 'role'. onEdit only for your own squad.
const SquadCard = ({ team, results, overseasLimit, sharing, onShare, view, onEdit }) => {
  const franchise = TEAMS_BY_ID.get(team.teamId);
  const busy = sharing === team.teamId;
  const { xi, bench, custom } = team.lineup;
  const inXI = new Set(xi.map(p => p.id));
  return (
    <Panel className="min-w-0" bodyClassName="p-0">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: franchise?.colors.primary }} aria-hidden />
      <div className="flex items-start gap-3 border-b border-white/6 p-4">
        <TeamCrest teamId={team.teamId} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold uppercase leading-tight tracking-wide">{team.name}</h3>
          <ManagerLine team={team} />
        </div>
        {team.players.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            icon={Share2}
            loading={busy}
            disabled={Boolean(sharing) && !busy}
            onClick={() => onShare(team)}
            aria-label={`Share ${team.name} squad as an image`}
          >
            <span className="hidden sm:inline">{busy ? 'Making image…' : 'Share squad'}</span>
            <span className="sm:hidden">Share</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-white/6 px-4 py-3 sm:grid-cols-5">
        <Stat size="sm" label="Purse left" value={formatPrice(team.budgetRemaining)} tone="volt" />
        <Stat size="sm" label="Spent" value={formatPrice(team.spent)} />
        <Stat size="sm" label="Overseas" value={overseasLimit ? overseasUsage(team.overseas, overseasLimit, results.squadLimit) : team.overseas} />
        <Stat size="sm" label="Players" value={`${team.players.length}/${results.squadLimit}`} />
        <Stat size="sm" label="Strength" value={team.strength.score} tone="signal" />
      </div>

      {team.players.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-haze">No players bought.</p>
      ) : view === 'order' ? (
        <div className="space-y-3 p-4">
          <section>
            <div className="mb-1.5 flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Playing XI</h4>
              {custom ? <Tag tone="volt">Manager&apos;s order</Tag> : <Tag>Suggested</Tag>}
              <span className="h-px flex-1 bg-white/6" aria-hidden />
              {onEdit && (
                <Button variant="outline" size="sm" icon={Pencil} onClick={() => onEdit(team)}>
                  Edit XI
                </Button>
              )}
            </div>
            <ol className="space-y-1" aria-label={`${team.name} batting order`}>
              {xi.map((player, index) => <SquadRow key={player.id} player={player} slot={index + 1} />)}
            </ol>
          </section>
          {bench.length > 0 && (
            <section>
              <GroupHeading count={bench.length}>Bench</GroupHeading>
              <ul className="space-y-1">
                {[...bench].sort(byRoleThenPrice).map(player => <SquadRow key={player.id} player={player} />)}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {ROLES.map(role => {
            const group = team.players.filter(p => p.role === role).sort((a, b) => b.bid - a.bid);
            if (!group.length) return null;
            return (
              <section key={role}>
                <GroupHeading count={group.length}>{ROLE_META[role].plural}</GroupHeading>
                <ul className="space-y-1">
                  {group.map(player => <SquadRow key={player.id} player={player} xi={inXI.has(player.id)} />)}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
};

const SQUAD_VIEWS = [
  { id: 'order', label: 'Batting order', icon: ListOrdered },
  { id: 'role', label: 'By role', icon: Users },
];

// canEdit: the auction is over, so managers can set their own XI
const SquadsTab = ({ results, overseasLimit, sharing, onShare, canEdit, onEdit }) => {
  const [view, setView] = useLocalSetting('squadView', 'order');
  const mine = results.teams.find(t => t.isYou);
  const others = results.teams
    .filter(t => !t.isYou && t.players.length > 0)
    .sort((a, b) => b.strength.score - a.strength.score);
  const cards = mine ? [mine, ...others] : others;
  if (!cards.length) {
    return (
      <Panel>
        <EmptyState icon={Users} title="No squads yet">Nobody bought a player in this room.</EmptyState>
      </Panel>
    );
  }
  return (
    <div className="space-y-3">
      <Segmented options={SQUAD_VIEWS} value={view === 'role' ? 'role' : 'order'} onChange={setView} size="sm" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {cards.map(team => (
          <SquadCard
            key={team.id}
            team={team}
            results={results}
            overseasLimit={overseasLimit}
            sharing={sharing}
            onShare={onShare}
            view={view === 'role' ? 'role' : 'order'}
            onEdit={canEdit && team.isYou ? onEdit : undefined}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Top buys ───

const TopBuysTab = ({ results }) => {
  const top = results.sold.slice(0, 10);
  if (!top.length) {
    return (
      <Panel>
        <EmptyState icon={Gavel} title="No sales yet">Once players are sold, the ten biggest buys show up here.</EmptyState>
      </Panel>
    );
  }
  return (
    <Panel label="Ten biggest buys" bodyClassName="p-0">
      <p className="border-b border-white/6 px-4 py-2.5 text-xs text-haze">
        Value compares each price with what players rated within 5 points of them went for in this room.
      </p>
      <ol className="divide-y divide-white/6">
        {top.map((player, index) => {
          const value = valueRead(player, results.sold);
          return (
            <li key={player.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('w-6 shrink-0 font-display text-xl font-bold tabular', index === 0 ? 'text-gold' : 'text-haze')}>{index + 1}</span>
              <PlayerPhoto player={player} className="size-10 shrink-0 text-sm sm:size-11" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold uppercase leading-tight tracking-wide">
                  {player.name}
                  {isOverseas(player) && <OverseasMark />}
                </p>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-haze">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <TeamCrest teamId={player.teamId} size="xs" />
                    <span className="truncate text-mist">{player.teamId}</span>
                  </span>
                  <span>{ROLE_META[player.role]?.short}</span>
                  {value ? (
                    <>
                      <Tag tone={value.tone}>{value.label}</Tag>
                      <span className="hidden tabular sm:inline">similar players ~{formatPrice(value.typical)}</span>
                    </>
                  ) : (
                    <span className="hidden sm:inline">No similar sales to compare</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row-reverse sm:items-center sm:gap-4">
                <span className="text-right font-display text-lg font-bold tabular sm:w-24 sm:text-xl">{formatPrice(player.bid)}</span>
                <RatingBadge rating={player.rating} />
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
};

// ─── Page ───

const Centered = ({ children }) => (
  <PageShell>
    <div className="py-16">
      <Panel className="mx-auto max-w-md">{children}</Panel>
    </div>
  </PageShell>
);

const Results = () => {
  const { id = '' } = useParams();
  const roomId = id.toUpperCase();
  const { user } = useAuth();
  const { currentAuction, roomTeams, loading, joinAuction, saveBattingOrder } = useAuction();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sharing, setSharing] = useState(null);
  // teamId of the squad whose XI is being edited
  const [editing, setEditing] = useState(null);
  const posterHost = useRef(null);
  // joinAuction turns loading on and off again once the server answers; remember
  // that it happened so an unknown room shows "not found" instead of a loader forever
  const [answeredFor, setAnsweredFor] = useState(null);
  if (loading && answeredFor !== roomId) setAnsweredFor(roomId);

  useDocumentTitle(`Results ${roomId}`);

  useEffect(() => {
    if (!roomId || !user?.uid) return undefined;
    return joinAuction(roomId);
  }, [roomId, user?.uid, joinAuction]);

  const requestedTab = searchParams.get('tab');
  const tab = TAB_IDS.has(requestedTab) ? requestedTab : 'standings';
  const setTab = (next) => setSearchParams(next === 'standings' ? {} : { tab: next }, { replace: true });

  if (!user) {
    return (
      <Centered>
        <EmptyState icon={LogIn} title="Sign in to see the results">
          <p>Results are for signed-in players. Sign in on the home page, then open this link again.</p>
          <Link to="/" className={cn(buttonClasses({ size: 'sm' }), 'mt-4')}>Go to sign in</Link>
        </EmptyState>
      </Centered>
    );
  }

  const ready = currentAuction && currentAuction.id === roomId;
  if (!ready) {
    if (!loading && answeredFor === roomId) {
      return (
        <Centered>
          <EmptyState icon={SearchX} title="Room not found">
            <p>There's no auction with the code {roomId}. Check the link and try again.</p>
            <Link to="/" className={cn(buttonClasses({ variant: 'outline', size: 'sm' }), 'mt-4')}>Back home</Link>
          </EmptyState>
        </Centered>
      );
    }
    return <PreShow />;
  }

  const results = buildResults(currentAuction, roomTeams, user.uid);
  const mode = MODE_META[currentAuction.auctionType];
  const status = currentAuction.status;
  const posterTeam = sharing ? results.teams.find(t => t.teamId === sharing) : null;
  const editingTeam = editing ? results.teams.find(t => t.teamId === editing && t.isYou) : null;

  const saveLineup = async (playerIds) => {
    await saveBattingOrder(roomId, playerIds);
    toast({ message: 'Batting order saved', tone: 'success' });
  };

  const shareSquad = async (team) => {
    if (sharing) return;
    // Mount the poster off-screen right away so it can be measured and copied
    flushSync(() => setSharing(team.teamId));
    try {
      const poster = posterHost.current?.firstElementChild;
      if (!poster) throw new Error('missing poster');
      await nextFrame();
      await nextFrame();
      const slug = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await shareElementAsImage(poster, `${slug}-${roomId}.png`, `${team.name} · Auction Arena`);
    } catch (err) {
      if (err?.name === 'AbortError') return; // the share sheet was closed
      toast({ message: "Couldn't make the squad image. Please try again.", tone: 'error' });
    } finally {
      setSharing(null);
    }
  };

  return (
    <PageShell>
      <div className="space-y-5 py-5 sm:py-8">
        {/* Header band */}
        <section className="relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-signal" aria-hidden />
          <div className="absolute inset-0 bg-stripes" aria-hidden />
          <div className="relative p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="clip-slant-r inline-flex h-6 items-center bg-signal pl-2.5 pr-6 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-950">
                  Room {roomId}
                </span>
                <h1 className="mt-2 text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl">
                  {status === 'completed' ? 'Final results' : 'Results so far'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Tag tone="signal">{mode?.label ?? currentAuction.auctionType}</Tag>
                  {status === 'completed' && <Tag tone="volt">Completed</Tag>}
                  {status === 'active' && <LiveTag />}
                  {status === 'waiting' && <Tag>Not started</Tag>}
                </div>
              </div>
              <Link to="/" className={cn(buttonClasses({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
                <House size={15} aria-hidden /> Home
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/6 pt-4">
              <Stat label="Franchises" value={results.teams.length} />
              <Stat label="Total spent" value={formatPrice(results.totalSpent)} tone="signal" />
              <Stat label="Players sold" value={results.sold.length} />
            </div>
          </div>
        </section>

        {status !== 'completed' && (
          <Panel accent="flare" bodyClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-mist">
              {status === 'waiting'
                ? "This auction hasn't started yet, so there's nothing to rank."
                : 'This auction is still running. Everything below is the picture so far.'}
            </p>
            <Link
              to={status === 'waiting' ? `/lobby/${roomId}` : `/auction/${roomId}`}
              className={cn(buttonClasses({ size: 'sm' }), 'shrink-0')}
            >
              {status === 'waiting' ? 'Go to the lobby' : 'Back to the auction'}
            </Link>
          </Panel>
        )}

        <Segmented options={TABS} value={tab} onChange={setTab} className="-mx-4 border-b border-white/6 px-4 sm:mx-0 sm:px-0" />

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} role="tabpanel">
          {tab === 'standings' && <StandingsTab results={results} />}
          {tab === 'squads' && (
            <SquadsTab
              results={results}
              overseasLimit={currentAuction.overseasLimit}
              sharing={sharing}
              onShare={shareSquad}
              canEdit={status === 'completed'}
              onEdit={(team) => setEditing(team.teamId)}
            />
          )}
          {tab === 'top' && <TopBuysTab results={results} />}
          {tab === 'ai' && <PowerRankings auctionId={roomId} isHost={currentAuction.hostId === user.uid} />}
          {tab === 'fantasy' && (
            <FantasyDashboard auctionId={roomId} user={user} roomTeams={roomTeams} currentAuction={currentAuction} />
          )}
        </motion.div>
      </div>

      {editingTeam && (
        <LineupEditor
          open
          onClose={() => setEditing(null)}
          team={editingTeam}
          lineup={editingTeam.lineup}
          squadLimit={results.squadLimit}
          overseasLimit={currentAuction.overseasLimit}
          onSave={saveLineup}
        />
      )}

      {/* Off-screen stage for the squad poster while it's being exported */}
      <div ref={posterHost} className="pointer-events-none fixed top-0" style={{ left: -12000 }} aria-hidden>
        {posterTeam && (
          <SquadPoster
            team={posterTeam}
            lineup={posterTeam.lineup}
            managerName={posterTeam.managerName}
            squadLimit={results.squadLimit}
            overseasLimit={currentAuction.overseasLimit}
            mode={currentAuction.auctionType}
            roomId={roomId}
          />
        )}
      </div>
    </PageShell>
  );
};

export default Results;
