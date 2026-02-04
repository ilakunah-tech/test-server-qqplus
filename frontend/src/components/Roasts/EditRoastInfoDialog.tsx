import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyMachines } from '@/api/machines';
import { authApi } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Roast } from '@/types/api';

interface EditRoastInfoDialogProps {
  roast: Roast;
  onClose: () => void;
  onSubmit: (data: {
    green_weight_kg?: number;
    roasted_weight_kg?: number;
    label?: string;
    machine?: string;
    operator?: string;
    email?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function EditRoastInfoDialog({
  roast,
  onClose,
  onSubmit,
  isSubmitting,
}: EditRoastInfoDialogProps) {
  const [greenWeight, setGreenWeight] = useState<string>(
    roast.green_weight_kg != null ? String(roast.green_weight_kg) : ''
  );
  const [roastedWeight, setRoastedWeight] = useState<string>(
    roast.roasted_weight_kg != null ? String(roast.roasted_weight_kg) : ''
  );
  const [label, setLabel] = useState(roast.label ?? roast.title ?? '');
  const [machine, setMachine] = useState(roast.machine ?? '');
  const [operator, setOperator] = useState(roast.operator ?? '');
  const [email, setEmail] = useState(roast.email ?? '');

  const { data: myMachines = [] } = useQuery({
    queryKey: ['machines', 'my'],
    queryFn: getMyMachines,
  });
  const { data: usersRes } = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: () => authApi.getUsers(),
  });
  const users = usersRes?.data ?? [];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const gw = parseFloat(greenWeight);
    const rw = roastedWeight.trim() ? parseFloat(roastedWeight) : undefined;
    if (isNaN(gw) || gw < 0) {
      alert('Укажите корректный начальный вес (кг).');
      return;
    }
    if (rw != null && (isNaN(rw) || rw < 0)) {
      alert('Укажите корректный конечный вес (кг).');
      return;
    }
    await onSubmit({
      green_weight_kg: gw,
      roasted_weight_kg: rw,
      label: label.trim() || undefined,
      machine: machine.trim() || undefined,
      operator: operator.trim() || undefined,
      email: email.trim() || undefined,
    });
  };

  const selectUser = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (u) {
      setOperator(u.email);
      setEmail(u.email);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card
        className="w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Редактировать обжарку</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-label">Название обжарки</Label>
              <Input
                id="edit-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Название батча"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-green">Зелёное зерно (кг)</Label>
                <Input
                  id="edit-green"
                  type="number"
                  step="0.01"
                  min="0"
                  value={greenWeight}
                  onChange={(e) => setGreenWeight(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-roasted">Жаренное зерно (кг)</Label>
                <Input
                  id="edit-roasted"
                  type="number"
                  step="0.01"
                  min="0"
                  value={roastedWeight}
                  onChange={(e) => setRoastedWeight(e.target.value)}
                  placeholder="—"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-machine">Машина</Label>
              <Input
                id="edit-machine"
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                placeholder="Название машины"
                list="edit-machine-list"
                className="mt-1"
              />
              <datalist id="edit-machine-list">
                {myMachines.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="edit-operator">Оператор / Пользователь</Label>
              <select
                id="edit-operator-user"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (v) selectUser(v);
                }}
                className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">— Выберите пользователя —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
              <Input
                id="edit-operator"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Имя оператора"
                className="mt-1"
              />
              <Input
                id="edit-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (необязательно)"
                type="email"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
