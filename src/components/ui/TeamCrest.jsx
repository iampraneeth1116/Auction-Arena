import React, { useState } from 'react';
import { cn } from '../../lib/cn';
import { TEAMS_BY_ID } from '../../lib/catalog';

const SIZES = { xs: 'size-6 p-0.5', sm: 'size-8 p-1', md: 'size-11 p-1.5', lg: 'size-16 p-2', xl: 'size-24 p-3' };

const TEXT = { xs: 'text-[8px]', sm: 'text-[10px]', md: 'text-xs', lg: 'text-base', xl: 'text-xl' };

// A franchise logo on a tile tinted with the team's kit colour; the short name if the logo can't load
const TeamCrest = ({ teamId, size = 'md', className }) => {
  const team = TEAMS_BY_ID.get(teamId);
  const [failedLogo, setFailedLogo] = useState(null);
  if (!team) {
    return <span className={cn(SIZES[size], 'inline-block rounded-md border border-dashed border-ink-500', className)} aria-hidden />;
  }
  return (
    <span
      className={cn(SIZES[size], 'relative inline-flex shrink-0 items-center justify-center rounded-md border border-white/10', className)}
      style={{ background: `linear-gradient(145deg, ${team.colors.primary}55, #0a0f1f 75%)` }}
    >
      {failedLogo === team.logo ? (
        <span className={cn(TEXT[size], 'font-display font-extrabold leading-none text-white')} aria-label={team.name}>{team.id}</span>
      ) : (
        <img src={team.logo} alt={team.name} className="size-full object-contain" loading="lazy" decoding="async" onError={() => setFailedLogo(team.logo)} />
      )}
    </span>
  );
};

export default TeamCrest;
