# Что делать дальше с иконками из Figma

Иконки в Figma готовы. Дальше — экспорт в проект и замена текущих (lucide-react).

---

## Шаг 1. Получить код иконок из Figma

- **Если Figma выдал React-компоненты:** скопируйте код каждого компонента в отдельный файл в `frontend/src/components/icons/qq-ui/` (например `IconRoasts.tsx`, `IconDashboard.tsx`). Имена файлов — см. таблицу в `qq-ui/README.md`.
- **Если есть только SVG:** в Figma выберите иконку → Copy as SVG. В проекте создайте файл `IconИмя.tsx`, вставьте SVG в компонент по образцу из `qq-ui/IconSample.tsx` (viewBox="0 0 24 24", width/height={size}, fill/stroke="currentColor").

Проверьте:
- у каждого компонента есть пропсы `className?`, `size?` (по умолчанию 24);
- у градиентных иконок уникальный `id` у `linearGradient` (например через `id={\`roasts-grad-${size}\`}`), чтобы не было конфликтов.

---

## Шаг 2. Добавить экспорт в индекс

В `frontend/src/components/icons/qq-ui/index.ts` раскомментируйте и допишите строки для перенесённых иконок, например:

```ts
export { IconDashboard } from './IconDashboard';
export { IconRoasts } from './IconRoasts';
// …
```

---

## Шаг 3. Заменить иконки по экранам

Менять по одному месту, проверяя интерфейс.

| Где | Файл | Что заменить |
|-----|------|--------------|
| **Сайдбар** | `components/layout/Sidebar.tsx` | LayoutDashboard → IconDashboard, Flame → IconRoasts, Package → IconGreenBean, Layers → IconBlends, ClipboardCheck → IconQualityControl, Calendar → IconSchedule, Bell → IconProductionTasks, Settings → IconSettings |
| **Шапка** | `components/layout/Header.tsx` | PanelLeftClose / PanelLeft → IconPanelLeftClose / IconPanelLeft, Wifi / WifiOff → IconWifi / IconWifiOff, LogOut → IconLogout |
| **Dashboard** | `pages/DashboardPage.tsx` | Package, Flame, Layers, TrendingUp, Calendar в KPI; BarChart3, Coffee в заголовках карточек; AlertTriangle в Low stock |
| **Обжарки** | `pages/RoastsPage.tsx`, `RoastDetailPage.tsx` | Plus, Upload, Download, Trash2, Search, Filter, RefreshCw, FileDown, Printer, Pencil, MoreVertical, GitCompare, ArrowLeft, Star, StarOff, FileText, Calendar и т.д. |
| **Склад** | `pages/InventoryPage.tsx` | Plus, Pencil, Trash2, PackagePlus |
| **Смеси** | `components/Blends/BlendsList.tsx` | Pencil, Trash2, Plus |
| **Расписание** | `pages/SchedulePage.tsx` | Plus, Check, X, Trash2, ExternalLink, RotateCcw |
| **Production Tasks** | `pages/ProductionTasksPage.tsx`, `ProductionTasksHistoryPage.tsx` | Plus, Edit, Trash2, Clock, Calendar, History, CheckCircle2, BellOff и т.д. |
| **Quality Control** | `pages/QualityControlPage.tsx`, `QCStatisticsTab.tsx` | ClipboardCheck, List, BarChart3, ChevronLeft/Right, Loader2, FileText, X, CheckCircle2, AlertTriangle, XCircle, Coffee |
| **Сравнение** | `pages/CompareRoastsPage.tsx`, `RoastSelector.tsx` | ArrowLeft, Download, X, Search |
| **Настройки** | `pages/SettingsPage.tsx` | Cpu, User, Bell, Palette, Target, Info, Users |
| **Пользователи** | `pages/UsersPage.tsx` | UsersIcon, Plus, Trash2, X, Pencil |
| **Цели** | `components/Goals/GoalsTab.tsx` | Plus, Pencil, Trash2, Save, X |

Пример замены в Sidebar:

```ts
// Было:
import { LayoutDashboard, Package, Flame, ... } from 'lucide-react';
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ...

// Стало:
import { IconDashboard, IconRoasts, IconGreenBean, IconBlends, IconQualityControl, IconSchedule, IconProductionTasks, IconSettings } from '@/components/icons/qq-ui';
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { path: '/roasts', label: 'Roasts', icon: IconRoasts },
  ...
```

Использование в разметке то же: `<Icon className="w-5 h-5" />` (или с `size={20}` при необходимости).

---

## Шаг 4. Градиентные иконки (Roasts, Coffee, Flame)

Для ключевых иконок с градиентом (#FFEA00 → #F48C06 → #E85D04) оставьте в SVG `defs` с `linearGradient`. В остальных местах можно использовать монохромный вариант с `className="text-qq-flame"` или `text-brand`.

---

## Шаг 5. Уведомления

В `store/notificationStore.ts` заменить `icon: '/vite.svg'` на путь к вашей иконке (например лого или пламя) или на компонент, если храните уведомления как React-узлы.

---

## Чеклист

- [ ] Экспортировать из Figma все нужные иконки в `qq-ui/`
- [ ] Добавить экспорты в `qq-ui/index.ts`
- [ ] Заменить иконки в Sidebar
- [ ] Заменить иконки в Header
- [ ] Заменить иконки на Dashboard
- [ ] Заменить иконки на остальных страницах (Roasts, Inventory, Blends, Schedule, Production Tasks, QC, Compare, Settings, Users, Goals)
- [ ] Обновить иконку в уведомлениях
- [ ] Проверить светлую и тёмную тему

После этого набор QQ COFFEE UI Icons будет полностью интегрирован в приложение.
