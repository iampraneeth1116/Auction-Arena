import React, { useState } from 'react';
import { cn } from '../../lib/cn';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Player headshot; falls back to initials when the photo can't load
const PlayerPhoto = ({ player, className, rounded = 'rounded-md' }) => {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = player?.image;
  if (!src || failedSrc === src) {
    return (
      <span className={cn('inline-flex items-center justify-center bg-ink-700 font-display font-bold text-mist', rounded, className)} aria-label={player?.name}>
        {initials(player?.name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={player.name}
      className={cn('bg-ink-800 object-cover object-top', rounded, className)}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
};

export default PlayerPhoto;
