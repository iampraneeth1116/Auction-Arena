import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Logo from './ui/Logo';
import Button from './ui/Button';

// One of these shows under the logo while the pre-show plays
const TIPS = [
  'Bids go up by ₹20 L while the price is under ₹5 Cr, then by ₹25 L a time.',
  'Overseas slots are capped: 8 by default in a Mega Auction, 4 in Classic 11 and 2 in the 5-player modes.',
  'Not enough friends? The host can hand any empty franchise to a bot, and each bot drafts its own way.',
  'Every player has an Arena Rating from 1 to 99, worked out from career stats and auction standing.',
  'Keep something back: every open slot in your squad needs at least ₹30 L.',
  'Rooms listed as open can be watched by anyone signed in. Spectators see every bid without taking a team.',
  'Arena Strength scores your squad on its best XI. Missing a wicketkeeper costs points.',
];

// Keys that shouldn't count as "press any key"
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape']);

// How long the logo reveal runs before the enter button appears
const REVEAL_MS = 1400;
const TIP_MS = 4800;

// The branded loader. With `intro` it plays the pre-show and waits for the player to enter;
// otherwise it's the everyday loader for page and data loads.
const PageLoader = ({ intro = false, onEnter }) => (intro ? <PreShow onEnter={onEnter} /> : <CompactLoader />);

// A short broadcast-style sting: logo reveal, one tip at a time, then "Enter the arena"
const PreShow = ({ onEnter }) => {
  const [tipIndex, setTipIndex] = useState(() => new Date().getSeconds() % TIPS.length);
  const [ready, setReady] = useState(false);
  const entered = useRef(false);
  const enterRef = useRef(onEnter);
  useEffect(() => {
    enterRef.current = onEnter;
  });

  const enter = () => {
    if (entered.current) return;
    entered.current = true;
    enterRef.current?.();
  };

  useEffect(() => {
    const readyTimer = setTimeout(() => setReady(true), REVEAL_MS);
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), TIP_MS);
    const onKeyDown = (e) => {
      if (IGNORED_KEYS.has(e.key) || e.metaKey || e.ctrlKey || e.altKey || entered.current) return;
      entered.current = true;
      enterRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(readyTimer);
      clearInterval(tipTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex select-none flex-col overflow-hidden bg-ink-950 text-snow"
      onClick={enter}
      role="dialog"
      aria-modal="true"
      aria-label="Auction Arena intro"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(42rem 28rem at 50% 42%, rgb(34 211 238 / 0.12), transparent 70%)' }}
        aria-hidden
      />

      {/* A cyan wipe crosses the screen as the sting starts */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-signal/25 to-transparent"
        initial={{ x: '-120%' }}
        animate={{ x: '360%' }}
        transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1] }}
        aria-hidden
      />

      {/* Top strip */}
      <div className="relative flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <motion.span
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="clip-slant-r inline-flex h-7 items-center gap-2 bg-signal pl-3 pr-6 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-950"
        >
          <span className="size-1.5 rounded-full bg-ink-950 animate-live" aria-hidden />
          Pre-show
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-haze"
        >
          Live IPL auctions
        </motion.span>
      </div>

      {/* Logo reveal */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4">
        <motion.div
          // Negative insets once revealed, so the skewed bar and its glow aren't cut off
          initial={{ clipPath: 'inset(-40% 100% -40% -12%)' }}
          animate={{ clipPath: 'inset(-40% -12% -40% -12%)' }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="origin-center sm:scale-125 lg:scale-150"
        >
          <Logo size="lg" />
        </motion.div>
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.5, ease: 'easeOut' }}
          className="mt-5 h-0.5 w-48 origin-left bg-signal sm:mt-8 sm:w-72"
          aria-hidden
        />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.4 }}
          className="mt-4 text-balance text-center font-display text-xs font-semibold uppercase tracking-[0.16em] text-mist sm:text-base sm:tracking-[0.2em]"
        >
          Claim a franchise · Bid live · Build your XI
        </motion.p>
      </div>

      {/* Lower third: tip + enter */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.45 }}
        className="relative mx-auto w-full max-w-3xl px-4 pb-8 sm:px-8 sm:pb-12"
      >
        <div className="flex items-stretch overflow-hidden rounded-md border border-white/8 bg-ink-850/90">
          <span className="clip-slant-r flex shrink-0 items-center bg-volt pl-3 pr-6 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-950">
            Tip
          </span>
          <div className="flex min-h-16 flex-1 items-center px-3 py-2.5 sm:px-4" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={tipIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-sm leading-snug text-snow sm:text-base"
              >
                {TIPS[tipIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-6 flex min-h-12 flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
          {ready ? (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <Button size="lg" slant icon={ArrowRight} onClick={enter} autoFocus>
                  Enter the arena
                </Button>
              </motion.div>
              <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">
                <span className="pointer-coarse:hidden">or press any key</span>
                <span className="hidden pointer-coarse:inline">or tap anywhere</span>
              </span>
            </>
          ) : (
            <div className="flex w-full items-center gap-3" role="status">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">Setting up the studio</span>
              <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
                <motion.span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-signal"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: REVEAL_MS / 1000, ease: 'easeInOut' }}
                />
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Everyday loader for page and data loads
const CompactLoader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950" role="status">
    <div className="flex flex-col items-center gap-4">
      <Logo size="md" />
      <span className="relative h-1 w-40 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <span className="absolute inset-y-0 left-0 w-1/2 animate-sweep bg-gradient-to-r from-transparent via-signal to-transparent" />
      </span>
      <span className="sr-only">Loading</span>
    </div>
  </div>
);

export default PageLoader;
