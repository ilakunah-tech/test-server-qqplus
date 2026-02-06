import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionTasksApi, ProductionTask, ProductionTaskCreateInput } from '@/api/productionTasks';
import { getMyMachines } from '@/api/machines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Clock, Hash, Calendar, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/formatters';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
];

export const ProductionTasksPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [taskType, setTaskType] = useState<'schedule' | 'counter' | 'one_time'>('schedule');
  const queryClient = useQueryClient();

  const { data: tasksData } = useQuery({
    queryKey: ['production-tasks'],
    queryFn: () => productionTasksApi.getTasks(),
  });

  const { data: machinesData } = useQuery({
    queryKey: ['machines'],
    queryFn: getMyMachines,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: ProductionTaskCreateInput) => productionTasksApi.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductionTaskCreateInput> }) =>
      productionTasksApi.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
      setEditingTask(null);
      resetForm();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => productionTasksApi.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productionTasksApi.updateTask(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
    },
  });

  const resetForm = () => {
    setTaskType('schedule');
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const baseData: ProductionTaskCreateInput = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || undefined,
      notification_text: formData.get('notification_text') as string,
      task_type: taskType,
      is_active: formData.get('is_active') === 'true',
    };

    if (taskType === 'schedule') {
      baseData.schedule_day_of_week = parseInt(formData.get('schedule_day_of_week') as string);
      baseData.schedule_time = formData.get('schedule_time') as string;
      baseData.machine_id = (formData.get('machine_id') as string) || undefined;
    } else if (taskType === 'counter') {
      baseData.counter_trigger_value = parseInt(formData.get('counter_trigger_value') as string);
      baseData.counter_reset_on_trigger = formData.get('counter_reset_on_trigger') === 'true';
      baseData.machine_id = formData.get('machine_id') as string;
    } else if (taskType === 'one_time') {
      baseData.scheduled_date = formData.get('scheduled_date') as string;
      baseData.scheduled_time = (formData.get('scheduled_time') as string) || undefined;
      const repeatDays = formData.get('repeat_after_days') as string;
      baseData.repeat_after_days = repeatDays ? parseInt(repeatDays) : undefined;
      baseData.machine_id = (formData.get('machine_id') as string) || undefined;
    }

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: baseData });
    } else {
      createTaskMutation.mutate(baseData);
    }
  };

  const tasks = tasksData?.items ?? [];
  const machines = machinesData ?? [];

  const startEdit = (task: ProductionTask) => {
    setEditingTask(task);
    setTaskType(task.task_type);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Production Tasks</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Управление производственными задачами и напоминаниями</p>
        </div>
        <div className="flex gap-2">
          <Link to="/production-tasks/history">
            <Button variant="outline" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              История
            </Button>
          </Link>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Создать задачу
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTask ? 'Редактировать задачу' : 'Создать задачу'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="task_type">Тип задачи</Label>
                <Select
                  id="task_type"
                  name="task_type"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  required
                >
                  <option value="schedule">По расписанию (еженедельно)</option>
                  <option value="counter">По счетчику (после N ростов)</option>
                  <option value="one_time">Одноразовая задача</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingTask?.title}
                  required
                  placeholder="Например: Почистить ростер"
                />
              </div>

              <div>
                <Label htmlFor="description">Описание (необязательно)</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={editingTask?.description || ''}
                  placeholder="Дополнительная информация"
                />
              </div>

              <div>
                <Label htmlFor="notification_text">Текст уведомления</Label>
                <Input
                  id="notification_text"
                  name="notification_text"
                  defaultValue={editingTask?.notification_text}
                  required
                  placeholder="Текст, который будет показан в уведомлении"
                />
              </div>

              {taskType === 'schedule' && (
                <>
                  <div>
                    <Label htmlFor="schedule_day_of_week">День недели</Label>
                    <Select
                      id="schedule_day_of_week"
                      name="schedule_day_of_week"
                      defaultValue={editingTask?.schedule_day_of_week?.toString()}
                      required
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="schedule_time">Время</Label>
                    <Input
                      id="schedule_time"
                      name="schedule_time"
                      type="time"
                      defaultValue={editingTask?.schedule_time?.substring(0, 5)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="machine_id_schedule">Ростер (необязательно)</Label>
                    <Select
                      id="machine_id_schedule"
                      name="machine_id"
                      defaultValue={editingTask?.machine_id || ''}
                    >
                      <option value="">Все ростера</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              {taskType === 'counter' && (
                <>
                  <div>
                    <Label htmlFor="counter_trigger_value">Количество ростов для срабатывания</Label>
                    <Input
                      id="counter_trigger_value"
                      name="counter_trigger_value"
                      type="number"
                      min="1"
                      defaultValue={editingTask?.counter_trigger_value}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="machine_id_counter">Ростер</Label>
                    <Select
                      id="machine_id_counter"
                      name="machine_id"
                      defaultValue={editingTask?.machine_id || ''}
                      required
                    >
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="counter_reset_on_trigger"
                      name="counter_reset_on_trigger"
                      value="true"
                      defaultChecked={editingTask?.counter_reset_on_trigger !== false}
                    />
                    <Label htmlFor="counter_reset_on_trigger" className="cursor-pointer">
                      Сбрасывать счетчик после срабатывания
                    </Label>
                  </div>
                </>
              )}

              {taskType === 'one_time' && (
                <>
                  <div>
                    <Label htmlFor="scheduled_date">Дата</Label>
                    <Input
                      id="scheduled_date"
                      name="scheduled_date"
                      type="date"
                      defaultValue={editingTask?.scheduled_date}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduled_time">Время (необязательно)</Label>
                    <Input
                      id="scheduled_time"
                      name="scheduled_time"
                      type="time"
                      defaultValue={editingTask?.scheduled_time?.substring(0, 5)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="repeat_after_days">Повторять через N дней (необязательно)</Label>
                    <Input
                      id="repeat_after_days"
                      name="repeat_after_days"
                      type="number"
                      min="1"
                      defaultValue={editingTask?.repeat_after_days}
                      placeholder="Оставьте пустым для одноразовой задачи"
                    />
                  </div>
                  <div>
                    <Label htmlFor="machine_id_one_time">Ростер (необязательно)</Label>
                    <Select
                      id="machine_id_one_time"
                      name="machine_id"
                      defaultValue={editingTask?.machine_id || ''}
                    >
                      <option value="">Все ростера</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  value="true"
                  defaultChecked={editingTask?.is_active !== false}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Активна
                </Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createTaskMutation.isPending || updateTaskMutation.isPending}>
                  {editingTask ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{task.title}</h3>
                    {task.task_type === 'schedule' && <Clock className="w-4 h-4 text-blue-500" />}
                    {task.task_type === 'counter' && <Hash className="w-4 h-4 text-green-500" />}
                    {task.task_type === 'one_time' && <Calendar className="w-4 h-4 text-purple-500" />}
                    {!task.is_active && (
                      <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        Неактивна
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.description}</p>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    <strong>Уведомление:</strong> {task.notification_text}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    {task.task_type === 'schedule' && (
                      <>
                        <span>
                          День: {DAYS_OF_WEEK.find((d) => d.value === task.schedule_day_of_week)?.label}
                        </span>
                        <span>Время: {task.schedule_time?.substring(0, 5)}</span>
                      </>
                    )}
                    {task.task_type === 'counter' && (
                      <>
                        <span>
                          Срабатывание: каждые {task.counter_trigger_value} ростов
                        </span>
                        <span>Текущий счетчик: {task.counter_current_value}</span>
                        {task.machine_name && <span>Ростер: {task.machine_name}</span>}
                      </>
                    )}
                    {task.task_type === 'one_time' && (
                      <>
                        <span>Дата: {task.scheduled_date && formatDate(task.scheduled_date)}</span>
                        {task.scheduled_time && <span>Время: {task.scheduled_time.substring(0, 5)}</span>}
                        {task.repeat_after_days && (
                          <span>Повтор: каждые {task.repeat_after_days} дней</span>
                        )}
                      </>
                    )}
                  </div>
                  {task.last_triggered_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Последнее срабатывание: {new Date(task.last_triggered_at).toLocaleString('ru-RU')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: task.id, isActive: !task.is_active })}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {task.is_active ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(task)}
                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Удалить задачу?')) {
                        deleteTaskMutation.mutate(task.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              Нет созданных задач. Создайте первую задачу, нажав кнопку "Создать задачу".
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
