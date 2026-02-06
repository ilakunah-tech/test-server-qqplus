# QQ COFFEE UI Icons (из Figma)

Сюда помещайте иконки, экспортированные из Figma. Каждая иконка — отдельный файл с React-компонентом.

## Как экспортировать из Figma

1. **Вариант A: Copy as SVG**  
   Выделите иконку → правый клик → Copy/Paste → Copy as SVG. Вставьте в новый файл `IconИмя.tsx` и оберните в компонент (см. пример ниже).

2. **Вариант B: Export**  
   Выделите иконку → в правой панели Export → SVG. Сохраните как `IconИмя.svg`, затем конвертируйте в React-компонент (или вставьте содержимое SVG в компонент).

3. **Вариант C: Плагин**  
   Если в Figma использовался плагин (Figma to Code / Anima и т.п.), скопируйте сгенерированные React-компоненты сюда. Приведите к единому формату: `className`, `size` (по умолчанию 24).

## Формат компонента

```tsx
import { cn } from '@/utils/cn';

interface IconИмяProps {
  className?: string;
  size?: number;
  /** Для монохромных иконок — цвет заливки/контура (currentColor по умолчанию) */
  color?: string;
}

export const IconИмя = ({ className, size = 24, color = 'currentColor' }: IconИмяProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn('[&_path]:stroke-[2] [&_path]:stroke-linecap-round [&_path]:stroke-linejoin-round', className)}
    style={color !== 'currentColor' ? { color } : undefined}
  >
    {/* вставьте сюда path/group из Figma; для stroke используйте stroke="currentColor" */}
  </svg>
);
```

- Для **монохромных** иконок в SVG используйте `fill="currentColor"` или `stroke="currentColor"`, тогда цвет подхватится от `className` (например `text-qq-flame`) или от `color`.
- Для **градиентных** (Roasts, Coffee, Flame) оставьте в SVG `linearGradient` с уникальным `id` (например `id={"roasts-grad-" + size}`), чтобы не было конфликтов при нескольких иконках на странице.

## Соответствие имён (Figma → файл)

| Figma / назначение | Имя компонента | Файл |
|--------------------|----------------|------|
| Dashboard | IconDashboard | IconDashboard.tsx |
| Roasts | IconRoasts | IconRoasts.tsx |
| Green Bean | IconGreenBean | IconGreenBean.tsx |
| Blends | IconBlends | IconBlends.tsx |
| Quality Control | IconQualityControl | IconQualityControl.tsx |
| Schedule | IconSchedule | IconSchedule.tsx |
| Production Tasks | IconProductionTasks | IconProductionTasks.tsx |
| Settings | IconSettings | IconSettings.tsx |
| Plus | IconPlus | IconPlus.tsx |
| Pencil / Edit | IconPencil | IconPencil.tsx |
| Trash / Delete | IconTrash | IconTrash.tsx |
| Upload | IconUpload | IconUpload.tsx |
| Download | IconDownload | IconDownload.tsx |
| Printer | IconPrinter | IconPrinter.tsx |
| Search | IconSearch | IconSearch.tsx |
| Filter | IconFilter | IconFilter.tsx |
| Refresh | IconRefresh | IconRefresh.tsx |
| Arrow Left | IconArrowLeft | IconArrowLeft.tsx |
| Close | IconClose | IconClose.tsx |
| Check | IconCheck | IconCheck.tsx |
| Logout | IconLogout | IconLogout.tsx |
| Menu / Panel | IconPanelLeft, IconPanelLeftClose | IconPanelLeft.tsx, IconPanelLeftClose.tsx |
| Wifi | IconWifi | IconWifi.tsx |
| Wifi Off | IconWifiOff | IconWifiOff.tsx |
| Loader | IconLoader | IconLoader.tsx |
| Coffee / Bean | IconCoffee | IconCoffee.tsx |
| Chart | IconChart | IconChart.tsx |
| User | IconUser | IconUser.tsx |
| Users | IconUsers | IconUsers.tsx |
| Info | IconInfo | IconInfo.tsx |
| Target | IconTarget | IconTarget.tsx |
| Palette | IconPalette | IconPalette.tsx |
| Bell | IconBell | IconBell.tsx |
| Cpu / Machine | IconCpu | IconCpu.tsx |
| Star | IconStar, IconStarOff | IconStar.tsx, IconStarOff.tsx |
| File / Document | IconFileText | IconFileText.tsx |
| Compare | IconCompare | IconCompare.tsx |
| History | IconHistory | IconHistory.tsx |

После добавления файла экспортируйте компонент в `index.ts`.
