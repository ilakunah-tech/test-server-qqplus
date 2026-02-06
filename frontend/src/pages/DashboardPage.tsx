import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isValid, parseISO, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { inventoryApi } from '@/api/inventory';
import { roastsApi } from '@/api/roasts';
import { scheduleApi } from '@/api/schedule';
import { getBlends } from '@/api/blends';
import { productionTasksApi } from '@/api/productionTasks';
import { getMyMachines } from '@/api/machines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Flame,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Coffee,
  Layers,
  BarChart3,
  Thermometer,
  Droplets,
  Gauge,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ListTodo,
  Plus,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  ClipboardList,
  Percent,
} from 'lucide-react';
import { formatWeight } from '@/utils/formatters';
import type { Roast } from '@/types/api';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { settingsStore } from '@/store/settingsStore';
import { authStore } from '@/store/authStore';

// ───────────────────────────── Constants ─────────────────────────────

const DASHBOARD_QUOTES_RU = [
  'Идеальная обжарка начинается с внимания к зерну.',
  'Каждая чашка рассказывает историю.',
  'Утро без кофе — как день без солнца.',
  'Температура и время решают всё.',
  'First crack — музыка для обжарщика.',
  'Хороший кофе не спешит.',
  'Обжарка — это диалог с зерном.',
  'День без обжарки — день без магии.',
  'Слушайте зерно — оно подскажет.',
  'Маленькие батчи, большие вкусы.',
];

const DASHBOARD_QUOTES_EN = [
  'Perfect roast starts with attention to the bean.',
  'Every cup tells a story.',
  'Morning without coffee is like day without sun.',
  'Temperature and time decide everything.',
  'First crack — music for the roaster.',
  'Good coffee doesn\'t rush.',
  'Roasting is a dialogue with the bean.',
  'A day without roasting is a day without magic.',
  'Listen to the bean — it will guide you.',
  'Small batches, big flavours.',
];

function getDailyQuote(lang: 'ru' | 'en'): string {
  const quotes = lang === 'ru' ? DASHBOARD_QUOTES_RU : DASHBOARD_QUOTES_EN;
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
  return quotes[dayOfYear % quotes.length];
}

const CHART_COLORS = [
  '#E85D04', // QQ flame / brand
  '#FFEA00', // QQ yellow
  '#F48C06', // QQ amber
  '#10b981', // emerald
  '#6A1A9C', // QQ purple
  '#ec4899', // pink
];

const QC_COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  pending: '#6b7280',
};

const LOW_STOCK_THRESHOLD_KG = 5;

// ───────────────────────────── Weather hook ─────────────────────────────

interface WeatherCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  surface_pressure: number;
}

function useWeather() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      setError('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        setLoading(false);
        setError('denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,surface_pressure`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.current) {
          setWeather({
            temperature_2m: data.current.temperature_2m,
            relative_humidity_2m: data.current.relative_humidity_2m,
            surface_pressure: data.current.surface_pressure,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError('fetch');
        setLoading(false);
      });
  }, [coords]);

  return { weather, loading, error };
}

// ───────────────────────────── Data hook ─────────────────────────────

function useDashboardData(canViewSchedule: boolean, canViewProductionTasks: boolean) {
  const dateTo = format(new Date(), 'yyyy-MM-dd');
  const dateFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const dateFromPrev = format(subDays(new Date(), 60), 'yyyy-MM-dd');
  const dateToPrev = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees', 'dashboard'],
    queryFn: () => inventoryApi.getCoffees(500, 0),
  });

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', 'dashboard', dateFrom, dateTo],
    queryFn: () => roastsApi.getRoasts(200, 0, dateFrom, dateTo),
  });

  // Previous 30-day period (for trend comparison)
  const { data: prevRoastsData } = useQuery({
    queryKey: ['roasts', 'dashboard-prev', dateFromPrev, dateToPrev],
    queryFn: () => roastsApi.getRoasts(200, 0, dateFromPrev, dateToPrev),
  });

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', 'dashboard'],
    queryFn: () => scheduleApi.getSchedule(undefined, undefined, undefined, undefined, 20, 0),
    enabled: canViewSchedule,
  });

  const { data: blendsData } = useQuery({
    queryKey: ['blends', 'dashboard'],
    queryFn: () => getBlends(100, 0),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['production-tasks', 'dashboard'],
    queryFn: () => productionTasksApi.getTasks(undefined, true),
    enabled: canViewProductionTasks,
  });

  const { data: taskHistoryData } = useQuery({
    queryKey: ['production-tasks-history', 'dashboard'],
    queryFn: () => productionTasksApi.getHistory(undefined, undefined, false, 50, 0),
    enabled: canViewProductionTasks,
  });

  const { data: machinesData } = useQuery({
    queryKey: ['machines', 'dashboard'],
    queryFn: () => getMyMachines(),
    enabled: canViewProductionTasks, // machines are tied to user/admin
  });

  return {
    coffees: coffeesData?.data?.items ?? [],
    totalCoffees: coffeesData?.data?.total ?? 0,
    roasts: roastsData?.data?.items ?? [],
    totalRoasts: roastsData?.data?.total ?? 0,
    prevRoasts: prevRoastsData?.data?.items ?? [],
    prevTotalRoasts: prevRoastsData?.data?.total ?? 0,
    scheduleItems: scheduleData?.data?.items ?? [],
    blendsTotal: blendsData?.total ?? 0,
    tasks: tasksData?.data?.items ?? [],
    taskHistory: taskHistoryData?.data?.items ?? [],
    machines: machinesData ?? [],
  };
}

