import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/api/inventory';
import { Coffee } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, PackagePlus } from 'lucide-react';
import { formatWeight } from '@/utils/formatters';

export const InventoryPage = () => {
  const [showCoffeeForm, setShowCoffeeForm] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState<Coffee | null>(null);
  const [arrivalCoffee, setArrivalCoffee] = useState<Coffee | null>(null);
  const queryClient = useQueryClient();

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(),
  });

  const createCoffeeMutation = useMutation({
    mutationFn: inventoryApi.createCoffee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
      setShowCoffeeForm(false);
    },
  });

  const updateCoffeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Coffee> }) =>
      inventoryApi.updateCoffee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
      setEditingCoffee(null);
      setShowCoffeeForm(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка обновления');
    },
  });

  const deleteCoffeeMutation = useMutation({
    mutationFn: inventoryApi.deleteCoffee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка удаления');
    },
  });

  const addStockMutation = useMutation({
    mutationFn: ({ id, weightKg }: { id: string; weightKg: number }) =>
      inventoryApi.addCoffeeStock(id, weightKg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
      setArrivalCoffee(null);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка прихода');
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCoffeeForm(false);
        setEditingCoffee(null);
        setArrivalCoffee(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleCoffeeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      label: formData.get('label') as string,
      origin: (formData.get('origin') as string) || undefined,
      region: (formData.get('region') as string) || undefined,
      variety: (formData.get('variety') as string) || undefined,
      processing: (formData.get('processing') as string) || undefined,
      moisture: formData.get('moisture') ? parseFloat(formData.get('moisture') as string) : undefined,
      density: formData.get('density') ? parseFloat(formData.get('density') as string) : undefined,
      water_activity: formData.get('water_activity') ? parseFloat(formData.get('water_activity') as string) : undefined,
    };
    if (editingCoffee) {
      updateCoffeeMutation.mutate({ id: editingCoffee.id, data });
    } else {
      createCoffeeMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Green Bean</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your coffee beans and batches</p>
      </div>

      {
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Coffees</h3>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditingCoffee(null); setShowCoffeeForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Coffee
              </Button>
            </div>
          </div>

          {(showCoffeeForm || editingCoffee) && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/30"
                aria-hidden
                onClick={() => { setShowCoffeeForm(false); setEditingCoffee(null); }}
              />
              <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 shadow-xl">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {editingCoffee ? 'Редактировать зелёное зерно' : 'Добавить зелёное зерно'}
                </h3>
                <form key={editingCoffee?.id ?? 'new'} onSubmit={handleCoffeeSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="label">Наименование *</Label>
                      <Input
                        id="label"
                        name="label"
                        required
                        defaultValue={editingCoffee?.label ?? editingCoffee?.name ?? ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="origin">Происхождение</Label>
                      <Input id="origin" name="origin" defaultValue={editingCoffee?.origin ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="region">Регион</Label>
                      <Input id="region" name="region" defaultValue={editingCoffee?.region ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="variety">Сорт</Label>
                      <Input id="variety" name="variety" defaultValue={editingCoffee?.variety ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="processing">Обработка</Label>
                      <Input id="processing" name="processing" defaultValue={editingCoffee?.processing ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="moisture">Влажность (%)</Label>
                      <Input id="moisture" name="moisture" type="number" step="0.1" defaultValue={editingCoffee?.moisture ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="density">Плотность (г/л)</Label>
                      <Input id="density" name="density" type="number" step="0.01" defaultValue={editingCoffee?.density ?? ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="water_activity">Водная активность (aw)</Label>
                      <Input id="water_activity" name="water_activity" type="number" step="0.01" min="0" max="1" defaultValue={editingCoffee?.water_activity ?? ''} className="mt-1" placeholder="0.00–1.00" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowCoffeeForm(false); setEditingCoffee(null); }}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={createCoffeeMutation.isPending || updateCoffeeMutation.isPending}>
                      {editingCoffee ? 'Сохранить' : 'Создать'}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          {arrivalCoffee && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/30"
                aria-hidden
                onClick={() => setArrivalCoffee(null)}
              />
              <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 shadow-xl">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Приход зерна</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {arrivalCoffee.label ?? arrivalCoffee.name} ({arrivalCoffee.hr_id})
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const kg = parseFloat((fd.get('weight_kg') as string) || '0');
                    if (kg > 0) {
                      addStockMutation.mutate({ id: arrivalCoffee.id, weightKg: kg });
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="weight_kg">Вес, кг *</Label>
                    <Input
                      id="weight_kg"
                      name="weight_kg"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    На складе: {formatWeight(Number(arrivalCoffee.stock_weight_kg) || 0)}
                  </p>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={() => setArrivalCoffee(null)}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={addStockMutation.isPending}>
                      Добавить
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          <div className="rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">ID / Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">На складе</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Origin</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Region</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Variety</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Processing</th>
                  <th className="px-4 py-3 w-28 font-semibold text-gray-900 dark:text-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {coffeesData?.data.items.map((coffee) => (
                  <tr key={coffee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{coffee.label ?? coffee.name}</span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{coffee.hr_id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-green-700 dark:text-green-400">
                      {formatWeight(Number(coffee.stock_weight_kg) || 0)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{coffee.origin ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{coffee.region ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{coffee.variety ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{coffee.processing ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setArrivalCoffee(coffee)}
                          title="Приход"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditingCoffee(coffee); setShowCoffeeForm(true); }}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm('Удалить это зелёное зерно?')) {
                              deleteCoffeeMutation.mutate(coffee.id);
                            }
                          }}
                          disabled={deleteCoffeeMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  );
};
