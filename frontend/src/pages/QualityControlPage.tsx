import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import { roastsApi } from '@/api/roasts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ChevronLeft, ChevronRight, Loader2, FileText, X, List, BarChart3 } from 'lucide-react';
import type { Roast } from '@/types/api';
import { cn } from '@/utils/cn';
import { QCStatisticsTab } from '@/components/QualityControl/QCStatisticsTab';

const PAGE_SIZE = 50;
const VERDICTS = ['green', 'yellow', 'red'] as const;
type Verdict = (typeof VERDICTS)[number];

function nextVerdict(current: string | undefined): Verdict | '' {
  if (!current || !VERDICTS.includes(current as Verdict)) return 'green';
  const i = VERDICTS.indexOf(current as Verdict);
  if (i === VERDICTS.length - 1) return '';
  return VERDICTS[i + 1];
}

function batchId(r: Roast): string {
  const seq = r.roast_seq;
  const batch = r.batch_number;
  if (seq != null && seq > 0) {
    return batch != null && batch > 0 ? `#${seq} • R${batch}` : `#${seq}`;
  }
  if (batch != null && batch > 0) return `R${batch}`;
  return r.id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function formatDateDdMm(value: string | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, 'dd.MM') : '—';
}

function formatDateForInput(value: string | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
}

function lossPercent(r: Roast): number | null {
  const w = r.weight_loss;
  if (w != null) return w <= 1 ? w * 100 : w;
  const green = Number(r.green_weight_kg) || 0;
  const roasted = Number(r.roasted_weight_kg);
  if (green > 0 && roasted != null && !Number.isNaN(roasted)) {
    return ((green - roasted) / green) * 100;
  }
  return null;
}

function weightCell(r: Roast): string {
  const green = Number(r.green_weight_kg) || 0;
  const roasted = r.roasted_weight_kg != null ? Number(r.roasted_weight_kg) : null;
  const loss = lossPercent(r);
  const roastedStr = roasted != null ? roasted.toFixed(2) : '—';
  const lossStr = loss != null ? `${loss.toFixed(1)}%` : '—';
  return `${green.toFixed(2)} / ${roastedStr} / ${lossStr}`;
}

function machineOperator(r: Roast): string {
  const parts = [r.machine, r.operator].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function VerdictDot({
  verdict,
  onCycle,
  title,
}: {
  verdict: string | undefined;
  onCycle: () => void;
  title: string;
}) {
  const v = verdict?.toLowerCase();
  const bgStyle =
    v === 'green'
      ? { backgroundColor: '#10b981' }
      : v === 'yellow'
        ? { backgroundColor: '#FFEA00' }
        : v === 'red'
          ? { backgroundColor: '#ef4444' }
          : undefined;
  const neutralClass = 'bg-stone-300 dark:bg-stone-500';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCycle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={title}
      style={bgStyle}
      className={cn(
        'verdict-dot w-7 h-7 rounded-full border-2 border-white shadow-md shrink-0 transition-all hover:scale-110 hover:ring-2 hover:ring-qq-purple focus:outline-none focus:ring-2 focus:ring-qq-purple cursor-pointer',
        !bgStyle && neutralClass
      )}
    />
  );
}

type QCTab = 'roasts' | 'statistics';

