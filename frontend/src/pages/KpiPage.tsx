import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { BarChart3, Pencil, Save, X, RefreshCw, Database, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { roastsApi } from '@/api/roasts';
import type { Roast } from '@/types/api';

// Типы данных для KPI
interface KpiWeekData {
  id: string;
  weekLabel: string;
  value: string;
  autoValue?: string; // Автоматически рассчитанное значение из API
}

interface KpiRow {
  id: string;
  metric: string;
  description: string;
  weeklyData: KpiWeekData[];
  isAutoFilled?: boolean; // Эта строка заполняется автоматически
  autoFieldType?: string;
  totalType?: 'sum' | 'sum_pair' | 'percent_manual' | 'percent_auto'; // Тип расчета итога
  highlightRow?: boolean; // Строка участвует в сводке процентов
}

// Типы для недель
interface Week {
  id: string;
  label: string;
  dateFrom: string;
  dateTo: string;
}

// Рабочая неделя: понедельник = 0, воскресенье = 6
function getDaysFromMonday(d: Date): number {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  return (day + 6) % 7;   // Mon=0 .. Sun=6
}

// Генерация рабочих недель (Пн–Пт) для месяца
function getWeeksForMonth(year: number, month: number): Week[] {
  const weeks: Week[] = [];
  const lastDate = new Date(year, month + 1, 0).getDate();
  const monthStr = (month + 1).toString().padStart(2, '0');
  
  let day = 1;
  let weekNum = 1;
  
  while (day <= lastDate) {
    const cur = new Date(year, month, day);
    const fromMonday = getDaysFromMonday(cur);
    // Пятница этой недели: + (4 - fromMonday) дней от day
    const toFriday = 4 - fromMonday;
    const endDay = Math.min(day + toFriday, lastDate);
    
    const startStr = day.toString().padStart(2, '0');
    const endStr = endDay.toString().padStart(2, '0');
    
    weeks.push({
      id: `w${weekNum}`,
      label: `${startStr}-${endStr}.${monthStr}`,
      dateFrom: `${year}-${monthStr}-${startStr}`,
      dateTo: `${year}-${monthStr}-${endStr}`,
    });
    
    // Следующая неделя: понедельник = текущая пятница + 3 дня
    day = endDay + 3;
    weekNum++;
  }
  
  return weeks;
}

// Названия месяцев
const monthNames: Record<string, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// Начальные данные - скелет таблицы
const getInitialKpiData = (): Omit<KpiRow, 'weeklyData'>[] => [
  {
    id: '1',
    metric: 'Количество обжаренного кофе (кг)',
    description: 'Зеленое/Жаренное',
    isAutoFilled: true,
    autoFieldType: 'roasted_coffee',
    totalType: 'sum_pair',
  },
  {
    id: '2',
    metric: 'Количество обжаренных батчей',
    description: 'Общее количество (шт.)',
    isAutoFilled: true,
    autoFieldType: 'batches',
    totalType: 'sum',
  },
  {
    id: '3',
    metric: 'Количество введенных сортов',
    description: 'Количество введенных лотов за неделю',
  },
  {
    id: '4',
    metric: 'Качество введеных сортов',
    description: 'Название лота',
  },
  {
    id: '5',
    metric: 'Количество батчей до зеленого статуса',
    description: '100%-1 батч, 90%-2, 80%-3, 70%->4',
    totalType: 'percent_manual',
    highlightRow: true,
  },
  {
    id: '6',
    metric: 'Срок ввода лота',
    description: 'От даты прихода на склад',
  },
  {
    id: '7',
    metric: 'Отклонения от графика обжарки',
    description: 'Красные статусы по целям',
    isAutoFilled: true,
    autoFieldType: 'deviations',
    totalType: 'sum',
  },
  {
    id: '8',
    metric: 'Референсы и подложки',
    description: 'Все лоты имеют референсы и подложки (Да/Нет)',
    totalType: 'percent_manual',
    highlightRow: true,
  },
  {
    id: '9',
    metric: 'Статусы контроля качества',
    description: 'Общее количество образцов',
    isAutoFilled: true,
    autoFieldType: 'qc_total',
  },
  {
    id: '9a',
    metric: '↳ Красный',
    description: 'Красные статусы каппинга',
    isAutoFilled: true,
    autoFieldType: 'qc_red',
  },
  {
    id: '9b',
    metric: '↳ Желтый',
    description: 'Желтые статусы каппинга',
    isAutoFilled: true,
    autoFieldType: 'qc_yellow',
  },
  {
    id: '9c',
    metric: '↳ Зеленый',
    description: 'Зеленые статусы каппинга',
    isAutoFilled: true,
    autoFieldType: 'qc_green',
  },
  {
    id: '9d',
    metric: '↳ Соотношение качества',
    description: '(Всего - Красные) / Всего',
    isAutoFilled: true,
    autoFieldType: 'qc_ratio',
    totalType: 'percent_auto',
    highlightRow: true,
  },
  {
    id: '10',
    metric: 'Рекламации клиентов',
    description: 'Количество подтвержденных рекламаций',
    totalType: 'percent_manual',
    highlightRow: true,
  },
  {
    id: '10a',
    metric: '↳ Причина рекламаций',
    description: '',
  },
  {
    id: '11',
    metric: 'Переоценка физ. характеристик',
    description: 'Значения в таблицу КК',
    totalType: 'percent_manual',
    highlightRow: true,
  },
  {
    id: '12',
    metric: 'Обслуживание оборудования',
    description: 'Кофемолка, ростер и т.д.',
    totalType: 'percent_manual',
    highlightRow: true,
  },
  {
    id: '13',
    metric: 'Спец батчи',
    description: 'Кол-во/Ведер/Невмешанных',
  },
];

// Расчет KPI данных из обжарок
function calculateKpiFromRoasts(roasts: Roast[], fieldType: string): string {
  switch (fieldType) {
    case 'roasted_coffee': {
      // Списанное зеленое кофе / полученное жареное кофе
      const greenTotal = roasts.reduce((sum, r) => sum + (r.green_weight_kg || 0), 0);
      const roastedTotal = roasts.reduce((sum, r) => sum + (r.roasted_weight_kg || 0), 0);
      return `${greenTotal.toFixed(1)}/${roastedTotal.toFixed(1)}`;
    }
    case 'batches':
      // Общее количество обжарок за период
      return roasts.length.toString();
    case 'deviations': {
      // Количество красных статусов обжарок по целям (goals_status)
      const redCount = roasts.filter(r => r.goals_status === 'red').length;
      return redCount.toString();
    }
    case 'qc_total': {
      // Общее количество образцов на каппингах за период
      const count = roasts.filter(r => r.cupping_verdict).length;
      return count.toString();
    }
    case 'qc_red': {
      // Красные статусы контроля качества (cupping_verdict = 'red')
      const count = roasts.filter(r => r.cupping_verdict === 'red').length;
      return count.toString();
    }
    case 'qc_yellow': {
      // Желтые статусы контроля качества (cupping_verdict = 'yellow')
      const count = roasts.filter(r => r.cupping_verdict === 'yellow').length;
      return count.toString();
    }
    case 'qc_green': {
      // Зеленые статусы контроля качества (cupping_verdict = 'green')
      const count = roasts.filter(r => r.cupping_verdict === 'green').length;
      return count.toString();
    }
    case 'qc_ratio': {
      // Соотношение: (Всего - Красные) / Всего * 100%
      const total = roasts.filter(r => r.cupping_verdict).length;
      const red = roasts.filter(r => r.cupping_verdict === 'red').length;
      if (total === 0) return '0%';
      const ratio = ((total - red) / total) * 100;
      return `${ratio.toFixed(1)}%`;
    }
    default:
      return '';
  }
}

// Расчет итога для строки
function calculateTotal(row: KpiRow, kpiData: KpiRow[]): string {
  if (!row.totalType) return '';
  
  const values = row.weeklyData.map(wd => wd.value || wd.autoValue || '');
  
  switch (row.totalType) {
    case 'sum': {
      // Простая сумма чисел
      const sum = values.reduce((acc, val) => {
        const num = parseFloat(val);
        return acc + (isNaN(num) ? 0 : num);
      }, 0);
      return sum.toString();
    }
    case 'sum_pair': {
      // Сумма пар "зеленое/жареное"
      let greenSum = 0;
      let roastedSum = 0;
      values.forEach(val => {
        const parts = val.split('/');
        if (parts.length === 2) {
          const green = parseFloat(parts[0]);
          const roasted = parseFloat(parts[1]);
          if (!isNaN(green)) greenSum += green;
          if (!isNaN(roasted)) roastedSum += roasted;
        }
      });
      return `${greenSum.toFixed(1)}/${roastedSum.toFixed(1)}`;
    }
    case 'percent_manual': {
      // Процент (редактируемый вручную, просто показываем если есть)
      return '';
    }
    case 'percent_auto': {
      // Автоматический расчет процента на основе данных за весь период
      // Для qc_ratio берем данные из родительских строк
      const qcTotalRow = kpiData.find(r => r.autoFieldType === 'qc_total');
      const qcRedRow = kpiData.find(r => r.autoFieldType === 'qc_red');
      
      if (qcTotalRow && qcRedRow) {
        let totalSum = 0;
        let redSum = 0;
        
        qcTotalRow.weeklyData.forEach(wd => {
          const num = parseFloat(wd.value || wd.autoValue || '0');
          if (!isNaN(num)) totalSum += num;
        });
        
        qcRedRow.weeklyData.forEach(wd => {
          const num = parseFloat(wd.value || wd.autoValue || '0');
          if (!isNaN(num)) redSum += num;
        });
        
        if (totalSum === 0) return '0%';
        const ratio = ((totalSum - redSum) / totalSum) * 100;
        return `${ratio.toFixed(1)}%`;
      }
      return '';
    }
    default:
      return '';
  }
}

export const KpiPage = () => {
  const { t, language } = useTranslation();
  
  // Текущая дата для выбора месяца по умолчанию
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  
  // Недели для выбранного месяца (рабочие недели Пн–Пт)
  const weeks = useMemo(() => getWeeksForMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  
  // Скрытые недели (можно удалить из отображения)
  const [removedWeekIds, setRemovedWeekIds] = useState<Set<string>>(() => new Set());
  const visibleWeeks = useMemo(() => weeks.filter(w => !removedWeekIds.has(w.id)), [weeks, removedWeekIds]);
  
  // При смене месяца/года сбрасываем скрытые недели
  useEffect(() => {
    setRemovedWeekIds(new Set());
  }, [selectedYear, selectedMonth]);
  
  // KPI данные
  const [kpiData, setKpiData] = useState<KpiRow[]>(() => {
    const initial = getInitialKpiData();
    return initial.map(row => ({
      ...row,
      weeklyData: weeks.map(week => ({
        id: `${row.id}-${week.id}`,
        weekLabel: week.label,
        value: '',
        autoValue: '',
      })),
    }));
  });
  
  // Даты начала и конца месяца для загрузки данных
  const monthDateRange = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    return {
      dateFrom: `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`,
      dateTo: `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`,
    };
  }, [selectedYear, selectedMonth]);
  
  // Загрузка всех обжарок за месяц одним запросом
  const roastsQuery = useQuery({
    queryKey: ['roasts', 'kpi', monthDateRange.dateFrom, monthDateRange.dateTo],
    queryFn: () => roastsApi.getRoasts(1000, 0, monthDateRange.dateFrom, monthDateRange.dateTo),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
  
  // Фильтрация обжарок по неделям
  const getRoastsForWeek = useCallback((week: Week): Roast[] => {
    if (!roastsQuery.data?.data?.items) return [];
    return roastsQuery.data.data.items.filter(roast => {
      const roastDate = roast.roasted_at || roast.roast_date || roast.created_at;
      if (!roastDate) return false;
      const date = roastDate.split('T')[0];
      return date >= week.dateFrom && date <= week.dateTo;
    });
  }, [roastsQuery.data]);
  
  // Обновление недель и автозначений при смене месяца или загрузке данных
  useEffect(() => {
    setKpiData(prev => {
      const initial = getInitialKpiData();
      return initial.map((rowTemplate) => {
        // Сохраняем отредактированные значения метрики и описания
        const existingRow = prev.find(p => p.id === rowTemplate.id);
        
        return {
          ...rowTemplate,
          metric: existingRow?.metric || rowTemplate.metric,
          description: existingRow?.description || rowTemplate.description,
          weeklyData: weeks.map(week => {
            const weekRoasts = getRoastsForWeek(week);
            const autoValue = rowTemplate.isAutoFilled && rowTemplate.autoFieldType
              ? calculateKpiFromRoasts(weekRoasts, rowTemplate.autoFieldType)
              : '';
            
            // Сохраняем ручное значение если оно было
            const existingWeekData = existingRow?.weeklyData.find(wd => wd.weekLabel === week.label);
            
            return {
              id: `${rowTemplate.id}-${week.id}`,
              weekLabel: week.label,
              value: existingWeekData?.value || '',
              autoValue,
            };
          }),
        };
      });
    });
  }, [weeks, getRoastsForWeek]);
  
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [manualTotals, setManualTotals] = useState<Record<string, string>>({});
  
  // Начать редактирование ячейки
  const startEdit = (cellId: string, currentValue: string) => {
    setEditingCell(cellId);
    setEditValue(currentValue);
  };
  
  // Сохранить значение ячейки
  const saveWeeklyEdit = (rowId: string, weekId: string) => {
    setKpiData(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        weeklyData: row.weeklyData.map(wd => {
          if (wd.id !== `${rowId}-${weekId}`) return wd;
          return { ...wd, value: editValue };
        }),
      };
    }));
    setEditingCell(null);
    setEditValue('');
  };
  
  // Сохранить метрику
  const saveMetric = (rowId: string) => {
    setKpiData(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, metric: editValue };
    }));
    setEditingCell(null);
    setEditValue('');
  };
  
  // Сохранить описание
  const saveDescription = (rowId: string) => {
    setKpiData(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, description: editValue };
    }));
    setEditingCell(null);
    setEditValue('');
  };
  
  // Сохранить итог (для ручного ввода процентов)
  const saveTotal = (rowId: string) => {
    setManualTotals(prev => ({ ...prev, [rowId]: editValue }));
    setEditingCell(null);
    setEditValue('');
  };
  
  // Отменить редактирование
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };
  
  // Удалить неделю из отображения (скрыть колонку)
  const removeWeek = (weekId: string) => {
    setRemovedWeekIds(prev => new Set(prev).add(weekId));
  };
  
  // Список годов для выбора
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  
  // Проверка загрузки данных
  const isLoading = roastsQuery.isLoading;
  
  // Обновить данные
  const refetchAll = () => {
    roastsQuery.refetch();
  };
  
  // Получить отображаемое значение ячейки
  const getDisplayValue = (row: KpiRow, wd: KpiWeekData): string => {
    // Если есть ручное значение - показываем его
    if (wd.value) return wd.value;
    // Иначе показываем автоматическое
    if (row.isAutoFilled && wd.autoValue) return wd.autoValue;
    return '';
  };
  
  // Получить итог для строки (ручной перезаписывает расчётный)
  const getTotalValue = (row: KpiRow): string => {
    if (manualTotals[row.id] !== undefined && manualTotals[row.id] !== '') {
      return manualTotals[row.id];
    }
    if (row.totalType === 'sum' || row.totalType === 'sum_pair' || row.totalType === 'percent_auto') {
      return calculateTotal(row, kpiData);
    }
    return '';
  };

  // ID строк, участвующих в сводке процентов
  const HIGHLIGHT_ROW_IDS = ['5', '8', '9d', '10', '11', '12'];
  // Сводка: среднее (или сумма) процентов по выделенным строкам
  const summaryPercentValue = useMemo(() => {
    const values: number[] = [];
    HIGHLIGHT_ROW_IDS.forEach(rowId => {
      const row = kpiData.find(r => r.id === rowId);
      if (!row) return;
      const totalStr = getTotalValue(row);
      const match = totalStr.replace(',', '.').match(/^([\d.]+)\s*%?$/);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num >= 0 && num <= 100) values.push(num);
      }
    });
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    return { avg: Math.round(avg * 10) / 10, count: values.length };
  }, [kpiData, manualTotals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-brand" />
            {t('kpi.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('kpi.subtitle')}
          </p>
        </div>
        
        {/* Выбор месяца и года */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedMonth.toString()}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-40"
          >
            {monthNames[language]?.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            )) || monthNames.ru.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </Select>
          <Select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-28"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* KPI Table */}
      <Card className="border-purple-200/60 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('kpi.roastingKpi')}</CardTitle>
          {removedWeekIds.size > 0 ? (
            <Button onClick={() => setRemovedWeekIds(new Set())} size="sm" variant="outline" className="flex items-center gap-1">
              {t('kpi.restoreWeeks')} ({removedWeekIds.size})
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[220px] border border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">
                    {t('kpi.metric')}
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[200px] border border-gray-300 dark:border-gray-600">
                    {t('kpi.description')}
                  </th>
                  {visibleWeeks.map(week => (
                    <th
                      key={week.id}
                      className="text-center py-3 px-3 font-bold text-base text-gray-700 dark:text-gray-300 min-w-[130px] border border-gray-300 dark:border-gray-600 bg-slate-100 dark:bg-slate-700/50 group"
                    >
                      <span>{t('kpi.fact')} ({week.label})</span>
                      {visibleWeeks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeWeek(week.id); }}
                          className="ml-1.5 inline-flex items-center justify-center w-6 h-6 rounded opacity-60 hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400"
                          title={t('kpi.removeWeek')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </th>
                  ))}
                  <th className="text-center py-3 px-3 font-bold text-base text-gray-700 dark:text-gray-300 min-w-[120px] border border-gray-300 dark:border-gray-600 bg-amber-100 dark:bg-amber-900/30">
                    {t('kpi.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpiData.map((row) => {
                  const isSubRow = row.metric.startsWith('↳');
                  const totalValue = getTotalValue(row);
                  const isHighlight = row.highlightRow;
                  
                  return (
                    <tr
                      key={row.id}
                      className={`
                        ${isHighlight ? 'bg-sky-50/80 dark:bg-sky-900/20' : isSubRow ? 'bg-gray-50/80 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}
                        hover:bg-purple-50/50 dark:hover:bg-gray-800/70
                      `}
                    >
                      {/* Метрика (редактируемая) */}
                      <td className={`py-2 px-3 border border-gray-300 dark:border-gray-600 sticky left-0 z-10 ${isHighlight ? 'bg-sky-50/80 dark:bg-sky-900/20 pl-6' : isSubRow ? 'bg-gray-50/80 dark:bg-gray-800/50 pl-6' : 'bg-white dark:bg-gray-900'} font-medium text-gray-900 dark:text-gray-100`}>
                        {editingCell === `metric-${row.id}` ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveMetric(row.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => saveMetric(row.id)}>
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 min-h-[28px] flex items-center gap-2"
                            onClick={() => startEdit(`metric-${row.id}`, row.metric)}
                          >
                            {row.isAutoFilled && (
                              <Database className="w-3 h-3 text-blue-500 shrink-0" title={t('kpi.autoFilled')} />
                            )}
                            {row.metric || <span className="text-gray-400">—</span>}
                          </div>
                        )}
                      </td>
                      
                      {/* Описание (редактируемое) */}
                      <td className={`py-2 px-3 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 ${isHighlight ? 'bg-sky-50/80 dark:bg-sky-900/20' : ''}`}>
                        {editingCell === `desc-${row.id}` ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveDescription(row.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => saveDescription(row.id)}>
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 min-h-[28px] flex items-center"
                            onClick={() => startEdit(`desc-${row.id}`, row.description)}
                          >
                            {row.description || <span className="text-gray-400">—</span>}
                          </div>
                        )}
                      </td>
                      
                      {/* Недельные данные */}
                      {visibleWeeks.map((week, weekIndex) => {
                        const wd = row.weeklyData.find(d => d.id === `${row.id}-${week.id}`);
                        if (!wd) return <td key={`${row.id}-${week.id}`} className="py-2 px-3 border border-gray-300 dark:border-gray-600 bg-slate-50 dark:bg-slate-800/40" />;
                        const displayValue = getDisplayValue(row, wd);
                        const isAutoValue = row.isAutoFilled && !wd.value && wd.autoValue;
                        
                        return (
                          <td key={wd.id} className={`py-2 px-3 border border-gray-300 dark:border-gray-600 text-center bg-slate-50 dark:bg-slate-800/40 ${isHighlight ? '!bg-sky-50/90 dark:!bg-sky-900/25' : ''}`}>
                            {editingCell === wd.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-8 text-center text-base font-bold"
                                  autoFocus
                                  placeholder={wd.autoValue || ''}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveWeeklyEdit(row.id, week.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => saveWeeklyEdit(row.id, week.id)}>
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={cancelEdit}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 min-h-[32px] flex items-center justify-center text-base font-bold ${isAutoValue ? 'text-blue-600 dark:text-blue-400' : ''}`}
                                onClick={() => startEdit(wd.id, wd.value || wd.autoValue || '')}
                                title={isAutoValue ? t('kpi.autoFilledClickToOverride') : undefined}
                              >
                                {displayValue || <span className="text-gray-400 font-normal">—</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* Итого (всегда можно редактировать) */}
                      <td className={`py-2 px-3 border border-gray-300 dark:border-gray-600 text-center bg-amber-50/50 dark:bg-amber-900/20 ${isHighlight ? 'bg-sky-100/80 dark:bg-sky-900/30' : ''}`}>
                        {editingCell === `total-${row.id}` ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 text-center text-base font-bold"
                              autoFocus
                              placeholder={row.totalType === 'percent_manual' ? '0-100%' : ''}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTotal(row.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => saveTotal(row.id)}>
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800/30 rounded px-2 py-1 min-h-[32px] flex items-center justify-center text-base font-bold"
                            onClick={() => startEdit(`total-${row.id}`, manualTotals[row.id] ?? totalValue ?? '')}
                          >
                            {totalValue || <span className="text-gray-400 font-normal">—</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Сводка процентов по выделенным строкам */}
          <div className="mt-6 p-4 rounded-xl border-2 border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/30">
            <h3 className="text-sm font-semibold text-sky-800 dark:text-sky-200 mb-2">
              {t('kpi.summaryTitle')}
            </h3>
            <p className="text-2xl font-bold text-sky-700 dark:text-sky-100">
              {summaryPercentValue != null
                ? `${summaryPercentValue.avg}%`
                : '—'}
            </p>
            <p className="mt-1 text-xs text-sky-600 dark:text-sky-300">
              {summaryPercentValue != null && summaryPercentValue.count < 6
                ? t('kpi.summaryHint').replace('{n}', String(summaryPercentValue.count)).replace('{total}', '6')
                : t('kpi.summaryDesc')}
            </p>
          </div>
          
          {/* Легенда */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300">
              <Database className="w-4 h-4" />
              <span>{t('kpi.autoFilledLegend')}</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
              <Pencil className="w-4 h-4" />
              <span>{t('kpi.clickToEdit')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
