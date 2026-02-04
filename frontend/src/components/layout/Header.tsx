import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { LogOut, Wifi, WifiOff, PanelLeft, PanelLeftClose } from 'lucide-react';

interface HeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header = ({ sidebarOpen = true, onToggleSidebar }: HeaderProps) => {
  const { logout, isAuthenticated } = useAuth();
  const { isConnected } = useWebSocket();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 relative w-full overflow-hidden">
      <img
        src="/resized-image.png"
        alt=""
        className="block w-full h-auto"
        role="presentation"
      />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, rgba(17,24,39,0.35) 0%, rgba(17,24,39,0.10) 45%, rgba(17,24,39,0.35) 100%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-between container mx-auto px-4">
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              title={sidebarOpen ? 'Скрыть меню' : 'Показать меню'}
              aria-label={sidebarOpen ? 'Скрыть меню' : 'Показать меню'}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </Button>
          )}
          <a href="/dashboard" className="inline-flex items-center">
            <img src="/загруженное.png" alt="QQ Coffee" className="h-12 md:h-14 w-auto shrink-0 drop-shadow-lg" />
          </a>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-white">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-300" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-300" />
                <span>Offline</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={logout}
            size="sm"
            className="text-white hover:bg-white/20 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};
