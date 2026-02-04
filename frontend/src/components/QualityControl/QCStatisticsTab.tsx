import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { roastsApi } from '@/api/roasts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Filter,
  Loader2,
  TrendingUp,
  Coffee,
  Users,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { Roast } from '@/types/api';
import { cn } from '@/utils/cn';

const VERDICT_COLORS = {
  green: '#10b981',
  yellow: '#FFEA00',
  red: '#ef4444',
} as const;

function getRoastDate(r: Roast): string | null {
  const raw = r.roasted_at ?? r.roast_date ?? r.created_at;
  if (!raw) return null;
  const d = typeof raw === 'string' ? parseISO(raw) : raw;
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
}

function getLabel(r: Roast): string {
  return r.label || r.title || r.coffee_hr_id || r.blend_hr_id || '—';
}

function applyFilters(
  roasts: Roast[],
  filters: {
    dateFrom: string;
    dateTo: string;
    cuppingVerdict: string;
    espressoVerdict: string;
    label: string;
    operator: string;
    machine: string;
  }
): Roast[] {
  return roasts.filter((r) => {
    const dateStr = getRoastDate(r);
    if (filters.dateFrom && dateStr && dateStr < filters.dateFrom) return false;
    if (filters.dateTo && dateStr && dateStr > filters.dateTo) return false;

    const cv = (r.cupping_verdict ?? '').toLowerCase();
    if (filters.cuppingVerdict && cv !== filters.cuppingVerdict) return false;

    const ev = (r.espresso_verdict ?? '').toLowerCase();
    if (filters.espressoVerdict && ev !== filters.espressoVerdict) return false;

    const lbl = getLabel(r);
    if (filters.label && lbl !== filters.label) return false;

    const op = (r.operator ?? '').trim();
    if (filters.operator && op !== filters.operator) return false;

    const m = (r.machine ?? '').trim();
    if (filters.machine && m !== filters.machine) return false;

    return true;
  });
}

function computeCuppingVerdictStats(roasts: Roast[]) {
  const counts = { green: 0, yellow: 0, red: 0, none: 0 };
  roasts.forEach((r) => {
    const v = (r.cupping_verdict ?? '').toLowerCase();
    if (v === 'green') counts.green++;
    else if (v === 'yellow') counts.yellow++;
    else if (v === 'red') counts.red++;
    else counts.none++;
  });
  return counts;
}

function computeEspressoVerdictStats(roasts: Roast[]) {
  const counts = { green: 0, yellow: 0, red: 0, none: 0 };
  roasts.forEach((r) => {
    const v = (r.espresso_verdict ?? '').toLowerCase();
    if (v === 'green') counts.green++;
    else if (v === 'yellow') counts.yellow++;
    else if (v === 'red') counts.red++;
    else counts.none++;
  });
  return counts;
}

