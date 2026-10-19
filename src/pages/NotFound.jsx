import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, House } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { buttonClasses } from '../components/ui/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../lib/cn';

// Test-card colour bars, tuned to the Auction Arena palette
const TOP_BARS = ['bg-snow/80', 'bg-gold', 'bg-signal', 'bg-volt', 'bg-fuchsia-500', 'bg-flare', 'bg-blue-600'];
const MID_BARS = ['bg-blue-600', 'bg-ink-950', 'bg-fuchsia-500', 'bg-ink-950', 'bg-signal', 'bg-ink-950', 'bg-snow/80'];
const LOW_BLOCKS = [
  { className: 'bg-indigo-950', grow: 5 },
  { className: 'bg-snow', grow: 5 },
  { className: 'bg-violet-900', grow: 5 },
  { className: 'bg-ink-950', grow: 6 },
  { className: 'bg-black', grow: 1 },
  { className: 'bg-ink-950', grow: 1 },
  { className: 'bg-ink-800', grow: 1 },
  { className: 'bg-ink-950', grow: 4 },
];

const SCANLINES = {
  backgroundImage: 'repeating-linear-gradient(0deg, rgb(5 7 15 / 0.35) 0 1px, transparent 1px 3px)',
};

const NotFound = () => {
  useDocumentTitle('Not found');
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl py-8 sm:py-14">
        {/* The dead channel */}
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-ink-950 shadow-2xl">
          <div className="flex aspect-[4/3] flex-col sm:aspect-video" aria-hidden>
            <div className="flex flex-[67]">
              {TOP_BARS.map((bar, i) => <span key={i} className={cn('flex-1', bar)} />)}
            </div>
            <div className="flex flex-[8]">
              {MID_BARS.map((bar, i) => <span key={i} className={cn('flex-1', bar)} />)}
            </div>
            <div className="flex flex-[25]">
              {LOW_BLOCKS.map((block, i) => <span key={i} className={block.className} style={{ flexGrow: block.grow }} />)}
            </div>
          </div>

          {/* Scanlines, a dimming wash and a rolling band of interference */}
          <div className="pointer-events-none absolute inset-0 bg-ink-950/25" style={SCANLINES} aria-hidden />
          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-[18%] bg-linear-to-b from-transparent via-snow/15 to-transparent"
              initial={{ top: '-20%' }}
              animate={{ top: ['-20%', '110%'] }}
              transition={{ duration: 3.6, ease: 'linear', repeat: Infinity, repeatDelay: 1.2 }}
              aria-hidden
            />
          )}

          {/* Channel bug and on-screen message */}
          <span className="absolute left-3 top-3 rounded-sm bg-ink-950/85 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-[0.2em] text-snow sm:left-4 sm:top-4 sm:text-sm">
            CH 404
          </span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-sm bg-flare px-2 py-0.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-white sm:right-4 sm:top-4">
            <span className="size-1.5 rounded-full bg-white animate-live" aria-hidden />
            Off air
          </span>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-full border border-white/20 bg-ink-950/85 px-4 py-2.5 text-center backdrop-blur-sm sm:px-6 sm:py-3">
              <p className="font-display text-xl font-bold uppercase tracking-[0.3em] text-snow sm:text-3xl">No signal</p>
              <p className="mt-1 truncate font-display text-xs uppercase tracking-[0.14em] text-mist" title={pathname}>
                Input: <span className="normal-case tracking-normal text-snow">{pathname}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Lower third */}
        <div className="mt-6 sm:mt-8">
          <span className="clip-slant-r inline-flex h-7 items-center bg-signal pl-3 pr-6 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-950">
            Error 404
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
            No signal at this address
          </h1>
          <p className="mt-2 max-w-xl text-mist">
            There&rsquo;s nothing on this channel. The page may have moved, or the link has a typo. Room links look
            like <span className="font-display tracking-wide text-snow">/lobby/ABC123</span> — if you&rsquo;re joining a
            friend, check the code with them.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
              <House size={18} strokeWidth={2.5} />
              Home
            </Link>
            <Link to="/guide" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
              <BookOpen size={18} strokeWidth={2.5} />
              Game guide
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default NotFound;
