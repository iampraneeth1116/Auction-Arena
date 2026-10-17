import React, { useState } from 'react';
import { ArrowLeft, CircleAlert, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';
import Field from './ui/Field';
import Segmented from './ui/Segmented';

const MODES = [
  { id: 'login', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
];

// Email sign-in and account creation, used on the landing page and in the lobby
const EmailAuthForm = ({ onBack }) => {
  const { loginWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegister) await registerWithEmail(name.trim(), email.trim(), password);
      else await loginWithEmail(email.trim(), password);
      // On success the signed-in view replaces this form
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  return (
    <div className="space-y-4 text-left">
      {/* Kept outside the form: the tab buttons would otherwise submit it */}
      <Segmented options={MODES} value={mode} onChange={switchMode} size="sm" stretch className="border-b border-white/6" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <Field
            label="Manager name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should rivals call you?"
            autoComplete="nickname"
            maxLength={40}
            required
          />
        )}

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          autoFocus
        />

        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          minLength={isRegister ? 8 : undefined}
          hint={isRegister ? 'Use 8 or more characters.' : undefined}
          required
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-flare/30 bg-flare/10 px-3 py-2 text-sm text-flare">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <Button type="submit" size="lg" block loading={isSubmitting} icon={isRegister ? UserPlus : LogIn}>
          {isRegister ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {onBack && (
        <Button variant="ghost" size="sm" block icon={ArrowLeft} onClick={onBack}>
          Other ways to sign in
        </Button>
      )}
    </div>
  );
};

export default EmailAuthForm;
