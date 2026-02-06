import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachinesCatalog, getMyMachines, addMachine, removeMachine, type UserMachine } from '@/api/machines';
import { authApi } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/store/authStore';
import { settingsStore, type DateFormat, type WeightFormat, type TempFormat, type DefaultPageSize } from '@/store/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Settings, Plus, Trash2, User, Bell, Palette, Info, LogOut, Cpu, Target, Users } from 'lucide-react';
import { GoalsTab } from '@/components/Goals/GoalsTab';
import { useTranslation } from '@/hooks/useTranslation';

type SettingsTab = 'machines' | 'profile' | 'notifications' | 'interface' | 'goals' | 'about' | 'users';

const TABS: { id: SettingsTab; labelKey: string; icon: typeof Cpu; adminOnly?: boolean }[] = [
  { id: 'machines', labelKey: 'settings.machines', icon: Cpu },
  { id: 'profile', labelKey: 'settings.profile', icon: User },
  { id: 'notifications', labelKey: 'settings.notifications', icon: Bell },
  { id: 'interface', labelKey: 'settings.interface', icon: Palette },
  { id: 'goals', labelKey: 'settings.goals', icon: Target },
  { id: 'about', labelKey: 'settings.about', icon: Info },
  { id: 'users', labelKey: 'users.users', icon: Users, adminOnly: true },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('machines');
  const [newMachineName, setNewMachineName] = useState('');
  const [addFromCatalog, setAddFromCatalog] = useState('');
  const [changePwdCurrent, setChangePwdCurrent] = useState('');
  const [changePwdNew, setChangePwdNew] = useState('');
  const [changePwdConfirm, setChangePwdConfirm] = useState('');
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const email = authStore((s) => s.email);
  const isAdmin = authStore((s) => s.role === 'admin');
  const isSuperAdmin = email?.toLowerCase() === 'admin@test.com';

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

  const changePasswordMutation = useMutation({
    mutationFn: ({ current, newPwd }: { current: string; newPwd: string }) =>
      authApi.changePassword(current, newPwd),
    onSuccess: () => {
      setChangePwdCurrent('');
      setChangePwdNew('');
      setChangePwdConfirm('');
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (changePwdNew.length < 8) {
      alert(t('settings.passwordMinLength'));
      return;
    }
    if (changePwdNew !== changePwdConfirm) {
      alert(t('settings.passwordsDoNotMatch'));
      return;
    }
    changePasswordMutation.mutate({ current: changePwdCurrent, newPwd: changePwdNew });
  };

  const displayEmail = meData?.data?.email ?? email ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          {t('settings.settings')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{t('settings.pageSubtitle')}</p>
      </div>

      {/* Табы */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200 dark:border-gray-700 pb-2">
        {TABS.filter((tab) => (tab.id === 'users' ? isSuperAdmin : !tab.adminOnly || isAdmin)).map((tab) => {
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
              {t(tab.labelKey)}
            </Button>
          );
        })}
      </div>

      {/* Контент вкладок */}
      {activeTab === 'machines' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.myMachines')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.addFromCatalog')}. {t('sidebar.readyToCreate')}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="block mb-2">{t('settings.addFromCatalog')}</Label>
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={addFromCatalog}
                  onChange={(e) => setAddFromCatalog(e.target.value)}
                  className="min-w-[200px]"
                >
                  <option value="">— {t('roasts.selectMachine')} —</option>
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
                  {t('settings.add')}
                </Button>
              </div>
            </div>

            <div>
              <Label className="block mb-2">{t('settings.orEnterName')}</Label>
              <form onSubmit={handleAddCustom} className="flex gap-2">
                <Input
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder="Например: Besca BSC-15"
                  className="max-w-xs"
                />
                <Button type="submit" disabled={!newMachineName.trim() || addMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('settings.add')}
                </Button>
              </form>
            </div>

            {addMutation.isError && (
              <p className="text-sm text-red-600">
                {(addMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t('settings.addError')}
              </p>
            )}

            <div>
              <Label className="block mb-2">{t('settings.machinesInOrg')} ({myMachines.length})</Label>
              {myMachines.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('settings.noMachinesYet')}</p>
              ) : (
                <ul className="border rounded divide-y dark:border-gray-600">
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
            <CardTitle>{t('settings.profile')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.profileDesc')}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {meData?.data?.username != null && meData.data.username !== '' && (
              <div>
                <Label className="block mb-2">{t('users.username')}</Label>
                <p className="text-gray-900 font-medium">{meData.data.username}</p>
              </div>
            )}
            <div>
              <Label className="block mb-2">{t('login.email')}</Label>
              <p className="text-gray-900 font-medium">{displayEmail}</p>
            </div>

            <div className="pt-4 border-t space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.changePassword')}</h4>
              <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
                <div>
                  <Label htmlFor="change-pwd-current" className="block mb-1">{t('settings.currentPassword')}</Label>
                  <PasswordInput
                    id="change-pwd-current"
                    value={changePwdCurrent}
                    onChange={(e) => setChangePwdCurrent(e.target.value)}
                    placeholder="••••••••"
                    required={changePwdNew.length > 0 || changePwdConfirm.length > 0}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="change-pwd-new" className="block mb-1">{t('settings.newPassword')}</Label>
                  <PasswordInput
                    id="change-pwd-new"
                    value={changePwdNew}
                    onChange={(e) => setChangePwdNew(e.target.value)}
                    placeholder={t('settings.minChars')}
                    minLength={8}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="change-pwd-confirm" className="block mb-1">{t('settings.repeatNewPassword')}</Label>
                  <PasswordInput
                    id="change-pwd-confirm"
                    value={changePwdConfirm}
                    onChange={(e) => setChangePwdConfirm(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full"
                  />
                </div>
                {changePasswordMutation.isError && (
                  <p className="text-sm text-red-600">
                    {(changePasswordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t('settings.passwordChangeError')}
                  </p>
                )}
                {changePasswordMutation.isSuccess && (
                  <p className="text-sm text-green-600">{t('settings.passwordChanged')}</p>
                )}
                <Button
                  type="submit"
                  disabled={!changePwdCurrent.trim() || changePwdNew.length < 8 || changePwdNew !== changePwdConfirm || changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? t('users.saving') : t('settings.changePasswordBtn')}
                </Button>
              </form>
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" onClick={logout} className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50">
                <LogOut className="w-4 h-4 mr-2" />
                {t('settings.logoutAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifications')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.notificationsDesc')}
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
            <CardTitle>{t('settings.interface')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.interfaceDesc')}
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
            <CardTitle>{t('settings.goals')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.goalsDesc')}
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
            <CardTitle>{t('settings.aboutApp')}</CardTitle>
            <p className="text-sm text-gray-500 font-normal">
              {t('settings.aboutDesc')}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{t('settings.artisanServer')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.frontendVersion')}: <strong>1.0.0</strong>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.compatibleWithArtisan')}
              </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.artisanConnect')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function NotificationsSettings() {
  const { t } = useTranslation();
  const wsNotifications = settingsStore((s) => s.wsNotifications);
  const soundNotifications = settingsStore((s) => s.soundNotifications);
  const setWsNotifications = settingsStore((s) => s.setWsNotifications);
  const setSoundNotifications = settingsStore((s) => s.setSoundNotifications);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="block font-medium">{t('settings.wsNotifications')}</Label>
          <p className="text-sm text-gray-500">{t('settings.wsNotificationsDesc')}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={wsNotifications}
            onChange={(e) => setWsNotifications(e.target.checked)}
            className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
          />
          <span className="text-sm">{t('settings.enabled')}</span>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="block font-medium">{t('settings.soundNotifications')}</Label>
          <p className="text-sm text-gray-500">{t('settings.soundNotificationsDesc')}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soundNotifications}
            onChange={(e) => setSoundNotifications(e.target.checked)}
            className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
          />
          <span className="text-sm">{t('settings.enabled')}</span>
        </label>
      </div>
    </div>
  );
}

function InterfaceSettings() {
  const { t } = useTranslation();
  const dateFormat = settingsStore((s) => s.dateFormat);
  const weightFormat = settingsStore((s) => s.weightFormat);
  const tempFormat = settingsStore((s) => s.tempFormat);
  const defaultPageSize = settingsStore((s) => s.defaultPageSize);

  const setDateFormat = settingsStore((s) => s.setDateFormat);
  const setWeightFormat = settingsStore((s) => s.setWeightFormat);
  const setTempFormat = settingsStore((s) => s.setTempFormat);
  const setDefaultPageSize = settingsStore((s) => s.setDefaultPageSize);

  return (
    <div className="space-y-6">
      <div>
        <Label className="block mb-2">{t('settings.dateFormat')}</Label>
        <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
          <option value="dd.MM.yyyy">DD.MM.YYYY</option>
          <option value="yyyy-MM-dd">YYYY-MM-DD</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">{t('settings.weightFormat')}</Label>
        <Select value={weightFormat} onChange={(e) => setWeightFormat(e.target.value as WeightFormat)}>
          <option value="kg">кг</option>
          <option value="lb">lb</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">{t('settings.tempFormat')}</Label>
        <Select value={tempFormat} onChange={(e) => setTempFormat(e.target.value as TempFormat)}>
          <option value="C">°C</option>
          <option value="F">°F</option>
        </Select>
      </div>
      <div>
        <Label className="block mb-2">{t('settings.defaultPageSize')}</Label>
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
