import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Spinner from './components/ui/Spinner';
import LandingPage from './pages/LandingPage';

// Everything except the landing page loads when first visited
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <Router>
      <ScrollToTop />
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
    </Router>
  );
}

export default App;
