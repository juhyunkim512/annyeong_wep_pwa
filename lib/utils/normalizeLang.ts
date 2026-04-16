/**
 * lib/utils/normalizeLang.ts
 *
 * 언어 코드 정규화 유틸.
 * DB 저장값('english', 'korean'), short code('en', 'ko'),
 * zh 변형('zh-CN', 'zh_TW', 'zh-Hant')까지 모두 처리한다.
 *
 * 서버/클라이언트 양쪽에서 import 가능 (side-effect 없음).
 */

const LANG_MAP: Record<string, string> = {
  // full-word form (DB 저장값)
  english: 'en',
  korean: 'ko',
  chinese: 'zh',
  japanese: 'ja',
  spanish: 'es',
  vietnamese: 'vi',
  // short-code form (이미 정규화된 경우)
  en: 'en',
  ko: 'ko',
  zh: 'zh',
  ja: 'ja',
  es: 'es',
  vi: 'vi',
  // zh 변형 전체 대응
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hant': 'zh',
  'zh-hans': 'zh',
  'zh_cn': 'zh',
  'zh_tw': 'zh',
};

/** 허용된 target language short codes */
export const SUPPORTED_LANGUAGES = ['ko', 'en', 'zh', 'ja', 'vi', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * 다양한 형태의 언어 입력을 정규화된 2자 코드로 변환.
 * 인식 불가 시 'en' fallback.
 */
export function normalizeLang(value: string | undefined | null): string {
  if (!value) return 'en';
  const lower = value.toLowerCase().trim();
  return LANG_MAP[lower] ?? 'en';
}

/** 지원 언어인지 확인 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}
