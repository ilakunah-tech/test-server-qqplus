import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Coffee } from '@/types/api';
import { useTranslation } from '@/hooks/useTranslation';

interface AddCoffeeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CoffeeFormData) => void;
  /** If provided, dialog is in edit mode */
  coffee?: Coffee | null;
  isPending?: boolean;
  /** Pre-fill the origin field (e.g. when adding from a country card) */
  defaultOrigin?: string;
}

export interface CoffeeFormData {
  label: string;
  origin?: string;
  region?: string;
  variety?: string;
  processing?: string;
  moisture?: number;
  density?: number;
  water_activity?: number;
}

export const AddCoffeeDialog = ({
  open,
  onClose,
  onSubmit,
  coffee,
  isPending = false,
  defaultOrigin,
}: AddCoffeeDialogProps) => {
  const { t } = useTranslation();
  const isEdit = !!coffee;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: CoffeeFormData = {
      label: fd.get('label') as string,
      origin: (fd.get('origin') as string) || undefined,
      region: (fd.get('region') as string) || undefined,
      variety: (fd.get('variety') as string) || undefined,
      processing: (fd.get('processing') as string) || undefined,
      moisture: fd.get('moisture') ? parseFloat(fd.get('moisture') as string) : undefined,
      density: fd.get('density') ? parseFloat(fd.get('density') as string) : undefined,
      water_activity: fd.get('water_activity') ? parseFloat(fd.get('water_activity') as string) : undefined,
    };
    onSubmit(data);
  };

  const originDefault = coffee?.origin ?? defaultOrigin ?? '';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 py-8"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
      <div className="relative w-full max-w-lg mx-4 rounded-card border border-stone-200/60 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-xl animate-scale-in">
        <h3 className="mb-5 text-lg font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? t('coffeeDialog.editTitle') : t('coffeeDialog.addTitle')}
        </h3>

        <form key={coffee?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-5">
          {/* ── Main info ── */}
          <div>
            <Label htmlFor="cd_label" className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              {t('coffeeDialog.name')} *
            </Label>
            <Input
              id="cd_label"
              name="label"
              required
              defaultValue={coffee?.label ?? coffee?.name ?? ''}
              className="mt-1 rounded-lg"
              placeholder={t('coffeeDialog.namePlaceholder')}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cd_origin" className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {t('coffeeDialog.origin')}
              </Label>
              <Input
                id="cd_origin"
                name="origin"
                defaultValue={originDefault}
                className="mt-1 rounded-lg"
                placeholder="Бразилия, Эфиопия..."
              />
            </div>
            <div>
              <Label htmlFor="cd_region" className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {t('coffeeDialog.region')}
              </Label>
              <Input
                id="cd_region"
                name="region"
                defaultValue={coffee?.region ?? ''}
                className="mt-1 rounded-lg"
                placeholder="Серрадо, Иргачеффе..."
              />
            </div>
            <div>
              <Label htmlFor="cd_variety" className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {t('coffeeDialog.variety')}
              </Label>
              <Input
                id="cd_variety"
                name="variety"
                defaultValue={coffee?.variety ?? ''}
                className="mt-1 rounded-lg"
              />
            </div>
            <div>
              <Label htmlFor="cd_processing" className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {t('coffeeDialog.processing')}
              </Label>
              <Input
                id="cd_processing"
                name="processing"
                defaultValue={coffee?.processing ?? ''}
                className="mt-1 rounded-lg"
                placeholder="Мытая, Натуральная..."
              />
            </div>
          </div>

          {/* ── F/C data ── */}
          <div className="pt-2 border-t border-stone-100 dark:border-white/5">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
              {t('coffeeDialog.physChemTitle')}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cd_moisture" className="text-xs text-gray-500">
                  {t('coffeeDialog.moisture')} (%)
                </Label>
                <Input
                  id="cd_moisture"
                  name="moisture"
                  type="number"
                  step="0.1"
                  defaultValue={coffee?.moisture ?? ''}
                  className="mt-1 rounded-lg"
                  placeholder="10.5"
                />
              </div>
              <div>
                <Label htmlFor="cd_density" className="text-xs text-gray-500">
                  {t('coffeeDialog.density')} (г/л)
                </Label>
                <Input
                  id="cd_density"
                  name="density"
                  type="number"
                  step="0.01"
                  defaultValue={coffee?.density ?? ''}
                  className="mt-1 rounded-lg"
                  placeholder="720"
                />
              </div>
              <div>
                <Label htmlFor="cd_water_activity" className="text-xs text-gray-500">
                  Aw
                </Label>
                <Input
                  id="cd_water_activity"
                  name="water_activity"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  defaultValue={coffee?.water_activity ?? ''}
                  className="mt-1 rounded-lg"
                  placeholder="0.50"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isEdit ? t('common.save') : t('coffeeDialog.create')}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
};