export const QualityControlPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<QCTab>('roasts');
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [notesModal, setNotesModal] = useState<{ roast: Roast; field: 'notes' | 'espresso_notes' } | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const qcQueryKey = ['roasts', 'quality-control', dateFrom || undefined, dateTo || undefined, 500, 0, true] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: qcQueryKey,
    queryFn: () =>
      roastsApi.getRoasts(500, 0, dateFrom || undefined, dateTo || undefined, undefined, true),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof roastsApi.updateRoast>[1] }) =>
      roastsApi.updateRoast(id, data),
    onMutate: async ({ id, data: patch }) => {
      await queryClient.cancelQueries({ queryKey: qcQueryKey });
      const prev = queryClient.getQueryData(qcQueryKey);
      queryClient.setQueryData(qcQueryKey, (old: { data?: { items?: Roast[]; total?: number } } | undefined) => {
        if (!old?.data?.items) return old;
        const items = old.data.items.map((r: Roast) =>
          r.id === id
            ? {
                ...r,
                ...(patch.cupping_verdict !== undefined && { cupping_verdict: patch.cupping_verdict ?? undefined }),
                ...(patch.espresso_verdict !== undefined && { espresso_verdict: patch.espresso_verdict ?? undefined }),
              }
            : r
        );
        return { ...old, data: { ...old.data, items } };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qcQueryKey, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
  });

  const roasts = data?.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(roasts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = roasts.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const openNotesModal = useCallback((roast: Roast, field: 'notes' | 'espresso_notes') => {
    setNotesModal({ roast, field });
    setNotesDraft(field === 'notes' ? (roast.notes ?? '') : (roast.espresso_notes ?? ''));
  }, []);

  const saveNotesAndClose = useCallback(() => {
    if (!notesModal) return;
    const { roast, field } = notesModal;
    const value = notesDraft.trim();
    const current = field === 'notes' ? roast.notes ?? '' : roast.espresso_notes ?? '';
    if (value !== current) {
      updateMutation.mutate({
        id: roast.id,
        data: field === 'notes' ? { notes: value || undefined } : { espresso_notes: value || undefined },
      });
    }
    setNotesModal(null);
  }, [notesModal, notesDraft, updateMutation]);

  const handleSaveDate = useCallback(
    (roast: Roast, field: 'cupping_date' | 'espresso_date', value: string) => {
      const trimmed = value.trim();
      const current = field === 'cupping_date' ? roast.cupping_date : roast.espresso_date;
      if (trimmed === (current ?? '')) return;
      updateMutation.mutate({
        id: roast.id,
        data: { [field]: trimmed || undefined },
      });
    },
    [updateMutation]
  );

  const handleVerdictCycle = useCallback(
    (roast: Roast, field: 'cupping_verdict' | 'espresso_verdict') => {
      const current = field === 'cupping_verdict' ? roast.cupping_verdict : roast.espresso_verdict;
      const next = nextVerdict(current);
      // Send null for reset so backend clears the verdict (undefined is omitted from JSON)
      updateMutation.mutate({
        id: roast.id,
        data: { [field]: next === '' ? null : next } as Parameters<typeof roastsApi.updateRoast>[1],
      });
    },
    [updateMutation]
  );

  return (
    <div className="space-y-6">
      <div className="qc-page-header rounded-card overflow-hidden bg-gradient-to-r from-qq-purple to-qq-purple-dark shadow-lg">
        <div className="p-5 pb-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-qq-yellow" />
            Quality control
          </h1>
          <p className="mt-2 font-medium qc-page-header-desc">
            Таблица контроля качества. Редактируйте даты каппинга и эспрессо, вердикты и заметки.
          </p>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => setActiveTab('roasts')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === 'roasts'
                  ? 'bg-qq-yellow text-qq-purple-dark shadow-md'
                  : 'text-white/90 hover:bg-white/15 hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
              Обжарки
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('statistics')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === 'statistics'
                  ? 'bg-qq-yellow text-qq-purple-dark shadow-md'
                  : 'text-white/90 hover:bg-white/15 hover:text-white'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Статистика
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'statistics' ? (
        <QCStatisticsTab />
      ) : (
      <Card className="overflow-hidden border border-purple-200/80 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b border-purple-200/60 dark:border-gray-600 bg-purple-50/40 dark:bg-gray-700/50">
          <CardTitle className="text-lg font-semibold text-qq-purple-dark">Обжарки</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              className="w-36 h-9 text-sm text-stone-800 dark:text-gray-100 border-purple-200/80 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-qq-purple"
            />
            <span className="text-purple-600">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className="w-36 h-9 text-sm text-stone-800 dark:text-gray-100 border-purple-200/80 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-qq-purple"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}
          {isError && (
            <p className="text-red-700 py-6 px-4">
              {error instanceof Error ? error.message : 'Ошибка загрузки'}
            </p>
          )}
          {!isLoading && !isError && roasts.length === 0 && (
            <p className="text-stone-600 dark:text-gray-400 py-12 text-center">Нет обжарок</p>
          )}
          {!isLoading && !isError && roasts.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-qq-purple to-qq-purple-dark text-white border-b-2 border-qq-purple-dark/80 shadow-sm">
                      <th className="text-left py-3 px-3 font-semibold">ID</th>
                      <th className="text-left py-3 px-3 font-semibold">Дата</th>
                      <th className="text-left py-3 px-3 font-semibold">Наименование</th>
                      <th className="text-left py-3 px-3 font-semibold">Вес / Ужарка</th>
                      <th className="text-left py-3 px-3 font-semibold">Машина, оператор</th>
                      <th className="text-left py-3 px-3 font-semibold">Дата каппинга</th>
                      <th className="text-center py-3 px-3 font-semibold w-14">Каппинг</th>
                      <th className="text-left py-3 px-3 font-semibold w-24">Заметки</th>
                      <th className="text-left py-3 px-3 font-semibold">Дата эспрессо</th>
                      <th className="text-center py-3 px-3 font-semibold w-14">Эспрессо</th>
                      <th className="text-left py-3 px-3 font-semibold w-24">Заметки эспрессо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((roast, idx) => (
                      <tr
                        key={roast.id}
                        className={cn(
                          'border-b border-purple-100/80 transition-colors',
                          idx % 2 === 0
                            ? 'bg-white dark:bg-gray-800 hover:bg-purple-50/50 dark:hover:bg-gray-700/50'
                            : 'bg-purple-50/30 dark:bg-gray-700/30 hover:bg-purple-100/40 dark:hover:bg-gray-600/40'
                        )}
                      >
                        <td className="py-2 px-3">
                          <Link
                            to={`/roasts/${roast.id}`}
                            className="font-mono text-qq-purple hover:text-qq-purple-dark hover:underline font-medium"
                          >
                            {batchId(roast)}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-stone-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDateDdMm(roast.roasted_at ?? roast.roast_date ?? roast.created_at)}
                        </td>
                        <td className="py-2 px-3 text-stone-800 dark:text-gray-100 font-medium">
                          {roast.label || roast.title || '—'}
                        </td>
                        <td className="py-2 px-3 text-stone-700 dark:text-gray-300 whitespace-nowrap">
                          {weightCell(roast)}
                        </td>
                        <td className="py-2 px-3 text-stone-700 dark:text-gray-300 text-xs">
                          {machineOperator(roast)}
                        </td>
                        <td className="py-1 px-2">
                          <Input
                            key={`cupping-${roast.id}-${roast.cupping_date ?? ''}`}
                            type="date"
                            defaultValue={formatDateForInput(roast.cupping_date)}
                            onBlur={(e) => handleSaveDate(roast, 'cupping_date', e.target.value)}
                            className="h-8 w-32 text-xs text-stone-800 dark:text-gray-100 border-purple-200/80 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-qq-purple"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex justify-center">
                            <VerdictDot
                              verdict={roast.cupping_verdict}
                              onCycle={() => handleVerdictCycle(roast, 'cupping_verdict')}
                              title="Каппинг: клик — сменить (зелёный → жёлтый → красный → сброс)"
                            />
                          </div>
                        </td>
                        <td className="py-1 px-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full justify-start gap-1 text-stone-700 dark:text-gray-300 border-purple-200/80 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-gray-600"
                            onClick={() => openNotesModal(roast, 'notes')}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {roast.notes ? 'Изм.' : 'Добавить'}
                          </Button>
                        </td>
                        <td className="py-1 px-2">
                          <Input
                            key={`espresso-${roast.id}-${roast.espresso_date ?? ''}`}
                            type="date"
                            defaultValue={formatDateForInput(roast.espresso_date)}
                            onBlur={(e) => handleSaveDate(roast, 'espresso_date', e.target.value)}
                            className="h-8 w-32 text-xs text-stone-800 dark:text-gray-100 border-purple-200/80 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-qq-purple"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex justify-center">
                            <VerdictDot
                              verdict={roast.espresso_verdict}
                              onCycle={() => handleVerdictCycle(roast, 'espresso_verdict')}
                              title="Эспрессо: клик — сменить (зелёный → жёлтый → красный → сброс)"
                            />
                          </div>
                        </td>
                        <td className="py-1 px-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full justify-start gap-1 text-stone-700 dark:text-gray-300 border-purple-200/80 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-gray-600"
                            onClick={() => openNotesModal(roast, 'espresso_notes')}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {roast.espresso_notes ? 'Изм.' : 'Добавить'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-200/60 dark:border-gray-600 bg-purple-50/30 dark:bg-gray-700/30">
                  <p className="text-xs text-stone-600 dark:text-gray-400">
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, roasts.length)} из {roasts.length}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setNotesModal(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-card shadow-xl border border-purple-200/80 dark:border-gray-700 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-qq-purple-dark dark:text-gray-100">
                {notesModal.field === 'notes' ? 'Заметки о кофе' : 'Заметки эспрессо'}
              </h3>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNotesModal(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Введите заметки..."
              className="w-full min-h-[120px] px-3 py-2 text-sm border border-purple-200/80 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-qq-purple/50"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setNotesModal(null)}>
                Отмена
              </Button>
              <Button size="sm" onClick={saveNotesAndClose} className="bg-brand text-white hover:bg-brand/90">
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
