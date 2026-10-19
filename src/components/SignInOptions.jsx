import React, { useState } from 'react';
import { ArrowLeft, Mail, UserRound } from 'lucide-react';
import Button from './ui/Button';
import Field from './ui/Field';
import GoogleMark from './ui/GoogleMark';
import EmailAuthForm from './EmailAuthForm';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const GuestSignIn = ({ onBack }) => {
  const { loginAsGuest } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await loginAsGuest(name.trim());
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Your name" placeholder="e.g. Praneeth" maxLength={24} value={name} onChange={e => setName(e.target.value)} autoFocus />
      <Button type="submit" size="lg" block icon={UserRound} loading={busy} disabled={!name.trim()}>
        Play as a guest
      </Button>
      <Button variant="ghost" size="sm" block icon={ArrowLeft} onClick={onBack}>Other ways to sign in</Button>
    </form>
  );
};

// Every way in: Google (when configured), email, or a guest name. Used on the home page and on invite links.
const SignInOptions = () => {
  const { googleEnabled, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('choose'); // choose | email | guest

  const signInWithGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      toast({ message: err.message, tone: 'error' });
    }
  };

  if (view === 'email') return <EmailAuthForm onBack={() => setView('choose')} />;
  if (view === 'guest') return <GuestSignIn onBack={() => setView('choose')} />;
  return (
    <div className="space-y-2.5">
      {googleEnabled && (
        <Button size="lg" block icon={GoogleMark} onClick={signInWithGoogle}>Continue with Google</Button>
      )}
      <Button variant={googleEnabled ? 'outline' : 'primary'} size="lg" block icon={Mail} onClick={() => setView('email')}>
        Continue with email
      </Button>
      <Button variant="outline" size="lg" block icon={UserRound} onClick={() => setView('guest')}>Play as a guest</Button>
      <p className="pt-1 text-xs leading-relaxed text-haze">
        Guests can play straight away. Sign in with {googleEnabled ? 'Google or email' : 'email'} to keep your auction
        history on any device.
      </p>
    </div>
  );
};

export default SignInOptions;
