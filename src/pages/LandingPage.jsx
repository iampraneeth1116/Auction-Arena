import React from 'react';
import PageShell from '../components/ui/PageShell';
import Tag from '../components/ui/Tag';
import TeamCrest from '../components/ui/TeamCrest';
import PlayerPhoto from '../components/ui/PlayerPhoto';
import RatingBadge from '../components/ui/RatingBadge';
import { ratingOf } from '../lib/catalog';
import { TEAMS } from '../data/teams';
import { IPL_PLAYERS } from '../data/players';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// The five highest Arena Ratings, as a taste of the player list
const TOP_RATED = [...IPL_PLAYERS].sort((a, b) => ratingOf(b.id) - ratingOf(a.id)).slice(0, 5);

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
