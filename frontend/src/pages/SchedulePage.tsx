import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '@/api/schedule';
import { inventoryApi } from '@/api/inventory';
import { roastsApi } from '@/api/roasts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Check, X, Trash2, ExternalLink, RotateCcw } from 'lucide-react';
import { formatDate, roastDisplayId } from '@/utils/formatters';
import { Schedule } from '@/types/api';

export const SchedulePage = () => {
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [coffeeFilter, setCoffeeFilter] = useState('');
  const [completeScheduleId, setCompleteScheduleId] = useState<string | null>(null);
  const [selectedRoastId, setSelectedRoastId] = useState('');
  const queryClient = useQueryClient();

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', dateFrom, dateTo, coffeeFilter],
    queryFn: () =>
      scheduleApi.getSchedule(
        dateFrom || undefined,
        dateTo || undefined,
        coffeeFilter || undefined
      ),
  });

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => inventoryApi.getBatches(),
  });

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', 'for-schedule'],
    queryFn: () => roastsApi.getRoasts(200, 0),
  });

  const createScheduleMutation = useMutation({
    mutationFn: scheduleApi.createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setShowForm(false);
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Schedule> }) =>
      scheduleApi.updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const completeScheduleMutation = useMutation({
    mutationFn: ({ id, roastId }: { id: string; roastId: string }) =>
      scheduleApi.completeSchedule(id, { roast_id: roastId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      setCompleteScheduleId(null);
      setSelectedRoastId('');
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: scheduleApi.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const coffeeId = (formData.get('coffee_id') as string) || undefined;
    const coffee = coffeesData?.data.items.find((c) => c.id === coffeeId);
    const coffeeLabel = coffee?.label || coffee?.name || 'Roast';
    const weight = formData.get('scheduled_weight_kg') as string;
    const title =
      (formData.get('title') as string)?.trim() || `${coffeeLabel}${weight ? ` - ${weight} kg` : ''}`;

    createScheduleMutation.mutate({
      title,
      scheduled_date: formData.get('scheduled_date') as string,
      scheduled_weight_kg: weight ? parseFloat(weight) : undefined,
      coffee_id: coffeeId,
      batch_id: (formData.get('batch_id') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    });
  };

  const scheduleItems = scheduleData?.data.items ?? [];
  const roasts = roastsData?.data.items ?? [];
  const coffees = coffeesData?.data.items ?? [];
  const batches = batchesData?.data.items ?? [];

  const getCoffeeLabel = (coffeeId: string | undefined) => {
    if (!coffeeId) return null;
    const c = coffees.find((x) => x.id === coffeeId);
    return c?.label || c?.name || null;
  };

  const getRoastForSchedule = (scheduleId: string) =>
    roasts.find((r) => r.schedule_id === scheduleId);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCoffeeFilter('');
  };

  const hasActiveFilters = dateFrom || dateTo || coffeeFilter;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your roast schedule</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <Label htmlFor="date_from" className="text-sm">Дата от</Label>
            <Input
              id="date_from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full min-w-[140px]"
            />
          </div>
          <div>
            <Label htmlFor="date_to" className="text-sm">Дата до</Label>
            <Input
              id="date_to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full min-w-[140px]"
            />
          </div>
          <div>
            <Label htmlFor="coffee_filter" className="text-sm">Зерно</Label>
            <Select
              id="coffee_filter"
              value={coffeeFilter}
              onChange={(e) => setCoffeeFilter(e.target.value)}
              className="mt-1 min-w-[200px]"
            >
              <option value="">— Все —</option>
              {coffees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? c.name ?? c.hr_id}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Сбросить фильтры
          </Button>
        )}
        <Button onClick={() => setShowForm(!showForm)} className="ml-auto gap-2">
          <Plus className="w-4 h-4" />
          Add Schedule
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coffee_id">Coffee</Label>
                  <Select id="coffee_id" name="coffee_id" className="mt-1">
                    <option value="">Select coffee (optional)</option>
                    {coffees.map((coffee) => (
                      <option key={coffee.id} value={coffee.id}>
                        {coffee.label || coffee.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batch_id">Batch (Optional)</Label>
                  <Select id="batch_id" name="batch_id" className="mt-1">
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.lot_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g. Ethiopia Yirgacheffe - 2 kg"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="scheduled_date">Date *</Label>
                  <Input id="scheduled_date" name="scheduled_date" type="date" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="scheduled_weight_kg">Weight (kg)</Label>
                  <Input
                    id="scheduled_weight_kg"
                    name="scheduled_weight_kg"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="2.5"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional notes" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createScheduleMutation.isPending}>
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

      <div className="rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Дата</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Название / Зерно</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Вес (кг)</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Батч</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Статус</th>
              <th className="px-4 py-3 w-40 font-semibold text-gray-900 dark:text-gray-100">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {scheduleItems.map((schedule) => {
              const coffeeLabel = getCoffeeLabel(schedule.coffee_id);
              const batch = batches.find((b) => b.id === schedule.batch_id);
              const linkedRoast = getRoastForSchedule(schedule.id);

              return (
                <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatDate(schedule.scheduled_date)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {schedule.title || coffeeLabel || 'Scheduled roast'}
                      </span>
                      {coffeeLabel && schedule.title !== coffeeLabel && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{coffeeLabel}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {schedule.scheduled_weight_kg != null && schedule.scheduled_weight_kg > 0
                      ? `${schedule.scheduled_weight_kg}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {batch ? batch.lot_number : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        schedule.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                          : schedule.status === 'cancelled'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {schedule.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setCompleteScheduleId(completeScheduleId === schedule.id ? null : schedule.id)}
                            title="Complete"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() =>
                              updateScheduleMutation.mutate({
                                id: schedule.id,
                                data: { status: 'cancelled' },
                              })
                            }
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (window.confirm('Удалить эту запись из расписания?')) {
                                deleteScheduleMutation.mutate(schedule.id);
                              }
                            }}
                            disabled={deleteScheduleMutation.isPending}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {schedule.status === 'completed' && linkedRoast && (
                        <Link to={`/roasts/${linkedRoast.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" title="View roast">
                            <ExternalLink className="w-4 h-4" />
                            Roast
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {completeScheduleId && (
          <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-4 py-4">
            {scheduleItems
              .filter((s) => s.id === completeScheduleId)
              .map((schedule) => (
                <div key={schedule.id} className="flex flex-wrap items-center gap-3">
                  <Label className="font-medium">Привязать обжарку:</Label>
                  <Select
                    value={selectedRoastId}
                    onChange={(e) => setSelectedRoastId(e.target.value)}
                    className="min-w-[220px]"
                  >
                    <option value="">Выберите обжарку...</option>
                    {roasts
                      .filter((r) => !r.schedule_id || r.schedule_id === schedule.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label || r.title || (roastDisplayId(r) !== '—' ? roastDisplayId(r) : 'Обжарка')} —{' '}
                          {formatDate(r.roasted_at)}
                        </option>
                      ))}
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedRoastId || completeScheduleMutation.isPending}
                    onClick={() =>
                      selectedRoastId &&
                      completeScheduleMutation.mutate({
                        id: schedule.id,
                        roastId: selectedRoastId,
                      })
                    }
                  >
                    Связать и завершить
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCompleteScheduleId(null);
                      setSelectedRoastId('');
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              ))}
          </div>
        )}

        {scheduleItems.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            Нет записей в расписании. Добавьте запись или измените фильтры.
          </p>
        )}
      </div>
    </div>
  );
};
