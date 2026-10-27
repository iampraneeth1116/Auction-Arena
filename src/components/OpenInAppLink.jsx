import React from 'react';
import { MonitorDown } from 'lucide-react';
import { cn } from '../lib/cn';

// Phones can't run the desktop app, and inside the app the page is already open there
const canOfferApp = () =>
  typeof window !== 'undefined' && !window.auctionArenaDesktop && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Opens this page in the Auction Arena desktop app (auctionarena://lobby/AB12CD) for
// people who have it installed; the browser asks first. path: a site path, e.g. /lobby/AB12CD
const OpenInAppLink = ({ path, className }) => {
  if (!canOfferApp()) return null;
  return (
    <a
      href={`auctionarena://${path.replace(/^\//, '')}`}
      className={cn('inline-flex items-center gap-1.5 text-sm text-haze transition-colors hover:text-snow', className)}
    >
      <MonitorDown size={14} /> Have the desktop app? Open this room in it
    </a>
  );
};

export default OpenInAppLink;
