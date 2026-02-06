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

/** Короткий формат для наклеек: "дд.мм" */
export const formatDateDDMM = (date: string | Date | null | undefined): string => {
  const d = toDate(date);
  return d ? format(d, 'dd.MM') : '—';
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

/**
 * Decode Unicode escape sequences (e.g. \u042d\u0444 → Эф) in strings from .alog profiles.
 * Artisan may store Cyrillic as literal \uXXXX sequences that JSON.parse does not decode.
 */
export function decodeUnicodeEscapes(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return value ?? '';
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/** Roast display ID: #roast_seq (server) and optionally Rbatch_number (Artisan) */
export function roastDisplayId(roast: { roast_seq?: number; batch_number?: number }): string {
  const seq = roast.roast_seq;
  const batch = roast.batch_number;
  if (seq != null && seq > 0) {
    return batch != null && batch > 0 ? `#${seq} • R${batch}` : `#${seq}`;
  }
  return batch != null && batch > 0 ? `R${batch}` : '—';
}
