import { createContext, useContext } from 'react';

// Kept apart from AuthProvider so that file only exports a component (needed for Fast Refresh)
export const AuthContext = createContext({
  user: null,
  loading: true,
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginAsGuest: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);
