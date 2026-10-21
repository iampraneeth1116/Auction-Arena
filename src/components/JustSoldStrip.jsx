import React, { useEffect, useState } from 'react';
import Ticker, { TickerItem } from './ui/Ticker';
import TeamCrest from './ui/TeamCrest';
import { LiveTag } from './ui/Tag';
import { api } from '../lib/api';
import { PLAYERS_BY_ID, TEAMS_BY_ID } from '../lib/catalog';
import { formatPrice, timeAgo } from '../lib/format';

const REFRESH_MS = 20000;

// A broadcast ticker of real signings from every room, plus how many auctions are live.
// Renders nothing until there is at least one signing to show.
export default function JustSoldStrip({ className }) {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      api('/api/activity')
        .then((data) => {
          if (!cancelled) setFeed({ ...data, fetchedAt: Date.now() });
        })
        .catch(() => {
          // Keep showing the last good data if a refresh fails
        });
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const signings = (feed?.recentSignings ?? []).filter(s => PLAYERS_BY_ID.has(s.playerId) && TEAMS_BY_ID.has(s.teamId));
  if (signings.length === 0) return null;

  const live = feed.liveAuctions ?? 0;

  return (
    <section aria-label="Recent signings" className={className}>
      <Ticker label="Just sold" loop={signings.length >= 3} className="rounded-md border-x">
        {live > 0 && (
          <TickerItem>
            <LiveTag />
            <span className="font-display font-semibold uppercase tracking-wider text-snow">
              {live} {live === 1 ? 'auction' : 'auctions'} running now
            </span>
          </TickerItem>
        )}
        {signings.map(s => {
          const player = PLAYERS_BY_ID.get(s.playerId);
          return (
            <TickerItem key={s.id}>
              <TeamCrest teamId={s.teamId} size="xs" />
              <span className="font-semibold text-snow">{player.name}</span>
              <span className="text-haze">to {s.teamId}</span>
              <span className="font-display font-bold tabular text-volt">{formatPrice(s.price)}</span>
              <span className="text-xs text-haze">{timeAgo(s.soldAt, feed.fetchedAt)}</span>
            </TickerItem>
          );
        })}
      </Ticker>
    </section>
  );
}
