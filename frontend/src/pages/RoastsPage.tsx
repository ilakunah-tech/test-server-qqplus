import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roastsApi } from '@/api/roasts';
import { inventoryApi } from '@/api/inventory';
import { getBlends } from '@/api/blends';
import { getMyMachines } from '@/api/machines';
import { authApi } from '@/api/auth';
import { settingsStore } from '@/store/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Upload, Download, Trash2, Search, Filter, RefreshCw, FileDown, LayoutGrid, Pencil, MoreVertical, ChevronLeft, ChevronRight, GitCompare, Printer } from 'lucide-react';
import { EditRoastInfoDialog } from '@/components/Roasts/EditRoastInfoDialog';
import { formatDateTimeTable, formatWeight, formatPercent, roastDisplayId } from '@/utils/formatters';
import { calculateWeightLoss, formatTimeMMSS } from '@/utils/roastCalculations';
import { exportToCSV, exportToExcel, EXPORT_COLUMNS, type ExportFormat, type ExportScope } from '@/utils/exportRoasts';
import { StickerPrint } from '@/components/StickerPrint/StickerPrint';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Roast } from '@/types/api';

const ROASTS_COLUMNS_STORAGE_KEY = 'roasts-visible-columns';

const COLUMN_OPTIONS: { id: string; label: string; shortLabel: string }[] = [
  { id: 'date', label: 'Дата', shortLabel: 'Дата' },
  { id: 'name', label: 'Наименование', shortLabel: 'Наим.' },
  { id: 'warehouse', label: 'Склад', shortLabel: 'Склад' },
  { id: 'machine', label: 'Машина', shortLabel: 'Маш.' },
  { id: 'user', label: 'Оператор', shortLabel: 'Опер.' },
  { id: 'green_weight', label: 'Начальный вес', shortLabel: 'Нач. кг' },
  { id: 'roasted_weight', label: 'Конечный вес', shortLabel: 'Кон. кг' },
  { id: 'shrinkage', label: 'Ужарка', shortLabel: 'Ужарка' },
  { id: 'dtr', label: 'Отношение времени развития (DTR)', shortLabel: 'DTR' },
  { id: 'bean_color', label: 'Цвет зерна', shortLabel: 'Цв. зерна' },
  { id: 'grind_color', label: 'Цвет помола', shortLabel: 'Цв. помола' },
  { id: 'coffee', label: 'Кофе', shortLabel: 'Кофе' },
  { id: 'rating', label: 'Оценка', shortLabel: 'Оценка' },
  { id: 'quality_control', label: 'Контроль качества', shortLabel: 'КК' },
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
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 py-1 rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg min-w-[160px]">
            {hasProfile ? (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
                  className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => { document.getElementById(`file-row-${roastId}`)?.click(); }}
                  disabled={uploadPending}
                >
                  <Upload className="w-4 h-4" /> Загрузить профиль
                </button>
              </>
            )}
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
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

type RoastsTab = 'roasts' | 'references';

