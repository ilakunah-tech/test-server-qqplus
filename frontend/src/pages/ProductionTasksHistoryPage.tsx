import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productionTasksApi,
  ProductionTaskSnoozeInput,
} from '@/api/productionTasks';
import { getMyMachines } from '@/api/machines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Check, Clock, Hash, Calendar, CheckCircle2, BellOff } from 'lucide-react';

export const ProductionTasksHistoryPage = () => {
  const [taskFilter, setTaskFilter] = useState<string>('');
  const [machineFilter, setMachineFilter] = useState<string>('');
  const [completedOnly, setCompletedOnly] = useState<boolean>(false);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [snoozeHours, setSnoozeHours] = useState<number>(1);
  const queryClient = useQueryClient();

  const { data: historyData } = useQuery({
    queryKey: ['production-tasks-history', taskFilter, machineFilter, completedOnly],
    queryFn: () =>
      productionTasksApi.getHistory(
        taskFilter || undefined,
        machineFilter || undefined,
        completedOnly || undefined
      ),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['production-tasks'],
    queryFn: () => productionTasksApi.getTasks(),
  });

  const { data: machinesData } = useQuery({
    queryKey: ['machines'],
    queryFn: getMyMachines,
  });

  const markCompletedMutation = useMutation({
    mutationFn: (historyId: string) => productionTasksApi.markCompleted(historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks-history'] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ historyId, data }: { historyId: string; data: ProductionTaskSnoozeInput }) =>
      productionTasksApi.snoozeTask(historyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks-history'] });
      setSnoozingId(null);
    },
  });

  const handleSnooze = (historyId: string) => {
    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + snoozeHours);
    snoozeMutation.mutate({
      historyId,
      data: { snooze_until: snoozeUntil.toISOString() },
    });
  };

  const historyItems = historyData?.data.items ?? [];
  const tasks = tasksData?.data.items ?? [];
  const machines = machinesData ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">История задач</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">История выполненных производственных задач</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="task_filter">Задача</Label>
              <Select
                id="task_filter"
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
              >
                <option value="">Все задачи</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="machine_filter">Ростер</Label>
              <Select
                id="machine_filter"
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
              >
                <option value="">Все ростера</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="completed_only"
                checked={completedOnly}
                onChange={(e) => setCompletedOnly(e.target.checked)}
              />
              <Label htmlFor="completed_only" className="cursor-pointer">
                Только выполненные
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {historyItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    {item.task_type === 'schedule' && <Clock className="w-4 h-4 text-blue-500" />}
                    {item.task_type === 'counter' && <Hash className="w-4 h-4 text-green-500" />}
                    {item.task_type === 'one_time' && <Calendar className="w-4 h-4 text-purple-500" />}
                    {item.marked_completed_at && (
                      <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Выполнено
                      </span>
                    )}
                    {item.snoozed_until && new Date(item.snoozed_until) > new Date() && (
                      <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded flex items-center gap-1">
                        <BellOff className="w-3 h-3" />
                        Отложено до {new Date(item.snoozed_until).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {item.notification_text}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      Сработало: {new Date(item.triggered_at).toLocaleString('ru-RU')}
                    </span>
                    {item.machine_name && <span>Ростер: {item.machine_name}</span>}
                    {item.trigger_reason && (
                      <span>
                        Причина: {
                          item.trigger_reason === 'schedule_time'
                            ? 'По расписанию'
                            : item.trigger_reason === 'counter_reached'
                            ? 'Счетчик достигнут'
                            : item.trigger_reason === 'one_time_date'
                            ? 'Одноразовая задача'
                            : item.trigger_reason
                        }
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!item.marked_completed_at && (
                    <>
                      {snoozingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="168"
                            value={snoozeHours}
                            onChange={(e) => setSnoozeHours(parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <span className="text-sm">ч</span>
                          <Button
                            size="sm"
                            onClick={() => handleSnooze(item.id)}
                            disabled={snoozeMutation.isPending}
                          >
                            Отложить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSnoozingId(null)}
                          >
                            Отмена
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSnoozingId(item.id)}
                          >
                            <BellOff className="w-4 h-4 mr-1" />
                            Отложить
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => markCompletedMutation.mutate(item.id)}
                            disabled={markCompletedMutation.isPending}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Выполнено
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {historyItems.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              Нет записей в истории.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
