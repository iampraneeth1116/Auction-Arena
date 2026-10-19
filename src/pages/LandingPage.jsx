import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Gavel, LogIn, Mail, UserRound } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import Tag from '../components/ui/Tag';
import Segmented from '../components/ui/Segmented';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import EmailAuthForm from '../components/EmailAuthForm';
import GoogleMark from '../components/ui/GoogleMark';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuction } from '../hooks/useAuction';
import { auctionPoolSize, ratingOf } from '../lib/catalog';
import { BID_TIMER_PRESETS, MODE_META, overseasLimitLabel } from '../lib/format';
import Toggle from '../components/ui/Toggle';
import OverseasLimitPicker from '../components/OverseasLimitPicker';
import { cn } from '../lib/cn';
import { TEAMS } from '../data/teams';
import { IPL_PLAYERS } from '../data/players';

// The five highest Arena Ratings, as a taste of the player list
const TOP_RATED = [...IPL_PLAYERS].sort((a, b) => ratingOf(b.id) - ratingOf(a.id)).slice(0, 5);

const GuestSignIn = ({ onBack }) => {
  const { loginAsGuest } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await loginAsGuest(name.trim());
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
      setBusy(false);
    }
  };

  return (
      <form onSubmit={submit} className="space-y-3">
        <Field label="Your name" placeholder="e.g. Praneeth" maxLength={24} value={name} onChange={e => setName(e.target.value)} autoFocus />
        <Button type="submit" size="lg" block icon={UserRound} loading={busy} disabled={!name.trim()}>
          Play as a guest
        </Button>
        <Button variant="ghost" size="sm" block icon={ArrowLeft} onClick={onBack}>Other ways to sign in</Button>
      </form>
  );
};

const SignInPanel = () => {
  const { googleEnabled, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('choose'); // choose | email | guest

  const signInWithGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
    }
  };

  return (
    <Panel label="Start playing" accent="signal" className="w-full max-w-md" bodyClassName="p-4 sm:p-5">
      {view === 'email' && <EmailAuthForm onBack={() => setView('choose')} />}
      {view === 'guest' && <GuestSignIn onBack={() => setView('choose')} />}
      {view === 'choose' && (
        <div className="space-y-2.5">
          {googleEnabled && (
            <Button size="lg" block icon={GoogleMark} onClick={signInWithGoogle}>Continue with Google</Button>
          )}
          <Button variant={googleEnabled ? 'outline' : 'primary'} size="lg" block icon={Mail} onClick={() => setView('email')}>
            Continue with email
          </Button>
          <Button variant="outline" size="lg" block icon={UserRound} onClick={() => setView('guest')}>Play as a guest</Button>
          <p className="pt-1 text-xs leading-relaxed text-haze">
            Guests can play straight away. Sign in with {googleEnabled ? 'Google or email' : 'email'} to keep your auction
            history on any device.
          </p>
        </div>
      )}
    </Panel>
  );
};

// ─── Signed in: host a room or join one ───

const MODES = ['mega', 'sprint11', 'sprint5', 'blitz5'];

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
  const [quickPool, setQuickPool] = useState(false);
  const [rotateUnsold, setRotateUnsold] = useState(true);
  // null until the host picks one: then each mode's own value applies
  const [timerChoice, setTimerChoice] = useState(null);
  const [overseasChoice, setOverseasChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const bidTimer = timerChoice ?? MODE_META[mode].timer;
  const squadSize = MODE_META[mode].squad;
  // A choice made for a bigger squad can't exceed this mode's squad size
  const overseasLimit = Math.min(overseasChoice ?? MODE_META[mode].overseas, squadSize);

  const create = async () => {
    setBusy(true);
    try {
      const id = await createRoom({ teamId, auctionType: mode, quickPool, rotateUnsold, bidTimer, overseasLimit });
      navigate(`/lobby/${id}`);
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mist">Pick your franchise. Friends join with the room code and pick theirs.</p>
      <div className="grid grid-cols-5 gap-2">
        {TEAMS.map(team => (
          <button
            key={team.id}
            onClick={() => setTeamId(team.id)}
            aria-pressed={team.id === teamId}
            className={cn('relative flex flex-col items-center gap-1 rounded-md border p-2 transition-colors cursor-pointer',
              team.id === teamId ? 'border-signal bg-signal/10' : 'border-white/8 hover:border-ink-500')}
          >
            <TeamCrest teamId={team.id} size="md" className="border-0" />
            <span className="font-display text-xs font-bold">{team.id}</span>
            {team.id === teamId && <Check size={12} className="absolute right-1 top-1 text-signal" />}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Format">
        {MODES.map(m => <ModeCard key={m} mode={m} selected={m === mode} onSelect={() => setMode(m)} />)}
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">Time per bid</span>
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
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">Overseas per squad</span>
          <span className="text-xs text-haze">{overseasLimitLabel(overseasLimit, squadSize)}{overseasLimit === MODE_META[mode].overseas ? ' (usual)' : ''}</span>
        </div>
        <OverseasLimitPicker value={overseasLimit} squadLimit={squadSize} defaultLimit={MODE_META[mode].overseas} onChange={setOverseasChoice} />
      </div>
      <Button size="lg" block slant icon={Gavel} loading={busy} onClick={create}>Create room</Button>
    </div>
  );
};

const JoinTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { joinRoom } = useAuction();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await joinRoom(code.trim());
      navigate(`/lobby/${id}`);
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={join} className="space-y-3">
      <Field
        label="Room code"
        placeholder="ABC123"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        inputClassName="font-display text-xl tracking-[0.3em]"
      />
      <Button type="submit" size="lg" block icon={LogIn} loading={busy} disabled={code.length !== 6}>Join room</Button>
    </form>
  );
};

const ControlRoom = ({ user }) => {
  const [tab, setTab] = useState('host');
  return (
    <Panel label={`Welcome, ${user.displayName}`} accent="volt" className="w-full max-w-md" bodyClassName="space-y-4 p-4 sm:p-5">
      <Segmented
        options={[{ id: 'host', label: 'Host', icon: Gavel }, { id: 'join', label: 'Join', icon: LogIn }]}
        value={tab}
        onChange={setTab}
        stretch
      />
      {tab === 'host' ? <HostTab /> : <JoinTab />}
    </Panel>
  );
};

const LandingPage = () => {
  useDocumentTitle();
  const { user } = useAuth();

  return (
    <PageShell>
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Tag tone="signal">Live IPL auction game</Tag>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none sm:text-7xl">
            Run the IPL auction
            <br />
            <span className="text-signal">with your friends</span>
          </h1>
          <p className="max-w-xl text-lg text-mist">
            Claim a franchise, bid live against each other on {IPL_PLAYERS.length} real players, and see who builds the
            best squad.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="The ten franchises">
            {TEAMS.map(team => (
              <TeamCrest key={team.id} teamId={team.id} size="md" />
            ))}
          </div>
        </div>

        {user ? (
          <ControlRoom user={user} />
        ) : (
          <SignInPanel />
        )}
      </section>

      <section className="pb-16">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em] text-haze">Top rated</h2>
        <ul className="grid gap-2 sm:grid-cols-5">
          {TOP_RATED.map(player => (
            <li key={player.id} className="flex items-center gap-3 rounded-md border border-white/8 bg-ink-850/80 p-2">
              <PlayerPhoto player={player} className="size-10 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
              <RatingBadge rating={ratingOf(player.id)} size="sm" />
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
};

export default LandingPage;
