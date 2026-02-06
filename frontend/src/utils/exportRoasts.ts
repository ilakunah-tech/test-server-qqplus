import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import type { Roast } from '@/types/api';
import { formatDateTimeTable, formatWeight, formatPercent, roastDisplayId } from './formatters';
import { calculateWeightLoss, formatTimeMMSS } from './roastCalculations';

export type ExportFormat = 'csv' | 'xlsx';
export type ExportScope = 'page' | 'all' | 'selected';

export interface ExportColumn {
  id: string;
  label: string;
  getValue: (r: Roast) => string;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { id: 'id', label: 'ID', getValue: (r) => roastDisplayId(r) },
  { id: 'date', label: 'Дата', getValue: (r) => formatDateTimeTable(r.roasted_at ?? r.roast_date) ?? '—' },
  { id: 'name', label: 'Наименование', getValue: (r) => r.title ?? r.label ?? '—' },
  { id: 'warehouse', label: 'Склад', getValue: (r) => r.location_hr_id ?? '—' },
  { id: 'machine', label: 'Машина', getValue: (r) => r.machine ?? '—' },
  { id: 'user', label: 'Оператор', getValue: (r) => r.operator ?? '—' },
  { id: 'green_weight', label: 'Начальный вес', getValue: (r) => formatWeight(Number(r.green_weight_kg) || 0) },
  { id: 'roasted_weight', label: 'Конечный вес', getValue: (r) => r.roasted_weight_kg != null ? formatWeight(r.roasted_weight_kg) : '—' },
  { id: 'shrinkage', label: 'Ужарка', getValue: (r) => {
    let pct: number | null = null;
    if (r.weight_loss != null) pct = r.weight_loss <= 1 ? r.weight_loss * 100 : r.weight_loss;
    else pct = calculateWeightLoss(r.green_weight_kg, r.roasted_weight_kg);
    return pct != null ? formatPercent(pct) : '—';
  }},
  { id: 'dtr', label: 'DTR', getValue: (r) => {
    const devTime = r.DEV_time != null ? formatTimeMMSS(r.DEV_time) : null;
    const devPct = r.DEV_ratio != null ? formatPercent(r.DEV_ratio) : null;
    if (!devTime && !devPct) return '—';
    return devTime && devPct ? `${devTime} (${devPct})` : (devTime ?? devPct ?? '—');
  }},
  { id: 'bean_color', label: 'Цвет зерна', getValue: (r) => r.whole_color != null && r.whole_color !== 0 ? String(r.whole_color) : '—' },
  { id: 'grind_color', label: 'Цвет помола', getValue: (r) => r.ground_color != null && r.ground_color !== 0 ? String(r.ground_color) : '—' },
  { id: 'coffee', label: 'Кофе', getValue: (r) => r.coffee_label ?? r.blend_spec?.label ?? r.coffee_hr_id ?? r.blend_hr_id ?? '—' },
  { id: 'rating', label: 'Оценка', getValue: (r) => r.cupping_score != null && r.cupping_score > 0 ? String(r.cupping_score) : '—' },
  { id: 'quality_control', label: 'Контроль качества', getValue: (r) => r.notes ?? '—' },
];

function getFilename(ext: string): string {
  return `roasts_export_${format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: ru })}.${ext}`;
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportToCSV(
  roasts: Roast[],
  columns: ExportColumn[],
  headerLines: string[] = []
): void {
  const rows: string[][] = [];
  headerLines.forEach((line) => rows.push([line]));
  if (headerLines.length) rows.push([]);
  rows.push(columns.map((c) => c.label));
  roasts.forEach((r) => {
    rows.push(columns.map((c) => c.getValue(r)));
  });
  const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getFilename('csv');
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(
  roasts: Roast[],
  columns: ExportColumn[],
  headerLines: string[] = []
): void {
  const wb = XLSX.utils.book_new();
  const headerData = headerLines.map((line) => [line]);
  const colHeaders = [columns.map((c) => c.label)];
  const data = roasts.map((r) => columns.map((c) => c.getValue(r)));
  const wsData = headerData.length > 0 ? [...headerData, [], ...colHeaders, ...data] : [...colHeaders, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Обжарки');
  XLSX.writeFile(wb, getFilename('xlsx'));
}
