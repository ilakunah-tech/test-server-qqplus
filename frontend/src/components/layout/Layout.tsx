import { ReactNode, useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationToast } from '@/components/NotificationToast';
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
    <div className="min-h-screen bg-gradient-to-br from-[#fffbf7] via-[#fff8f0] to-[#fffbf7] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Subtle mesh gradient overlay */}
      <div className="fixed inset-0 bg-qq-mesh pointer-events-none opacity-60 dark:opacity-30" />
      
      <div className="relative">
        <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <NotificationToast />
        <div className="flex min-w-0 flex-1">
          <Sidebar open={sidebarOpen} />
          <main className="relative min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">
            {/* Page content with subtle animation */}
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
