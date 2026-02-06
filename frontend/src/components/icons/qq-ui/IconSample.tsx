/**
 * Пример компонента иконки в формате QQ UI.
 * Замените содержимое SVG на экспорт из Figma или удалите файл после добавления реальных иконок.
 */
import { cn } from '@/utils/cn';

export interface IconSampleProps {
  className?: string;
  size?: number;
  color?: string;
}

export const IconSample = ({ className, size = 24, color = 'currentColor' }: IconSampleProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
    style={color !== 'currentColor' ? { color } : undefined}
    aria-hidden
  >
    <path
      d="M12 2C12 2 8 6 7 10C6 14 8 18 12 20C16 18 18 14 17 10C16 6 12 2 12 2Z"
      fill={color}
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