function byLabel(roasts: Roast[], limit = 10) {
  const m: Record<string, number> = {};
  roasts.forEach((r) => {
    const lbl = getLabel(r);
    m[lbl] = (m[lbl] ?? 0) + 1;
  });
  return Object.entries(m)
    .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function byOperator(roasts: Roast[], limit = 8) {
  const m: Record<string, number> = {};
  roasts.forEach((r) => {
    const op = (r.operator ?? '').trim() || '—';
    m[op] = (m[op] ?? 0) + 1;
  });
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function byMachine(roasts: Roast[], limit = 8) {
  const m: Record<string, number> = {};
  roasts.forEach((r) => {
    const machine = (r.machine ?? '').trim() || '—';
    m[machine] = (m[machine] ?? 0) + 1;
  });
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
        'opacity-0'
      )}
      style={{
        animation: `fade-in-up 0.5s ease-out ${delay}ms forwards`,
        borderColor: 'transparent',
        background: `linear-gradient(135deg, ${color}12 0%, ${color}08 100%)`,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-stone-600 dark:text-gray-400">{title}</CardTitle>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl opacity-90"
          style={{ backgroundColor: `${color}30` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </span>
      </CardHeader>
      <CardContent>
        <div
          className="text-2xl font-bold"
          style={{ color }}
        >
          {value}
        </div>
        {sub != null && (
          <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

export const QCStatisticsTab = () => {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    cuppingVerdict: '',
    espressoVerdict: '',
    label: '',
    operator: '',
    machine: '',
  });
  const [showFilters, setShowFilters] = useState(true);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['roasts', 'qc-statistics', 2000, 0, true],
    queryFn: () => roastsApi.getRoasts(2000, 0, undefined, undefined, undefined, true),
  });

  const allRoasts = data?.data?.items ?? [];
  const filtered = useMemo(
    () => applyFilters(allRoasts, filters),
    [allRoasts, filters]
  );

  const uniqueLabels = useMemo(() => {
    const s = new Set<string>();
    allRoasts.forEach((r) => s.add(getLabel(r)));
    return Array.from(s).filter(Boolean).sort();
  }, [allRoasts]);

  const uniqueOperators = useMemo(() => {
    const s = new Set<string>();
    allRoasts.forEach((r) => {
      const op = (r.operator ?? '').trim();
      if (op) s.add(op);
    });
    return Array.from(s).sort();
  }, [allRoasts]);

  const uniqueMachines = useMemo(() => {
    const s = new Set<string>();
    allRoasts.forEach((r) => {
      const m = (r.machine ?? '').trim();
      if (m) s.add(m);
    });
    return Array.from(s).sort();
  }, [allRoasts]);

  const cuppingStats = useMemo(() => computeCuppingVerdictStats(filtered), [filtered]);
  const espressoStats = useMemo(() => computeEspressoVerdictStats(filtered), [filtered]);

  const cuppingPieData = useMemo(
    () => [
      { name: 'Зелёный', value: cuppingStats.green, color: VERDICT_COLORS.green },
      { name: 'Жёлтый', value: cuppingStats.yellow, color: VERDICT_COLORS.yellow },
      { name: 'Красный', value: cuppingStats.red, color: VERDICT_COLORS.red },
      { name: 'Без вердикта', value: cuppingStats.none, color: '#94a3b8' },
    ].filter((d) => d.value > 0),
    [cuppingStats]
  );

  const espressoPieData = useMemo(
    () => [
      { name: 'Зелёный', value: espressoStats.green, color: VERDICT_COLORS.green },
      { name: 'Жёлтый', value: espressoStats.yellow, color: VERDICT_COLORS.yellow },
      { name: 'Красный', value: espressoStats.red, color: VERDICT_COLORS.red },
      { name: 'Без вердикта', value: espressoStats.none, color: '#94a3b8' },
    ].filter((d) => d.value > 0),
    [espressoStats]
  );

  const labelData = useMemo(() => byLabel(filtered), [filtered]);
  const operatorData = useMemo(() => byOperator(filtered), [filtered]);
  const machineData = useMemo(() => byMachine(filtered), [filtered]);

  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      cuppingVerdict: '',
      espressoVerdict: '',
      label: '',
      operator: '',
      machine: '',
    });
  };

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.cuppingVerdict ||
    filters.espressoVerdict ||
    filters.label ||
    filters.operator ||
    filters.machine;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 animate-spin text-qq-purple mb-4" />
        <p className="text-stone-600 dark:text-gray-400">Загрузка статистики…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-card border-2 border-red-200 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Ошибка загрузки'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <Card className="overflow-hidden border border-purple-200/80 bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <Filter className="w-5 h-5" />
              Фильтры
              {hasActiveFilters && (
                <span className="text-xs font-normal text-qq-purple/80">
                  ({filtered.length} из {allRoasts.length})
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-1.5 border-purple-200/80 text-qq-purple hover:bg-purple-50 dark:hover:bg-purple-900/30"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Сбросить
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters((s) => !s)}
                className="text-qq-purple"
              >
                {showFilters ? 'Скрыть' : 'Показать'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="pt-0 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Дата от</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80 focus:ring-qq-purple"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Дата до</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80 focus:ring-qq-purple"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Каппинг</label>
                <Select
                  value={filters.cuppingVerdict}
                  onChange={(e) => setFilters((f) => ({ ...f, cuppingVerdict: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80"
                >
                  <option value="">Все</option>
                  <option value="green">Зелёный</option>
                  <option value="yellow">Жёлтый</option>
                  <option value="red">Красный</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Эспрессо</label>
                <Select
                  value={filters.espressoVerdict}
                  onChange={(e) => setFilters((f) => ({ ...f, espressoVerdict: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80"
                >
                  <option value="">Все</option>
                  <option value="green">Зелёный</option>
                  <option value="yellow">Жёлтый</option>
                  <option value="red">Красный</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Сорт / бленд</label>
                <Select
                  value={filters.label}
                  onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80"
                >
                  <option value="">Все</option>
                  {uniqueLabels.map((l) => (
                    <option key={l} value={l}>
                      {l.length > 30 ? l.slice(0, 30) + '…' : l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Оператор</label>
                <Select
                  value={filters.operator}
                  onChange={(e) => setFilters((f) => ({ ...f, operator: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80"
                >
                  <option value="">Все</option>
                  {uniqueOperators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400 mb-1 block">Машина</label>
                <Select
                  value={filters.machine}
                  onChange={(e) => setFilters((f) => ({ ...f, machine: e.target.value }))}
                  className="h-9 text-sm border-purple-200/80"
                >
                  <option value="">Все</option>
                  {uniqueMachines.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
        <StatCard
          title="Всего обжарок"
          value={filtered.length}
          sub={hasActiveFilters ? `из ${allRoasts.length}` : undefined}
          icon={BarChart3}
          color="#6A1A9C"
          delay={0}
        />
        <StatCard
          title="Зелёный каппинг"
          value={cuppingStats.green}
          sub={filtered.length ? `${((cuppingStats.green / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={CheckCircle2}
          color="#10b981"
          delay={50}
        />
        <StatCard
          title="Жёлтый каппинг"
          value={cuppingStats.yellow}
          sub={filtered.length ? `${((cuppingStats.yellow / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={AlertTriangle}
          color="#eab308"
          delay={100}
        />
        <StatCard
          title="Красный каппинг"
          value={cuppingStats.red}
          sub={filtered.length ? `${((cuppingStats.red / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={XCircle}
          color="#ef4444"
          delay={150}
        />
        <StatCard
          title="Зелёный эспрессо"
          value={espressoStats.green}
          sub={filtered.length ? `${((espressoStats.green / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={Coffee}
          color="#059669"
          delay={200}
        />
        <StatCard
          title="Жёлтый эспрессо"
          value={espressoStats.yellow}
          sub={filtered.length ? `${((espressoStats.yellow / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={AlertTriangle}
          color="#eab308"
          delay={250}
        />
        <StatCard
          title="Красный эспрессо"
          value={espressoStats.red}
          sub={filtered.length ? `${((espressoStats.red / filtered.length) * 100).toFixed(0)}%` : undefined}
          icon={XCircle}
          color="#dc2626"
          delay={300}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cupping verdict pie */}
        <Card
          className="overflow-hidden border border-purple-200/80 shadow-md animate-fade-in-up opacity-0"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <TrendingUp className="w-5 h-5" />
              Вердикты каппинга
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {cuppingPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cuppingPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      animationBegin={200}
                      animationDuration={800}
                    >
                      {cuppingPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [v, '']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Нет данных
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Espresso verdict pie */}
        <Card
          className="overflow-hidden border border-purple-200/80 shadow-md animate-fade-in-up opacity-0"
          style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <Coffee className="w-5 h-5" />
              Вердикты эспрессо
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {espressoPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={espressoPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      animationBegin={250}
                      animationDuration={800}
                    >
                      {espressoPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [v, '']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Нет данных
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="overflow-hidden border border-purple-200/80 shadow-md animate-fade-in-up opacity-0"
          style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <Coffee className="w-5 h-5" />
              По сортам и блендам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {labelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={labelData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#6A1A9C"
                      radius={[0, 6, 6, 0]}
                      animationBegin={300}
                      animationDuration={600}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Нет данных
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="overflow-hidden border border-purple-200/80 shadow-md animate-fade-in-up opacity-0"
          style={{ animationDelay: '250ms', animationFillMode: 'forwards' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <Users className="w-5 h-5" />
              По операторам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {operatorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={operatorData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#8B3DB8"
                      radius={[0, 6, 6, 0]}
                      animationBegin={350}
                      animationDuration={600}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Нет данных
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="overflow-hidden border border-purple-200/80 shadow-md animate-fade-in-up opacity-0"
          style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-qq-purple-dark dark:text-gray-100">
              <Cpu className="w-5 h-5" />
              По машинам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {machineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={machineData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#4A1068"
                      radius={[0, 6, 6, 0]}
                      animationBegin={400}
                      animationDuration={600}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Нет данных
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