// ───────────────────────────── Helpers ─────────────────────────────

function safeFormatDate(value: string | Date | null | undefined, fmt: string): string | null {
  if (value == null || value === '') return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, fmt) : null;
}

function aggregateRoastsByDay(roasts: Roast[]) {
  const byDay: Record<string, { date: string; count: number; weight: number }> = {};
  for (let i = 0; i <= 30; i++) {
    const d = format(subDays(new Date(), 30 - i), 'yyyy-MM-dd');
    byDay[d] = { date: format(new Date(d), 'd MMM'), count: 0, weight: 0 };
  }
  roasts.forEach((r) => {
    const raw = r.roasted_at ?? r.roast_date ?? r.created_at;
    const dStr = raw ? safeFormatDate(typeof raw === 'string' ? raw : raw, 'yyyy-MM-dd') : null;
    if (!dStr) return;
    if (!byDay[dStr]) {
      const parsed = typeof raw === 'string' ? parseISO(raw) : raw;
      const displayDate = raw && isValid(parsed) ? format(parsed, 'd MMM') : dStr;
      byDay[dStr] = { date: displayDate, count: 0, weight: 0 };
    }
    byDay[dStr].count += 1;
    byDay[dStr].weight += Number(r.roasted_weight_kg) || 0;
  });
  return Object.keys(byDay)
    .sort()
    .map((k) => byDay[k]);
}

