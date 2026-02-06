import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { LayoutDashboard, Package, Flame, Calendar, Layers, ClipboardCheck, Settings, Bell, Coffee, BarChart3, FlaskConical } from 'lucide-react';
import type { UserRole } from '@/types/api';
import { authStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';

const allNavItems = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, color: 'text-blue-500', roles: ['user', 'admin', 'qc', 'sm'] as UserRole[] },
  { path: '/roasts', labelKey: 'nav.roasts', icon: Flame, color: 'text-orange-500', roles: ['user', 'admin', 'qc', 'sm'] as UserRole[] },
  { path: '/inventory', labelKey: 'nav.greenBean', icon: Package, color: 'text-emerald-500', roles: ['user', 'admin'] as UserRole[] },
  { path: '/green-bean-data', labelKey: 'nav.greenBeanData', icon: FlaskConical, color: 'text-teal-500', roles: ['user', 'admin'] as UserRole[] },
  { path: '/blends', labelKey: 'nav.blends', icon: Layers, color: 'text-violet-500', roles: ['user', 'admin'] as UserRole[] },
  { path: '/quality-control', labelKey: 'nav.qualityControl', icon: ClipboardCheck, color: 'text-pink-500', roles: ['user', 'admin', 'qc'] as UserRole[] },
  { path: '/schedule', labelKey: 'nav.schedule', icon: Calendar, color: 'text-cyan-500', roles: ['user', 'admin'] as UserRole[] },
  { path: '/production-tasks', labelKey: 'nav.productionTasks', icon: Bell, color: 'text-amber-500', roles: ['user', 'admin'] as UserRole[] },
  { path: '/kpi', labelKey: 'kpi.title', icon: BarChart3, color: 'text-rose-500', roles: ['admin'] as UserRole[], superAdminOnly: true },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings, color: 'text-gray-500', roles: ['user', 'admin'] as UserRole[] },
];

interface SidebarProps {
  open?: boolean;
}

export const Sidebar = ({ open = true }: SidebarProps) => {
  const location = useLocation();
  const role = authStore((s) => s.role);
  const email = authStore((s) => s.email);
  const { t } = useTranslation();
  const isSuperAdmin = email?.toLowerCase() === 'admin@test.com';
  const navItems = role ? allNavItems.filter((item) => {
    // Check role access
    if (!item.roles.includes(role)) return false;
    // Check superAdminOnly flag
    if ((item as { superAdminOnly?: boolean }).superAdminOnly && !isSuperAdmin) return false;
    return true;
  }) : [];

  return (
    <aside
      className={cn(
        'relative min-h-screen shrink-0 overflow-hidden transition-all duration-300 ease-smooth',
        open ? 'w-72' : 'w-0'
      )}
    >
      {/* Background with subtle pattern */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-b from-white via-white to-stone-50/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 border-r border-stone-200/80 dark:border-white/5',
        !open && 'border-r-0'
      )} />
      
      {/* Decorative gradient accent */}
      <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-qq-flame/20 to-transparent dark:via-qq-amber/10" />
      
      {/* Content */}
      <div className={cn(
        'relative h-full p-4 transition-opacity duration-200',
        open ? 'opacity-100' : 'opacity-0'
      )}>
        {/* Logo section */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-qq-flame to-qq-amber shadow-lg shadow-qq-flame/20">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">QQ Coffee</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Artisan+</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.length === 0 ? null : navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-brand to-qq-flame text-white shadow-lg shadow-brand/25'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-stone-100/80 dark:hover:bg-white/5'
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-qq-amber rounded-r-full shadow-[0_0_8px_rgba(255,182,39,0.6)]" />
                )}
                
                {/* Icon with background */}
                <div className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
                  isActive 
                    ? 'bg-white/20' 
                    : 'bg-stone-100 dark:bg-white/5 group-hover:bg-stone-200/80 dark:group-hover:bg-white/10'
                )}>
                  <Icon className={cn(
                    'w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110',
                    isActive ? 'text-white' : item.color
                  )} />
                </div>
                
                {/* Label */}
                <span className={cn(
                  'font-medium text-sm transition-colors duration-200',
                  isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                )}>
                  {t(item.labelKey)}
                </span>

                {/* Hover indicator */}
                {!isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom decoration */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-qq-flame/5 to-qq-amber/5 dark:from-qq-flame/10 dark:to-qq-amber/10 border border-qq-flame/10 dark:border-qq-amber/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-qq-flame/20 to-qq-amber/20">
                <Flame className="w-5 h-5 text-qq-flame" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">{t('sidebar.roastingMode')}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('sidebar.readyToCreate')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
