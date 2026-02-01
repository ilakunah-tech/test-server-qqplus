import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore } from '@/store/authStore';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { RoastsPage } from '@/pages/RoastsPage';
import { RoastDetailPage } from '@/pages/RoastDetailPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { BlendsPage } from '@/pages/BlendsPage';
import { SettingsPage } from '@/pages/SettingsPage';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
                <Layout>
                  <InventoryPage />
                </Layout>
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
                <Layout>
                  <SchedulePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blends"
            element={
              <ProtectedRoute>
                <Layout>
                  <BlendsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
