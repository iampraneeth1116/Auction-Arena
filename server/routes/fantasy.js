import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { HttpError, parseBody } from '../validation.js';
import { PLAYERS_BY_ID, isOverseas } from '../auctionRules.js';

const router = Router();

const MAX_OVERSEAS_IN_XI = 4;

const squadSchema = z.object({
  players: z.array(z.string()).min(5, 'Please select at least 5 players.').max(11, 'You can pick at most 11 players.'),
  captain: z.string().min(1, 'Please select a Captain and Vice-Captain.'),
  viceCaptain: z.string().min(1, 'Please select a Captain and Vice-Captain.'),
  impactPlayer: z.string().nullable().optional(),
});
const matchPointsSchema = z.object({ points: z.number().finite().min(-500).max(1000) });
const manualStatSchema = z.object({
  average: z.number().finite().min(-500).max(1000).optional(),
  matches: z.number().int().min(0).max(1000).optional(),
});

async function loadPlayerStats() {
  const rows = await prisma.playerStat.findMany();
  return Object.fromEntries(rows.map(r => [r.playerId, { totalPoints: r.totalPoints, matches: r.matches }]));
}

const toClientStat = (stat) => ({ totalPoints: stat.totalPoints, matches: stat.matches });

router.get('/fantasy/player-stats', requireAuth, async (req, res) => {
  res.json({ stats: await loadPlayerStats() });
});

router.get('/rooms/:id/fantasy', requireAuth, async (req, res) => {
  const roomId = req.params.id.trim().toUpperCase();
  const [squads, playerStats] = await Promise.all([
    prisma.fantasySquad.findMany({ where: { roomId } }),
    loadPlayerStats(),
  ]);
  res.json({
    squads: squads.map(s => ({
      userId: s.userId,
      userName: s.userName,
      teamId: s.teamId,
      players: s.players,
      captain: s.captain,
      viceCaptain: s.viceCaptain,
      impactPlayer: s.impactPlayer,
    })),
    playerStats,
  });
});

router.put('/rooms/:id/fantasy/squad', requireAuth, async (req, res) => {
  const roomId = req.params.id.trim().toUpperCase();
  const body = parseBody(squadSchema, req.body);

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: req.user.id } },
    include: { purchases: true },
  });
  if (!member?.teamId) throw new HttpError(403, 'You must be part of a franchise to participate in fantasy selections.');

  // Everything is re-checked here: the client's rules are only a convenience
  const owned = new Set(member.purchases.map(p => p.playerId));
  const players = [...new Set(body.players)];
  if (players.length !== body.players.length) throw new HttpError(400, 'A player can only be picked once.');
  if (!players.every(id => owned.has(id))) throw new HttpError(400, 'You can only pick players you bought in this auction.');

  const overseasInXI = players.filter(id => isOverseas(PLAYERS_BY_ID.get(id))).length;
  if (overseasInXI > MAX_OVERSEAS_IN_XI) throw new HttpError(400, 'Maximum 4 overseas players allowed in the XI.');
  if (!players.includes(body.captain) || !players.includes(body.viceCaptain) || body.captain === body.viceCaptain) {
    throw new HttpError(400, 'Captain and Vice-Captain must be two different players from your XI.');
  }

  const impactPlayer = body.impactPlayer || null;
  if (impactPlayer) {
    if (!owned.has(impactPlayer) || players.includes(impactPlayer)) {
      throw new HttpError(400, 'The Impact Player must be one of your players outside the XI.');
    }
    if (isOverseas(PLAYERS_BY_ID.get(impactPlayer)) && overseasInXI >= MAX_OVERSEAS_IN_XI) {
      throw new HttpError(400, 'Impact player cannot be overseas if 4 overseas players are already in the XI.');
    }
  }

  const data = {
    userName: member.displayName,
    teamId: member.teamId,
    players,
    captain: body.captain,
    viceCaptain: body.viceCaptain,
    impactPlayer,
  };
  await prisma.fantasySquad.upsert({
    where: { roomId_userId: { roomId, userId: req.user.id } },
    create: { roomId, userId: req.user.id, ...data },
    update: data,
  });
  res.json({ squad: { userId: req.user.id, ...data } });
});

// ─── Admin ───

const requireKnownPlayer = (playerId) => {
  if (!PLAYERS_BY_ID.has(playerId)) throw new HttpError(404, 'Unknown player');
};

router.post('/admin/player-stats/:playerId/match', requireAuth, requireAdmin, async (req, res) => {
  const { playerId } = req.params;
  requireKnownPlayer(playerId);
  const { points } = parseBody(matchPointsSchema, req.body);

  const stat = await prisma.playerStat.upsert({
    where: { playerId },
    create: { playerId, totalPoints: points, matches: 1 },
    update: { totalPoints: { increment: points }, matches: { increment: 1 } },
  });
  res.json({ stat: toClientStat(stat) });
});

router.put('/admin/player-stats/:playerId', requireAuth, requireAdmin, async (req, res) => {
  const { playerId } = req.params;
  requireKnownPlayer(playerId);
  const body = parseBody(manualStatSchema, req.body);

  const current = (await prisma.playerStat.findUnique({ where: { playerId } })) ?? { totalPoints: 0, matches: 0 };
  // Stats are stored as a running total. Keep the average fixed when only the match
  // count changes; an average needs at least one match to be stored.
  const matches = body.matches ?? (body.average !== undefined ? Math.max(current.matches, 1) : current.matches);
  const average = body.average ?? (current.matches ? current.totalPoints / current.matches : 0);
  const totalPoints = average * matches;

  const stat = await prisma.playerStat.upsert({
    where: { playerId },
    create: { playerId, totalPoints, matches },
    update: { totalPoints, matches },
  });
  res.json({ stat: toClientStat(stat) });
});

export default router;
