import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

/** Effective theme for display (light or dark). Used when theme is 'system'. */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export type Language = 'ru' | 'en';
export type DateFormat = 'dd.MM.yyyy' | 'yyyy-MM-dd';
export type WeightFormat = 'kg' | 'lb';
export type TempFormat = 'C' | 'F';
export type DefaultPageSize = 25 | 50 | 100 | 500;

interface SettingsState {
  // Интерфейс
  theme: Theme;
  language: Language;
  dateFormat: DateFormat;
  weightFormat: WeightFormat;
  tempFormat: TempFormat;
  defaultPageSize: DefaultPageSize;

  // Оповещения
  wsNotifications: boolean;
  soundNotifications: boolean;

  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDateFormat: (format: DateFormat) => void;
  setWeightFormat: (format: WeightFormat) => void;
  setTempFormat: (format: TempFormat) => void;
  setDefaultPageSize: (size: DefaultPageSize) => void;
  setWsNotifications: (enabled: boolean) => void;
  setSoundNotifications: (enabled: boolean) => void;
}

function applyThemeToDom(theme: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let effective: 'light' | 'dark' = 'light';
  if (theme === 'dark') effective = 'dark';
  else if (theme === 'system') {
    effective = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.classList.remove('dark', 'light');
  root.classList.add(effective);
  root.setAttribute('data-theme', effective);
}

export const settingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'ru',
      dateFormat: 'dd.MM.yyyy',
      weightFormat: 'kg',
      tempFormat: 'C',
      defaultPageSize: 25,
      wsNotifications: true,
      soundNotifications: false,

      setTheme: (theme) => {
        set({ theme });
        applyThemeToDom(theme);
      },
      setLanguage: (language) => set({ language }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setWeightFormat: (weightFormat) => set({ weightFormat }),
      setTempFormat: (tempFormat) => set({ tempFormat }),
      setDefaultPageSize: (defaultPageSize) => set({ defaultPageSize }),
      setWsNotifications: (wsNotifications) => set({ wsNotifications }),
      setSoundNotifications: (soundNotifications) => set({ soundNotifications }),
    }),
    {
      name: 'settings-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeToDom(state.theme);
      },
    }
  )
);
