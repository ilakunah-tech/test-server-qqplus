import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { LayoutDashboard, Package, Flame, Calendar, Layers, Settings } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/roasts', label: 'Roasts', icon: Flame },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/blends', label: 'Blends', icon: Layers },
  { path: '/settings', label: 'Настройки', icon: Settings },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-button transition-all",
                isActive
                  ? "bg-brand text-white"
                  : "text-gray-700 hover:bg-gray-100"
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
