import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AuthContext } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

// Keeps the field names the pages use (uid, displayName)
const toClientUser = (user) => user && {
  uid: user.id,
  displayName: user.name,
  isGuest: user.isGuest,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookies
  useEffect(() => {
    let cancelled = false;
    api('/api/auth/me')
      .then(({ user }) => { if (!cancelled) setUser(toClientUser(user)); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loginAsGuest = async (displayName) => {
    const { user } = await api('/api/auth/guest', { method: 'POST', body: { name: displayName } });
    const clientUser = toClientUser(user);
    setUser(clientUser);
    return clientUser;
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAsGuest, logout }}>
      {loading ? <Spinner className="min-h-dvh" /> : children}
    </AuthContext.Provider>
  );
};
