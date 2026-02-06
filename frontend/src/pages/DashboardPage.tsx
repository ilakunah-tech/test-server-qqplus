import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isValid, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
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
} from 'lucide-react';
import { formatWeight } from '@/utils/formatters';
import type { Roast } from '@/types/api';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { settingsStore } from '@/store/settingsStore';

/** Случайная надпись дня (одна на день, зависит от языка) */
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

const CHART_COLORS = [
  '#E85D04', // QQ flame / brand
  '#FFEA00', // QQ yellow
  '#F48C06', // QQ amber
  '#10b981', // emerald
  '#6A1A9C', // QQ purple
  '#ec4899', // pink
];

function useDashboardData() {
  const dateTo = format(new Date(), 'yyyy-MM-dd');
  const dateFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees', 'dashboard'],
    queryFn: () => inventoryApi.getCoffees(500, 0),
  });

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', 'dashboard', dateFrom, dateTo],
    queryFn: () => roastsApi.getRoasts(200, 0, dateFrom, dateTo),
  });

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', 'dashboard'],
    queryFn: () => scheduleApi.getSchedule(undefined, undefined, 20, 0),
  });

  const { data: blendsData } = useQuery({
    queryKey: ['blends', 'dashboard'],
    queryFn: () => getBlends(100, 0),
  });

  return {
    coffees: coffeesData?.data?.items ?? [],
    totalCoffees: coffeesData?.data?.total ?? 0,
    roasts: roastsData?.data?.items ?? [],
    totalRoasts: roastsData?.data?.total ?? 0,
    scheduleItems: scheduleData?.data?.items ?? [],
    blendsTotal: blendsData?.total ?? 0,
  };
}

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
    const name =
      r.label ||
      r.title ||
      r.coffee_hr_id ||
      r.blend_hr_id ||
      'Unknown';
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

const LOW_STOCK_THRESHOLD_KG = 5;

