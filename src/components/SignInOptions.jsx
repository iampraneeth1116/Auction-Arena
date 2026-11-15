import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleAlert, ExternalLink, Mail, UserRound } from 'lucide-react';
import Button from './ui/Button';
import Field from './ui/Field';
import GoogleMark from './ui/GoogleMark';
import EmailAuthForm from './EmailAuthForm';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const GUEST_NAME_MAX = 24;

const GuestSignIn = ({ onBack }) => {
  const { loginAsGuest } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name so other managers know who you are.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await loginAsGuest(name.trim());
    } catch (err) {
      setError(err.message || 'Guest sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Display name"
        placeholder="What should rivals call you?"
        maxLength={GUEST_NAME_MAX}
        autoComplete="nickname"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError('');
        }}
        aria-invalid={Boolean(error)}
        hint={`${name.length}/${GUEST_NAME_MAX} characters`}
      />
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-flare">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" variant="volt" size="lg" block icon={ArrowRight} loading={busy}>Start playing</Button>
      <Button variant="ghost" size="sm" block icon={ArrowLeft} onClick={onBack}>Other ways to sign in</Button>
    </form>
  );
};

// Every way in: Google (when configured), email, or a guest name. Used on the home page and on
// invite links; onViewChange lets the surrounding panel title the step it's on.
const SignInOptions = ({ onViewChange }) => {
  const { googleEnabled, googleInBrowser, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('choose'); // choose | email | guest
  // In the desktop app Google sign-in happens in the browser, which can take a while
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);
  const googleAttempt = useRef(0);

  const show = (next) => {
    setView(next);
    onViewChange?.(next);
  };

  const signInWithGoogle = async () => {
    const attempt = ++googleAttempt.current;
    setWaitingForBrowser(googleInBrowser);
    try {
      await loginWithGoogle();
    } catch (err) {
      toast({ message: err.message || 'Google sign-in failed. Please try again.', tone: 'error' });
    } finally {
      // Pressing the button again starts a new attempt, which keeps the note up
      if (attempt === googleAttempt.current) setWaitingForBrowser(false);
    }
  };

  if (view === 'email') return <EmailAuthForm onBack={() => show('choose')} />;
  if (view === 'guest') return <GuestSignIn onBack={() => show('choose')} />;
  return (
    <div className="space-y-2.5">
      {googleEnabled && (
        <Button size="lg" block icon={GoogleMark} onClick={signInWithGoogle}>Continue with Google</Button>
      )}
      {waitingForBrowser && (
        <p role="status" className="flex gap-2 rounded-md border border-signal/25 bg-signal/8 px-3 py-2.5 text-xs leading-relaxed text-mist">
          <ExternalLink size={14} className="mt-0.5 shrink-0 text-signal" aria-hidden />
          <span>
            Your browser has opened Google sign-in. Finish there, allow it to open Auction Arena, and you&rsquo;ll be
            signed in here. Closed it? Press Continue with Google again.
          </span>
        </p>
      )}
      <Button variant={googleEnabled ? 'outline' : 'primary'} size="lg" block icon={Mail} onClick={() => show('email')}>
        Continue with email
      </Button>
      <div className="flex items-center gap-3 py-1" aria-hidden>
        <span className="h-px flex-1 bg-white/8" />
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">or</span>
        <span className="h-px flex-1 bg-white/8" />
      </div>
      <Button variant="outline" size="lg" block icon={UserRound} onClick={() => show('guest')}>Play as a guest</Button>
      <p className="pt-1 text-xs leading-relaxed text-haze">
        Guests can play straight away. Sign in with {googleEnabled ? 'Google or email' : 'email'} to keep your auction
        history on any device.
      </p>
    </div>
  );
};

export default SignInOptions;
