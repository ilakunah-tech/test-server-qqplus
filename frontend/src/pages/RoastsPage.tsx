import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roastsApi } from '@/api/roasts';
import { inventoryApi } from '@/api/inventory';
import { getBlends } from '@/api/blends';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Upload, Download, Trash2, Search, Filter, RefreshCw, FileDown, LayoutGrid, Pencil, MoreVertical } from 'lucide-react';
import { formatDateTimeTable, formatWeight, formatPercent } from '@/utils/formatters';
import type { Roast } from '@/types/api';

const ROASTS_COLUMNS_STORAGE_KEY = 'roasts-visible-columns';

const COLUMN_OPTIONS: { id: string; label: string }[] = [
  { id: 'date', label: 'Дата' },
  { id: 'name', label: 'Наименование' },
  { id: 'warehouse', label: 'Склад' },
  { id: 'machine', label: 'Машина' },
  { id: 'user', label: 'Пользователь' },
  { id: 'green_weight', label: 'Начальный вес' },
  { id: 'roasted_weight', label: 'Конечный вес' },
  { id: 'shrinkage', label: 'Ужарка' },
  { id: 'dtr', label: 'Отношение времени развития (DTR)' },
  { id: 'bean_color', label: 'Цвет зерна' },
  { id: 'grind_color', label: 'Цвет помола' },
  { id: 'coffee', label: 'Кофе' },
  { id: 'rating', label: 'Оценка' },
  { id: 'quality_control', label: 'Контроль качества' },
];

const defaultVisibleColumnIds = new Set(COLUMN_OPTIONS.map((c) => c.id));

function loadVisibleColumnIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ROASTS_COLUMNS_STORAGE_KEY);
    if (!raw) return defaultVisibleColumnIds;
    const arr = JSON.parse(raw) as string[];
    const set = new Set(arr.filter((id) => COLUMN_OPTIONS.some((c) => c.id === id)));
    return set.size > 0 ? set : defaultVisibleColumnIds;
  } catch {
    return defaultVisibleColumnIds;
  }
}

function saveVisibleColumnIds(ids: Set<string>) {
  try {
    localStorage.setItem(ROASTS_COLUMNS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function RoastRowActions({
  roastId,
  hasProfile,
  onUpload,
  onDownload,
  onDelete,
  uploadPending,
  deletePending,
}: {
  roastId: string;
  hasProfile: boolean;
  onUpload: (file: File) => void;
  onDownload: () => void;
  onDelete: () => void;
  uploadPending: boolean;
  deletePending: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 py-1 rounded-card border border-gray-200 bg-white shadow-lg min-w-[160px]">
            {hasProfile ? (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => { onDownload(); setOpen(false); }}
              >
                <Download className="w-4 h-4" /> Скачать профиль
              </button>
            ) : (
              <>
                <input
                  type="file"
                  accept=".alog"
                  id={`file-row-${roastId}`}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { onUpload(f); setOpen(false); }
                  }}
                />
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => { document.getElementById(`file-row-${roastId}`)?.click(); }}
                  disabled={uploadPending}
                >
                  <Upload className="w-4 h-4" /> Загрузить профиль
                </button>
              </>
            )}
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => { onDelete(); setOpen(false); }}
              disabled={deletePending}
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type RoastsTab = 'roasts' | 'references' | 'goals';

