// Display helpers shared by every page. Prices are crores (the server sends crores).

// ₹12.50 Cr above a crore, ₹75 L below it
export function formatPrice(crores) {
  const value = Number(crores) || 0;
  if (value > 0 && value < 1) return `₹${Math.round(value * 100)} L`;
  return `₹${value.toFixed(2)} Cr`;
}

// 12.5 / 0.75 — for tight spaces next to a "Cr" label
export const formatCrores = (crores) => (Number(crores) || 0).toFixed(2).replace(/\.?0+$/, '') || '0';

// squad: squad limit · overseas: overseas players allowed per squad
export const MODE_META = {
  mega: { label: 'Mega Auction', short: 'Mega', blurb: '25-player squads · ₹120 Cr purse · full player list', squad: 25, overseas: 8 },
};

// Seconds per bid the host can pick from
export const BID_TIMER_PRESETS = [3, 5, 10, 15, 20, 30];

export const isOverseas = (player) => Boolean(player) && player.country !== 'IND';

export const ROLE_META = {
  'Batsman': { short: 'BAT', label: 'Batter' },
  'Wicket-Keeper': { short: 'WK', label: 'Keeper' },
  'All-Rounder': { short: 'AR', label: 'All-rounder' },
  'Bowler': { short: 'BOWL', label: 'Bowler' },
};

// Same increments the server uses: base price first, then +20 L under ₹5 Cr, +25 L above
export function nextBid(currentBid, basePrice) {
  if (!currentBid) return basePrice;
  const step = currentBid < 5 ? 0.2 : 0.25;
  return Math.round((currentBid + step) * 100) / 100;
}

// What the bid button says for each state of the manager's desk
export function bidButtonLabel(state, nextAmount) {
  return {
    leading: 'You lead',
    closed: 'Bidding closed',
    full: 'Squad full',
    overseas: 'Overseas quota full',
    budget: 'Not enough purse',
    spectating: 'Pick a franchise to bid',
    open: `Bid ${formatPrice(nextAmount)}`,
  }[state];
}

// The most a team can bid on one player and still afford the rest of its squad at ₹30 L each
export function maxBidFor(team, squadLimit) {
  if (!team) return 0;
  const openSlots = squadLimit - (team.squad?.length || 0);
  if (openSlots <= 0) return 0;
  return Math.max(0, Math.round((team.budgetRemaining - (openSlots - 1) * 0.3) * 100) / 100);
}
