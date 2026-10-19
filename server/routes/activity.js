import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { toCrores } from '../auctionRules.js';
import { countLiveAuctions } from '../realtime/roomManager.js';

const router = Router();

const RECENT_SIGNINGS = 9;

const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// The home page's "Just sold" strip: real signings and how many auctions are live.
// Only sales to people (not bots) in rooms their host listed in Open rooms, so private
// games stay private; and only franchise, player and price, never names or room codes.
router.get('/activity', activityLimiter, async (req, res) => {
  const purchases = await prisma.purchase.findMany({
    where: { room: { isPublic: true }, member: { isBot: false } },
    orderBy: { createdAt: 'desc' },
    take: RECENT_SIGNINGS,
    select: { id: true, playerId: true, price: true, createdAt: true, member: { select: { teamId: true } } },
  });

  res.json({
    liveAuctions: countLiveAuctions(),
    recentSignings: purchases.map(p => ({
      id: p.id,
      playerId: p.playerId,
      teamId: p.member.teamId,
      price: toCrores(p.price),
      soldAt: p.createdAt.getTime(),
    })),
  });
});

export default router;
