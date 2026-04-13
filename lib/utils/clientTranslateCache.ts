/**
 * lib/utils/clientTranslateCache.ts
 *
 * 세션 레벨 인메모리 번역 캐시.
 * 같은 contentId + fieldName 조합은 페이지 내/간 이동 시 API 재호출 없이 즉시 반환.
 * 서버사이드 content_translation_cache(Supabase)와 독립 — 클라이언트 왕복 비용 절감용.
 */

interface TranslationResult {
  text: string
  isTranslated: boolean
}

// 모듈 레벨 싱글톤 Map (브라우저 세션 내 유지)
const _cache = new Map<string, TranslationResult>()

/** `contentId:fieldName` 키로 캐시 조회 */
export function getClientTranslation(
  contentId: string,
  fieldName: string,
): TranslationResult | null {
  return _cache.get(`${contentId}:${fieldName}`) ?? null
}

/** `contentId:fieldName` 키로 캐시 저장 */
export function setClientTranslation(
  contentId: string,
  fieldName: string,
  result: TranslationResult,
): void {
  _cache.set(`${contentId}:${fieldName}`, result)
}
