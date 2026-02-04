import { cn } from '@/utils/cn';

interface FlamesDecorProps {
  className?: string;
}

/** Coffee beans (зёрна) decoration - shown on all pages */
export const FlamesDecor = ({ className }: FlamesDecorProps) => (
  <svg
    viewBox="0 0 1200 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('w-full h-auto', className)}
    preserveAspectRatio="none"
  >
    {/* Row of coffee beans - oval shapes in brand colors */}
    <ellipse cx="50" cy="60" rx="35" ry="22" fill="#6A1A9C" opacity="0.9" transform="rotate(-15 50 60)" />
    <ellipse cx="140" cy="55" rx="32" ry="20" fill="#8B3DB8" opacity="0.85" transform="rotate(8 140 55)" />
    <ellipse cx="220" cy="62" rx="38" ry="21" fill="#6A1A9C" opacity="0.9" transform="rotate(-10 220 62)" />
    <ellipse cx="310" cy="58" rx="34" ry="20" fill="#A855F7" opacity="0.8" transform="rotate(5 310 58)" />
    <ellipse cx="400" cy="60" rx="36" ry="22" fill="#6A1A9C" opacity="0.9" transform="rotate(-12 400 60)" />
    <ellipse cx="490" cy="55" rx="33" ry="20" fill="#8B3DB8" opacity="0.85" transform="rotate(10 490 55)" />
    <ellipse cx="580" cy="62" rx="37" ry="21" fill="#6A1A9C" opacity="0.9" transform="rotate(-8 580 62)" />
    <ellipse cx="670" cy="58" rx="35" ry="20" fill="#A855F7" opacity="0.8" transform="rotate(6 670 58)" />
    <ellipse cx="760" cy="60" rx="36" ry="22" fill="#6A1A9C" opacity="0.9" transform="rotate(-15 760 60)" />
    <ellipse cx="850" cy="55" rx="32" ry="20" fill="#8B3DB8" opacity="0.85" transform="rotate(8 850 55)" />
    <ellipse cx="930" cy="62" rx="38" ry="21" fill="#6A1A9C" opacity="0.9" transform="rotate(-10 930 62)" />
    <ellipse cx="1020" cy="58" rx="34" ry="20" fill="#A855F7" opacity="0.8" transform="rotate(5 1020 58)" />
    <ellipse cx="1110" cy="60" rx="35" ry="22" fill="#8B3DB8" opacity="0.85" transform="rotate(-12 1110 60)" />
  </svg>
);

export const FlameIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 2C12 2 8 6 7 10C6 14 8 18 12 20C16 18 18 14 17 10C16 6 12 2 12 2Z"
      fill="currentColor"
    />
  </svg>
);
