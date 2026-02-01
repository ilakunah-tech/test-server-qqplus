import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachinesCatalog, getMyMachines, addMachine, removeMachine, type UserMachine } from '@/api/machines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Plus, Trash2 } from 'lucide-react';

export const SettingsPage = () => {
  const [newMachineName, setNewMachineName] = useState('');
  const [addFromCatalog, setAddFromCatalog] = useState('');
  const queryClient = useQueryClient();

  const { data: catalog = [] } = useQuery({
    queryKey: ['machines', 'catalog'],
    queryFn: getMachinesCatalog,
  });

  const { data: myMachines = [] } = useQuery({
    queryKey: ['machines', 'my'],
    queryFn: getMyMachines,
  });

  const addMutation = useMutation({
    mutationFn: addMachine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', 'my'] });
      setNewMachineName('');
      setAddFromCatalog('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeMachine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', 'my'] });
    },
  });

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMachineName.trim();
    if (!name) return;
    addMutation.mutate(name);
  };

  const handleAddFromCatalog = () => {
    const name = addFromCatalog.trim();
    if (!name) return;
    addMutation.mutate(name);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Настройки
        </h2>
        <p className="text-gray-600 mt-1">Машины организации и другие параметры</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Мои машины</CardTitle>
          <p className="text-sm text-gray-500 font-normal">
            Машины, на которых вы жарите. Они используются при создании эталонных профилей и в расписании.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="block mb-2">Добавить из каталога Artisan</Label>
            <div className="flex gap-2 flex-wrap">
              <select
                className="border rounded px-3 py-2 min-w-[200px]"
                value={addFromCatalog}
                onChange={(e) => setAddFromCatalog(e.target.value)}
              >
                <option value="">— Выберите машину —</option>
                {catalog
                  .filter((name) => !myMachines.some((m) => m.name === name))
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                onClick={handleAddFromCatalog}
                disabled={!addFromCatalog.trim() || addMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>
          </div>

          <div>
            <Label className="block mb-2">Или введите название вручную</Label>
            <form onSubmit={handleAddCustom} className="flex gap-2">
              <Input
                value={newMachineName}
                onChange={(e) => setNewMachineName(e.target.value)}
                placeholder="Например: Besca BSC-15"
                className="max-w-xs"
              />
              <Button type="submit" disabled={!newMachineName.trim() || addMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </form>
          </div>

          {addMutation.isError && (
            <p className="text-sm text-red-600">
              {(addMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Ошибка добавления'}
            </p>
          )}

          <div>
            <Label className="block mb-2">Машины в организации ({myMachines.length})</Label>
            {myMachines.length === 0 ? (
              <p className="text-gray-500 text-sm">Пока нет машин. Добавьте из каталога или введите название.</p>
            ) : (
              <ul className="border rounded divide-y">
                {myMachines.map((m: UserMachine) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="font-medium">{m.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMutation.mutate(m.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
