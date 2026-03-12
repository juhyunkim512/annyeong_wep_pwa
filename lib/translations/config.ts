export const SUPPORTED_LANGUAGES = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  vi: 'Tiếng Việt',
  ja: '日本語',
  th: 'ไทย',
  fr: 'Français',
  es: 'Español',
} as const

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES

export const DEFAULT_LANGUAGE: LanguageCode = 'ko'

export const TRANSLATION_CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

export const GOOGLE_CLOUD_TRANSLATE_CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  apiKey: process.env.GOOGLE_CLOUD_API_KEY,
  location: 'global',
}
