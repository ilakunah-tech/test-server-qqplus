import { QQCoffeeLogoFull } from '@/components/icons/QQCoffeeLogo';
import { FlamesDecor } from '@/components/icons/FlamesDecor';

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-purple-200/60 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 backdrop-blur">
      <div className="container mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <QQCoffeeLogoFull className="text-white" />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>© {year} QQ Coffee</span>
        </div>
      </div>
      <div className="opacity-70">
        <FlamesDecor className="h-6" />
      </div>
    </footer>
  );
};

