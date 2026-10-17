import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, Crown, Home } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Spinner from '../components/ui/Spinner';
import TeamCrest from '../components/ui/TeamCrest';
import Tag from '../components/ui/Tag';
import { buttonClasses } from '../components/ui/styles';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { TEAMS } from '../data/teams';

const Lobby = () => {
  const { id: rawId } = useParams();
  const id = rawId.toUpperCase();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  useDocumentTitle(`Lobby ${id}`);

  // Join the room (a no-op if already in it), then load it
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api(`/api/rooms/${id}/join`, { method: 'POST', body: {} })
      .then(() => api(`/api/rooms/${id}`))
      .then(({ room }) => { if (!cancelled) setRoom(room); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id, user]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!user) {
    return (
      <PageShell>
        <p className="py-16 text-mist">Sign in on the <Link to="/" className="text-signal">home page</Link> to join room {id}.</p>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <div className="space-y-4 py-16">
          <p className="font-display text-3xl font-bold uppercase">{error}</p>
          <Link to="/" className={buttonClasses({ variant: 'outline' })}><Home size={16} /> Home</Link>
        </div>
      </PageShell>
    );
  }
  if (!room) return <Spinner className="min-h-dvh" />;

  const byTeam = new Map(room.members.filter(m => m.team).map(m => [m.team, m]));

  return (
    <PageShell>
      <div className="space-y-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Tag tone="signal">Lobby</Tag>
            <h1 className="mt-2 font-display text-6xl font-extrabold tracking-[0.12em]">{room.id}</h1>
          </div>
          <button onClick={copyLink} className={buttonClasses({ variant: 'outline' })}>
            {copied ? <Check size={16} /> : <Copy size={16} />} Copy invite link
          </button>
        </div>

        <Panel label="Franchises" bodyClassName="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEAMS.map(team => {
            const manager = byTeam.get(team.id);
            return (
              <div key={team.id} className="flex items-center gap-3 rounded-md border border-white/8 bg-ink-900/60 p-2">
                <TeamCrest teamId={team.id} size="sm" />
                <div className="min-w-0">
                  <div className="font-display font-bold">{team.id}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-haze">
                    {manager?.isHost && <Crown size={11} className="text-gold" />}
                    {manager ? manager.name : 'Open'}
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>
        <p className="text-sm text-haze">{room.members.length} in the room · the live lobby is coming next.</p>
      </div>
    </PageShell>
  );
};

export default Lobby;
