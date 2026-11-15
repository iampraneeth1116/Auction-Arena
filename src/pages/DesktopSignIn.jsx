import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleAlert, CircleCheck, House, MonitorUp } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import { buttonClasses } from '../components/ui/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../lib/cn';

// Google sign-in for the desktop app ends here, in the person's browser. The server sends
// #code=… to hand back to the app on an auctionarena://signed-in link, or #error=… to say
// what went wrong. The code is no use to anyone but the app that started the sign-in.
const CODE = /^[\w-]{43}$/;

const PROBLEMS = {
  cancelled: ['Google sign-in was cancelled', 'Nothing changed. To try again, press Continue with Google in the app.'],
  expired: ['That sign-in took too long', 'A sign-in from the app lasts 10 minutes. Press Continue with Google in the app to start again.'],
  unverified: ['Your Google email isn’t verified', 'Verify it with Google first, or sign in to the app with email or as a guest.'],
  unavailable: ['Google sign-in isn’t available', 'This server isn’t set up for Google sign-in. Sign in to the app with email or as a guest.'],
  busy: ['Too many sign-ins at once', 'Wait a minute, then press Continue with Google in the app again.'],
  failed: ['Google sign-in didn’t work', 'Press Continue with Google in the app to try again.'],
};

const readOutcome = () => {
  const outcome = Object.fromEntries(new URLSearchParams(window.location.hash.slice(1)));
  if (CODE.test(outcome.code ?? '')) return { link: `auctionarena://signed-in?code=${outcome.code}` };
  if (outcome.error) return { problem: PROBLEMS[outcome.error] ?? PROBLEMS.failed };
  return {};
};

const DesktopSignIn = () => {
  useDocumentTitle('Desktop sign-in');
  const [{ link, problem }] = useState(readOutcome);
  const opened = useRef(false);

  useEffect(() => {
    // Off the address bar, so the code doesn't stay in the browser's history
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
    // Hand the code to the app straight away: the browser asks first. The button below is
    // for when it didn't ask, or was told no.
    if (link && !opened.current) {
      opened.current = true;
      window.location.href = link;
    }
  }, [link]);

  const [label, title, body] = link
    ? ['Google sign-in', 'Back to the app', 'You’re signed in with Google. If your browser asks to open Auction Arena, allow it and the app finishes signing you in. Then you can close this tab.']
    : problem
      ? ['Google sign-in', ...problem]
      : ['Desktop app', 'Signing in to the desktop app', 'This page finishes Google sign-in for the Auction Arena desktop app. To sign in, press Continue with Google in the app.'];
  const Icon = link ? CircleCheck : problem ? CircleAlert : MonitorUp;
  const accent = problem ? 'flare' : 'signal';

  return (
    <PageShell showUser={false} className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6 py-10">
      <Panel as={motion.section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} accent={accent} className="w-full max-w-md" bodyClassName="p-6 sm:p-8">
        <span className={cn('clip-slant-r inline-block py-0.5 pl-2.5 pr-6 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-950', problem ? 'bg-flare' : 'bg-signal')}>
          {label}
        </span>
        <h1 className="mt-4 flex items-start gap-2.5 font-display text-3xl font-bold uppercase tracking-wide text-snow">
          <Icon size={26} strokeWidth={2.5} className={cn('mt-1 shrink-0', problem ? 'text-flare' : 'text-signal')} aria-hidden />
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-mist">{body}</p>
        {link && (
          <>
            <a href={link} className={cn(buttonClasses({ variant: 'primary', size: 'lg' }), 'mt-6 w-full')}>
              <MonitorUp size={18} strokeWidth={2.5} /> Open Auction Arena
            </a>
            <p className="mt-3 text-xs leading-relaxed text-haze">
              Nothing happened? Press the button. It works once, within 5 minutes, and only in the app that asked.
            </p>
          </>
        )}
      </Panel>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-haze transition-colors hover:text-snow">
        <House size={14} /> Auction Arena home
      </Link>
    </PageShell>
  );
};

export default DesktopSignIn;
