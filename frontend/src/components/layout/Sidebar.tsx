import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { LayoutDashboard, Package, Flame, Calendar, Layers, ClipboardCheck, Settings, Bell } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/roasts', label: 'Roasts', icon: Flame },
  { path: '/inventory', label: 'Green Bean', icon: Package },
  { path: '/blends', label: 'Blends', icon: Layers },
  { path: '/quality-control', label: 'Quality control', icon: ClipboardCheck },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/production-tasks', label: 'Production Tasks', icon: Bell },
  { path: '/settings', label: 'Setting', icon: Settings },
];

interface SidebarProps {
  open?: boolean;
}

export const Sidebar = ({ open = true }: SidebarProps) => {
  const location = useLocation();
  const items = navItems;

  return (
    <aside
      className={cn(
        'bg-white dark:bg-gray-800 border-r border-purple-200/60 dark:border-gray-700 min-h-screen p-4 shrink-0 overflow-hidden transition-all duration-300',
        open ? 'w-64' : 'w-0 p-0 border-r-0'
      )}
    >
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-button transition-all",
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
