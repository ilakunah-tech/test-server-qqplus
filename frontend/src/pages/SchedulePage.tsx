import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '@/api/schedule';
import { inventoryApi } from '@/api/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Check, X } from 'lucide-react';
import { formatDateTime } from '@/utils/formatters';
import { Schedule } from '@/types/api';

export const SchedulePage = () => {
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const queryClient = useQueryClient();

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', dateFrom, dateTo],
    queryFn: () => scheduleApi.getSchedule(dateFrom || undefined, dateTo || undefined),
  });

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => inventoryApi.getBatches(),
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createScheduleMutation.mutate({
      coffee_id: formData.get('coffee_id') as string,
      batch_id: formData.get('batch_id') ? (formData.get('batch_id') as string) : undefined,
      planned_date: new Date(formData.get('planned_date') as string).toISOString(),
      notes: formData.get('notes') as string || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Schedule</h2>
          <p className="text-gray-600 mt-1">Manage your roast schedule</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      <div className="flex gap-4">
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
            <CardTitle>Add New Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coffee_id">Coffee *</Label>
                  <Select id="coffee_id" name="coffee_id" required>
                    <option value="">Select coffee</option>
                    {coffeesData?.data.items.map((coffee) => (
                      <option key={coffee.id} value={coffee.id}>
                        {coffee.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batch_id">Batch (Optional)</Label>
                  <Select id="batch_id" name="batch_id">
                    <option value="">Select batch</option>
                    {batchesData?.data.items.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.lot_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="planned_date">Planned Date *</Label>
                  <Input id="planned_date" name="planned_date" type="datetime-local" required />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
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

      <div className="space-y-4">
        {scheduleData?.data.items.map((schedule) => {
          const coffee = coffeesData?.data.items.find(c => c.id === schedule.coffee_id);
          const batch = batchesData?.data.items.find(b => b.id === schedule.batch_id);
          return (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{coffee?.name || 'Unknown Coffee'}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDateTime(schedule.planned_date)}
                      {batch && ` • ${batch.lot_number}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-button text-sm font-medium ${
                      schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                      schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {schedule.status}
                    </span>
                    {schedule.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateScheduleMutation.mutate({
                            id: schedule.id,
                            data: { status: 'cancelled' },
                          })}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              {schedule.notes && (
                <CardContent>
                  <p className="text-sm text-gray-600">{schedule.notes}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
