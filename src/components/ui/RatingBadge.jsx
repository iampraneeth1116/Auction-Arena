import React from 'react';
import { cn } from '../../lib/cn';
import { ratingTier } from '../../lib/playerRating';

const TIER_STYLES = {
  elite: 'bg-volt text-ink-950',
  star: 'bg-signal text-ink-950',
  solid: 'bg-snow text-ink-950',
  squad: 'bg-ink-600 text-snow',
  prospect: 'bg-ink-700 text-mist',
};

// Arena Rating in a notched chip, coloured by tier
const RatingBadge = ({ rating, size = 'md', className }) => (
  <span
    className={cn(
      'clip-notch inline-flex items-center justify-center font-display font-bold tabular leading-none',
      size === 'lg' ? 'h-10 min-w-12 px-2 text-2xl' : size === 'sm' ? 'h-5 min-w-7 px-1 text-xs' : 'h-7 min-w-9 px-1.5 text-base',
      TIER_STYLES[ratingTier(rating)],
      className,
    )}
    title={`Arena Rating ${rating}`}
  >
    {rating}
  </span>
);

export default RatingBadge;
