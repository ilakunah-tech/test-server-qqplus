import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi, type RoastGoal, type GoalParameterConfig } from '@/api/goals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

const PARAMETER_LABELS: Record<string, { label: string; unit: string; type: 'temp' | 'time' | 'percent' | 'weight' }> = {
  charge_temp: { label: 'Температура загрузки', unit: '°C', type: 'temp' },
  drop_temp: { label: 'Температура выгрузки', unit: '°C', type: 'temp' },
  TP_temp: { label: 'Точка разворота', unit: '°C', type: 'temp' },
  total_time: { label: 'Общее время обжарки', unit: 'сек', type: 'time' },
  FCs_time: { label: 'Время первого крэка', unit: 'сек', type: 'time' },
  DEV_time: { label: 'Время развития', unit: 'сек', type: 'time' },
  DEV_ratio: { label: 'Процент времени развития (DTR)', unit: 'п.п.', type: 'percent' },
  DRY_time: { label: 'Время сушки', unit: 'сек', type: 'time' },
  green_weight_kg: { label: 'Начальный вес', unit: 'кг', type: 'weight' },
  roasted_weight_kg: { label: 'Конечный вес', unit: 'кг', type: 'weight' },
  weight_loss: { label: 'Ужарка', unit: 'п.п.', type: 'percent' },
  whole_color: { label: 'Цвет зерна', unit: '', type: 'temp' },
  ground_color: { label: 'Цвет помола', unit: '', type: 'temp' },
};

