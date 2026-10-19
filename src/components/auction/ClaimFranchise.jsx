import React, { useState } from 'react';
import { Eye, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import TeamCrest from '../ui/TeamCrest';
import Logo from '../ui/Logo';
import { buttonClasses } from '../ui/styles';
import { TEAMS } from '../../data/teams';
import { cn } from '../../lib/cn';

// Arriving after the auction started: pick a free franchise or just watch
const ClaimFranchise = ({ takenTeamIds, onClaim, onWatch }) => {
  const [claiming, setClaiming] = useState(null);
  const open = TEAMS.filter(t => !takenTeamIds.has(t.id));

  const claim = async (teamId) => {
    setClaiming(teamId);
    try {
      await onClaim(teamId);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-grid px-4 py-10">
      <Panel accent="signal" className="w-full max-w-xl" bodyClassName="p-6 sm:p-8">
        <Logo size="sm" />
        <h1 className="mt-5 font-display text-3xl font-extrabold uppercase">The auction is live</h1>
        <p className="mt-1 text-mist">
          {open.length > 0
            ? `${open.length} franchise${open.length === 1 ? ' is' : 's are'} still free. Claim one to start bidding, or watch from the stands.`
            : 'Every franchise has a manager. You can still watch every bid live.'}
        </p>

        {open.length > 0 && (
          <div className="mt-6 grid grid-cols-5 gap-2">
            {TEAMS.map(t => {
              const taken = takenTeamIds.has(t.id);
              return (
                <button
                  key={t.id}
                  disabled={taken || Boolean(claiming)}
                  onClick={() => claim(t.id)}
                  className={cn('flex flex-col items-center gap-1 rounded-md border p-2 transition-colors cursor-pointer disabled:cursor-not-allowed',
                    taken ? 'border-transparent opacity-25 grayscale' : 'border-ink-600 hover:border-signal',
                    claiming === t.id && 'border-signal bg-signal/10')}
                  aria-label={taken ? `${t.name} is taken` : `Claim ${t.name}`}
                >
                  <TeamCrest teamId={t.id} size="md" className="border-0" />
                  <span className="font-display text-xs font-bold">{claiming === t.id ? '…' : t.id}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant={open.length ? 'outline' : 'primary'} icon={Eye} onClick={onWatch}>Watch instead</Button>
          <Link to="/" className={buttonClasses({ variant: 'ghost' })}><Home size={16} /> Home</Link>
        </div>
      </Panel>
    </div>
  );
};

export default ClaimFranchise;