export const DashboardPage = () => {
  const { t } = useTranslation();
  const language = settingsStore((s) => s.language);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { weather, loading: weatherLoading, error: weatherError } = useWeather();
  const dailyQuote = useMemo(() => getDailyQuote(language), [language]);

  useEffect(() => {
    const tid = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(tid);
  }, []);

  const {
    coffees,
    totalCoffees,
    roasts,
    totalRoasts,
    scheduleItems,
    blendsTotal,
  } = useDashboardData();

  const pendingSchedules = scheduleItems.filter((s) => s.status === 'pending');
  const totalRoasted = useMemo(
    () => roasts.reduce((sum, r) => sum + (Number(r.roasted_weight_kg) || 0), 0),
    [roasts]
  );
  const chartData = useMemo(() => {
    try {
      return aggregateRoastsByDay(roasts);
    } catch {
      return [];
    }
  }, [roasts]);
  const topCoffees = useMemo(() => {
    try {
      return topCoffeesByRoasts(roasts);
    } catch {
      return [];
    }
  }, [roasts]);
  const levelData = useMemo(() => {
    try {
      return roastLevelDistribution(roasts);
    } catch {
      return [];
    }
  }, [roasts]);
  const lowStockCoffees = useMemo(
    () =>
      coffees.filter(
        (c) =>
          c.stock_weight_kg != null &&
          c.stock_weight_kg > 0 &&
          c.stock_weight_kg <= LOW_STOCK_THRESHOLD_KG
      ),
    [coffees]
  );

  const stats = [
    {
      title: 'Coffee lots',
      value: totalCoffees,
      icon: Package,
      gradient: 'from-blue-500 to-cyan-400',
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
    },
    {
      title: 'Total roasts',
      value: totalRoasts,
      icon: Flame,
      gradient: 'from-orange-500 to-amber-400',
      iconBg: 'bg-gradient-to-br from-orange-500/20 to-amber-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]',
    },
    {
      title: 'Blends',
      value: blendsTotal,
      icon: Layers,
      gradient: 'from-violet-500 to-purple-400',
      iconBg: 'bg-gradient-to-br from-violet-500/20 to-purple-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    },
    {
      title: 'Roasted (30d)',
      value: formatWeight(totalRoasted),
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-400',
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    },
    {
      title: 'Pending',
      value: pendingSchedules.length,
      icon: Calendar,
      gradient: 'from-amber-500 to-yellow-400',
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-yellow-400/20',
      glow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    },
  ];

  return (
    <div className="space-y-8 pb-8 max-w-7xl mx-auto">
      {/* Hero: время, дата, погода по геолокации, случайная надпись дня */}
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

      {/* KPI cards - Premium design */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 cursor-default',
                'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm',
                'border border-stone-200/60 dark:border-white/5',
                'hover:-translate-y-1',
                stat.glow,
                'animate-fade-in-up'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Gradient accent line */}
              <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r', stat.gradient)} />
              
              {/* Decorative background gradient */}
              <div className={cn(
                'absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                'bg-gradient-to-br',
                stat.gradient
              )} />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110',
                    stat.iconBg
                  )}>
                    <Icon className={cn('w-6 h-6 bg-gradient-to-br bg-clip-text', stat.gradient.replace('from-', 'text-').split(' ')[0])} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white animate-number-count">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '400ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-400/20">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              Roasts & weight (last 30 days)
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

        <Card className="overflow-hidden animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '480ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-400/20">
                <Coffee className="h-5 w-5 text-violet-500" />
              </div>
              Top coffees / blends
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
                <div className="flex flex-col h-full items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-400/10 flex items-center justify-center mb-4">
                    <Coffee className="w-8 h-8 text-orange-400/60" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-center">No roast data for the period</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second charts row: pie + low stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1 animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '560ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-400/20">
                <Flame className="h-5 w-5 text-emerald-500" />
              </div>
              Roast levels
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
                <div className="flex flex-col h-full items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-400/10 flex items-center justify-center mb-4">
                    <Flame className="w-8 h-8 text-emerald-400/60" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">No roast levels</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '640ms' }}>
          <CardHeader className="border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-400/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              Low stock alert
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {lowStockCoffees.length > 0 ? (
              <ul className="space-y-2">
                {lowStockCoffees.slice(0, 8).map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-yellow-50/50 py-3 px-4 dark:border-amber-800/40 dark:from-amber-900/20 dark:to-amber-800/10 transition-all hover:scale-[1.01]" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{c.label ?? c.name ?? c.hr_id}</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg">{formatWeight(c.stock_weight_kg ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-400/10 flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">All stock levels are healthy!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Threshold: {LOW_STOCK_THRESHOLD_KG} kg</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent roasts + Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '720ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-400/20">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              Recent roasts
            </CardTitle>
            <Link to="/roasts" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
              View all
              <span className="text-lg">→</span>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {roasts.length > 0 ? (
              <div className="space-y-2">
                {roasts.slice(0, 6).map((roast, i) => {
                  const dateStr = roast.roasted_at ?? roast.roast_date ?? roast.created_at;
                  const weightKg = Number(roast.roasted_weight_kg) || 0;
                  const loss = (roast as Roast & { weight_loss_percent?: number }).weight_loss_percent ?? (roast.weight_loss != null ? (roast.weight_loss <= 1 ? roast.weight_loss * 100 : roast.weight_loss) : null);
                  return (
                    <Link key={roast.id} to={`/roasts/${roast.id}`} className="group flex justify-between items-center rounded-xl border border-stone-200/60 dark:border-white/5 py-3 px-4 transition-all hover:bg-stone-50 dark:hover:bg-white/5 hover:border-brand/20 hover:scale-[1.01]" style={{ animationDelay: `${i * 40}ms` }}>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand transition-colors">{roast.title ?? roast.label ?? roast.operator ?? '—'}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{dateStr ? (safeFormatDate(dateStr, 'd MMM yyyy') ?? '—') : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatWeight(weightKg)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{loss != null ? `${loss.toFixed(1)}% loss` : '—'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-400/10 flex items-center justify-center mb-4 animate-bounce-subtle">
                  <Flame className="w-8 h-8 text-orange-400/60" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">No roasts yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start your first roast to see data here</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-0 shadow-lg dark:shadow-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm" style={{ animationDelay: '800ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-stone-100 dark:border-white/5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-400/20">
                <Calendar className="h-5 w-5 text-cyan-500" />
              </div>
              Upcoming schedule
            </CardTitle>
            <Link to="/schedule" className="text-sm font-medium text-brand hover:text-brand-hover transition-colors flex items-center gap-1">
              View all
              <span className="text-lg">→</span>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {pendingSchedules.length > 0 ? (
              <div className="space-y-2">
                {pendingSchedules.slice(0, 6).map((schedule, i) => (
                  <div key={schedule.id} className="flex justify-between items-center rounded-xl border border-stone-200/60 dark:border-white/5 py-3 px-4 transition-all hover:bg-stone-50 dark:hover:bg-white/5" style={{ animationDelay: `${i * 40}ms` }}>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{schedule.title || 'Scheduled roast'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{safeFormatDate(schedule.scheduled_date, 'd MMM yyyy') ?? '—'}</p>
                    </div>
                    <span className="rounded-lg bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-400/10 flex items-center justify-center mb-4 animate-bounce-subtle">
                  <Calendar className="w-8 h-8 text-cyan-400/60" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">No upcoming schedules</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Plan your next roasting session</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