export const RoastsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RoastsTab>('roasts');
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refFilterType, setRefFilterType] = useState<'coffee' | 'blend'>('coffee');
  const [refCoffeeHrId, setRefCoffeeHrId] = useState('');
  const [refBlendId, setRefBlendId] = useState('');
  const [refMachine, setRefMachine] = useState('');
  const [pageSize, setPageSize] = useState<25 | 50 | 100 | 500>(() => settingsStore.getState().defaultPageSize);
  const [page, setPage] = useState(0);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [stickerPrintRoasts, setStickerPrintRoasts] = useState<Roast[] | null>(null);
  const [editingRoast, setEditingRoast] = useState<Roast | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportScope, setExportScope] = useState<ExportScope>('page');
  const [exportPending, setExportPending] = useState(false);
  const [filterMachine, setFilterMachine] = useState('');
  const [filterCoffeeId, setFilterCoffeeId] = useState('');
  const [filterBlendId, setFilterBlendId] = useState('');
  const [filterRoastName, setFilterRoastName] = useState('');
  const [filterRoastId, setFilterRoastId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const queryClient = useQueryClient();

  const { data: roastsData, isFetching: roastsLoading } = useQuery({
    queryKey: ['roasts', dateFrom, dateTo, filterCoffeeId, page, pageSize],
    queryFn: () => roastsApi.getRoasts(
      pageSize,
      page * pageSize,
      dateFrom || undefined,
      dateTo || undefined,
      filterCoffeeId || undefined
    ),
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

  const { data: myMachines = [] } = useQuery({
    queryKey: ['machines', 'my'],
    queryFn: getMyMachines,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.getUsers(),
  });
  const users = usersData?.data ?? [];

  const referencesParams =
    refFilterType === 'coffee' && refCoffeeHrId.trim()
      ? { coffee_hr_id: refCoffeeHrId.trim(), machine: refMachine.trim() || undefined }
      : refFilterType === 'blend' && refBlendId
        ? { blend_id: refBlendId, machine: refMachine.trim() || undefined }
        : { machine: refMachine.trim() || undefined };
  const { data: referencesData, isFetching: referencesLoading } = useQuery({
    queryKey: ['roasts', 'references', referencesParams],
    queryFn: () =>
      roastsApi.getReferences({
        ...(referencesParams.coffee_hr_id && { coffee_hr_id: referencesParams.coffee_hr_id }),
        ...(referencesParams.blend_id && { blend_id: referencesParams.blend_id }),
        machine: referencesParams.machine,
      }),
    enabled: activeTab === 'references',
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

  const updateQCMutation = useMutation({
    mutationFn: ({ roastId, inQualityControl }: { roastId: string; inQualityControl: boolean }) =>
      roastsApi.updateRoast(roastId, { in_quality_control: inQualityControl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
  });

  const updateRoastInfoMutation = useMutation({
    mutationFn: ({ roastId, data }: { roastId: string; data: Parameters<typeof roastsApi.updateRoast>[1] }) =>
      roastsApi.updateRoast(roastId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      setEditingRoast(null);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка сохранения');
    },
  });

  const removeReferenceMutation = useMutation({
    mutationFn: roastsApi.removeReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['roasts', 'references'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка снятия эталона');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const batchId = formData.get('batch_id') as string;
    const batch = batchesData?.data?.items?.find(b => b.id === batchId);
    
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

  const handleExport = async () => {
    let dataToExport: Roast[] = [];
    if (exportScope === 'selected') {
      dataToExport = sortedRoasts.filter((r) => selectedIds.has(r.id));
      if (dataToExport.length === 0) {
        alert('Выберите обжарки для экспорта');
        return;
      }
    } else if (exportScope === 'all') {
      setExportPending(true);
      try {
        const res = await roastsApi.getRoasts(10000, 0, dateFrom || undefined, dateTo || undefined, filterCoffeeId || undefined);
        const allRoasts = res?.data?.items ?? [];
        let afterFilter = filterByDialogActive ? allRoasts.filter(filterByDialog) : allRoasts;
        if (searchQuery.trim()) {
          afterFilter = afterFilter.filter(
            (r) =>
              r.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              String(r.roast_seq ?? '').includes(searchQuery) ||
              String(r.batch_number).includes(searchQuery)
          );
        }
        dataToExport = [...afterFilter].sort((a, b) => {
          const aSeq = a.roast_seq ?? a.batch_number ?? 0;
          const bSeq = b.roast_seq ?? b.batch_number ?? 0;
          return sortDesc ? bSeq - aSeq : aSeq - bSeq;
        });
      } finally {
        setExportPending(false);
      }
    } else {
      dataToExport = sortedRoasts;
    }

    if (dataToExport.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    const columns = EXPORT_COLUMNS.filter((c) => visibleColumnIds.has(c.id));
    const cols = columns.length > 0 ? columns : EXPORT_COLUMNS;
    const headerLines = [
      `Artisan+ — Экспорт обжарок`,
      `Дата экспорта: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}`,
      `Записей: ${dataToExport.length}`,
      ...[
        dateFrom || dateTo ? `Период: ${dateFrom || '…'} — ${dateTo || '…'}` : null,
        filterMachine ? `Ростер: ${filterMachine}` : null,
        filterCoffeeId ? `Кофе: ${coffeesData?.data?.items?.find((c) => c.id === filterCoffeeId)?.label ?? filterCoffeeId}` : null,
        filterUserId ? `Пользователь: ${users.find((u) => u.id === filterUserId)?.email ?? filterUserId}` : null,
      ].filter(Boolean) as string[],
    ];

    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, cols, headerLines);
    } else {
      exportToExcel(dataToExport, cols, headerLines);
    }
    setExportDialogOpen(false);
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

  useEffect(() => {
    if (!filterDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterDialogOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterDialogOpen]);

  useEffect(() => {
    if (!exportDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportDialogOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportDialogOpen]);

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
  const totalRoasts = roastsData?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRoasts / pageSize));

  const filterByDialog = (r: Roast) => {
    if (filterMachine && (r.machine ?? '') !== filterMachine) return false;
    if (filterBlendId) {
      const blendMatch = blendsListData?.items?.find((b) => b.id === filterBlendId);
      if (!blendMatch) return false;
      const matches = r.blend_id === filterBlendId || r.blend_spec?.label === blendMatch.name;
      if (!matches) return false;
    }
    if (filterRoastName.trim() && !(r.title ?? r.label ?? '').toLowerCase().includes(filterRoastName.trim().toLowerCase())) return false;
    if (filterRoastId.trim() && !String(r.roast_seq ?? '').includes(filterRoastId.trim()) && !String(r.batch_number).includes(filterRoastId.trim())) return false;
    if (filterUserId && r.user_id !== filterUserId) return false;
    return true;
  };

  const filterByDialogActive = filterMachine || filterBlendId || filterRoastName.trim() || filterRoastId.trim() || filterUserId;
  const roastsAfterFilter = filterByDialogActive ? roasts.filter(filterByDialog) : roasts;

  const filteredRoasts = searchQuery.trim()
    ? roastsAfterFilter.filter(
        (r) =>
          r.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(r.roast_seq ?? '').includes(searchQuery) ||
          String(r.batch_number).includes(searchQuery)
      )
    : roastsAfterFilter;
  const sortedRoasts = [...filteredRoasts].sort((a, b) => {
    const aSeq = a.roast_seq ?? a.batch_number ?? 0;
    const bSeq = b.roast_seq ?? b.batch_number ?? 0;
    const cmp = aSeq - bSeq;
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
  const shrinkPct = (r: Roast): number | null => {
    if (r.weight_loss != null) return r.weight_loss <= 1 ? r.weight_loss * 100 : r.weight_loss;
    return calculateWeightLoss(r.green_weight_kg, r.roasted_weight_kg);
  };

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = sortedRoasts.length > 0 && selectedIds.size > 0 && selectedIds.size < sortedRoasts.length;
  }, [selectedIds.size, sortedRoasts.length]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
      {/* Заголовок страницы */}
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Обжарки</h2>

      {/* Вкладки: Обжарки / Референсы / Цели */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Вкладки">
          <button
            type="button"
            onClick={() => setActiveTab('roasts')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'roasts' ? 'border-brand text-brand' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            ОБЖАРКИ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'references' ? 'border-brand text-brand' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            РЕФЕРЕНСЫ
          </button>
        </nav>
      </div>

      {/* Контент вкладки «Референсы» */}
      {activeTab === 'references' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-card border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Фильтр (необязательно):</span>
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
          <div className="relative min-w-0 w-full overflow-hidden rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm">
              {referencesLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-white/70 dark:bg-gray-800/70">
                  <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Загрузка…</span>
                  </div>
                </div>
              )}
              <div className="min-w-0 w-full overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-max min-w-full text-sm text-left">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">ID</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Дата</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Наименование</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Кофе / Бленд</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Машина</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Начальный вес</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Конечный вес</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap w-14">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {((referencesData?.data?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
                          {refCoffeeHrId || refBlendId
                            ? 'Нет эталонных обжарок по выбранному фильтру.'
                            : 'Нет эталонных обжарок.'}
                        </td>
                      </tr>
                    ) : (
                      (referencesData?.data?.items ?? []).map((r) => {
                        const roastDate = r.roasted_at ?? r.roast_date;
                        return (
                          <tr key={r.id} className="hover:bg-brand-light/50 transition-colors">
                            <td className="py-2 px-4">
                              <Link to={`/roasts/${r.id}`} className="font-medium text-brand hover:underline">
                                {roastDisplayId(r)}
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
                            <td className="py-2 px-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Снять эталон"
                                aria-label="Снять эталон"
                                onClick={() => {
                                  if (window.confirm('Снять эталон с этой обжарки? Обжарка останется в системе, но перестанет быть эталоном.')) {
                                    removeReferenceMutation.mutate(r.id);
                                  }
                                }}
                                disabled={removeReferenceMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setFilterDialogOpen(true)}>
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
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportDialogOpen(true)}>
          <FileDown className="w-4 h-4" />
          ЭКСПОРТ
        </Button>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const roastsToPrint = sortedRoasts.filter((r) => selectedIds.has(r.id));
              setStickerPrintRoasts(roastsToPrint);
            }}
          >
            <Printer className="w-4 h-4" />
            ПЕЧАТЬ НАКЛЕЕК ({selectedIds.size})
          </Button>
        )}
        {selectedIds.size >= 2 && selectedIds.size <= 10 && (
          <Button
            variant="default"
            size="sm"
            className="gap-2"
            onClick={() => {
              const ids = Array.from(selectedIds);
              navigate(`/roasts/compare?ids=${ids.join(',')}`);
            }}
          >
            <GitCompare className="w-4 h-4" />
            СРАВНИТЬ ({selectedIds.size})
          </Button>
        )}
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

      {/* Диалог фильтров */}
      {filterDialogOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden onClick={() => setFilterDialogOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Фильтры обжарок</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filter_machine" className="text-sm">1. По ростерам</Label>
                <Select
                  id="filter_machine"
                  value={filterMachine}
                  onChange={(e) => setFilterMachine(e.target.value)}
                  className="mt-1 rounded-input"
                >
                  <option value="">— Выберите ростер —</option>
                  {myMachines.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </Select>
                {myMachines.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">Добавьте машины в Настройках</p>
                )}
              </div>
              <div>
                <Label className="text-sm">2. По зерну / бленду</Label>
                <div className="mt-1 flex gap-2">
                  <Select
                    value={filterCoffeeId}
                    onChange={(e) => { setFilterCoffeeId(e.target.value); setFilterBlendId(''); }}
                    className="flex-1 rounded-input"
                  >
                    <option value="">— Кофе —</option>
                    {(coffeesData?.data?.items ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.label ?? c.name ?? c.hr_id}</option>
                    ))}
                  </Select>
                  <Select
                    value={filterBlendId}
                    onChange={(e) => { setFilterBlendId(e.target.value); setFilterCoffeeId(''); }}
                    className="flex-1 rounded-input"
                  >
                    <option value="">— Бленд —</option>
                    {(blendsListData?.items ?? []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="filter_roast_name" className="text-sm">3. По наименованию обжарки</Label>
                <Input
                  id="filter_roast_name"
                  type="text"
                  placeholder="Часть названия"
                  value={filterRoastName}
                  onChange={(e) => setFilterRoastName(e.target.value)}
                  className="mt-1 rounded-input"
                />
              </div>
              <div>
                <Label htmlFor="filter_roast_id" className="text-sm">4. По ID</Label>
                <Input
                  id="filter_roast_id"
                  type="text"
                  placeholder="Например: 2829"
                  value={filterRoastId}
                  onChange={(e) => setFilterRoastId(e.target.value)}
                  className="mt-1 rounded-input"
                />
              </div>
              <div>
                <Label className="text-sm">5. По дате</Label>
                <div className="mt-1 flex gap-2 items-center">
                  <Input
                    type="date"
                    placeholder="От"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-input"
                  />
                  <span className="text-gray-500">—</span>
                  <Input
                    type="date"
                    placeholder="До"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-input"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Оставьте одинаковые даты для одного дня</p>
              </div>
              <div>
                <Label htmlFor="filter_user" className="text-sm">6. По пользователю</Label>
                <Select
                  id="filter_user"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="mt-1 rounded-input"
                >
                  <option value="">— Выберите пользователя —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterMachine('');
                  setFilterCoffeeId('');
                  setFilterBlendId('');
                  setFilterRoastName('');
                  setFilterRoastId('');
                  setFilterUserId('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Сбросить
              </Button>
              <Button size="sm" onClick={() => setFilterDialogOpen(false)}>
                Применить
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Печать наклеек */}
      {stickerPrintRoasts && stickerPrintRoasts.length > 0 && (
        <StickerPrint
          roasts={stickerPrintRoasts}
          baseUrl={window.location.origin}
          onClose={() => setStickerPrintRoasts(null)}
        />
      )}

      {/* Диалог редактирования обжарки */}
      {editingRoast && (
        <EditRoastInfoDialog
          roast={editingRoast}
          onClose={() => setEditingRoast(null)}
          onSubmit={async (data) => {
            await updateRoastInfoMutation.mutateAsync({ roastId: editingRoast.id, data });
          }}
          isSubmitting={updateRoastInfoMutation.isPending}
        />
      )}

      {/* Диалог экспорта */}
      {exportDialogOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden onClick={() => setExportDialogOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Экспорт обжарок</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Формат</Label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_format"
                      checked={exportFormat === 'xlsx'}
                      onChange={() => setExportFormat('xlsx')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_format"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">CSV</span>
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-sm">Что экспортировать</Label>
                <div className="mt-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'page'}
                      onChange={() => setExportScope('page')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">Текущая страница ({sortedRoasts.length} записей)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">Вся выборка (с учётом фильтров)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'selected'}
                      onChange={() => setExportScope('selected')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">Только выбранные ({selectedIds.size} записей)</span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                В файл попадут видимые колонки. Имя файла: roasts_export_ГГГГ-ММ-ДД_ЧЧ-ММ
              </p>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(false)}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exportPending}>
                {exportPending ? 'Загрузка…' : 'Экспортировать'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Пагинация: выбор кол-ва на странице */}
      <div className="flex flex-wrap items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">На странице:</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              const v = Number(e.target.value) as 25 | 50 | 100 | 500;
              setPageSize(v);
              setPage(0);
            }}
            className="w-20 rounded-input text-sm"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="500">500</option>
          </Select>
        </div>
        <span className="text-sm text-gray-600">
          {totalRoasts === 0
            ? 'Нет записей'
            : `Показано ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalRoasts)} из ${totalRoasts}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
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
                    {(batchesData?.data?.items ?? []).map((batch) => (
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

      {/* Таблица обжарок — интегрирована в страницу */}
      {roastsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-sm">Загрузка…</span>
          </div>
        </div>
      )}
      <div className="min-w-0 w-full overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="py-2 px-2 w-8">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={sortedRoasts.length > 0 && selectedIds.size === sortedRoasts.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-brand focus:ring-brand"
                  aria-label="Выбрать все"
                />
              </th>
              <th className="py-2 px-2 w-6 font-medium text-gray-700" title="Статус целей">
                {/* Цветовой индикатор целей */}
              </th>
              <th className="py-2 px-2 w-14 font-medium text-gray-700 truncate" title="ID">
                <button
                  type="button"
                  onClick={() => setSortDesc((d) => !d)}
                  className="hover:text-gray-900 flex items-center gap-0.5"
                >
                  ID {sortDesc ? '↓' : '↑'}
                </button>
              </th>
              {visibleColumns.map((col) => (
                <th key={col.id} className="py-2 px-2 font-medium text-gray-700 truncate" title={col.label}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="py-2 px-2 w-10 font-medium text-gray-700 truncate">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRoasts.length === 0 ? (
              <tr>
                <td colSpan={4 + visibleColumns.length} className="py-12 text-center">
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
                    return <span className="text-gray-600 whitespace-nowrap truncate block" title={formatDateTimeTable(roastDate)}>{formatDateTimeTable(roastDate)}</span>;
                  case 'name':
                    const nameVal = roast.title ?? roast.label ?? '—';
                    const blendVal = roast.blend_spec?.label ?? roast.blend_hr_id ?? '';
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1"
                        title="Нажмите для редактирования"
                      >
                        <div className="truncate" title={[nameVal, blendVal].filter(Boolean).join(' / ')}>
                          <span className="font-medium text-gray-900 truncate block">{nameVal}</span>
                          {blendVal && <span className="text-gray-500 truncate block">{blendVal}</span>}
                        </div>
                      </button>
                    );
                  case 'warehouse':
                    return <span className="text-gray-700 truncate block" title={roast.location_hr_id ?? ''}>{roast.location_hr_id ?? '—'}</span>;
                  case 'machine':
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-600"
                        title="Нажмите для редактирования"
                      >
                        {roast.machine ?? '—'}
                      </button>
                    );
                  case 'user':
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-600"
                        title="Нажмите для редактирования"
                      >
                        {roast.operator ?? '—'}
                      </button>
                    );
                  case 'green_weight':
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-700"
                        title="Нажмите для редактирования"
                      >
                        {formatWeight(Number(roast.green_weight_kg) || 0)}
                      </button>
                    );
                  case 'roasted_weight':
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-700"
                        title="Нажмите для редактирования"
                      >
                        {roast.roasted_weight_kg != null ? formatWeight(roast.roasted_weight_kg) : '—'}
                      </button>
                    );
                  case 'shrinkage':
                    return loss != null ? <span className="text-gray-600">{formatPercent(loss)}</span> : '—';
                  case 'dtr': {
                    const devTime = roast.DEV_time != null ? formatTimeMMSS(roast.DEV_time) : null;
                    const devPct = roast.DEV_ratio != null ? formatPercent(roast.DEV_ratio) : null;
                    if (!devTime && !devPct) return <span className="text-gray-700">—</span>;
                    const text = devTime && devPct ? `${devTime} (${devPct})` : (devTime ?? devPct ?? '—');
                    return <span className="text-gray-700" title="Время развития / % развития">{text}</span>;
                  }
                  case 'bean_color':
                    return <span className="text-gray-600">{roast.whole_color != null && roast.whole_color !== 0 ? String(roast.whole_color) : '—'}</span>;
                  case 'grind_color':
                    return <span className="text-gray-600">{roast.ground_color != null && roast.ground_color !== 0 ? String(roast.ground_color) : '—'}</span>;
                  case 'coffee':
                    const coffeeVal = roast.coffee_hr_id ?? roast.blend_spec?.label ?? roast.label ?? '—';
                    return <span className="text-gray-700 truncate block" title={String(coffeeVal)}>{coffeeVal}</span>;
                  case 'rating':
                    return (
                      <button type="button" className="p-1 text-gray-500 hover:text-brand" title="Оценка">
                        <Pencil className="w-4 h-4" />
                      </button>
                    );
                  case 'quality_control':
                    return (
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={roast.in_quality_control ?? false}
                          onChange={(e) => {
                            updateQCMutation.mutate({
                              roastId: roast.id,
                              inQualityControl: e.target.checked,
                            });
                          }}
                          className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                          title="Отметить для контроля качества"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  default:
                    return '—';
                }
              };
              const goalsStatus = roast.goals_status;
              const statusColor = goalsStatus === 'green' 
                ? 'bg-green-500' 
                : goalsStatus === 'red' 
                ? 'bg-red-500' 
                : goalsStatus === 'yellow'
                ? 'bg-yellow-500'
                : 'bg-gray-300'; // Серый если статус не определен (нет активных целей)
              
              return (
                <tr key={roast.id} className="hover:bg-brand-light/50 transition-colors">
                  <td className="py-1.5 px-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(roast.id)}
                      onChange={() => toggleSelect(roast.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    {goalsStatus && (
                      <div
                        className={`w-3 h-3 rounded ${statusColor}`}
                        title={
                          goalsStatus === 'green'
                            ? 'Все цели выполнены'
                            : goalsStatus === 'red'
                            ? 'Цели не выполнены'
                            : 'Отсутствуют данные для проверки'
                        }
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    <Link to={`/roasts/${roast.id}`} className="font-medium text-brand hover:underline truncate block">
                      {roastDisplayId(roast)}
                    </Link>
                  </td>
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="py-1.5 px-2 overflow-hidden">
                      {renderCell(col.id)}
                    </td>
                  ))}
                  <td className="py-1.5 px-2">
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
      </>
      )}
    </div>
  );
};
