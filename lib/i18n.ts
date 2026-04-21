import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en/common.json';
import ko from './locales/ko/common.json';
import zh from './locales/zh/common.json';
import ja from './locales/ja/common.json';
import es from './locales/es/common.json';
import vi from './locales/vi/common.json';

export const SUPPORTED_LANGS = ['en', 'ko', 'zh', 'ja', 'es', 'vi'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_LABELS: Record<AppLang, string> = {
  en: '🇬🇧 English',
  ko: '🇰🇷 한국어',
  zh: '🇨🇳 中文',
  ja: '🇯🇵 日本語',
  es: '🇪🇸 Español',
  vi: '🇻🇳 Tiếng Việt',
};

/**
 * DB에 저장된 구 형식 언어 값(full word)을 짧은 코드로 변환
 * 예: "english" → "en", "korean" → "ko"
 */
export function normalizeDbLang(value: string | undefined | null): AppLang {
  if (!value) return 'ko';
  const lower = value.toLowerCase();
  const map: Record<string, AppLang> = {
    english: 'en',
    korean: 'ko',
    chinese: 'zh',
    japanese: 'ja',
    spanish: 'es',
    vietnamese: 'vi',
    en: 'en',
    ko: 'ko',
    zh: 'zh',
    ja: 'ja',
    es: 'es',
    vi: 'vi',
  };
  return map[lower] ?? 'en';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
      ko: { common: ko },
      zh: { common: zh },
      ja: { common: ja },
      es: { common: es },
      vi: { common: vi },
    },
    lng: 'ko',
    fallbackLng: 'ko',
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