export const RoastsPage = () => {
  const [activeTab, setActiveTab] = useState<RoastsTab>('roasts');
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refFilterType, setRefFilterType] = useState<'coffee' | 'blend'>('coffee');
  const [refCoffeeHrId, setRefCoffeeHrId] = useState('');
  const [refBlendId, setRefBlendId] = useState('');
  const [refMachine, setRefMachine] = useState('');
  const queryClient = useQueryClient();

  const { data: roastsData, isFetching: roastsLoading } = useQuery({
    queryKey: ['roasts', dateFrom, dateTo],
    queryFn: () => roastsApi.getRoasts(100, 0, dateFrom || undefined, dateTo || undefined),
  });
  const selectAllRef = useRef<HTMLInputElement>(null);

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => inventoryApi.getBatches(),
  });

  const { data: coffeesData } = useQuery({
    queryKey: ['inventory', 'coffees'],
    queryFn: () => inventoryApi.getCoffees(500, 0),
  });
  const { data: blendsListData } = useQuery({
    queryKey: ['blends'],
    queryFn: () => getBlends(500, 0),
  });

  const referencesParams =
    activeTab === 'references' && refFilterType === 'coffee' && refCoffeeHrId.trim()
      ? { coffee_hr_id: refCoffeeHrId.trim(), machine: refMachine.trim() || undefined }
      : activeTab === 'references' && refFilterType === 'blend' && refBlendId
        ? { blend_id: refBlendId, machine: refMachine.trim() || undefined }
        : null;
  const { data: referencesData, isFetching: referencesLoading } = useQuery({
    queryKey: ['roasts', 'references', referencesParams],
    queryFn: () =>
      roastsApi.getReferences({
        ...(referencesParams?.coffee_hr_id && { coffee_hr_id: referencesParams.coffee_hr_id }),
        ...(referencesParams?.blend_id && { blend_id: referencesParams.blend_id }),
        machine: referencesParams?.machine,
      }),
    enabled: Boolean(referencesParams),
  });

  const createRoastMutation = useMutation({
    mutationFn: roastsApi.createRoast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowForm(false);
    },
  });

  const uploadProfileMutation = useMutation({
    mutationFn: ({ roastId, file }: { roastId: string; file: File }) =>
      roastsApi.uploadProfile(roastId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
  });

  const deleteRoastMutation = useMutation({
    mutationFn: roastsApi.deleteRoast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка удаления');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const batchId = formData.get('batch_id') as string;
    const batch = batchesData?.data.items.find(b => b.id === batchId);
    
    createRoastMutation.mutate({
      batch_id: batchId,
      coffee_id: batch?.coffee_id || '',
      roast_date: new Date(formData.get('roast_date') as string).toISOString(),
      operator: formData.get('operator') as string || undefined,
      machine: formData.get('machine') as string || undefined,
      green_weight_kg: parseFloat(formData.get('green_weight_kg') as string),
      roasted_weight_kg: parseFloat(formData.get('roasted_weight_kg') as string),
      roast_time_sec: formData.get('roast_time_sec') ? parseInt(formData.get('roast_time_sec') as string) : undefined,
      drop_temp: formData.get('drop_temp') ? parseInt(formData.get('drop_temp') as string) : undefined,
      first_crack_temp: formData.get('first_crack_temp') ? parseInt(formData.get('first_crack_temp') as string) : undefined,
      first_crack_time: formData.get('first_crack_time') ? parseInt(formData.get('first_crack_time') as string) : undefined,
      agtron: formData.get('agtron') ? parseInt(formData.get('agtron') as string) : undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };

  const handleFileUpload = (roastId: string, file: File) => {
    uploadProfileMutation.mutate({ roastId, file });
  };

  const handleDeleteRoast = (roastId: string) => {
    if (!window.confirm('Удалить эту обжарку? Склад будет восстановлен.')) return;
    deleteRoastMutation.mutate(roastId);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDesc, setSortDesc] = useState(true);
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => loadVisibleColumnIds());
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  useEffect(() => {
    if (!columnPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColumnPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [columnPickerOpen]);

  const toggleColumn = (id: string) => {
    setVisibleColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveVisibleColumnIds(next);
      return next;
    });
  };
  const visibleColumns = COLUMN_OPTIONS.filter((c) => visibleColumnIds.has(c.id));

  const roasts = roastsData?.data?.items ?? [];
  const filteredRoasts = searchQuery.trim()
    ? roasts.filter(
        (r) =>
          r.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(r.batch_number).includes(searchQuery)
      )
    : roasts;
  const sortedRoasts = [...filteredRoasts].sort((a, b) => {
    const cmp = (a.batch_number ?? 0) - (b.batch_number ?? 0);
    return sortDesc ? -cmp : cmp;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRoasts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedRoasts.map((r) => r.id)));
  };
  const shrinkPct = (r: Roast) => {
    if (r.weight_loss != null) return r.weight_loss <= 1 ? r.weight_loss * 100 : r.weight_loss;
    return null;
  };

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = sortedRoasts.length > 0 && selectedIds.size > 0 && selectedIds.size < sortedRoasts.length;
  }, [selectedIds.size, sortedRoasts.length]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
      {/* Заголовок страницы */}
      <h2 className="text-3xl font-bold text-gray-900">Обжарки</h2>

      {/* Вкладки: Обжарки / Референсы / Цели */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Вкладки">
          <button
            type="button"
            onClick={() => setActiveTab('roasts')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'roasts' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ОБЖАРКИ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'references' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            РЕФЕРЕНСЫ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'goals' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ЦЕЛИ
          </button>
        </nav>
      </div>

      {/* Контент вкладки «Референсы» */}
      {activeTab === 'references' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-card border border-gray-200 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Фильтр:</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refType"
                  checked={refFilterType === 'coffee'}
                  onChange={() => setRefFilterType('coffee')}
                  className="text-brand focus:ring-brand"
                />
                Кофе
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refType"
                  checked={refFilterType === 'blend'}
                  onChange={() => setRefFilterType('blend')}
                  className="text-brand focus:ring-brand"
                />
                Бленд
              </label>
            </div>
            {refFilterType === 'coffee' ? (
              <Select
                value={refCoffeeHrId}
                onChange={(e) => setRefCoffeeHrId(e.target.value)}
                className="min-w-[200px] rounded-input"
              >
                <option value="">Выберите кофе</option>
                {(coffeesData?.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.hr_id}>
                    {c.label ?? c.name ?? c.hr_id}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={refBlendId}
                onChange={(e) => setRefBlendId(e.target.value)}
                className="min-w-[200px] rounded-input"
              >
                <option value="">Выберите бленд</option>
                {(blendsListData?.items ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
            <Input
              type="text"
              placeholder="Машина (необязательно)"
              value={refMachine}
              onChange={(e) => setRefMachine(e.target.value)}
              className="min-w-[180px] rounded-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['roasts', 'references'] })}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Обновить
            </Button>
          </div>
          {!referencesParams ? (
            <div className="rounded-card border border-gray-200 bg-white p-8 text-center text-gray-500">
              Выберите кофе или бленд в фильтре, чтобы увидеть список референсных профилей.
            </div>
          ) : (
            <div className="relative min-w-0 w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm">
              {referencesLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-white/70">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Загрузка…</span>
                  </div>
                </div>
              )}
              <div className="min-w-0 w-full overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-max min-w-full text-sm text-left">
                  <thead className="bg-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">ID</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Дата</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Наименование</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Кофе / Бленд</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Машина</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Начальный вес</th>
                      <th className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">Конечный вес</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {((referencesData?.data?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">
                          Нет референсных профилей по выбранному фильтру.
                        </td>
                      </tr>
                    ) : (
                      (referencesData?.data?.items ?? []).map((r) => {
                        const roastDate = r.roasted_at ?? r.roast_date;
                        return (
                          <tr key={r.id} className="hover:bg-brand-light/50 transition-colors">
                            <td className="py-2 px-4">
                              <Link to={`/roasts/${r.id}`} className="font-medium text-brand hover:underline">
                                R{r.batch_number}
                              </Link>
                            </td>
                            <td className="py-2 px-4 text-gray-600 whitespace-nowrap">{formatDateTimeTable(roastDate)}</td>
                            <td className="py-2 px-4 font-medium text-gray-900">{r.title ?? r.label ?? '—'}</td>
                            <td className="py-2 px-4 text-gray-700">{r.coffee_hr_id ?? r.blend_spec?.label ?? r.blend_hr_id ?? '—'}</td>
                            <td className="py-2 px-4 text-gray-600 text-xs">{r.machine ?? '—'}</td>
                            <td className="py-2 px-4 text-gray-700">{formatWeight(Number(r.green_weight_kg) || 0)}</td>
                            <td className="py-2 px-4 text-gray-700">
                              {r.roasted_weight_kg != null ? formatWeight(r.roasted_weight_kg) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Контент вкладки «Цели» */}
      {activeTab === 'goals' && (
        <div className="rounded-card border border-gray-200 bg-white p-8 text-center text-gray-500">
          Раздел «Цели» в разработке.
        </div>
      )}

      {/* Панель управления: поиск, фильтр, обновить, экспорт — только для вкладки «Обжарки» */}
      {activeTab === 'roasts' && (
      <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Найти"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-input"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          ФИЛЬТР
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['roasts'] })}
        >
          <RefreshCw className="w-4 h-4" />
          ОБНОВИТЬ
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="w-4 h-4" />
          ЭКСПОРТ
        </Button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setColumnPickerOpen((o) => !o)}
            className="p-2 rounded-input border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Выбор колонок"
            aria-expanded={columnPickerOpen}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          {columnPickerOpen && (
            <>
              <div className="fixed inset-0 z-20" aria-hidden onClick={() => setColumnPickerOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded-card border border-gray-200 bg-white shadow-lg py-3 px-3 max-h-[80vh] overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1 pb-2 mb-2 border-b border-gray-100">
                  Отображать в списке
                </p>
                <ul className="space-y-1">
                  {COLUMN_OPTIONS.map((col) => (
                    <li key={col.id}>
                      <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumnIds.has(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-gray-300 text-brand focus:ring-brand"
                        />
                        <span className="text-sm text-gray-800">{col.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setColumnPickerOpen(false)}
                >
                  ЗАКРЫТЬ
                </Button>
              </div>
            </>
          )}
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="ml-auto gap-2">
          <Plus className="w-4 h-4" />
          Добавить обжарку
        </Button>
      </div>

      {/* Скрытые фильтры по дате (оставляем для логики) */}
      <div className="sr-only flex gap-4">
        <div>
          <Label htmlFor="date_from">From Date</Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="date_to">To Date</Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Roast</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch_id">Batch *</Label>
                  <Select id="batch_id" name="batch_id" required>
                    <option value="">Select batch</option>
                    {batchesData?.data.items.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.lot_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="roast_date">Roast Date *</Label>
                  <Input id="roast_date" name="roast_date" type="datetime-local" required />
                </div>
                <div>
                  <Label htmlFor="operator">Operator</Label>
                  <Input id="operator" name="operator" />
                </div>
                <div>
                  <Label htmlFor="machine">Machine</Label>
                  <Input id="machine" name="machine" />
                </div>
                <div>
                  <Label htmlFor="green_weight_kg">Green Weight (kg) *</Label>
                  <Input id="green_weight_kg" name="green_weight_kg" type="number" step="0.1" required />
                </div>
                <div>
                  <Label htmlFor="roasted_weight_kg">Roasted Weight (kg) *</Label>
                  <Input id="roasted_weight_kg" name="roasted_weight_kg" type="number" step="0.1" required />
                </div>
                <div>
                  <Label htmlFor="roast_time_sec">Roast Time (sec)</Label>
                  <Input id="roast_time_sec" name="roast_time_sec" type="number" />
                </div>
                <div>
                  <Label htmlFor="drop_temp">Drop Temp (°C)</Label>
                  <Input id="drop_temp" name="drop_temp" type="number" />
                </div>
                <div>
                  <Label htmlFor="first_crack_temp">First Crack Temp (°C)</Label>
                  <Input id="first_crack_temp" name="first_crack_temp" type="number" />
                </div>
                <div>
                  <Label htmlFor="first_crack_time">First Crack Time (sec)</Label>
                  <Input id="first_crack_time" name="first_crack_time" type="number" />
                </div>
                <div>
                  <Label htmlFor="agtron">Agtron</Label>
                  <Input id="agtron" name="agtron" type="number" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRoastMutation.isPending}>
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Таблица обжарок */}
      <div className="relative min-w-0 w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm">
        {roastsLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-white/70">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm">Загрузка…</span>
            </div>
          </div>
        )}
        <div className="min-w-0 w-full overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-max min-w-full text-sm text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={sortedRoasts.length > 0 && selectedIds.size === sortedRoasts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                    aria-label="Выбрать все"
                  />
                </th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[60px]">
                  <button
                    type="button"
                    onClick={() => setSortDesc((d) => !d)}
                    className="font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1"
                  >
                    ID {sortDesc ? '↓' : '↑'}
                  </button>
                </th>
                {visibleColumns.map((col) => (
                  <th key={col.id} className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap min-w-[100px]">
                    {col.label}
                  </th>
                ))}
                <th className="py-3 px-4 w-12 min-w-[52px] font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRoasts.length === 0 ? (
                <tr>
                  <td colSpan={3 + visibleColumns.length} className="py-12 text-center">
                    <p className="text-gray-500">
                      {searchQuery.trim() ? 'По запросу ничего не найдено. Измените поиск или очистите поле.' : 'Нет обжарок для отображения'}
                    </p>
                  </td>
                </tr>
              ) : sortedRoasts.map((roast) => {
                const roastDate = roast.roasted_at ?? roast.roast_date;
                const hasProfile = Boolean(roast.alog_file_path ?? roast.profile_file);
                const loss = shrinkPct(roast);
                const renderCell = (colId: string) => {
                  switch (colId) {
                    case 'date':
                      return <span className="text-gray-600 whitespace-nowrap">{formatDateTimeTable(roastDate)}</span>;
                    case 'name':
                      return (
                        <>
                          <span className="font-medium text-gray-900">
                            {roast.title ?? roast.label ?? '—'}
                          </span>
                          {(roast.blend_hr_id ?? roast.blend_spec?.label) && (
                            <div className="text-gray-500 text-xs mt-0.5">
                              {roast.blend_spec?.label ?? roast.blend_hr_id}
                            </div>
                          )}
                        </>
                      );
                    case 'warehouse':
                      return <span className="text-gray-700">{roast.location_hr_id ?? '—'}</span>;
                    case 'machine':
                      return <span className="text-gray-600 text-xs">{roast.machine ?? '—'}</span>;
                    case 'user':
                      return <span className="text-gray-600 text-xs">{roast.operator ?? '—'}</span>;
                    case 'green_weight':
                      return <span className="text-gray-700">{formatWeight(Number(roast.green_weight_kg) || 0)}</span>;
                    case 'roasted_weight':
                      return (
                        <span className="text-gray-700">
                          {roast.roasted_weight_kg != null ? formatWeight(roast.roasted_weight_kg) : '—'}
                        </span>
                      );
                    case 'shrinkage':
                      return loss != null ? <span className="text-gray-600">{formatPercent(loss)}</span> : '—';
                    case 'dtr':
                      return <span className="text-gray-700">{roast.DEV_ratio != null ? roast.DEV_ratio.toFixed(1) : '—'}</span>;
                    case 'bean_color':
                      return <span className="text-gray-600">{roast.whole_color != null && roast.whole_color !== 0 ? String(roast.whole_color) : '—'}</span>;
                    case 'grind_color':
                      return <span className="text-gray-600">{roast.ground_color != null && roast.ground_color !== 0 ? String(roast.ground_color) : '—'}</span>;
                    case 'coffee':
                      return <span className="text-gray-700">{roast.coffee_hr_id ?? roast.blend_spec?.label ?? roast.label ?? '—'}</span>;
                    case 'rating':
                      return (
                        <button type="button" className="p-1 text-gray-500 hover:text-brand" title="Оценка">
                          <Pencil className="w-4 h-4" />
                        </button>
                      );
                    case 'quality_control':
                      return <span className="text-gray-600 text-xs">{roast.notes ?? '—'}</span>;
                    default:
                      return '—';
                  }
                };
                return (
                  <tr key={roast.id} className="hover:bg-brand-light/50 transition-colors">
                    <td className="py-2 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(roast.id)}
                        onChange={() => toggleSelect(roast.id)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Link to={`/roasts/${roast.id}`} className="font-medium text-brand hover:underline">
                        R{roast.batch_number}
                      </Link>
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.id} className="py-2 px-4">
                        {renderCell(col.id)}
                      </td>
                    ))}
                    <td className="py-2 px-4">
                      <RoastRowActions
                        roastId={roast.id}
                        hasProfile={hasProfile}
                        onUpload={(file) => handleFileUpload(roast.id, file)}
                        onDownload={() =>
                          roastsApi.downloadProfile(roast.id).then((blob) => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${roast.id}.alog`;
                            a.click();
                          })
                        }
                        onDelete={() => handleDeleteRoast(roast.id)}
                        uploadPending={uploadProfileMutation.isPending}
                        deletePending={deleteRoastMutation.isPending}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
