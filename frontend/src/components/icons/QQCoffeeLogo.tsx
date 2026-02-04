import { cn } from '@/utils/cn';

interface QQCoffeeLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

/** Logo matching favicon.svg: flame + Q on purple background */
export const QQCoffeeLogo = ({ className, size = 40, color = 'currentColor' }: QQCoffeeLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
  >
    {/* Flame shape - same path as favicon */}
    <path
      d="M50 10C50 10 32 28 28 46C24 64 32 82 50 87C55 88 58 89 60 92C62 89 65 88 70 87C88 82 96 64 92 46C88 28 70 10 50 10Z"
      fill={color}
    />
    {/* Q letter: outer ring (white on purple bg) */}
    <ellipse cx="50" cy="50" rx="16" ry="16" fill={color} />
    {/* Q hole - purple so ring is visible on purple background */}
    <ellipse cx="50" cy="50" rx="9" ry="9" fill="#6A1A9C" />
    {/* Q tail */}
    <path
      d="M57 59C57 59 60 64 63 70C66 76 59 79 55 75"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const QQCoffeeLogoFull = ({ className, color = '#6A1A9C' }: { className?: string; color?: string }) => (
  <div className={cn('flex items-center gap-2', className)}>
    <QQCoffeeLogo size={36} color="white" className="bg-qq-purple rounded-lg p-1" />
    <span className="font-bold text-lg" style={{ color }}>QQ COFFEE</span>
  </div>
);
