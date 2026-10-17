import React from 'react';
import PageShell from '../components/ui/PageShell';
import Tag from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import { TEAMS } from '../data/teams';
import { IPL_PLAYERS } from '../data/players';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const LandingPage = () => {
  useDocumentTitle();
  return (
    <PageShell>
      <section className="flex min-h-[70dvh] flex-col items-start justify-center gap-5 py-16">
        <Tag tone="signal">Coming soon</Tag>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none sm:text-7xl">
          Run the IPL auction
          <br />
          <span className="text-signal">with your friends</span>
        </h1>
        <p className="max-w-xl text-lg text-mist">
          Claim a franchise, bid live against each other on {IPL_PLAYERS.length} real players, and see who builds the
          best squad.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="The ten franchises">
          {TEAMS.map(team => (
            <TeamCrest key={team.id} teamId={team.id} size="md" />
          ))}
        </div>
      </section>
    </PageShell>
  );
};

export default LandingPage;
