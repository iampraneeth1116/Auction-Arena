import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartColumn, ShieldOff, Trophy, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { PLAYERS_BY_ID, TEAMS_BY_ID } from '../../lib/catalog';
import { cn } from '../../lib/cn';
import { useToast } from '../../hooks/useToast';
import Panel from '../ui/Panel';
import Segmented from '../ui/Segmented';
import EmptyState from '../ui/EmptyState';
import Tag from '../ui/Tag';
import TeamCrest from '../ui/TeamCrest';
import SquadSelector from './SquadSelector';
import SquadPreview from './SquadPreview';

// All squads in this room plus the global player stats
const fetchFantasy = (roomId) => api(`/api/rooms/${encodeURIComponent(roomId)}/fantasy`);

const statOf = (playerStats, id) => playerStats[id] || { totalPoints: 0, matches: 0 };

// Captain scores double, vice-captain one and a half times, and the impact player's points count too
function scoreSquad(squad, playerStats) {
  const { players = [], captain, viceCaptain, impactPlayer } = squad;
  const scored = impactPlayer && !players.includes(impactPlayer) ? [...players, impactPlayer] : players;

  let totalPoints = 0;
  let totalMatches = 0;
  for (const id of scored) {
    const stat = statOf(playerStats, id);
    const multiplier = id === captain ? 2 : id === viceCaptain ? 1.5 : 1;
    totalPoints += (stat.totalPoints || 0) * multiplier;
    totalMatches += stat.matches || 0;
  }
  const avgPoints = totalMatches > 0 ? totalPoints / scored.length : 0;
  return { totalPoints: Math.round(totalPoints), avgPoints: Number(avgPoints.toFixed(1)) };
}

const FantasyDashboard = ({ auctionId, user, roomTeams = [], currentAuction }) => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('squad');
  const [allSquads, setAllSquads] = useState([]);
  const [playerStats, setPlayerStats] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const userSquad = useMemo(() => allSquads.find(s => s.userId === user?.uid) || null, [allSquads, user]);

  // The signed-in manager's franchise in this room
  const userTeam = useMemo(() => roomTeams.find(rt => rt.userId === user?.uid), [roomTeams, user]);

  // The players they bought, which are the only ones they can pick
  const ownedPlayers = useMemo(() => (userTeam?.squad ?? [])
    .map(({ id, bid }) => {
      const player = PLAYERS_BY_ID.get(id);
      return player ? { ...player, bid, teamId: userTeam.teamId } : null;
    })
    .filter(Boolean), [userTeam]);

  const leaderboard = useMemo(() => {
    const members = currentAuction?.players || [];
    return allSquads.map(squad => {
      const member = members.find(p => p.id === squad.userId);
      return {
        userId: squad.userId,
        userName: member?.name || squad.userName || 'Manager',
        teamId: squad.teamId,
        teamName: TEAMS_BY_ID.get(squad.teamId)?.name || squad.teamId,
        playerCount: squad.players?.length ?? 0,
        ...scoreSquad(squad, playerStats),
      };
    }).sort((a, b) => b.avgPoints - a.avgPoints);
  }, [allSquads, playerStats, currentAuction]);

  const applyFantasy = (data) => {
    setAllSquads(data.squads);
    setPlayerStats(data.playerStats);
  };

  useEffect(() => {
    if (!auctionId || !user?.uid) return;
    let cancelled = false;
    fetchFantasy(auctionId)
      .then((data) => {
        if (cancelled) return;
        setAllSquads(data.squads);
        setPlayerStats(data.playerStats);
        // No saved XI yet: open the editor straight away
        setIsEditing(!data.squads.some(s => s.userId === user.uid));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the fantasy league. Please refresh the page.');
      });
    return () => { cancelled = true; };
  }, [auctionId, user?.uid]);

  const handleSaveSquad = async ({ players, captain, viceCaptain, impactPlayer }) => {
    try {
      const { squad } = await api(`/api/rooms/${encodeURIComponent(auctionId)}/fantasy/squad`, {
        method: 'PUT',
        body: { players, captain, viceCaptain, impactPlayer },
      });
      setAllSquads(prev => [...prev.filter(s => s.userId !== user.uid), squad]);
      setIsEditing(false);
      toast({ message: 'Fantasy XI saved.', tone: 'success' });
    } catch (err) {
      toast({ message: err.message || "Couldn't save your XI. Please try again.", tone: 'error' });
    }
  };

  const changeSubTab = (id) => {
    setActiveSubTab(id);
    // Pick up XIs other managers saved since the page loaded
    if (id === 'leaderboard') fetchFantasy(auctionId).then(applyFantasy).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-white/6 sm:flex-row sm:items-end sm:justify-between">
        <Segmented
          size="sm"
          value={activeSubTab}
          onChange={changeSubTab}
          options={[
            { id: 'squad', label: 'My XI', icon: Users },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, count: allSquads.length },
          ]}
        />
        <p className="pb-2 text-xs text-haze">Points come from real matches. Captain 2x, vice-captain 1.5x, impact player counts too.</p>
      </div>

      {loadError && (
        <p role="alert" className="rounded-md border border-flare/30 bg-flare/10 px-4 py-3 text-sm text-flare">{loadError}</p>
      )}

      <motion.div key={activeSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeSubTab === 'squad' ? (
          !userTeam ? (
            <Panel>
              <EmptyState icon={ShieldOff} title="You don't have a franchise here">
                Only managers who ran a franchise in this auction can pick a fantasy XI. You can still follow the leaderboard.
              </EmptyState>
            </Panel>
          ) : isEditing ? (
            <SquadSelector
              ownedPlayers={ownedPlayers}
              currentSquad={userSquad}
              playerStats={playerStats}
              onSave={handleSaveSquad}
              onCancel={userSquad ? () => setIsEditing(false) : undefined}
            />
          ) : (
            <SquadPreview currentSquad={userSquad} playerStats={playerStats} onEdit={() => setIsEditing(true)} />
          )
        ) : (
          <Panel label="Fantasy leaderboard" accent="gold" bodyClassName="p-0">
            {leaderboard.length > 0 ? (
              <ol className="divide-y divide-white/6">
                {leaderboard.map((entry, index) => {
                  const isYou = entry.userId === user?.uid;
                  const scored = entry.avgPoints > 0;
                  return (
                    <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isYou && 'bg-volt/[0.04]')}>
                      <span className={cn('flex w-8 shrink-0 items-center gap-0.5 font-display text-2xl font-bold tabular', index === 0 && scored ? 'text-gold' : 'text-haze')}>
                        {index + 1}
                        {index === 0 && scored && <Trophy size={13} aria-label="Leader" />}
                      </span>
                      <TeamCrest teamId={entry.teamId} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-semibold">{entry.userName}</span>
                          {isYou && <Tag tone="volt">You</Tag>}
                        </div>
                        <p className="truncate text-xs text-haze">{entry.teamName} · {entry.playerCount} in XI</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn('font-display text-2xl font-bold leading-none tabular', scored ? 'text-snow' : 'text-haze')}>
                          {scored ? entry.avgPoints : '–'}
                        </div>
                        <div className="mt-0.5 font-display text-[11px] uppercase tracking-wider text-haze">
                          {scored ? <>Avg · <span className="tabular">{entry.totalPoints}</span> total</> : 'No points yet'}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={ChartColumn} title="No XIs saved yet">
                When managers save their fantasy XI, they show up here with their points.
              </EmptyState>
            )}
          </Panel>
        )}
      </motion.div>
    </div>
  );
};

export default FantasyDashboard;
