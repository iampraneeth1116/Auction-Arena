import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, UserRound } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import Tag from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import EmailAuthForm from '../components/EmailAuthForm';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ratingOf } from '../lib/catalog';
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
  const [view, setView] = useState('choose'); // choose | email | guest
  return (
    <Panel label="Start playing" accent="signal" className="w-full max-w-md" bodyClassName="p-4 sm:p-5">
      {view === 'email' && <EmailAuthForm onBack={() => setView('choose')} />}
      {view === 'guest' && <GuestSignIn onBack={() => setView('choose')} />}
      {view === 'choose' && (
        <div className="space-y-2.5">
          <Button size="lg" block icon={Mail} onClick={() => setView('email')}>Continue with email</Button>
          <Button variant="outline" size="lg" block icon={UserRound} onClick={() => setView('guest')}>Play as a guest</Button>
          <p className="pt-1 text-xs leading-relaxed text-haze">
            Guests can play straight away. Sign in with email to keep your auction history on any device.
          </p>
        </div>
      )}
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
          <Panel label="Welcome" accent="volt" bodyClassName="space-y-2 p-4 sm:p-5">
            <p className="font-display text-2xl font-bold uppercase">Hi, {user.displayName}</p>
            <p className="text-sm text-mist">Hosting and joining rooms is coming next.</p>
            <ArrowRight className="text-volt" size={18} />
          </Panel>
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
