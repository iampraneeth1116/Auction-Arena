import React, { useEffect, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import { resetSocket } from '../lib/socket';
import { AuthContext } from '../hooks/useAuth';
import PreShow from '../components/PreShow';

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
  isAdmin: user.isAdmin,
};

const INTRO_SEEN_KEY = 'aa_intro_seen';

// The pre-show plays once per browser session, and only when arriving on the home page
const shouldPlayIntro = () => {
  if (window.location.pathname !== '/') return false;
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) !== 'true';
  } catch {
    return false; // storage blocked: skip it rather than show it on every visit
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [introPlaying, setIntroPlaying] = useState(shouldPlayIntro);
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
    // The socket authenticated with the previous cookie; reconnect with the new one
    resetSocket();
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

  const finishIntro = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, 'true');
    } catch {
      // storage blocked: nothing to remember
    }
    setIntroPlaying(false);
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      resetSocket();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleEnabled: GOOGLE_ENABLED, loginWithGoogle, loginWithEmail, registerWithEmail, loginAsGuest, logout }}>
      {GOOGLE_ENABLED && (
        <GoogleSignIn openerRef={googleOpener} onCode={handleGoogleCode} onFailure={(err) => settleGoogleLogin('reject', err)} />
      )}
      <AnimatePresence mode="wait">
        {loading || introPlaying ? (
          <motion.div key="loader" exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeIn' }} className="fixed inset-0 z-[9999]">
            <PreShow intro={introPlaying} onEnter={finishIntro} />
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};
