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
import { authStore } from '@/store/authStore';
import { formatDateTimeTable, formatWeight, formatPercent, roastDisplayId, decodeUnicodeEscapes } from '@/utils/formatters';
import { calculateWeightLoss, formatTimeMMSS } from '@/utils/roastCalculations';
import { exportToCSV, exportToExcel, EXPORT_COLUMNS, type ExportFormat, type ExportScope } from '@/utils/exportRoasts';
import { StickerPrint } from '@/components/StickerPrint/StickerPrint';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Roast } from '@/types/api';
import { useTranslation } from '@/hooks/useTranslation';

const ROASTS_COLUMNS_STORAGE_KEY = 'roasts-visible-columns';

const COLUMN_OPTIONS: { id: string; labelKey: string; shortLabelKey: string }[] = [
  { id: 'date', labelKey: 'roasts.date', shortLabelKey: 'roasts.date' },
  { id: 'name', labelKey: 'roasts.name', shortLabelKey: 'roasts.shortName' },
  { id: 'warehouse', labelKey: 'roasts.warehouse', shortLabelKey: 'roasts.warehouse' },
  { id: 'machine', labelKey: 'roasts.machine', shortLabelKey: 'roasts.shortMachine' },
  { id: 'user', labelKey: 'roasts.operator', shortLabelKey: 'roasts.shortOperator' },
  { id: 'green_weight', labelKey: 'roasts.greenWeight', shortLabelKey: 'roasts.shortGreenWeight' },
  { id: 'roasted_weight', labelKey: 'roasts.roastedWeight', shortLabelKey: 'roasts.shortRoastedWeight' },
  { id: 'shrinkage', labelKey: 'roasts.shrinkage', shortLabelKey: 'roasts.shrinkage' },
  { id: 'dtr', labelKey: 'roasts.dtr', shortLabelKey: 'roasts.dtr' },
  { id: 'bean_color', labelKey: 'roasts.beanColor', shortLabelKey: 'roasts.shortBeanColor' },
  { id: 'grind_color', labelKey: 'roasts.grindColor', shortLabelKey: 'roasts.shortGrindColor' },
  { id: 'coffee', labelKey: 'roasts.coffee', shortLabelKey: 'roasts.coffee' },
  { id: 'rating', labelKey: 'roasts.rating', shortLabelKey: 'roasts.rating' },
  { id: 'quality_control', labelKey: 'roasts.qualityControl', shortLabelKey: 'roasts.qualityControl' },
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
  canEdit,
}: {
  roastId: string;
  hasProfile: boolean;
  onUpload: (file: File) => void;
  onDownload: () => void;
  onDelete: () => void;
  uploadPending: boolean;
  deletePending: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
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
                <Download className="w-4 h-4" /> {t('roasts.downloadProfile')}
              </button>
            ) : canEdit ? (
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
                  <Upload className="w-4 h-4" /> {t('roasts.uploadProfile')}
                </button>
              </>
            ) : null}
            {canEdit && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                onClick={() => { onDelete(); setOpen(false); }}
                disabled={deletePending}
              >
                <Trash2 className="w-4 h-4" /> {t('roasts.delete')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type RoastsTab = 'roasts' | 'references';

export const RoastsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = authStore((s) => s.role);
  const canEditRoasts = role === 'user' || role === 'admin';
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
  const [manualStickerOpen, setManualStickerOpen] = useState(false);
  const [manualStickerText, setManualStickerText] = useState('');
  const [manualStickerFont, setManualStickerFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [manualStickerFontSize, setManualStickerFontSize] = useState<string>('9.5');
  const [manualStickerBold, setManualStickerBold] = useState(false);
  const [manualStickerItalic, setManualStickerItalic] = useState(false);
  const [manualStickerUnderline, setManualStickerUnderline] = useState(false);
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
    enabled: canEditRoasts,
  });

  const { data: coffeesData } = useQuery({
    queryKey: ['inventory', 'coffees'],
    queryFn: () => inventoryApi.getCoffees(500, 0),
    enabled: canEditRoasts,
  });
  const { data: blendsListData } = useQuery({
    queryKey: ['blends'],
    queryFn: () => getBlends(500, 0),
    enabled: canEditRoasts,
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
      alert(err.response?.data?.detail || t('roasts.deleteError'));
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
      alert(err.response?.data?.detail || t('roasts.saveError'));
    },
  });

  const removeReferenceMutation = useMutation({
    mutationFn: roastsApi.removeReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['roasts', 'references'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || t('roasts.removeReferenceError'));
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
    if (!window.confirm(t('roastDetail.deleteRoastConfirm'))) return;
    deleteRoastMutation.mutate(roastId);
  };

  const handleExport = async () => {
    let dataToExport: Roast[] = [];
    if (exportScope === 'selected') {
      dataToExport = sortedRoasts.filter((r) => selectedIds.has(r.id));
      if (dataToExport.length === 0) {
        alert(t('roasts.selectRoastsForExport'));
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
      alert(t('roasts.noDataForExport'));
      return;
    }

    const columns = EXPORT_COLUMNS.filter((c) => visibleColumnIds.has(c.id));
    const cols = columns.length > 0 ? columns : EXPORT_COLUMNS;
    const headerLines = [
      t('roasts.exportTitle'),
      `${t('roasts.exportDate')}: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}`,
      `${t('roasts.recordsCount')}: ${dataToExport.length}`,
      ...[
        dateFrom || dateTo ? `${t('roasts.period')}: ${dateFrom || '…'} — ${dateTo || '…'}` : null,
        filterMachine ? `${t('roasts.roaster')}: ${filterMachine}` : null,
        filterCoffeeId ? `${t('roasts.coffee')}: ${coffeesData?.data?.items?.find((c) => c.id === filterCoffeeId)?.label ?? filterCoffeeId}` : null,
        filterUserId ? `${t('roasts.userFilter')}: ${users.find((u) => u.id === filterUserId)?.email ?? filterUserId}` : null,
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
    // 1. Если есть оба веса — считаем напрямую (надёжнее всего)
    const calculated = calculateWeightLoss(r.green_weight_kg, r.roasted_weight_kg);
    if (calculated != null && calculated > 0 && calculated < 50) {
      return calculated;
    }

    // 2. Используем сохранённое значение из БД (может быть 0..1 или 0..100)
    if (r.weight_loss != null) {
      const raw = r.weight_loss;
      const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
      if (pct > 0 && pct < 50) return pct;
    }

    // 3. Фоллбэк — что посчитали по весам (может быть null/за пределами диапазона)
    return calculated;
  };

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = sortedRoasts.length > 0 && selectedIds.size > 0 && selectedIds.size < sortedRoasts.length;
  }, [selectedIds.size, sortedRoasts.length]);

  const handleManualStickerPrint = () => {
    const trimmed = manualStickerText.trim();
    if (!trimmed) {
      alert(t('roasts.customStickerHint'));
      return;
    }

    const escapeHtml = (s: string): string => {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    };

    const win = window.open('', '_blank');
    if (!win) {
      alert('Разрешите всплывающие окна для печати наклеек.');
      return;
    }

    const safeText = escapeHtml(trimmed);

    const fontFamily =
      manualStickerFont === 'serif'
        ? "Georgia, 'Times New Roman', serif"
        : manualStickerFont === 'mono'
          ? "'Courier New', Menlo, monospace"
          : "Arial, Helvetica, sans-serif";
    const sizePt = Number(manualStickerFontSize.replace(',', '.'));
    const safeSize = Number.isFinite(sizePt) && sizePt > 4 && sizePt < 40 ? sizePt : 9.5;

    const styleParts = [
      `font-family:${fontFamily}`,
      `font-size:${safeSize}pt`,
      `font-weight:${manualStickerBold ? '700' : '400'}`,
      `font-style:${manualStickerItalic ? 'italic' : 'normal'}`,
      `text-decoration:${manualStickerUnderline ? 'underline' : 'none'}`,
    ];
    const textStyle = styleParts.join(';');

    const stickersHtml = `
      <div class="sticker">
        <div class="sticker__inner">
          <div class="sticker__body">
            <div class="manual-text" style="${textStyle}">${safeText}</div>
          </div>
        </div>
      </div>
    `;

    const doc = win.document;
    doc.open();
    doc.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t('roasts.customStickerTitle'))}</title>
  <script>
    window.addEventListener('load', function() {
      window.onafterprint = function() { window.close(); };
      setTimeout(function() {
        window.print();
      }, 100);
    });
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page { size: 58mm 40mm; margin: 0; }
    
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 58mm !important; height: 40mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      .stickers { margin: 0 !important; padding: 0 !important; display: block !important; width: 58mm !important; height: 40mm !important; }
      .sticker {
        width: 58mm !important; height: 40mm !important; min-width: 58mm !important; min-height: 40mm !important;
        margin: 0 !important; padding: 0 !important; border: none !important;
        /* без явного page-break-after, чтобы не провоцировать второй лист на некоторых драйверах */
        page-break-inside: avoid !important; break-inside: avoid !important;
        display: flex !important; box-sizing: border-box !important; overflow: hidden !important;
      }
      .sticker * { page-break-inside: avoid !important; break-inside: avoid !important; }
      .sticker__inner, .sticker__body, .sticker__text, .sticker__meta, .sticker__footer, .sticker__qr-wrap { display: flex !important; }
      .sticker__qr { width: 44px !important; height: 44px !important; }
      .sticker__qr img { width: 44px !important; height: 44px !important; image-rendering: crisp-edges !important; }
    }
    
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      width: 58mm;
      height: 40mm;
      overflow: hidden;
    }
    
    .stickers { display: block; margin: 0; padding: 0; width: 58mm; height: 40mm; }
    
    .sticker {
      width: 58mm;
      height: 40mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
      border: 0.35mm solid #000;
      background: #fff;
    }
    
    .sticker__inner {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 1.8mm;
      gap: 0;
    }
    
    .sticker__meta {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: baseline;
      font-size: 6.5pt;
      line-height: 1.35;
      color: #333;
      letter-spacing: 0.02em;
      padding-bottom: 1mm;
    }
    
    .sticker__label {
      font-weight: 600;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 0.5mm;
    }
    
    .sticker__meta-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%; }
    
    .sticker__divider {
      height: 0.25mm;
      background: #000;
      margin-bottom: 1.2mm;
      flex-shrink: 0;
    }
    
    .sticker__body {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      justify-content: space-between;
      gap: 2mm;
      flex: 1;
      min-height: 0;
    }
    
    .sticker__text {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .sticker__title {
      font-size: 9.5pt;
      font-weight: 700;
      line-height: 1.2;
      color: #000;
      word-break: break-word;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-bottom: 1mm;
      letter-spacing: 0.01em;
    }
    
    .sticker__footer {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      line-height: 1.3;
      color: #333;
      margin-top: auto;
    }
    
    .sticker__date { font-weight: 500; color: #000; }
    
    .sticker__goal {
      font-weight: 700;
      color: #000;
      padding: 0.4mm 1.2mm;
      border: 0.25mm solid #000;
      border-radius: 0.5mm;
      font-size: 6.5pt;
      letter-spacing: 0.03em;
    }
    
    .sticker__qr-wrap {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border: 0.25mm solid #000;
      border-radius: 1mm;
      padding: 1.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    
    .sticker__qr {
      width: 40px;
      height: 40px;
      display: block;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }

    .manual-text {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 1mm;
    }
  </style>
</head>
<body>
  <div class="stickers">
    ${stickersHtml}
  </div>
</body>
</html>
    `);
    doc.close();
    win.focus();
    setManualStickerOpen(false);
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
      {/* Заголовок страницы */}
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('roasts.roasts')}</h2>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label={t('roasts.tabs')}>
          <button
            type="button"
            onClick={() => setActiveTab('roasts')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'roasts' ? 'border-brand text-brand' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('roasts.tabRoasts').toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'references' ? 'border-brand text-brand' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('roasts.tabReferences').toUpperCase()}
          </button>
        </nav>
      </div>

      {/* Контент вкладки «Референсы» */}
      {activeTab === 'references' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-card border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('roasts.filterOptional')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refType"
                  checked={refFilterType === 'coffee'}
                  onChange={() => setRefFilterType('coffee')}
                  className="text-brand focus:ring-brand"
                />
                {t('roasts.coffee')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refType"
                  checked={refFilterType === 'blend'}
                  onChange={() => setRefFilterType('blend')}
                  className="text-brand focus:ring-brand"
                />
                {t('roasts.blend')}
              </label>
            </div>
            {refFilterType === 'coffee' ? (
              <Select
                value={refCoffeeHrId}
                onChange={(e) => setRefCoffeeHrId(e.target.value)}
                className="min-w-[200px] rounded-input"
              >
                <option value="">{t('roasts.selectCoffeeOption')}</option>
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
                <option value="">{t('roasts.selectBlendOption')}</option>
                {(blendsListData?.items ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
            <Input
              type="text"
              placeholder={t('roasts.machineOptional')}
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
              {t('roasts.refresh')}
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
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.byId')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.date')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.name')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.coffee')} / {t('roasts.blend')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.machine')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.greenWeight')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('roasts.roastedWeight')}</th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap w-14">{t('roasts.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {((referencesData?.data?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
{refCoffeeHrId || refBlendId
                              ? t('roasts.noReferencesByFilter')
                              : t('roasts.noReferences')}
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
                            <td className="py-2 px-4 text-gray-700">{decodeUnicodeEscapes(r.coffee_label ?? r.blend_spec?.label ?? r.coffee_hr_id ?? r.blend_hr_id ?? '—')}</td>
                            <td className="py-2 px-4 text-gray-600 text-xs">{r.machine ?? '—'}</td>
                            <td className="py-2 px-4 text-gray-700">{formatWeight(Number(r.green_weight_kg) || 0)}</td>
                            <td className="py-2 px-4 text-gray-700">
                              {r.roasted_weight_kg != null ? formatWeight(r.roasted_weight_kg) : '—'}
                            </td>
                            <td className="py-2 px-4">
                              {canEditRoasts ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title={t('roasts.removeReference')}
                                  aria-label={t('roasts.removeReference')}
                                  onClick={() => {
                                    if (window.confirm(t('roasts.removeReferenceConfirm'))) {
                                      removeReferenceMutation.mutate(r.id);
                                    }
                                  }}
                                  disabled={removeReferenceMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
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
            placeholder={t('roasts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-input"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setFilterDialogOpen(true)}>
          <Filter className="w-4 h-4" />
          {t('roasts.filters').toUpperCase()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['roasts'] })}
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh').toUpperCase()}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportDialogOpen(true)}>
          <FileDown className="w-4 h-4" />
          {t('roasts.export').toUpperCase()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setManualStickerOpen(true)}
        >
          <Printer className="w-4 h-4" />
          {t('roasts.customSticker').toUpperCase()}
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
            {t('roasts.printStickers').toUpperCase()} ({selectedIds.size})
          </Button>
        )}
        {canEditRoasts && selectedIds.size >= 2 && selectedIds.size <= 10 && (
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
            {t('roasts.compare').toUpperCase()} ({selectedIds.size})
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
                  {t('roasts.displayInList')}
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
                        <span className="text-sm text-gray-800">{t(col.labelKey)}</span>
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
                  {t('roasts.close').toUpperCase()}
                </Button>
              </div>
            </>
          )}
        </div>
        {canEditRoasts && (
          <Button onClick={() => setShowForm(!showForm)} className="ml-auto gap-2">
            <Plus className="w-4 h-4" />
            {t('roasts.addRoast')}
          </Button>
        )}
      </div>

      {/* Диалог фильтров */}
      {filterDialogOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden onClick={() => setFilterDialogOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('roasts.filtersTitle')}</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filter_machine" className="text-sm">1. {t('roasts.byMachine')}</Label>
                <Select
                  id="filter_machine"
                  value={filterMachine}
                  onChange={(e) => setFilterMachine(e.target.value)}
                  className="mt-1 rounded-input"
                >
                  <option value="">{t('roasts.selectMachine')}</option>
                  {myMachines.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </Select>
                {myMachines.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">{t('roasts.addMachinesInSettings')}</p>
                )}
              </div>
              {canEditRoasts && (
                <div>
                  <Label className="text-sm">2. {t('roasts.byCoffeeBlend')}</Label>
                  <div className="mt-1 flex gap-2">
                    <Select
                      value={filterCoffeeId}
                      onChange={(e) => { setFilterCoffeeId(e.target.value); setFilterBlendId(''); }}
                      className="flex-1 rounded-input"
                    >
                      <option value="">{t('roasts.selectCoffee')}</option>
                      {(coffeesData?.data?.items ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.label ?? c.name ?? c.hr_id}</option>
                      ))}
                    </Select>
                    <Select
                      value={filterBlendId}
                      onChange={(e) => { setFilterBlendId(e.target.value); setFilterCoffeeId(''); }}
                      className="flex-1 rounded-input"
                    >
                      <option value="">{t('roasts.selectBlend')}</option>
                      {(blendsListData?.items ?? []).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="filter_roast_name" className="text-sm">{canEditRoasts ? '3' : '2'}. {t('roasts.byRoastName')}</Label>
                <Input
                  id="filter_roast_name"
                  type="text"
                  placeholder={t('roasts.partOfName')}
                  value={filterRoastName}
                  onChange={(e) => setFilterRoastName(e.target.value)}
                  className="mt-1 rounded-input"
                />
              </div>
              <div>
                <Label htmlFor="filter_roast_id" className="text-sm">4. {t('roasts.byId')}</Label>
                <Input
                  id="filter_roast_id"
                  type="text"
                  placeholder={t('roasts.filterIdPlaceholder')}
                  value={filterRoastId}
                  onChange={(e) => setFilterRoastId(e.target.value)}
                  className="mt-1 rounded-input"
                />
              </div>
              <div>
                <Label className="text-sm">5. {t('roasts.byDate')}</Label>
                <div className="mt-1 flex gap-2 items-center">
                  <Input
                    type="date"
                    placeholder={t('roasts.dateFrom')}
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-input"
                  />
                  <span className="text-gray-500">—</span>
                  <Input
                    type="date"
                    placeholder={t('roasts.dateTo')}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-input"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">{t('roasts.sameDateHint')}</p>
              </div>
              <div>
                <Label htmlFor="filter_user" className="text-sm">6. {t('roasts.byUser')}</Label>
                <Select
                  id="filter_user"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="mt-1 rounded-input"
                >
                  <option value="">{t('roasts.selectUser')}</option>
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
                {t('roasts.reset')}
              </Button>
              <Button size="sm" onClick={() => setFilterDialogOpen(false)}>
                {t('roasts.apply')}
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

      {/* Диалог текстовой наклейки */}
      {manualStickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
            onClick={() => setManualStickerOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t('roasts.customStickerTitle')}
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              {t('roasts.customStickerHint')}
            </p>
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="manual_sticker_font" className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t('roasts.customStickerFont')}
                </Label>
                <Select
                  id="manual_sticker_font"
                  value={manualStickerFont}
                  onChange={(e) =>
                    setManualStickerFont(e.target.value as 'sans' | 'serif' | 'mono')
                  }
                  className="rounded-input text-sm"
                >
                  <option value="sans">Sans-serif (Arial)</option>
                  <option value="serif">Serif (Times)</option>
                  <option value="mono">Monospace (Courier)</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual_sticker_font_size" className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t('roasts.customStickerFontSize')}
                </Label>
                <Input
                  id="manual_sticker_font_size"
                  type="number"
                  min={5}
                  max={36}
                  step={0.5}
                  value={manualStickerFontSize}
                  onChange={(e) => setManualStickerFontSize(e.target.value)}
                  className="rounded-input text-sm"
                />
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('roasts.customStickerStyle')}
              </span>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={manualStickerBold}
                    onChange={(e) => setManualStickerBold(e.target.checked)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="font-semibold">{t('roasts.customStickerBold')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={manualStickerItalic}
                    onChange={(e) => setManualStickerItalic(e.target.checked)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="italic">{t('roasts.customStickerItalic')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={manualStickerUnderline}
                    onChange={(e) => setManualStickerUnderline(e.target.checked)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="underline decoration-1">
                    {t('roasts.customStickerUnderline')}
                  </span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual_sticker_text" className="text-sm">
                {t('roasts.customStickerPreviewLabel')}
              </Label>
              <textarea
                id="manual_sticker_text"
                value={manualStickerText}
                onChange={(e) => setManualStickerText(e.target.value)}
                rows={6}
                className="w-full rounded-input border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/40 resize-vertical min-h-[120px]"
              />
            </div>
            <div className="mt-4 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('roasts.customStickerPreview')}
              </span>
              <div
                className="mt-1 rounded-card border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-center text-sm text-gray-900"
                style={{
                  fontFamily:
                    manualStickerFont === 'serif'
                      ? "Georgia, 'Times New Roman', serif"
                      : manualStickerFont === 'mono'
                        ? "'Courier New', Menlo, monospace"
                        : "Arial, Helvetica, sans-serif",
                  fontSize: `${Number(
                    manualStickerFontSize.replace(',', '.')
                  ) || 9.5}pt`,
                  fontWeight: manualStickerBold ? 700 : 400,
                  fontStyle: manualStickerItalic ? 'italic' : 'normal',
                  textDecoration: manualStickerUnderline ? 'underline' : 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {manualStickerText || ' '}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManualStickerOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleManualStickerPrint}>
                {t('roasts.customStickerPrint')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Диалог редактирования обжарки (только user/admin) */}
      {editingRoast && canEditRoasts && (
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
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('roasts.exportRoasts')}</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">{t('roasts.format')}</Label>
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
                <Label className="text-sm">{t('roasts.scope')}</Label>
                <div className="mt-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'page'}
                      onChange={() => setExportScope('page')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">{t('roasts.currentPageRecords').replace('{n}', String(sortedRoasts.length))}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">{t('roasts.allFiltered')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export_scope"
                      checked={exportScope === 'selected'}
                      onChange={() => setExportScope('selected')}
                      className="text-brand focus:ring-brand"
                    />
                    <span className="text-sm">{t('roasts.selectedRecords').replace('{n}', String(selectedIds.size))}</span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {t('roasts.exportFileHint')}
              </p>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exportPending}>
                {exportPending ? t('roasts.loading') : t('roasts.exportButton')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Пагинация: выбор кол-ва на странице */}
      <div className="flex flex-wrap items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('roasts.perPage')}</span>
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
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {totalRoasts === 0
            ? t('roasts.noRecords')
            : t('roasts.showingRange')
                .replace('{from}', String(page * pageSize + 1))
                .replace('{to}', String(Math.min((page + 1) * pageSize, totalRoasts)))
                .replace('{total}', String(totalRoasts))}
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

      {showForm && canEditRoasts && (
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
        <table className="w-full text-xs text-left text-gray-900 dark:text-gray-100">
          <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
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
              <th className="py-2 px-2 w-6 font-medium text-gray-700 dark:text-gray-200" title="Статус целей">
                {/* Цветовой индикатор целей */}
              </th>
              <th className="py-2 px-2 w-14 font-medium text-gray-700 dark:text-gray-200 truncate" title="ID">
                <button
                  type="button"
                  onClick={() => setSortDesc((d) => !d)}
                  className="hover:text-gray-900 dark:hover:text-white flex items-center gap-0.5"
                >
                  ID {sortDesc ? '↓' : '↑'}
                </button>
              </th>
              {visibleColumns.map((col) => (
                <th key={col.id} className="py-2 px-2 font-medium text-gray-700 dark:text-gray-200 truncate" title={t(col.labelKey)}>
                  {t(col.shortLabelKey)}
                </th>
              ))}
              <th className="py-2 px-2 w-10 font-medium text-gray-700 dark:text-gray-200 truncate">{t('roasts.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedRoasts.length === 0 ? (
              <tr>
                <td colSpan={4 + visibleColumns.length} className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery.trim() ? t('roasts.noSearchResults') : t('roasts.noRoastsToDisplay')}
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
                    return <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap truncate block" title={formatDateTimeTable(roastDate)}>{formatDateTimeTable(roastDate)}</span>;
                  case 'name': {
                    const nameVal = roast.title ?? roast.label ?? '—';
                    const blendVal = roast.blend_spec?.label ?? roast.blend_hr_id ?? '';
                    const coffeeVal = roast.coffee_id && !roast.blend_id ? (roast.coffee_label ?? '') : '';
                    const subVal = blendVal || coffeeVal;
                    const subDisplay = decodeUnicodeEscapes(subVal);
                    if (!canEditRoasts) {
                      return (
                        <div className="truncate" title={[nameVal, subDisplay].filter(Boolean).join(' / ')}>
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{nameVal}</span>
                          {subDisplay && <span className="text-gray-500 dark:text-gray-400 truncate block">{subDisplay}</span>}
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1"
                        title={t('roasts.clickToEdit')}
                      >
                        <div className="truncate" title={[nameVal, subDisplay].filter(Boolean).join(' / ')}>
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{nameVal}</span>
                          {subDisplay && <span className="text-gray-500 dark:text-gray-400 truncate block">{subDisplay}</span>}
                        </div>
                      </button>
                    );
                  }
                  case 'warehouse':
                    return <span className="text-gray-700 dark:text-gray-300 truncate block" title={roast.location_hr_id ?? ''}>{roast.location_hr_id ?? '—'}</span>;
                  case 'machine':
                    if (!canEditRoasts) return <span className="text-gray-600 dark:text-gray-300 truncate block">{roast.machine ?? '—'}</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-600 dark:text-gray-300"
                        title={t('roasts.clickToEdit')}
                      >
                        {roast.machine ?? '—'}
                      </button>
                    );
                  case 'user':
                    if (!canEditRoasts) return <span className="text-gray-600 dark:text-gray-300 truncate block">{roast.operator ?? '—'}</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full truncate hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-600 dark:text-gray-300"
                        title={t('roasts.clickToEdit')}
                      >
                        {roast.operator ?? '—'}
                      </button>
                    );
                  case 'green_weight':
                    if (!canEditRoasts) return <span className="text-gray-700 dark:text-gray-200">{formatWeight(Number(roast.green_weight_kg) || 0)}</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-700 dark:text-gray-200"
                        title={t('roasts.clickToEdit')}
                      >
                        {formatWeight(Number(roast.green_weight_kg) || 0)}
                      </button>
                    );
                  case 'roasted_weight':
                    if (!canEditRoasts) return <span className="text-gray-700 dark:text-gray-200">{roast.roasted_weight_kg != null ? formatWeight(roast.roasted_weight_kg) : '—'}</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setEditingRoast(roast)}
                        className="text-left w-full hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 text-gray-700 dark:text-gray-200"
                        title={t('roasts.clickToEdit')}
                      >
                        {roast.roasted_weight_kg != null ? formatWeight(roast.roasted_weight_kg) : '—'}
                      </button>
                    );
                  case 'shrinkage':
                    return loss != null ? <span className="text-gray-600 dark:text-gray-300">{formatPercent(loss)}</span> : '—';
                  case 'dtr': {
                    const devTime = roast.DEV_time != null ? formatTimeMMSS(roast.DEV_time) : null;
                    const devPct = roast.DEV_ratio != null ? formatPercent(roast.DEV_ratio) : null;
                    if (!devTime && !devPct) return <span className="text-gray-700 dark:text-gray-300">—</span>;
                    const text = devTime && devPct ? `${devTime} (${devPct})` : (devTime ?? devPct ?? '—');
                    return <span className="text-gray-700 dark:text-gray-200" title={t('roasts.devTimeTitle')}>{text}</span>;
                  }
                  case 'bean_color':
                    return <span className="text-gray-600 dark:text-gray-300">{roast.whole_color != null && roast.whole_color !== 0 ? String(roast.whole_color) : '—'}</span>;
                  case 'grind_color':
                    return <span className="text-gray-600 dark:text-gray-300">{roast.ground_color != null && roast.ground_color !== 0 ? String(roast.ground_color) : '—'}</span>;
                  case 'coffee': {
                    const coffeeVal = roast.coffee_label ?? roast.blend_spec?.label ?? roast.coffee_hr_id ?? roast.label ?? '—';
                    const displayVal = decodeUnicodeEscapes(coffeeVal);
                    return <span className="text-gray-700 dark:text-gray-200 truncate block" title={displayVal}>{displayVal}</span>;
                  }
                  case 'rating':
                    if (!canEditRoasts) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                    return (
                      <button type="button" className="p-1 text-gray-500 dark:text-gray-400 hover:text-brand" title={t('roasts.ratingTitle')}>
                        <Pencil className="w-4 h-4" />
                      </button>
                    );
                  case 'quality_control':
                    if (!canEditRoasts) {
                      return (
                        <div className="flex items-center justify-center">
                          <span className="text-gray-500 dark:text-gray-400" title={t('roasts.qualityControl')}>
                            {roast.in_quality_control ? '✓' : '—'}
                          </span>
                        </div>
                      );
                    }
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
                          title={t('roasts.inQC')}
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
                <tr key={roast.id} className="hover:bg-brand-light/50 dark:hover:bg-white/5 transition-colors">
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
                            ? t('roasts.goalsStatusGreen')
                            : goalsStatus === 'red'
                            ? t('roasts.goalsStatusRed')
                            : t('roasts.goalsStatusYellow')
                        }
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    <Link to={`/roasts/${roast.id}`} className="font-medium text-brand dark:text-qq-amber hover:underline truncate block">
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
                      canEdit={canEditRoasts}
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
