/**
 * lib/utils/clientTranslateCache.ts
 *
 * 세션 레벨 인메모리 번역 캐시.
 * 같은 contentId + fieldName + targetLanguage 조합은 페이지 내/간 이동 시 API 재호출 없이 즉시 반환.
 * 서버사이드 content_translation_cache(Supabase)와 독립 — 클라이언트 왕복 비용 절감용.
 */

interface TranslationResult {
  text: string
  isTranslated: boolean
}

// 모듈 레벨 싱글톤 Map (브라우저 세션 내 유지)
const _cache = new Map<string, TranslationResult>()

/** `contentId:fieldName:targetLang` 키로 캐시 조회 */
export function getClientTranslation(
  contentId: string,
  fieldName: string,
  targetLang?: string,
): TranslationResult | null {
  return _cache.get(`${contentId}:${fieldName}:${targetLang ?? ''}`) ?? null
}

const MAX_CACHE_SIZE = 500

/** `contentId:fieldName:targetLang` 키로 캐시 저장 (최대 500개, 초과 시 가장 오래된 항목 삭제) */
export function setClientTranslation(
  contentId: string,
  fieldName: string,
  result: TranslationResult,
  targetLang?: string,
): void {
  const key = `${contentId}:${fieldName}:${targetLang ?? ''}`
  // 이미 존재하는 키면 삭제 후 재삽입(LRU 갱신)
  if (_cache.has(key)) {
    _cache.delete(key)
  } else if (_cache.size >= MAX_CACHE_SIZE) {
    // Map은 삽입 순서를 보장하므로 첫 번째 키가 가장 오래된 항목
    const oldestKey = _cache.keys().next().value
    if (oldestKey !== undefined) _cache.delete(oldestKey)
  }
  _cache.set(key, result)
}
