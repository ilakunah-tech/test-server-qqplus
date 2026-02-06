import { useState, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/api/inventory';
import type { Coffee } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, FileDown, Pencil, RefreshCw,
  ChevronDown, ChevronRight, Save, X, Droplets,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { authStore } from '@/store/authStore';
import { AddCoffeeDialog, type CoffeeFormData } from '@/components/shared/AddCoffeeDialog';

/* ═══════════════════════════ HELPERS ═══════════════════════════ */

function groupByOrigin(coffees: Coffee[]): Record<string, Coffee[]> {
  const out: Record<string, Coffee[]> = {};
  coffees.forEach((c) => {
    const key = c.origin || 'Без страны';
    (out[key] ??= []).push(c);
  });
  return out;
}

/* ═══════════════════════ EDIT DRAFT ═══════════════════════════ */

interface DraftRow {
  label: string;
  moisture: string;
  density: string;
  waterActivity: string;
}

/* ═══════════════════════════ COMPONENT ═══════════════════════ */

export const GreenBeanDataPage = () => {
  const { t } = useTranslation();
  const role = authStore((s) => s.role);
  const canEdit = role === 'user' || role === 'admin';
  const queryClient = useQueryClient();

  /* ── data ── */
  const { data: coffeesData, isLoading } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(),
  });
  const coffees: Coffee[] = coffeesData?.data?.items ?? [];

  /* ── UI state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  /* ── add coffee dialog ── */
  const [showAddCoffee, setShowAddCoffee] = useState(false);
  const [addCoffeeOrigin, setAddCoffeeOrigin] = useState('');

  /* ── edit mode ── */
  const [isEditMode, setIsEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});

  /* ── mutations ── */
  const createCoffeeMutation = useMutation({
    mutationFn: inventoryApi.createCoffee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
      setShowAddCoffee(false);
    },
  });

  const updateCoffeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Coffee> }) =>
      inventoryApi.updateCoffee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
    },
  });

  /* ── derived ── */
  const filtered = searchQuery.trim()
    ? coffees.filter((c) =>
        (c.label ?? c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.origin ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : coffees;
  const grouped = groupByOrigin(filtered);

  /* ── toggles ── */
  const toggle = (s: Set<string>, k: string) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; };
  const toggleCountry = (c: string) => setExpandedCountries((p) => toggle(p, c));
  const expandAll = () => setExpandedCountries(new Set(Object.keys(grouped)));
  const collapseAll = () => setExpandedCountries(new Set());

  /* ── add coffee ── */
  const handleAddCoffee = useCallback((data: CoffeeFormData) => {
    createCoffeeMutation.mutate(data);
  }, [createCoffeeMutation]);

  const openAddCoffeeForCountry = (origin: string) => {
    setAddCoffeeOrigin(origin);
    setShowAddCoffee(true);
  };

  /* ═══════════ EDIT MODE ═══════════ */

  const enterEditMode = useCallback(() => {
    setExpandedCountries(new Set(Object.keys(groupByOrigin(coffees))));
    const d: Record<string, DraftRow> = {};
    coffees.forEach((c) => {
      d[c.id] = {
        label: c.label ?? c.name ?? '',
        moisture: c.moisture != null ? String(c.moisture) : '',
        density: c.density != null ? String(c.density) : '',
        waterActivity: c.water_activity != null ? String(c.water_activity) : '',
      };
    });
    setDrafts(d);
    setIsEditMode(true);
  }, [coffees]);

  const cancelEditMode = () => {
    setIsEditMode(false);
    setDrafts({});
  };

  const saveEditMode = useCallback(async () => {
    // Find what changed and save
    const promises: Promise<unknown>[] = [];
    coffees.forEach((c) => {
      const draft = drafts[c.id];
      if (!draft) return;
      const updates: Partial<Coffee> = {};
      const oldLabel = c.label ?? c.name ?? '';
      if (draft.label !== oldLabel) updates.label = draft.label;
      const newMoist = draft.moisture ? parseFloat(draft.moisture) : undefined;
      if (newMoist !== c.moisture) updates.moisture = newMoist as number;
      const newDens = draft.density ? parseFloat(draft.density) : undefined;
      if (newDens !== c.density) updates.density = newDens as number;
      const newAw = draft.waterActivity ? parseFloat(draft.waterActivity) : undefined;
      if (newAw !== c.water_activity) updates.water_activity = newAw as number;
      if (Object.keys(updates).length > 0) {
        promises.push(inventoryApi.updateCoffee(c.id, updates));
      }
    });
    if (promises.length > 0) {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
    }
    setIsEditMode(false);
    setDrafts({});
  }, [coffees, drafts, queryClient]);

  const setDraft = (id: string, field: keyof DraftRow, val: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], [field]: val } }));

  /* ── value cell ── */
  const valCell = (val: number | null | undefined) => (
    <span className={val != null ? 'text-gray-800 dark:text-gray-200 font-medium tabular-nums' : 'text-gray-400 dark:text-gray-600'}>
      {val != null ? val : '—'}
    </span>
  );

  const editInput = (id: string, field: keyof DraftRow, placeholder: string) => (
    <Input
      type="number"
      step="0.01"
      placeholder={placeholder}
      value={drafts[id]?.[field] ?? ''}
      onChange={(e) => setDraft(id, field, e.target.value)}
      className="w-20 text-center text-sm rounded-lg border-brand/30 focus:border-brand bg-brand-light/30 dark:bg-brand-light/10 py-1 px-2 h-8"
    />
  );

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
      {/* ─── HEADER ─── */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t('greenBeanData.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('greenBeanData.subtitle')}
        </p>
      </div>

      {/* ─── TOOLBAR ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder={t('greenBeanData.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-input"
            disabled={isEditMode}
          />
        </div>
        {!isEditMode && (
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={expandAll}>
              <ChevronDown className="w-4 h-4" />
              {t('greenBeanData.expandAll')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={collapseAll}>
              <ChevronRight className="w-4 h-4" />
              {t('greenBeanData.collapseAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['coffees'] })}
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.refresh')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileDown className="w-4 h-4" />
              {t('common.export')}
            </Button>
            {canEdit && (
              <Button size="sm" className="gap-2 ml-auto" onClick={enterEditMode}>
                <Pencil className="w-4 h-4" />
                {t('greenBeanData.updateData')}
              </Button>
            )}
          </>
        )}
        {isEditMode && (
          <>
            <Button size="sm" className="gap-2 ml-auto" onClick={saveEditMode}>
              <Save className="w-4 h-4" />
              {t('greenBeanData.saveAll')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={cancelEditMode}>
              <X className="w-4 h-4" />
              {t('common.cancel')}
            </Button>
          </>
        )}
      </div>

      {/* edit-mode banner */}
      {isEditMode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-light/40 to-transparent border border-brand/20 text-sm text-brand dark:text-qq-amber">
          <Pencil className="w-4 h-4 shrink-0" />
          <span>{t('greenBeanData.editModeHint')}</span>
        </div>
      )}

      {/* loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* ─── COUNTRY CARDS ─── */}
      {!isLoading && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([country, items]) => {
            const isExpanded = expandedCountries.has(country);

            return (
              <Card key={country} className={isEditMode ? 'ring-1 ring-brand/20' : ''}>
                <CardHeader
                  className="cursor-pointer hover:bg-stone-50/50 dark:hover:bg-white/[0.02] transition-colors py-4"
                  onClick={() => !isEditMode && toggleCountry(country)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="w-5 h-5 text-brand/60" />
                      : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-light/60 to-brand-light/20 text-brand font-bold text-sm">
                      {country.slice(0, 2).toUpperCase()}
                    </span>
                    <CardTitle className="text-lg">{country}</CardTitle>
                    <span className="text-xs font-medium text-gray-400 bg-stone-100 dark:bg-white/5 rounded-full px-2.5 py-0.5">
                      {items.length} {t('greenBeanData.coffees')}
                    </span>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="p-0 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-stone-100 to-stone-50 dark:from-slate-700/60 dark:to-slate-700/40 border-y border-stone-200/60 dark:border-white/5">
                            <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap sticky left-0 bg-stone-100 dark:bg-slate-700/60 z-10 min-w-[200px]">
                              {t('greenBeanData.coffeeName')}
                            </th>
                            <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {t('coffeeDialog.region')}
                            </th>
                            <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {t('coffeeDialog.processing')}
                            </th>
                            <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-stone-200/60 dark:border-white/5">
                              <div className="flex items-center justify-center gap-1">
                                <Droplets className="w-3.5 h-3.5" />
                                {t('greenBeanData.moisture')} %
                              </div>
                            </th>
                            <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {t('greenBeanData.density')} г/л
                            </th>
                            <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              Aw
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((c, idx) => (
                            <tr
                              key={c.id}
                              className={`group transition-colors ${
                                idx % 2 === 0
                                  ? 'bg-white dark:bg-slate-800/60'
                                  : 'bg-stone-50/50 dark:bg-slate-800/30'
                              } hover:bg-brand-light/20 dark:hover:bg-brand-light/5`}
                            >
                              <td className={`py-2.5 px-3 whitespace-nowrap sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800/60' : 'bg-stone-50/50 dark:bg-slate-800/30'} group-hover:bg-brand-light/20 dark:group-hover:bg-brand-light/5 transition-colors`}>
                                {isEditMode ? (
                                  <Input
                                    value={drafts[c.id]?.label ?? c.label ?? c.name ?? ''}
                                    onChange={(e) => setDraft(c.id, 'label', e.target.value)}
                                    className="text-sm font-medium rounded-lg h-8 min-w-[180px] border-stone-200 dark:border-white/10"
                                  />
                                ) : (
                                  <div>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{c.label ?? c.name}</span>
                                    <div className="text-[10px] text-gray-400">{c.hr_id}</div>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs">{c.region ?? '—'}</td>
                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs">{c.processing ?? '—'}</td>
                              <td className="py-2.5 px-3 text-center border-l border-stone-100 dark:border-white/[0.03]">
                                {isEditMode
                                  ? editInput(c.id, 'moisture', '%')
                                  : valCell(c.moisture)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isEditMode
                                  ? editInput(c.id, 'density', 'г/л')
                                  : valCell(c.density)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isEditMode
                                  ? editInput(c.id, 'waterActivity', 'Aw')
                                  : valCell(c.water_activity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ── add coffee in country ── */}
                    {canEdit && !isEditMode && (
                      <div className="px-4 py-3 border-t border-stone-100 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => openAddCoffeeForCountry(country)}
                          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {t('greenBeanData.addLot')}
                        </button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {Object.keys(grouped).length === 0 && !isLoading && (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
              {searchQuery.trim() ? t('greenBeanData.noSearchResults') : t('greenBeanData.noData')}
            </div>
          )}
        </div>
      )}

      {/* ── Add country (bottom) ── */}
      {canEdit && !isEditMode && !isLoading && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => { setAddCoffeeOrigin(''); setShowAddCoffee(true); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-brand border-2 border-dashed border-stone-200/60 dark:border-white/10 hover:border-brand/40 rounded-xl px-5 py-4 transition-all w-full justify-center hover:bg-brand-light/10"
          >
            <Plus className="w-4 h-4" />
            {t('greenBeanData.addCoffee')}
          </button>
        </div>
      )}

      {/* ── Unified Add Coffee Dialog ── */}
      <AddCoffeeDialog
        open={showAddCoffee}
        onClose={() => setShowAddCoffee(false)}
        onSubmit={handleAddCoffee}
        isPending={createCoffeeMutation.isPending}
        defaultOrigin={addCoffeeOrigin}
      />
    </div>
  );
};
