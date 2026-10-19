import { createContext, useContext } from 'react';

// Kept apart from AuthProvider so that file only exports a component (needed for Fast Refresh)
export const AuthContext = createContext({
  user: null,
  loading: true,
  googleEnabled: false,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginAsGuest: async () => {},
  logout: async () => {},
});

// The fallback keeps a component rendered outside the provider from crashing
export const useAuth = () => useContext(AuthContext) || {};
