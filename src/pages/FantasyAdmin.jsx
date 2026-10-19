import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, LogIn, Pencil, Plus, RefreshCw, Search, SearchX, ShieldCheck } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Field from '../components/ui/Field';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import Stat from '../components/ui/Stat';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import { buttonClasses } from '../components/ui/styles';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { ROLE_META, isOverseas } from '../lib/format';
import { ratingOf } from '../lib/catalog';
import { IPL_PLAYERS } from '../data/players';

const MAX_RESULTS = 12;
// Same bounds the server accepts (server/routes/fantasy.js)
const POINTS_MIN = -500;
const POINTS_MAX = 1000;

const averageFrom = (stat) => (stat?.matches ? Number((stat.totalPoints / stat.matches).toFixed(1)) : 0);
const oneDecimal = (value) => Number((Number(value) || 0).toFixed(1));
const matchesLabel = (count) => `${count} ${count === 1 ? 'match' : 'matches'}`;

const FantasyAdmin = () => {
  useDocumentTitle('Fantasy admin');
  const { user, loading, loginWithGoogle, googleEnabled } = useAuth();

  // The server decides who is an admin; this flag only picks which screen to show
  const isAdmin = Boolean(user?.isAdmin);

  if (loading) {
    return (
      <PageShell>
        <Spinner label="Checking your account" className="min-h-[60dvh]" />
      </PageShell>
    );
  }
  if (!isAdmin) return <AdminGate user={user} googleEnabled={googleEnabled} onSignIn={() => loginWithGoogle().catch(() => {})} />;
  return <ScoringDesk />;
};

// ─── Not an admin ───

const AdminGate = ({ user, googleEnabled, onSignIn }) => (
  <PageShell>
    <div className="flex min-h-[70dvh] items-center justify-center py-10">
      <Panel accent="flare" className="w-full max-w-md" bodyClassName="space-y-5 p-5 sm:p-6">
        <span className="flex size-12 items-center justify-center rounded-md border border-flare/30 bg-flare/10 text-flare">
          <Lock size={22} />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Admins only</h1>
          <p className="text-sm leading-relaxed text-mist">
            This page is for the site admin. Sign in with the admin&rsquo;s Google account to manage fantasy points.
          </p>
        </div>

        {!googleEnabled ? (
          <p className="rounded-md border border-white/8 bg-ink-900/70 px-3 py-2 text-sm text-haze">
            Google sign-in isn&rsquo;t set up on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable the admin page.
          </p>
        ) : !user ? (
          <Button icon={LogIn} size="lg" block onClick={onSignIn}>
            Sign in with Google
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-white/8 bg-ink-900/70 px-3 py-2">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">Signed in as</p>
              <p className="truncate text-sm font-semibold">{user.email || user.displayName}</p>
            </div>
            <p className="text-sm text-haze">This account doesn&rsquo;t have admin access.</p>
            <Link to="/" className={buttonClasses({ variant: 'outline', block: true })}>
              <ArrowLeft size={16} strokeWidth={2.5} />
              Back to home
            </Link>
          </div>
        )}
      </Panel>
    </div>
  </PageShell>
);

// ─── Admin ───

