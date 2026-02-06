import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore } from '@/store/authStore';
import { settingsStore } from '@/store/settingsStore';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { RoastsPage } from '@/pages/RoastsPage';
import { RoastDetailPage } from '@/pages/RoastDetailPage';
import { CompareRoastsPage } from '@/pages/CompareRoastsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { BlendsPage } from '@/pages/BlendsPage';
import { QualityControlPage } from '@/pages/QualityControlPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { UsersPage } from '@/pages/UsersPage';
import { ProductionTasksPage } from '@/pages/ProductionTasksPage';
import { ProductionTasksHistoryPage } from '@/pages/ProductionTasksHistoryPage';
import { KpiPage } from '@/pages/KpiPage';
import { GreenBeanDataPage } from '@/pages/GreenBeanDataPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = authStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

/** Only admin@test.com can manage users (create/edit/delete). */
const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = authStore((state) => state.isAuthenticated);
  const email = authStore((state) => state.email);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (email?.toLowerCase() !== 'admin@test.com') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/** QC and SM can only access dashboard, roasts, and (QC only) quality-control. Redirect others to dashboard. */
const FullAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = authStore((state) => state.isAuthenticated);
  const role = authStore((state) => state.role);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'qc' || role === 'sm') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = settingsStore((s) => s.theme);
  useLayoutEffect(() => {
    const root = document.documentElement;
    let effective: 'light' | 'dark' = 'light';
    if (theme === 'dark') effective = 'dark';
    else if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.classList.remove('dark', 'light');
    root.classList.add(effective);
    root.setAttribute('data-theme', effective);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const isDark = mq.matches;
        root.classList.remove('dark', 'light');
        root.classList.add(isDark ? 'dark' : 'light');
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <InventoryPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roasts"
            element={
              <ProtectedRoute>
                <Layout>
                  <RoastsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roasts/compare"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <CompareRoastsPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roasts/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <RoastDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <SchedulePage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/production-tasks"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <ProductionTasksPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/production-tasks/history"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <ProductionTasksHistoryPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blends"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <BlendsPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-control"
            element={
              <ProtectedRoute>
                <Layout>
                  <QualityControlPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <SuperAdminRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </SuperAdminRoute>
            }
          />
          <Route
            path="/kpi"
            element={
              <SuperAdminRoute>
                <Layout>
                  <KpiPage />
                </Layout>
              </SuperAdminRoute>
            }
          />
          <Route
            path="/green-bean-data"
            element={
              <ProtectedRoute>
                <FullAccessRoute>
                  <Layout>
                    <GreenBeanDataPage />
                  </Layout>
                </FullAccessRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
