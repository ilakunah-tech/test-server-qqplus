import { cn } from '@/utils/cn';

interface FlamesDecorProps {
  className?: string;
}

/** Coffee beans (зёрна) + огненная палитра QQ COFFEE */
const BEAN_COLORS = ['#5D4037', '#6A1A9C', '#8D6E63', '#E85D04', '#8B3DB8', '#3E2723', '#F48C06', '#5D4037', '#6A1A9C', '#8D6E63', '#E85D04', '#8B3DB8'];

/** Coffee beans decoration - warm coffee browns and flame accents */
export const FlamesDecor = ({ className }: FlamesDecorProps) => (
  <svg
    viewBox="0 0 1200 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('w-full h-auto', className)}
    preserveAspectRatio="none"
  >
    {[
      { cx: 50, cy: 60, rx: 35, ry: 22, r: -15 },
      { cx: 140, cy: 55, rx: 32, ry: 20, r: 8 },
      { cx: 220, cy: 62, rx: 38, ry: 21, r: -10 },
      { cx: 310, cy: 58, rx: 34, ry: 20, r: 5 },
      { cx: 400, cy: 60, rx: 36, ry: 22, r: -12 },
      { cx: 490, cy: 55, rx: 33, ry: 20, r: 10 },
      { cx: 580, cy: 62, rx: 37, ry: 21, r: -8 },
      { cx: 670, cy: 58, rx: 35, ry: 20, r: 6 },
      { cx: 760, cy: 60, rx: 36, ry: 22, r: -15 },
      { cx: 850, cy: 55, rx: 32, ry: 20, r: 8 },
      { cx: 930, cy: 62, rx: 38, ry: 21, r: -10 },
      { cx: 1020, cy: 58, rx: 34, ry: 20, r: 5 },
      { cx: 1110, cy: 60, rx: 35, ry: 22, r: -12 },
    ].map((b, i) => (
      <ellipse
        key={i}
        cx={b.cx}
        cy={b.cy}
        rx={b.rx}
        ry={b.ry}
        fill={BEAN_COLORS[i % BEAN_COLORS.length]}
        opacity="0.9"
        transform={`rotate(${b.r} ${b.cx} ${b.cy})`}
      />
    ))}
  </svg>
);

/** Горизонтальный разделитель в стиле «мазок/акцент» */
export const PaintDivider = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'h-1.5 w-full rounded-full bg-gradient-to-r from-qq-amber via-qq-flame to-qq-purple opacity-90',
      'dark:from-qq-yellow dark:via-qq-flame dark:to-qq-purple-light',
      className
    )}
  />
);

export const FlameIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('text-qq-flame', className)}
  >
    <path
      d="M12 2C12 2 8 6 7 10C6 14 8 18 12 20C16 18 18 14 17 10C16 6 12 2 12 2Z"
      fill="currentColor"
    />
  </svg>
);