const ScoringDesk = () => {
  const { toast } = useToast();
  const [playerStats, setPlayerStats] = useState({});
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/fantasy/player-stats')
      .then(({ stats }) => {
        if (cancelled) return;
        setPlayerStats(stats);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const retryLoad = () => {
    setLoadState('loading');
    setReloadKey(key => key + 1);
  };

  const term = searchTerm.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    return IPL_PLAYERS.filter(p => p.name.toLowerCase().includes(term)).slice(0, MAX_RESULTS);
  }, [term]);

  const summary = useMemo(() => {
    const entries = Object.entries(playerStats).filter(([, stat]) => stat?.matches > 0);
    let leader = null;
    for (const [playerId, stat] of entries) {
      const average = averageFrom(stat);
      if (!leader || average > leader.average) leader = { playerId, average };
    }
    return {
      scored: entries.length,
      leader: leader && { ...leader, name: IPL_PLAYERS.find(p => p.id === leader.playerId)?.name },
    };
  }, [playerStats]);

  const storeStat = (playerId, stat) => {
    setPlayerStats(prev => ({ ...prev, [playerId]: stat }));
  };

  // One match's points: adds to the running total and counts one more match
  const addMatchPoints = async (player, points) => {
    if (!Number.isFinite(points)) return false;
    setUpdatingId(player.id);
    const oldAverage = averageFrom(playerStats[player.id]);
    try {
      const { stat } = await api(`/api/admin/player-stats/${player.id}/match`, {
        method: 'POST',
        body: { points },
      });
      storeStat(player.id, stat);
      toast({
        tone: 'success',
        message: `Match added. ${player.name}: average ${oldAverage} → ${averageFrom(stat)} over ${matchesLabel(stat.matches)}.`,
      });
      return true;
    } catch (err) {
      toast({ tone: 'error', message: err.message || 'Update failed.' });
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  // Sets the average and/or match count directly, to fix a mistake
  const saveCorrection = async (player, change) => {
    setSaving(true);
    try {
      const { stat } = await api(`/api/admin/player-stats/${player.id}`, { method: 'PUT', body: change });
      storeStat(player.id, stat);
      toast({ tone: 'success', message: `${player.name} updated: average ${averageFrom(stat)} over ${matchesLabel(stat.matches)}.` });
      setEditOpen(false);
    } catch (err) {
      toast({ tone: 'error', message: err.message || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  };

  const openCorrection = (player) => {
    setEditing(player);
    setEditSession(n => n + 1);
    setEditOpen(true);
  };

  const ready = loadState === 'ready';

  return (
    <PageShell>
      <header className="pb-6 pt-8 sm:pt-10">
        <Tag tone="gold" icon={ShieldCheck}>Admin</Tag>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">Fantasy points</h1>
        <p className="mt-1.5 max-w-2xl text-mist">
          Add a player&rsquo;s points from a match, or correct their running totals. Managers see the change the next
          time they open their fantasy league.
        </p>
      </header>

      <div className="grid gap-4 pb-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {loadState === 'error' && (
            <Panel accent="flare" bodyClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-mist">Could not load player stats, so current totals aren’t shown. Adding match points still works.</p>
              <Button variant="outline" size="sm" icon={RefreshCw} onClick={retryLoad}>
                Try again
              </Button>
            </Panel>
          )}

          <Panel accent="signal" bodyClassName="p-4">
            <Field
              label="Find a player"
              type="search"
              placeholder="Start typing a name"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              hint={
                term
                  ? results.length === MAX_RESULTS
                    ? `Showing the first ${MAX_RESULTS} results`
                    : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
                  : `${IPL_PLAYERS.length} players in the list`
              }
              autoComplete="off"
              spellCheck={false}
            />
          </Panel>

          {results.length > 0 ? (
            <ul className="space-y-3">
              {results.map(player => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  stat={playerStats[player.id]}
                  ready={ready}
                  updatingId={updatingId}
                  onAdd={addMatchPoints}
                  onCorrect={openCorrection}
                />
              ))}
            </ul>
          ) : (
            <Panel>
              {term ? (
                <EmptyState icon={SearchX} title="No players found">
                  Nothing matches &ldquo;{searchTerm.trim()}&rdquo;. Try part of a first or last name.
                </EmptyState>
              ) : (
                <EmptyState icon={Search} title="Find a player to start">
                  Search by name to add match points or correct a player&rsquo;s totals.
                </EmptyState>
              )}
            </Panel>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Panel label="Season so far" bodyClassName="grid grid-cols-2 gap-4 p-4">
            <Stat label="Players scored" value={ready ? summary.scored : '—'} tone="signal" />
            <Stat
              label="Best average"
              value={ready && summary.leader ? summary.leader.average : '—'}
              hint={ready ? summary.leader?.name : undefined}
            />
          </Panel>

          <Panel label="How the numbers work" bodyClassName="p-4">
            <ol className="space-y-3 text-sm leading-relaxed text-mist">
              {[
                'Each player has a running points total and a match count. The average is total ÷ matches.',
                'Add puts one match’s points on the total and counts one more match.',
                'Correct sets the average or the match count directly. Changing only the matches keeps the average.',
                'Finished IPL matches are also scored automatically every morning, around 08:00 IST. Use this page for anything that needs fixing.',
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-display text-xs font-bold tabular text-snow">
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>

      <Modal
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title={editing ? `Correct ${editing.name}` : 'Correct totals'}
        subtitle="Set the numbers directly"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="fantasy-correction" loading={saving}>Save</Button>
          </div>
        }
      >
        {editing && (
          <CorrectionForm
            key={editSession}
            player={editing}
            stat={playerStats[editing.id]}
            onSave={saveCorrection}
            onUnchanged={() => setEditOpen(false)}
          />
        )}
      </Modal>
    </PageShell>
  );
};

const PlayerRow = ({ player, stat, ready, updatingId, onAdd, onCorrect }) => {
  const [points, setPoints] = useState('');
  const matches = stat?.matches ?? 0;
  const show = (value) => (ready ? value : '—');

  const submit = async (e) => {
    e.preventDefault();
    if (points.trim() === '') return;
    const value = Number(points);
    if (Number.isNaN(value)) return;
    if (await onAdd(player, value)) setPoints('');
  };

  return (
    <Panel as="li" bodyClassName="divide-y divide-white/6">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PlayerPhoto player={player} className="size-14 shrink-0" />
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide">{player.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <RatingBadge rating={ratingOf(player.id)} size="sm" />
              <Tag>{ROLE_META[player.role]?.short ?? player.role}</Tag>
              <Tag>{player.set}</Tag>
              {isOverseas(player) && <Tag tone="signal">Overseas</Tag>}
            </div>
            <p className="mt-1 font-display text-[11px] tracking-[0.14em] text-haze">
              <span className="uppercase">ID</span> {player.id}
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-3 rounded-md border border-white/6 bg-ink-900/60 px-3 py-2 sm:w-64">
          <Stat label="Average" value={show(averageFrom(stat))} tone="signal" />
          <Stat label="Matches" value={show(matches)} />
          <Stat label="Total" value={show(oneDecimal(stat?.totalPoints))} />
        </div>
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 bg-ink-900/40 px-4 py-3">
        <Field
          label="Match points"
          type="number"
          inputMode="decimal"
          step="any"
          min={POINTS_MIN}
          max={POINTS_MAX}
          placeholder="e.g. 42"
          value={points}
          onChange={e => setPoints(e.target.value)}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <Button
          type="submit"
          variant="volt"
          icon={Plus}
          className="h-11 shrink-0"
          loading={updatingId === player.id}
          disabled={updatingId !== null || points.trim() === ''}
        >
          Add match
        </Button>
        <Button
          variant="outline"
          className="h-11 shrink-0 px-3 sm:ml-auto"
          onClick={() => onCorrect(player)}
          aria-label={`Correct ${player.name}'s totals`}
          title="Correct totals"
        >
          <Pencil size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Correct</span>
        </Button>
      </form>
    </Panel>
  );
};

const CorrectionForm = ({ player, stat, onSave, onUnchanged }) => {
  const currentAverage = averageFrom(stat);
  const currentMatches = stat?.matches ?? 0;
  const [average, setAverage] = useState(String(currentAverage));
  const [matches, setMatches] = useState(String(currentMatches));

  // Only send what changed, so the server keeps the other number as it is
  const change = {};
  if (average.trim() !== '' && !Number.isNaN(Number(average)) && Number(average) !== currentAverage) {
    change.average = Number(average);
  }
  if (matches.trim() !== '' && !Number.isNaN(Number(matches)) && parseInt(matches, 10) !== currentMatches) {
    change.matches = parseInt(matches, 10);
  }
  const changed = Object.keys(change).length > 0;

  // What the server will store (server/routes/fantasy.js PUT /admin/player-stats)
  const nextMatches = change.matches ?? (change.average !== undefined ? Math.max(currentMatches, 1) : currentMatches);
  const nextAverage = change.average ?? currentAverage;

  const submit = (e) => {
    e.preventDefault();
    if (!changed) return onUnchanged();
    onSave(player, change);
  };

  return (
    <form id="fantasy-correction" onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-mist">
        Use this to fix a mistake. Changing only the match count keeps the average; setting an average on a player with
        no matches counts it as one match.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Average points"
          type="number"
          inputMode="decimal"
          step="any"
          min={POINTS_MIN}
          max={POINTS_MAX}
          value={average}
          onChange={e => setAverage(e.target.value)}
        />
        <Field
          label="Matches"
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          max={1000}
          value={matches}
          onChange={e => setMatches(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-white/6 bg-ink-900/60 px-3 py-2 text-sm">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">After saving</span>
        <span className={changed ? 'text-snow' : 'text-haze'}>
          {changed
            ? `${oneDecimal(nextAverage)} avg · ${matchesLabel(nextMatches)} · ${oneDecimal(nextAverage * nextMatches)} total`
            : 'No changes yet'}
        </span>
      </div>
    </form>
  );
};

export default FantasyAdmin;
