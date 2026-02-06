import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { settingsStore, getEffectiveTheme } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/utils/cn';
import { LogOut, Wifi, WifiOff, PanelLeft, PanelLeftClose, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header = ({ sidebarOpen = true, onToggleSidebar }: HeaderProps) => {
  const { logout, isAuthenticated } = useAuth();
  const { isConnected } = useWebSocket();
  const theme = settingsStore((s) => s.theme);
  const setTheme = settingsStore((s) => s.setTheme);
  const language = settingsStore((s) => s.language);
  const setLanguage = settingsStore((s) => s.setLanguage);
  const isDark = getEffectiveTheme(theme) === 'dark';
  const { t } = useTranslation();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="relative w-full overflow-hidden h-[80px] sm:h-[88px] bg-gradient-to-r from-qq-coffee-dark via-gray-900 to-qq-coffee-dark">
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" aria-hidden />
      {/* Accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-qq-amber/60 to-transparent" aria-hidden />
      
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-between container mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4 animate-slide-in-left">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title={sidebarOpen ? t('header.hideMenu') : t('header.showMenu')}
              aria-label={sidebarOpen ? t('header.hideMenu') : t('header.showMenu')}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 border-2 border-white/30 text-white hover:bg-white/25 hover:border-white/50 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
          )}
          <div className="flex items-center gap-3">
            <img 
              src="/загруженное.png" 
              alt="QQ Coffee" 
              className="h-10 md:h-11 w-auto shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" 
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-tagline text-xl md:text-2xl font-semibold text-qq-amber tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('header.tagline')}
              </span>
              <span className="text-[10px] text-white/90 tracking-[0.2em] uppercase font-medium">
                {t('header.platform')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 animate-slide-in-right">
          {/* Тема: светлая / тёмная */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? t('header.themeLight') : t('header.themeDark')}
            aria-label={isDark ? t('header.themeLight') : t('header.themeDark')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 border-2 border-white/30 text-white hover:bg-white/25 hover:border-white/50 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Язык: RU / EN */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            title={language === 'en' ? t('header.langRu') : t('header.langEn')}
            aria-label={language === 'en' ? t('header.langRu') : t('header.langEn')}
            className="flex items-center justify-center min-w-[44px] h-10 rounded-xl bg-white/15 border-2 border-white/30 text-white text-sm font-bold hover:bg-white/25 hover:border-white/50 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>

          {/* Status pill — контрастный текст */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300',
              isConnected
                ? 'bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.4)]'
                : 'bg-red-600 text-white border border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.4)]'
            )}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <span>{t('header.online')}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>{t('header.offline')}</span>
              </>
            )}
          </div>

          {/* Кнопка Выход — белый текст, тень для читаемости */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/25 border-2 border-white/50 text-white text-sm font-semibold hover:bg-white/35 hover:border-white/70 transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.3)] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('header.logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
