import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachinesCatalog, getMyMachines, addMachine, removeMachine, type UserMachine } from '@/api/machines';
import { authApi } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/store/authStore';
import { settingsStore, type Theme, type Language, type DateFormat, type WeightFormat, type TempFormat, type DefaultPageSize } from '@/store/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Settings, Plus, Trash2, User, Bell, Palette, Info, LogOut, Cpu, Target, Users } from 'lucide-react';
import { GoalsTab } from '@/components/Goals/GoalsTab';

type SettingsTab = 'machines' | 'profile' | 'notifications' | 'interface' | 'goals' | 'about' | 'users';

const TABS: { id: SettingsTab; label: string; icon: typeof Cpu; adminOnly?: boolean }[] = [
  { id: 'machines', label: 'Машины', icon: Cpu },
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'notifications', label: 'Оповещения', icon: Bell },
  { id: 'interface', label: 'Интерфейс', icon: Palette },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'about', label: 'О приложении', icon: Info },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('machines');
  const [newMachineName, setNewMachineName] = useState('');
  const [addFromCatalog, setAddFromCatalog] = useState('');
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const email = authStore((s) => s.email);
  const isAdmin = authStore((s) => s.role === 'admin');

  const { data: catalog = [] } = useQuery({
    queryKey: ['machines', 'catalog'],
    queryFn: getMachinesCatalog,
  });

  const { data: myMachines = [] } = useQuery({
    queryKey: ['machines', 'my'],
    queryFn: getMyMachines,
  });

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.getMe(),
    enabled: activeTab === 'profile',
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => addMachine(name),
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

  const displayEmail = meData?.data?.email ?? email ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Setting
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Машины, профиль, интерфейс и другие параметры</p>
      </div>

      {/* Табы */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200 dark:border-gray-700 pb-2">
        {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
          const Icon = tab.icon;
          const isUsersTab = tab.id === 'users';
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id && !isUsersTab ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (isUsersTab) {
                  navigate('/users');
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Контент вкладок */}
      {activeTab === 'machines' && (
        <Card>
          <CardHeader>
            <CardTitle>Мои машины</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Машины, на которых вы жарите. Используются при создании эталонных профилей и в расписании.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="block mb-2">Добавить из каталога Artisan</Label>
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={addFromCatalog}
                  onChange={(e) => setAddFromCatalog(e.target.value)}
                  className="min-w-[200px]"
                >
                  <option value="">— Выберите машину —</option>
                  {catalog
                    .filter((name) => !myMachines.some((m) => m.name === name))
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </Select>
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
      )}

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Информация об учётной записи и выход из системы.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {meData?.data?.username != null && meData.data.username !== '' && (
              <div>
                <Label className="block mb-2">Username</Label>
                <p className="text-gray-900 font-medium">{meData.data.username}</p>
              </div>
            )}
            <div>
              <Label className="block mb-2">Email</Label>
              <p className="text-gray-900 font-medium">{displayEmail}</p>
            </div>
            <div className="pt-4 border-t">
              <Button variant="outline" onClick={logout} className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50">
                <LogOut className="w-4 h-4 mr-2" />
                Выйти из аккаунта
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Оповещения</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Управление уведомлениями в реальном времени (WebSocket) и звуковыми сигналами.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <NotificationsSettings />
          </CardContent>
        </Card>
      )}

      {activeTab === 'interface' && (
        <Card>
          <CardHeader>
            <CardTitle>Интерфейс</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Язык, тема, форматы даты, веса, температуры и размер списка по умолчанию.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <InterfaceSettings />
          </CardContent>
        </Card>
      )}

      {activeTab === 'goals' && (
        <Card>
          <CardHeader>
            <CardTitle>Цели обжарки</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Настройка целей для сравнения обжаренных батчей с референсными профилями. Установите параметры и допуски для контроля качества обжарки.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <GoalsTab />
          </CardContent>
        </Card>
      )}

      {activeTab === 'about' && (
        <Card>
          <CardHeader>
            <CardTitle>О приложении</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              Информация о Artisan+ Local Server.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="font-medium text-gray-900">Artisan+ Local Server</p>
              <p className="text-sm text-gray-600">
                Версия фронтенда: <strong>1.0.0</strong>
              </p>
              <p className="text-sm text-gray-600">
                Совместим с Artisan — настольным приложением для профилирования обжарки кофе.
              </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600">
                Подключение Artisan: укажите URL сервера в настройках Artisan (например, <code className="bg-gray-100 px-1 rounded">http://localhost:8000</code>).
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function NotificationsSettings() {
  const wsNotifications = settingsStore((s) => s.wsNotifications);
  const soundNotifications = settingsStore((s) => s.soundNotifications);
  const setWsNotifications = settingsStore((s) => s.setWsNotifications);
  const setSoundNotifications = settingsStore((s) => s.setSoundNotifications);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="block font-medium">WebSocket-уведомления</Label>
          <p className="text-sm text-gray-500">Получать push-уведомления о расписании и новых обжарках</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={wsNotifications}
            onChange={(e) => setWsNotifications(e.target.checked)}
            className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
          />
          <span className="text-sm">Включено</span>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="block font-medium">Звуковые уведомления</Label>
          <p className="text-sm text-gray-500">Воспроизводить звук при новых событиях</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soundNotifications}
            onChange={(e) => setSoundNotifications(e.target.checked)}
            className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
          />
          <span className="text-sm">Включено</span>
        </label>
      </div>
    </div>
  );
}

function InterfaceSettings() {
  const theme = settingsStore((s) => s.theme);
  const language = settingsStore((s) => s.language);
  const dateFormat = settingsStore((s) => s.dateFormat);
  const weightFormat = settingsStore((s) => s.weightFormat);
  const tempFormat = settingsStore((s) => s.tempFormat);
  const defaultPageSize = settingsStore((s) => s.defaultPageSize);

  const setTheme = settingsStore((s) => s.setTheme);
  const setLanguage = settingsStore((s) => s.setLanguage);
  const setDateFormat = settingsStore((s) => s.setDateFormat);
  const setWeightFormat = settingsStore((s) => s.setWeightFormat);
  const setTempFormat = settingsStore((s) => s.setTempFormat);
  const setDefaultPageSize = settingsStore((s) => s.setDefaultPageSize);

  return (
    <div className="space-y-6">
      <div>
        <Label className="block mb-2">Тема</Label>
        <Select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
          <option value="system">Системная</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">Язык</Label>
        <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">Формат даты</Label>
        <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
          <option value="dd.MM.yyyy">DD.MM.YYYY</option>
          <option value="yyyy-MM-dd">YYYY-MM-DD</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">Единицы веса</Label>
        <Select value={weightFormat} onChange={(e) => setWeightFormat(e.target.value as WeightFormat)}>
          <option value="kg">кг</option>
          <option value="lb">lb</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">Единицы температуры</Label>
        <Select value={tempFormat} onChange={(e) => setTempFormat(e.target.value as TempFormat)}>
          <option value="C">°C</option>
          <option value="F">°F</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">Размер списка по умолчанию (Roasts)</Label>
        <Select value={String(defaultPageSize)} onChange={(e) => setDefaultPageSize(Number(e.target.value) as DefaultPageSize)}>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="500">500</option>
        </Select>
      </div>
    </div>
  );
}
