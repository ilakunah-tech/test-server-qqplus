import { useCallback } from 'react';
import { settingsStore } from '@/store/settingsStore';
import { t as translate } from '@/i18n/translations';

export function useTranslation() {
  const language = settingsStore((s) => s.language);

  const t = useCallback(
    (key: string): string => translate(language, key),
    [language]
  );

  return { t, language };
}