export const GoalsTab = () => {
  const [editingGoal, setEditingGoal] = useState<RoastGoal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [enabledParams, setEnabledParams] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading, error: goalsError } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      try {
        const result = await goalsApi.getGoals();
        console.log('Goals loaded:', result);
        return result;
      } catch (error) {
        console.error('Error loading goals:', error);
        throw error;
      }
    },
  });
  
  // Log goals error
  if (goalsError) {
    console.error('Goals query error:', goalsError);
  }

  const createMutation = useMutation({
    mutationFn: goalsApi.createGoal,
    onSuccess: async (data) => {
      console.log('Goal created successfully:', data);
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
      await queryClient.refetchQueries({ queryKey: ['goals'] });
      setShowForm(false);
      setEditingGoal(null);
      setEnabledParams(new Set());
    },
    onError: (error: any) => {
      console.error('Error creating goal:', error);
      alert(error?.response?.data?.detail || error?.message || 'Ошибка создания цели');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: Partial<RoastGoal> }) =>
      goalsApi.updateGoal(goalId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
      await queryClient.refetchQueries({ queryKey: ['goals'] });
      setEditingGoal(null);
      setShowForm(false);
      setEnabledParams(new Set());
    },
    onError: (error: any) => {
      console.error('Error updating goal:', error);
      alert(error?.response?.data?.detail || error?.message || 'Ошибка обновления цели');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: goalsApi.deleteGoal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
      await queryClient.refetchQueries({ queryKey: ['goals'] });
    },
    onError: (error: any) => {
      console.error('Error deleting goal:', error);
      alert(error?.response?.data?.detail || error?.message || 'Ошибка удаления цели');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const goalType = formData.get('goal_type') as string;
    const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';
    const failedStatus = formData.get('failed_status') as 'failed' | 'warning';
    const missingValueStatus = formData.get('missing_value_status') as 'failed' | 'warning';

    const parameters: Record<string, GoalParameterConfig> = {};
    Object.keys(PARAMETER_LABELS).forEach((paramKey) => {
      const enabled = formData.get(`param_${paramKey}_enabled`) === 'on';
      if (enabled) {
        const toleranceStr = (formData.get(`param_${paramKey}_tolerance`) as string) || '';
        // Заменяем запятую на точку для парсинга (русская локаль использует запятую)
        const tolerance = parseFloat(toleranceStr.replace(',', '.')) || 0;
        if (tolerance > 0) {
          parameters[paramKey] = { enabled: true, tolerance };
        }
      }
    });

    const goalData = {
      name,
      goal_type: goalType,
      is_active: isActive,
      failed_status: failedStatus,
      missing_value_status: missingValueStatus,
      parameters,
    };

    console.log('Submitting goal data:', goalData);

    if (editingGoal) {
      updateMutation.mutate({
        goalId: editingGoal.id,
        data: goalData,
      });
    } else {
      createMutation.mutate(goalData);
    }
  };

  const handleEdit = (goal: RoastGoal) => {
    setEditingGoal(goal);
    setShowForm(true);
    // Set enabled params from goal
    const enabled = new Set<string>();
    Object.entries(goal.parameters || {}).forEach(([key, config]) => {
      // Handle both GoalParameterConfig objects and plain dicts
      const isEnabled = typeof config === 'object' && config !== null
        ? (config.enabled ?? (config as any).enabled ?? false)
        : false;
      if (isEnabled) {
        enabled.add(key);
      }
    });
    setEnabledParams(enabled);
  };

  const handleDelete = (goalId: string) => {
    if (window.confirm('Удалить эту цель?')) {
      deleteMutation.mutate(goalId);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingGoal(null);
    setEnabledParams(new Set());
  };

  const toggleParamEnabled = (paramKey: string, enabled: boolean) => {
    const newEnabled = new Set(enabledParams);
    if (enabled) {
      newEnabled.add(paramKey);
    } else {
      newEnabled.delete(paramKey);
    }
    setEnabledParams(newEnabled);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Загрузка целей...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Цели обжарки</h3>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingGoal(null);
            setEnabledParams(new Set());
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать цель
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingGoal ? 'Редактировать цель' : 'Создать новую цель'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Наименование *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingGoal?.name}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="goal_type">Тип</Label>
                <Select
                  id="goal_type"
                  name="goal_type"
                  defaultValue={editingGoal?.goal_type || 'match_reference'}
                  className="mt-1"
                >
                  <option value="match_reference">Соответствие референсу</option>
                </Select>
              </div>

              <div>
                <Label>Статус обжарки при не пройденной цели</Label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="failed_status"
                      value="failed"
                      defaultChecked={editingGoal?.failed_status === 'failed' || !editingGoal}
                    />
                    Неуспешная
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="failed_status"
                      value="warning"
                      defaultChecked={editingGoal?.failed_status === 'warning'}
                    />
                    Предупреждение
                  </label>
                </div>
              </div>

              <div>
                <Label>Статус обжарки при отсутствии значения</Label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="missing_value_status"
                      value="failed"
                      defaultChecked={editingGoal?.missing_value_status === 'failed'}
                    />
                    Неуспешная
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="missing_value_status"
                      value="warning"
                      defaultChecked={editingGoal?.missing_value_status === 'warning' || !editingGoal}
                    />
                    Предупреждение
                  </label>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={editingGoal?.is_active !== false}
                  />
                  Цель активна
                </Label>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Параметры</h4>
                <div className="space-y-4">
                  {Object.entries(PARAMETER_LABELS).map(([paramKey, paramInfo]) => {
                    const paramConfig = editingGoal?.parameters?.[paramKey];
                    // Handle both GoalParameterConfig objects and plain dicts
                    const paramEnabled = typeof paramConfig === 'object' && paramConfig !== null
                      ? (paramConfig.enabled ?? (paramConfig as any).enabled ?? false)
                      : false;
                    const paramTolerance = typeof paramConfig === 'object' && paramConfig !== null
                      ? (paramConfig.tolerance ?? (paramConfig as any).tolerance ?? 0)
                      : 0;
                    const isEnabled = enabledParams.has(paramKey) || paramEnabled;
                    const tolerance = paramTolerance;

                    return (
                      <div key={paramKey} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id={`param_${paramKey}_enabled`}
                            name={`param_${paramKey}_enabled`}
                            checked={isEnabled}
                            onChange={(e) => toggleParamEnabled(paramKey, e.target.checked)}
                          />
                          <Label htmlFor={`param_${paramKey}_enabled`} className="font-medium">
                            {paramInfo.label}
                          </Label>
                        </div>
                        {isEnabled && (
                          <div className="flex-1 flex items-center gap-2">
                            <Label htmlFor={`param_${paramKey}_tolerance`} className="text-sm text-gray-600 whitespace-nowrap">
                              Допуск:
                            </Label>
                            <Input
                              id={`param_${paramKey}_tolerance`}
                              name={`param_${paramKey}_tolerance`}
                              type="number"
                              step="0.1"
                              defaultValue={tolerance || ''}
                              placeholder="10"
                              className="w-32"
                            />
                            <span className="text-sm text-gray-500">
                              {paramInfo.unit}
                              {tolerance > 0 && ` (±${(tolerance / 2).toFixed(1)}${paramInfo.unit})`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingGoal ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {goals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Нет созданных целей. Создайте первую цель для проверки обжарок.
          </div>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{goal.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {goal.is_active ? (
                        <span className="text-green-600">Активна</span>
                      ) : (
                        <span className="text-gray-400">Неактивна</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(goal)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(goal.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Тип:</span>{' '}
                    <span className="font-medium">{goal.goal_type === 'match_reference' ? 'Соответствие референсу' : goal.goal_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">При не пройденной цели:</span>{' '}
                    <span className="font-medium">{goal.failed_status === 'failed' ? 'Неуспешная' : 'Предупреждение'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">При отсутствии значения:</span>{' '}
                    <span className="font-medium">{goal.missing_value_status === 'failed' ? 'Неуспешная' : 'Предупреждение'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-gray-600 font-medium">Параметры:</span>
                    <div className="mt-2 space-y-1">
                  {Object.entries(goal.parameters || {}).map(([paramKey, paramConfig]) => {
                    // Handle both GoalParameterConfig objects and plain dicts
                    const enabled = typeof paramConfig === 'object' && paramConfig !== null 
                      ? (paramConfig.enabled ?? (paramConfig as any).enabled ?? false)
                      : false;
                    if (!enabled) return null;
                    const tolerance = typeof paramConfig === 'object' && paramConfig !== null
                      ? (paramConfig.tolerance ?? (paramConfig as any).tolerance ?? 0)
                      : 0;
                    const paramInfo = PARAMETER_LABELS[paramKey];
                    return (
                      <div key={paramKey} className="text-sm pl-4">
                        • {paramInfo?.label || paramKey}: допуск {tolerance}{paramInfo?.unit || ''} (±{tolerance / 2}{paramInfo?.unit || ''})
                      </div>
                    );
                  })}
                      {Object.entries(goal.parameters || {}).filter(([_, config]) => {
                        const enabled = typeof config === 'object' && config !== null
                          ? (config.enabled ?? (config as any).enabled ?? false)
                          : false;
                        return enabled;
                      }).length === 0 && (
                        <div className="text-sm text-gray-400 pl-4">Нет включенных параметров</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
