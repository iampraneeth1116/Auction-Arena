import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Logo from './ui/Logo';
import { useAuth } from '../hooks/useAuth';
import { TEAMS } from '../data/teams';

const YEAR = new Date().getFullYear();

const linkClass =
  'inline-flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wider text-mist transition-colors hover:text-signal';

// Sits at the bottom of the home page, inside PageShell's <main> (it adds no side padding of its own)
const Footer = () => {
  const { user } = useAuth();

  return (
    <footer className="mt-16 pb-8">
      {/* One band per franchise kit colour, like a broadcast sign-off */}
      <div className="flex h-1 overflow-hidden rounded-full opacity-70" aria-hidden>
        {TEAMS.map(team => (
          <span key={team.id} className="flex-1" style={{ backgroundColor: team.colors.primary }} />
        ))}
      </div>

      <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <Link to="/" aria-label="Auction Arena home" className="inline-block">
            <Logo size="sm" />
          </Link>
          <p className="text-sm leading-relaxed text-haze">
            Run a live IPL auction with friends, then compare squads and play the fantasy league.
          </p>
        </div>

        {user?.isAdmin && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link to="/admin/fantasy" className={linkClass}>
                  <ShieldCheck size={14} strokeWidth={2.4} />
                  Fantasy admin
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-white/6 pt-4 text-xs text-haze sm:flex-row sm:items-center sm:justify-between">
        <p>Built with React, Node.js, Socket.IO and PostgreSQL</p>
        <p className="font-display uppercase tracking-[0.14em]">© {YEAR} Auction Arena</p>
      </div>
    </footer>
  );
};

export default Footer;
