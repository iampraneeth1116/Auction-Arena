import React, { useEffect, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import { AuthContext } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

// Google's hook throws during setup without a client ID, so it only mounts when one is
// configured. It hands its popup opener up through openerRef.
const GoogleSignIn = ({ openerRef, onCode, onFailure }) => {
  const open = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: ({ code }) => onCode(code),
    onError: () => onFailure(new Error('Google sign-in failed. Please try again.')),
    onNonOAuthError: (err) => onFailure(
      new Error(err?.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed. Please try again.')
    ),
  });
  useEffect(() => {
    openerRef.current = open;
    return () => { openerRef.current = null; };
  }, [open, openerRef]);
  return null;
};

// Keeps the field names the pages use (uid, displayName, photoURL)
const toClientUser = (user) => user && {
  uid: user.id,
  displayName: user.name,
  email: user.email,
  photoURL: user.avatarUrl,
  isGuest: user.isGuest,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingGoogleLogin = useRef(null);
  const googleOpener = useRef(null);

  // Restore the session from the httpOnly cookies
  useEffect(() => {
    let cancelled = false;
    api('/api/auth/me')
      .then(({ user }) => { if (!cancelled) setUser(toClientUser(user)); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const applySession = (sessionUser) => {
    const clientUser = toClientUser(sessionUser);
    setUser(clientUser);
    return clientUser;
  };

  const settleGoogleLogin = (outcome, value) => {
    const pending = pendingGoogleLogin.current;
    pendingGoogleLogin.current = null;
    pending?.[outcome](value);
  };

  const handleGoogleCode = async (code) => {
    try {
      const { user } = await api('/api/auth/google', { method: 'POST', body: { code } });
      settleGoogleLogin('resolve', applySession(user));
    } catch (err) {
      settleGoogleLogin('reject', err);
    }
  };

  const loginWithGoogle = () => new Promise((resolve, reject) => {
    if (!googleOpener.current) {
      reject(new Error('Google sign-in is not configured.'));
      return;
    }
    pendingGoogleLogin.current = { resolve, reject };
    googleOpener.current();
  });

  const loginWithEmail = async (email, password) => {
    const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    return applySession(user);
  };

  const registerWithEmail = async (name, email, password) => {
    const { user } = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    return applySession(user);
  };

  const loginAsGuest = async (displayName) => {
    const { user } = await api('/api/auth/guest', { method: 'POST', body: { name: displayName } });
    return applySession(user);
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleEnabled: GOOGLE_ENABLED, loginWithGoogle, loginWithEmail, registerWithEmail, loginAsGuest, logout }}>
      {GOOGLE_ENABLED && (
        <GoogleSignIn openerRef={googleOpener} onCode={handleGoogleCode} onFailure={(err) => settleGoogleLogin('reject', err)} />
      )}
      {loading ? <Spinner className="min-h-dvh" /> : children}
    </AuthContext.Provider>
  );
};