function topCoffeesByRoasts(roasts: Roast[], limit = 8) {
  const count: Record<string, number> = {};
  roasts.forEach((r) => {
    const name = r.label || r.title || r.coffee_hr_id || r.blend_hr_id || 'Unknown';
    count[name] = (count[name] || 0) + 1;
  });
  return Object.entries(count)
    .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function roastLevelDistribution(roasts: Roast[]) {
  const count: Record<string, number> = {};
  roasts.forEach((r) => {
    const level = r.roast_level?.trim() || 'Not set';
    count[level] = (count[level] || 0) + 1;
  });
  return Object.entries(count).map(([name, value]) => ({ name, value }));
}

/** Ужарка в %: считаем по весам (зелёный/обжаренный), иначе — из поля weight_loss. */
function weightLossPercent(r: Roast): number | null {
  const green = Number(r.green_weight_kg);
  const roasted = Number(r.roasted_weight_kg);
  if (green > 0 && roasted > 0 && roasted < green) {
    const pct = ((green - roasted) / green) * 100;
    if (pct > 0 && pct <= 50) return +(pct.toFixed(1));
    return null;
  }
  const raw = (r as Roast & { weight_loss_percent?: number }).weight_loss_percent ?? r.weight_loss;
  if (raw == null) return null;
  const v = Number(raw);
  if (Number.isNaN(v)) return null;
  if (v > 1 && v <= 100) return Math.min(50, Math.max(0.5, v));
  if (v > 0 && v <= 1) {
    const pct = v < 1 ? v * 100 : 1;
    return Math.min(50, Math.max(0.5, pct));
  }
  return null;
}

/** Для списков и графиков — то же, что weightLossPercent (единая логика). */
function normalizeWeightLoss(r: Roast): number | null {
  return weightLossPercent(r);
}

function weightLossByDay(roasts: Roast[]) {
  const byDay: Record<string, { date: string; totalLoss: number; count: number }> = {};
  roasts.forEach((r) => {
    const raw = r.roasted_at ?? r.roast_date ?? r.created_at;
    const dStr = raw ? safeFormatDate(typeof raw === 'string' ? raw : raw, 'yyyy-MM-dd') : null;
    if (!dStr) return;
    const loss = normalizeWeightLoss(r);
    if (loss == null || loss <= 0) return;
    if (!byDay[dStr]) {
      byDay[dStr] = { date: format(parseISO(dStr), 'd MMM'), totalLoss: 0, count: 0 };
    }
    byDay[dStr].totalLoss += loss;
    byDay[dStr].count += 1;
  });
  return Object.keys(byDay)
    .sort()
    .map((k) => ({
      date: byDay[k].date,
      loss: +(byDay[k].totalLoss / byDay[k].count).toFixed(1),
    }));
}

function machineUtilization(roasts: Roast[]) {
  const count: Record<string, number> = {};
  roasts.forEach((r) => {
    const machine = r.machine?.trim();
    if (!machine) return;
    count[machine] = (count[machine] || 0) + 1;
  });
  return Object.entries(count)
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function computeQCSummary(roasts: Roast[]) {
  let green = 0, yellow = 0, red = 0, pending = 0;
  roasts.forEach((r) => {
    if (!r.in_quality_control && !r.cupping_verdict && !r.espresso_verdict) return;
    const verdict = r.cupping_verdict || r.espresso_verdict;
    if (verdict === 'green') green++;
    else if (verdict === 'yellow') yellow++;
    else if (verdict === 'red') red++;
    else pending++;
  });
  return { green, yellow, red, pending, total: green + yellow + red + pending };
}

function computeGoalsCompliance(roasts: Roast[]) {
  let green = 0, yellow = 0, red = 0;
  roasts.forEach((r) => {
    if (!r.goals_status) return;
    if (r.goals_status === 'green') green++;
    else if (r.goals_status === 'yellow') yellow++;
    else if (r.goals_status === 'red') red++;
  });
  const total = green + yellow + red;
  return { green, yellow, red, total };
}

function computeTrend(current: number, previous: number): { percent: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { percent: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
  const pct = ((current - previous) / previous) * 100;
  return {
    percent: Math.abs(+pct.toFixed(1)),
    direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
  };
}

// ───────────────────────────── Trend badge ─────────────────────────────

function TrendBadge({ current, previous, label, invert = false }: { current: number; previous: number; label: string; invert?: boolean }) {
  const { percent, direction } = computeTrend(current, previous);
  if (direction === 'flat') return <span className="text-xs text-gray-400">{label}</span>;

  const isPositive = invert ? direction === 'down' : direction === 'up';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium rounded-md px-1.5 py-0.5',
      isPositive
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
    )}>
      {direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {percent}%
    </span>
  );
}

// ───────────────────────────── Component ─────────────────────────────

export const DashboardPage = () => {
  const { t } = useTranslation();
  const language = settingsStore((s) => s.language);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { weather, loading: weatherLoading, error: weatherError } = useWeather();
  const dailyQuote = useMemo(() => getDailyQuote(language), [language]);

  // ── Role-based access ──
  const role = authStore((s) => s.role);
  const email = authStore((s) => s.email);
  const isSuperAdmin = email?.toLowerCase() === 'admin@test.com';

  const canViewInventory = role === 'user' || role === 'admin';
  const canViewSchedule = role === 'user' || role === 'admin';
  const canViewQC = role === 'user' || role === 'admin' || role === 'qc';
  const canViewProductionTasks = role === 'user' || role === 'admin';
  const canViewGoals = role === 'user' || role === 'admin';
  const canViewMachines = role === 'user' || role === 'admin';

  useEffect(() => {
    const tid = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(tid);
  }, []);

  // ── Data ──
  const {
    coffees,
    totalCoffees,
    roasts,
    totalRoasts,
    prevRoasts,
    prevTotalRoasts,
    scheduleItems,
    blendsTotal,
    tasks,
    taskHistory,
  } = useDashboardData(canViewSchedule, canViewProductionTasks);

  // ── Computed values ──
  const pendingSchedules = scheduleItems.filter((s) => s.status === 'pending');

  const totalRoasted = useMemo(
    () => roasts.reduce((sum, r) => sum + (Number(r.roasted_weight_kg) || 0), 0),
    [roasts]
  );
  const prevTotalRoasted = useMemo(
    () => prevRoasts.reduce((sum, r) => sum + (Number(r.roasted_weight_kg) || 0), 0),
    [prevRoasts]
  );

  const avgWeightLoss = useMemo(() => {
    const losses = roasts.map(normalizeWeightLoss).filter((l): l is number => l != null && l > 0);
    return losses.length > 0 ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0;
  }, [roasts]);
  const prevAvgWeightLoss = useMemo(() => {
    const losses = prevRoasts.map(normalizeWeightLoss).filter((l): l is number => l != null && l > 0);
    return losses.length > 0 ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0;
  }, [prevRoasts]);

  const chartData = useMemo(() => { try { return aggregateRoastsByDay(roasts); } catch { return []; } }, [roasts]);
  const topCoffees = useMemo(() => { try { return topCoffeesByRoasts(roasts); } catch { return []; } }, [roasts]);
  const levelData = useMemo(() => { try { return roastLevelDistribution(roasts); } catch { return []; } }, [roasts]);
  const weightLossData = useMemo(() => { try { return weightLossByDay(roasts); } catch { return []; } }, [roasts]);
  const machineData = useMemo(() => { try { return machineUtilization(roasts); } catch { return []; } }, [roasts]);
  const qcData = useMemo(() => computeQCSummary(roasts), [roasts]);
  const goalsData = useMemo(() => computeGoalsCompliance(roasts), [roasts]);

  const lowStockCoffees = useMemo(
    () => coffees.filter((c) => c.stock_weight_kg != null && c.stock_weight_kg > 0 && c.stock_weight_kg <= LOW_STOCK_THRESHOLD_KG),
    [coffees]
  );

  // KPI summary for superAdmin (this month)
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthRoasts = useMemo(
    () => roasts.filter((r) => {
      const raw = r.roasted_at ?? r.roast_date ?? r.created_at;
      const dStr = raw ? safeFormatDate(typeof raw === 'string' ? raw : raw, 'yyyy-MM-dd') : null;
      return dStr != null && dStr >= monthStart;
    }),
    [roasts, monthStart]
  );
  const monthRoastedKg = useMemo(
    () => monthRoasts.reduce((sum, r) => sum + (Number(r.roasted_weight_kg) || 0), 0),
    [monthRoasts]
  );
  const monthDeviations = useMemo(
    () => monthRoasts.filter((r) => r.goals_status === 'red').length,
    [monthRoasts]
  );

  // Pending task history items
  const pendingTaskHistory = useMemo(
    () => taskHistory.filter((h) => !h.marked_completed_at),
    [taskHistory]
  );

  // ── KPI Stats ──
  const baseStats = [
    {
      key: 'coffeeLots',
      title: t('dashboard.coffeeLots'),
      value: totalCoffees,
      icon: Package,
      gradient: 'from-blue-500 to-cyan-400',
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      link: canViewInventory ? '/inventory' : undefined,
    },
    {
      key: 'totalRoasts',
      title: t('dashboard.totalRoasts'),
      value: totalRoasts,
      icon: Flame,
      gradient: 'from-orange-500 to-amber-400',
      iconBg: 'bg-gradient-to-br from-orange-500/20 to-amber-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]',
      trend: { current: totalRoasts, previous: prevTotalRoasts },
      link: '/roasts',
    },
    {
      key: 'blends',
      title: t('dashboard.blends'),
      value: blendsTotal,
      icon: Layers,
      gradient: 'from-violet-500 to-purple-400',
      iconBg: 'bg-gradient-to-br from-violet-500/20 to-purple-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]',
      link: canViewInventory ? '/blends' : undefined,
    },
    {
      key: 'roasted30d',
      title: t('dashboard.roasted30d'),
      value: formatWeight(totalRoasted),
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-400',
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]',
      trend: { current: totalRoasted, previous: prevTotalRoasted },
      link: '/roasts',
    },
    {
      key: 'avgLoss',
      title: t('dashboard.avgWeightLoss'),
      value: avgWeightLoss > 0 ? `${avgWeightLoss}%` : '—',
      icon: Percent,
      gradient: 'from-rose-500 to-pink-400',
      iconBg: 'bg-gradient-to-br from-rose-500/20 to-pink-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(244,63,94,0.3)]',
      trend: avgWeightLoss > 0 && prevAvgWeightLoss > 0
        ? { current: avgWeightLoss, previous: prevAvgWeightLoss, invert: true }
        : undefined,
    },
  ];

  const pendingStat = canViewSchedule ? {
    key: 'pending',
    title: t('dashboard.pending'),
    value: pendingSchedules.length,
    icon: Calendar,
    gradient: 'from-amber-500 to-yellow-400',
    iconBg: 'bg-gradient-to-br from-amber-500/20 to-yellow-400/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    link: '/schedule',
  } : null;

  const stats = pendingStat ? [...baseStats, pendingStat] : baseStats;
  const gridCols = stats.length === 6 ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-2 lg:grid-cols-5';

  return (
    <div className="space-y-8 pb-8 max-w-7xl mx-auto">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        id="dashboard-hero"
        className="relative overflow-hidden rounded-2xl p-8 animate-fade-in"
        style={{ background: 'linear-gradient(to right, #3E2723, #111827, #3E2723)' }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-8 h-8 hero-muted" />
                <span className="text-4xl font-bold tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </span>
              </div>
              <span className="text-xl hero-muted">
                {format(currentTime, 'EEEE, d MMMM yyyy', { locale: language === 'ru' ? ru : undefined })}
              </span>
            </div>
            <p className="text-lg max-w-xl italic hero-soft">&ldquo;{dailyQuote}&rdquo;</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {weatherLoading && (
              <span className="text-sm hero-muted">{t('dashboard.weatherLoading')}</span>
            )}
            {weatherError && !weather && !weatherLoading && (
              <span className="text-sm hero-muted">{t('dashboard.allowLocation')}</span>
            )}
            {weather && (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
                  <Thermometer className="w-5 h-5 hero-icon-orange" />
                  <span className="font-semibold">{Math.round(weather.temperature_2m)} °C</span>
                  <span className="text-sm hero-dim">{t('dashboard.temperature')}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
                  <Droplets className="w-5 h-5 hero-icon-cyan" />
                  <span className="font-semibold">{weather.relative_humidity_2m}%</span>
                  <span className="text-sm hero-dim">{t('dashboard.humidity')}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
                  <Gauge className="w-5 h-5 hero-icon-green" />
                  <span className="font-semibold">{Math.round(weather.surface_pressure)} hPa</span>
                  <span className="text-sm hero-dim">{t('dashboard.pressure')}</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm hero-muted">{t('dashboard.liveData')}</span>
            </div>
          </div>
        </div>
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(244,140,6,0.2)' }} />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(106,26,156,0.2)' }} />
      </div>

      {/* ═══════════════════════ QUICK ACTIONS (user/admin) ═══════════════════════ */}
      {(canViewInventory) && (
        <div className="flex flex-wrap items-center gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-1">{t('dashboard.quickActions')}:</span>
          <Link
            to="/roasts"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-gradient-to-r from-orange-500 to-amber-500 text-white
              hover:from-orange-600 hover:to-amber-600 transition-all hover:scale-105 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('dashboard.newRoast')}
          </Link>
          {canViewSchedule && (
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                bg-gradient-to-r from-cyan-500 to-blue-500 text-white
                hover:from-cyan-600 hover:to-blue-600 transition-all hover:scale-105 shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              {t('dashboard.addSchedule')}
            </Link>
          )}
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-gradient-to-r from-emerald-500 to-teal-500 text-white
              hover:from-emerald-600 hover:to-teal-600 transition-all hover:scale-105 shadow-sm"
          >
            <Package className="w-4 h-4" />
            {t('dashboard.addStock')}
          </Link>
        </div>
      )}

      {/* ═══════════════════════ KPI CARDS ═══════════════════════ */}
      <div className={cn('grid grid-cols-1 gap-5', gridCols)}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const Wrapper = stat.link ? Link : 'div';
          const wrapperProps = stat.link ? { to: stat.link } : {};
          return (
            <Wrapper
              key={stat.key}
              {...(wrapperProps as any)}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-5 transition-all duration-300',
                stat.link ? 'cursor-pointer' : 'cursor-default',
                'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm',
                'border border-stone-200/60 dark:border-white/5',
                'hover:-translate-y-1',
                stat.glow,
                'animate-fade-in-up'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r', stat.gradient)} />
              <div className={cn(
                'absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                'bg-gradient-to-br',
                stat.gradient
              )} />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    'flex items-center justify-center w-11 h-11 rounded-xl transition-transform duration-300 group-hover:scale-110',
                    stat.iconBg
                  )}>
                    <Icon className={cn('w-5 h-5 bg-gradient-to-br bg-clip-text', stat.gradient.replace('from-', 'text-').split(' ')[0])} />
                  </div>
                  {'trend' in stat && stat.trend && (
                    <TrendBadge
                      current={stat.trend.current}
                      previous={stat.trend.previous}
                      label={t('dashboard.vsPrevPeriod')}
                      invert={'invert' in stat.trend && stat.trend.invert === true}
                    />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white animate-number-count">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* ═══════════════════════ CHARTS ROW 1 ═══════════════════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Roasts & Weight */}
        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '400ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-400/20">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              {t('dashboard.roastsAndWeight')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500" tickFormatter={(v) => `${v} kg`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => name === 'weight' ? [formatWeight(value), 'Weight'] : [value, 'Roasts']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="count" stroke={CHART_COLORS[0]} fill="url(#colorCount)" strokeWidth={2} name="roasts" />
                  <Area yAxisId="right" type="monotone" dataKey="weight" stroke={CHART_COLORS[2]} fill="url(#colorWeight)" strokeWidth={2} name="weight" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Coffees / Blends */}
        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '480ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-400/20">
                <Coffee className="h-5 w-5 text-violet-500" />
              </div>
              {t('dashboard.topCoffees')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[280px]">
              {topCoffees.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCoffees} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} name="Roasts" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Coffee} gradient="from-orange-500/10 to-amber-400/10" color="text-orange-400/60" text={t('dashboard.noRoastData')} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════ CHARTS ROW 2 ═══════════════════════ */}
      <div className={cn('grid grid-cols-1 gap-6', canViewInventory ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        {/* Roast Levels Pie */}
        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '560ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-400/20">
                <Flame className="h-5 w-5 text-emerald-500" />
              </div>
              {t('dashboard.roastLevels')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[220px]">
              {levelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={levelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {levelData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(value: number, _name: string, props) => [`${value} roasts`, props.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Flame} gradient="from-emerald-500/10 to-teal-400/10" color="text-emerald-400/60" text={t('dashboard.noRoastLevels')} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weight Loss Trend */}
        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '600ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-400/20">
                <Activity className="h-5 w-5 text-rose-500" />
              </div>
              {t('dashboard.weightLossTrend')}
              {avgWeightLoss > 0 && (
                <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                  {t('dashboard.avgLoss')}: <span className="font-semibold text-rose-500">{avgWeightLoss}%</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[220px]">
              {weightLossData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightLossData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500" />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500" tickFormatter={(v) => `${v}%`} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`${value}%`, t('dashboard.avgWeightLoss')]}
                    />
                    <Line type="monotone" dataKey="loss" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Activity} gradient="from-rose-500/10 to-pink-400/10" color="text-rose-400/60" text={t('dashboard.noWeightLossData')} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert (user/admin only) */}
        {canViewInventory && (
          <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '640ms' }}>
            <CardHeader className="border-b border-stone-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-400/20">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                {t('dashboard.lowStockAlert')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {lowStockCoffees.length > 0 ? (
                <ul className="space-y-2 max-h-[220px] overflow-y-auto">
                  {lowStockCoffees.slice(0, 8).map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-yellow-50/50 py-2.5 px-3 dark:border-amber-800/40 dark:from-amber-900/20 dark:to-amber-800/10 transition-all hover:scale-[1.01]" style={{ animationDelay: `${i * 50}ms` }}>
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate mr-2">{c.label ?? c.name ?? c.hr_id}</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-lg whitespace-nowrap">{formatWeight(c.stock_weight_kg ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-400/10 flex items-center justify-center mb-3">
                    <Package className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">{t('dashboard.allStockHealthy')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.threshold')}: {LOW_STOCK_THRESHOLD_KG} kg</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════════════════ ANALYTICS ROW (role-based) ═══════════════════════ */}
      {(canViewQC || canViewGoals || canViewMachines) && (
        <div className={cn('grid grid-cols-1 gap-6',
          canViewGoals && canViewMachines ? 'lg:grid-cols-3' :
          canViewQC && !canViewGoals ? 'lg:grid-cols-1' :
          'lg:grid-cols-2'
        )}>
          {/* QC Summary (user/admin/qc) */}
          {canViewQC && (
            <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '700ms' }}>
              <CardHeader className="border-b border-stone-100 dark:border-white/5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-400/20">
                    <Shield className="h-5 w-5 text-emerald-500" />
                  </div>
                  {t('dashboard.qcSummary')}
                  {canViewQC && (
                    <Link to="/quality-control" className="ml-auto text-sm font-medium text-brand hover:text-brand-hover transition-colors">
                      {t('dashboard.viewAll')} →
                    </Link>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {qcData.total > 0 ? (
                  <div className="space-y-4">
                    {/* Donut-like stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <QCStatItem color={QC_COLORS.green} count={qcData.green} label={t('dashboard.qcPassed')} icon={CheckCircle2} />
                      <QCStatItem color={QC_COLORS.yellow} count={qcData.yellow} label={t('dashboard.qcWarning')} icon={AlertCircle} />
                      <QCStatItem color={QC_COLORS.red} count={qcData.red} label={t('dashboard.qcFailed')} icon={XCircle} />
                      <QCStatItem color={QC_COLORS.pending} count={qcData.pending} label={t('dashboard.awaitingQC')} icon={Clock} />
                    </div>
                    {/* Progress bar */}
                    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {qcData.green > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(qcData.green / qcData.total) * 100}%` }} />}
                      {qcData.yellow > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(qcData.yellow / qcData.total) * 100}%` }} />}
                      {qcData.red > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${(qcData.red / qcData.total) * 100}%` }} />}
                      {qcData.pending > 0 && <div className="h-full bg-gray-400 transition-all" style={{ width: `${(qcData.pending / qcData.total) * 100}%` }} />}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={Shield} gradient="from-emerald-500/10 to-cyan-400/10" color="text-emerald-400/60" text={t('dashboard.noQCData')} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Goals Compliance (user/admin) */}
          {canViewGoals && (
            <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '740ms' }}>
              <CardHeader className="border-b border-stone-100 dark:border-white/5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-400/20">
                    <Target className="h-5 w-5 text-blue-500" />
                  </div>
                  {t('dashboard.goalsCompliance')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {goalsData.total > 0 ? (
                  <div className="space-y-4">
                    {/* Big compliance rate */}
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {Math.round((goalsData.green / goalsData.total) * 100)}%
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {goalsData.green} / {goalsData.total} {t('dashboard.goalsRate')}
                      </p>
                    </div>
                    {/* Status breakdown */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{goalsData.green}</div>
                        <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('dashboard.goalsMet')}</div>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{goalsData.yellow}</div>
                        <div className="text-xs text-amber-600/70 dark:text-amber-400/70">{t('dashboard.goalsWarning')}</div>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-red-50 dark:bg-red-900/20">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{goalsData.red}</div>
                        <div className="text-xs text-red-600/70 dark:text-red-400/70">{t('dashboard.goalsNotMet')}</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {goalsData.green > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(goalsData.green / goalsData.total) * 100}%` }} />}
                      {goalsData.yellow > 0 && <div className="h-full bg-amber-400" style={{ width: `${(goalsData.yellow / goalsData.total) * 100}%` }} />}
                      {goalsData.red > 0 && <div className="h-full bg-red-500" style={{ width: `${(goalsData.red / goalsData.total) * 100}%` }} />}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={Target} gradient="from-blue-500/10 to-indigo-400/10" color="text-blue-400/60" text={t('dashboard.noGoalsData')} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Machine Utilization (user/admin) */}
          {canViewMachines && (
            <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '780ms' }}>
              <CardHeader className="border-b border-stone-100 dark:border-white/5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-400/20">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                  </div>
                  {t('dashboard.machineUtilization')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {machineData.length > 0 ? (
                  <div className="space-y-2">
                    {machineData.map((m, i) => {
                      const maxVal = machineData[0]?.value || 1;
                      return (
                        <div key={m.name} className="flex items-center gap-3" style={{ animationDelay: `${i * 50}ms` }}>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 truncate" title={m.name}>{m.name}</span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                              style={{ width: `${Math.max((m.value / maxVal) * 100, 10)}%` }}
                            >
                              <span className="text-xs font-bold text-white">{m.value}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={BarChart3} gradient="from-purple-500/10 to-violet-400/10" color="text-purple-400/60" text={t('dashboard.noMachineData')} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════ PRODUCTION TASKS & KPI (role-based) ═══════════════════════ */}
      {(canViewProductionTasks || isSuperAdmin) && (
        <div className={cn('grid grid-cols-1 gap-6', isSuperAdmin && canViewProductionTasks ? 'lg:grid-cols-2' : '')}>
          {/* Production Tasks (user/admin) */}
          {canViewProductionTasks && (
            <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '820ms' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-400/20">
                    <ListTodo className="h-5 w-5 text-indigo-500" />
                  </div>
                  {t('dashboard.productionTasksWidget')}
                </CardTitle>
                <Link to="/production-tasks" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
                  {t('dashboard.viewAll')} <span className="text-lg">→</span>
                </Link>
              </CardHeader>
              <CardContent className="pt-4">
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                        <ListTodo className="w-5 h-5 text-indigo-500" />
                        <div>
                          <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{tasks.length}</div>
                          <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70">{t('dashboard.activeTasks')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                        <ClipboardList className="w-5 h-5 text-amber-500" />
                        <div>
                          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{pendingTaskHistory.length}</div>
                          <div className="text-xs text-amber-600/70 dark:text-amber-400/70">{t('dashboard.pendingCompletion')}</div>
                        </div>
                      </div>
                    </div>
                    {/* Task list */}
                    <div className="space-y-2">
                      {tasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-xl border border-stone-200/60 dark:border-white/5 py-2.5 px-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                              task.task_type === 'schedule' ? 'bg-blue-500' :
                              task.task_type === 'counter' ? 'bg-amber-500' : 'bg-violet-500'
                            )} />
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</span>
                          </div>
                          {task.task_type === 'counter' && task.counter_trigger_value && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                              {task.counter_current_value}/{task.counter_trigger_value}
                            </span>
                          )}
                          {task.machine_name && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2 hidden sm:inline">{task.machine_name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={ListTodo} gradient="from-indigo-500/10 to-blue-400/10" color="text-indigo-400/60" text={t('dashboard.noActiveTasksMsg')} />
                )}
              </CardContent>
            </Card>
          )}

          {/* KPI Summary (superAdmin only) */}
          {isSuperAdmin && (
            <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '860ms' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-400/20">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                  </div>
                  {t('dashboard.kpiSummary')}
                </CardTitle>
                <Link to="/kpi" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
                  {t('dashboard.viewAll')} <span className="text-lg">→</span>
                </Link>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <KPISummaryItem
                    icon={Flame}
                    label={t('dashboard.roastedThisMonth')}
                    value={formatWeight(monthRoastedKg)}
                    gradient="from-orange-500/20 to-amber-400/20"
                    color="text-orange-500"
                  />
                  <KPISummaryItem
                    icon={Package}
                    label={t('dashboard.batchesMonth')}
                    value={String(monthRoasts.length)}
                    gradient="from-blue-500/20 to-cyan-400/20"
                    color="text-blue-500"
                  />
                  <KPISummaryItem
                    icon={XCircle}
                    label={t('dashboard.deviations')}
                    value={String(monthDeviations)}
                    gradient="from-red-500/20 to-rose-400/20"
                    color="text-red-500"
                  />
                  <KPISummaryItem
                    icon={Shield}
                    label={t('dashboard.qcRatio')}
                    value={qcData.total > 0 ? `${Math.round((qcData.green / qcData.total) * 100)}%` : '—'}
                    gradient="from-emerald-500/20 to-teal-400/20"
                    color="text-emerald-500"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════ RECENT ROASTS & SCHEDULE ═══════════════════════ */}
      <div className={cn('grid grid-cols-1 gap-6', canViewSchedule ? 'lg:grid-cols-2' : '')}>
        {/* Recent Roasts (enhanced) */}
        <Card className="animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '900ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-400/20">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              {t('dashboard.recentRoasts')}
            </CardTitle>
            <Link to="/roasts" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
              {t('dashboard.viewAll')} <span className="text-lg">→</span>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {roasts.length > 0 ? (
              <div className="space-y-2">
                {roasts.slice(0, 6).map((roast, i) => {
                  const dateStr = roast.roasted_at ?? roast.roast_date ?? roast.created_at;
                  const weightKg = Number(roast.roasted_weight_kg) || 0;
                  const loss = normalizeWeightLoss(roast);
                  return (
                    <Link key={roast.id} to={`/roasts/${roast.id}`} className="group flex justify-between items-center rounded-xl border border-stone-200/60 dark:border-white/5 py-3 px-4 transition-all hover:bg-stone-50 dark:hover:bg-white/5 hover:border-brand/20 hover:scale-[1.01]" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Goals status dot */}
                        {roast.goals_status && (
                          <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0',
                            roast.goals_status === 'green' ? 'bg-emerald-500' :
                            roast.goals_status === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
                          )} title={
                            roast.goals_status === 'green' ? t('roasts.goalsStatusGreen') :
                            roast.goals_status === 'yellow' ? t('roasts.goalsStatusYellow') :
                            t('roasts.goalsStatusRed')
                          } />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand transition-colors truncate">{roast.title ?? roast.label ?? roast.operator ?? '—'}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{dateStr ? (safeFormatDate(dateStr, 'd MMM yyyy') ?? '—') : '—'}</span>
                            {roast.machine && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <span className="truncate">{roast.machine}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatWeight(weightKg)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{loss != null ? `${loss.toFixed(1)}% ${t('dashboard.loss')}` : '—'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Flame} gradient="from-orange-500/10 to-amber-400/10" color="text-orange-400/60" text={t('dashboard.noRoastsYet')} subtitle={t('dashboard.startFirstRoast')} />
            )}
          </CardContent>
        </Card>

        {/* Upcoming Schedule (user/admin only) */}
        {canViewSchedule && (
          <Card className="animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '960ms' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-400/20">
                  <Calendar className="h-5 w-5 text-cyan-500" />
                </div>
                {t('dashboard.upcomingSchedule')}
              </CardTitle>
              <Link to="/schedule" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
                {t('dashboard.viewAll')} <span className="text-lg">→</span>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {pendingSchedules.length > 0 ? (
                <div className="space-y-2">
                  {pendingSchedules.slice(0, 6).map((schedule, i) => (
                    <div key={schedule.id} className="flex justify-between items-center rounded-xl border border-stone-200/60 dark:border-white/5 py-3 px-4 transition-all hover:bg-stone-50 dark:hover:bg-white/5" style={{ animationDelay: `${i * 40}ms` }}>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{schedule.title || t('dashboard.scheduledRoast')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{safeFormatDate(schedule.scheduled_date, 'd MMM yyyy') ?? '—'}</p>
                      </div>
                      <span className="rounded-lg bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{t('dashboard.pendingBadge')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Calendar} gradient="from-cyan-500/10 to-blue-400/10" color="text-cyan-400/60" text={t('dashboard.noSchedules')} subtitle={t('dashboard.planNextSession')} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────── Sub-components ─────────────────────────────

function EmptyState({ icon: Icon, gradient, color, text, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  color: string;
  text: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-3', gradient)}>
        <Icon className={cn('w-7 h-7', color)} />
      </div>
      <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">{text}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function QCStatItem({ color, count, label, icon: Icon }: {
  color: string;
  count: number;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-stone-200/40 dark:border-white/5">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <div>
        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{count}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function KPISummaryItem({ icon: Icon, label, value, gradient, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-200/40 dark:border-white/5">
      <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br', gradient)}>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}
