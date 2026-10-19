import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { AuctionProvider } from './contexts/AuctionContext';
import ScrollToTop from './components/ScrollToTop';
import Spinner from './components/ui/Spinner';
import LandingPage from './pages/LandingPage';

// Everything except the landing page loads when first visited
const Lobby = lazy(() => import('./pages/Lobby'));
const AuctionRoom = lazy(() => import('./pages/AuctionRoom'));
const AuctionSummary = lazy(() => import('./pages/AuctionSummary'));
const FantasyAdmin = lazy(() => import('./pages/FantasyAdmin'));
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
            <AuctionProvider>
              <Suspense fallback={<Spinner className="min-h-dvh" />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/lobby/:id" element={<Lobby />} />
                  <Route path="/auction/:id" element={<AuctionRoom />} />
                  <Route path="/summary/:id" element={<AuctionSummary />} />
                  <Route path="/admin/fantasy" element={<FantasyAdmin />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuctionProvider>
          </AuthProvider>
        </ToastProvider>
      </GoogleProvider>
    </Router>
  );
}

export default App;
