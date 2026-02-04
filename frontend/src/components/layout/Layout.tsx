import { ReactNode, useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { authStore } from '@/store/authStore';
import { authApi } from '@/api/auth';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isAuthenticated = authStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    authApi
      .getMe()
      .then((res) => {
        authStore.getState().setUser(res.data.email, res.data.role);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-purple-50/30 dark:bg-gray-900">
      <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex min-w-0 flex-1">
        <Sidebar open={sidebarOpen} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-6 bg-purple-50/30 dark:bg-gray-900">{children}</main>
      </div>
    </div>
  );
};
