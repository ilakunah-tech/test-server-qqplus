import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isValid, parseISO } from 'date-fns';
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
} from 'lucide-react';
import { formatWeight } from '@/utils/formatters';
import type { Roast } from '@/types/api';
import { cn } from '@/utils/cn';

const CHART_COLORS = [
  '#6A1A9C', // QQ Coffee purple
  '#FFEA00', // QQ yellow
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8B3DB8', // QQ purple light
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
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      title: 'Total roasts',
      value: totalRoasts,
      icon: Flame,
      color: 'text-orange-600',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
    },
    {
      title: 'Blends',
      value: blendsTotal,
      icon: Layers,
      color: 'text-violet-600',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      title: 'Roasted (30d)',
      value: formatWeight(totalRoasted),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      title: 'Pending schedules',
      value: pendingSchedules.length,
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Overview of your coffee operations and statistics
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-8" aria-label="Quick tabs">
          <Link
            to="/inventory"
            className="pb-3 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand"
          >
            Green Bean
          </Link>
          <Link
            to="/blends"
            className="pb-3 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand"
          >
            Blends
          </Link>
        </nav>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={cn(
                'overflow-hidden border-2 transition hover:shadow-md dark:border-gray-700',
                stat.border
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.title}
                </CardTitle>
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    stat.bg,
                    stat.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Roasts & weight (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-gray-500"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-gray-500"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-gray-500"
                    tickFormatter={(v) => `${v} kg`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'weight' ? [formatWeight(value), 'Weight'] : [value, 'Roasts']
                    }
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS[0]}
                    fill="url(#colorCount)"
                    strokeWidth={2}
                    name="roasts"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="weight"
                    stroke={CHART_COLORS[2]}
                    fill="url(#colorWeight)"
                    strokeWidth={2}
                    name="weight"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Roasts by coffee / blend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {topCoffees.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCoffees}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Roasts" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                  No roast data for the period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second charts row: pie + low stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1">
          <CardHeader>
            <CardTitle>Roast level distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {levelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {levelData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, props) =>
                        [`${value} roasts`, props.payload.name]
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                  No roast levels
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low stock alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockCoffees.length > 0 ? (
              <ul className="space-y-2">
                {lowStockCoffees.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 py-2 px-3 dark:border-amber-800 dark:bg-amber-900/20"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {c.label ?? c.name ?? c.hr_id}
                    </span>
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      {formatWeight(c.stock_weight_kg ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No low stock items (threshold: {LOW_STOCK_THRESHOLD_KG} kg)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent roasts + Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent roasts</CardTitle>
            <Link
              to="/roasts"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {roasts.length > 0 ? (
              <div className="space-y-2">
                {roasts.slice(0, 6).map((roast) => {
                  const dateStr = roast.roasted_at ?? roast.roast_date ?? roast.created_at;
                  const weightKg = Number(roast.roasted_weight_kg) || 0;
                  const loss =
                    (roast as Roast & { weight_loss_percent?: number }).weight_loss_percent ??
                    (roast.weight_loss != null ? (roast.weight_loss <= 1 ? roast.weight_loss * 100 : roast.weight_loss) : null);
                  return (
                    <Link
                      key={roast.id}
                      to={`/roasts/${roast.id}`}
                      className="flex justify-between items-center rounded-lg border border-gray-200 py-2 px-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {roast.title ?? roast.label ?? roast.operator ?? '—'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {dateStr
                            ? (safeFormatDate(dateStr, 'd MMM yyyy') ?? '—')
                            : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatWeight(weightKg)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {loss != null ? `${loss.toFixed(1)}% loss` : '—'}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No roasts yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Upcoming schedule</CardTitle>
            <Link
              to="/schedule"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {pendingSchedules.length > 0 ? (
              <div className="space-y-2">
                {pendingSchedules.slice(0, 6).map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex justify-between items-center rounded-lg border border-gray-200 py-2 px-3 dark:border-gray-700"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {schedule.title || 'Scheduled roast'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {safeFormatDate(schedule.scheduled_date, 'd MMM yyyy') ?? '—'}
                      </p>
                    </div>
                    <span className="rounded-button bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No upcoming schedules</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
