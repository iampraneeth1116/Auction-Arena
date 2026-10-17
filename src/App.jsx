import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Spinner from './components/ui/Spinner';
import LandingPage from './pages/LandingPage';

// Everything except the landing page loads when first visited
const NotFound = lazy(() => import('./pages/NotFound'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Google sign-in is optional: without a client ID the app runs with email and guest sign-in
const GoogleProvider = ({ children }) =>
  GOOGLE_CLIENT_ID ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider> : children;

function App() {
  return (
    <Router>
      <ScrollToTop />
      <GoogleProvider>
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<Spinner className="min-h-dvh" />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </GoogleProvider>
    </Router>
  );
}

export default App;
