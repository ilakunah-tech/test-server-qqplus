import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export const formatDate = (date: string | Date | null | undefined): string => {
  const d = toDate(date);
  return d ? format(d, 'yyyy-MM-dd') : '—';
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  const d = toDate(date);
  return d ? format(d, 'yyyy-MM-dd HH:mm') : '—';
};

/** Короткий формат для таблицы: "пт, 30 янв. 2026, 15:23" */
export const formatDateTimeTable = (date: string | Date | null | undefined): string => {
  const d = toDate(date);
  return d ? format(d, 'EEE, d MMM yyyy, HH:mm', { locale: ru }) : '—';
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatWeight = (kg: number): string => {
  return `${kg.toFixed(2)} kg`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};
