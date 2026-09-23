// ═══════════════════════════════════════════════════════════════════
// PoolNear — Main App with Routing
// ═══════════════════════════════════════════════════════════════════

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingState } from './components/ui';

const AuthPage = lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then(module => ({ default: module.DiscoverPage })));
const CreatePoolPage = lazy(() => import('./pages/CreatePoolPage').then(module => ({ default: module.CreatePoolPage })));
const PoolDetailPage = lazy(() => import('./pages/PoolDetailPage').then(module => ({ default: module.PoolDetailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="bottom-center"
            containerStyle={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
              zIndex: 99999,
            }}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-surface-900)',
                color: 'var(--color-surface-0)',
                borderRadius: '16px',
                fontSize: '0.875rem',
                fontWeight: 700,
                padding: '16px 20px',
                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--color-surface-700)',
              },
            }}
          />
          <Suspense fallback={<div className="h-screen flex items-center justify-center bg-surface-50"><LoadingState /></div>}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/create" element={<CreatePoolPage />} />
                <Route path="/pool/:id" element={<PoolDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:id" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

