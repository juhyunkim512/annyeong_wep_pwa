/**
 * lib/utils/batchTranslate.ts
 *
 * 클라이언트에서 /api/translate/batch를 호출하는 유틸.
 * 클라이언트 캐시(clientTranslateCache)와 연동한다.
 */

import { getClientTranslation, setClientTranslation } from '@/lib/utils/clientTranslateCache';

export interface BatchTranslateItem {
  key: string;
  contentType: 'post' | 'comment' | 'chat_message';
  contentId: string;
  fieldName: 'title' | 'content';
  sourceText: string;
  sourceLanguage: string;
}

export interface BatchTranslateResult {
  text: string;
  isTranslated: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  error?: string;
}

/**
 * 배치 번역 호출.
 * 1. 클라이언트 캐시에서 hit하는 항목은 API 호출에서 제외
 * 2. miss 항목만 /api/translate/batch로 전송
 * 3. 응답을 클라이언트 캐시에 저장
 * 4. key 기준으로 전체 결과 반환
 */
export async function batchTranslate(
  items: BatchTranslateItem[],
  targetLanguage: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<Record<string, BatchTranslateResult>> {
  const results: Record<string, BatchTranslateResult> = {};
  const toFetch: BatchTranslateItem[] = [];

  // 1. 캐시 확인
  for (const item of items) {
    const cached = getClientTranslation(item.contentId, item.fieldName, targetLanguage);
    if (cached) {
      results[item.key] = {
        text: cached.text,
        isTranslated: cached.isTranslated,
        sourceLanguage: item.sourceLanguage,
        targetLanguage,
      };
    } else {
      toFetch.push(item);
    }
  }

  // 2. 모두 캐시 히트면 바로 반환
  if (toFetch.length === 0) return results;

  // 3. batch API 호출
  try {
    const res = await fetch('/api/translate/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ targetLanguage, items: toFetch }),
      signal,
    });

    if (!res.ok) {
      // API 실패 시 원문 반환
      for (const item of toFetch) {
        results[item.key] = {
          text: item.sourceText,
          isTranslated: false,
          sourceLanguage: item.sourceLanguage,
          targetLanguage,
        };
      }
      return results;
    }

    const data = await res.json();
    const batchResults: Record<string, BatchTranslateResult> = data.results ?? {};

    // 4. 캐시 저장 + 결과 병합
    for (const item of toFetch) {
      const result = batchResults[item.key];
      if (result) {
        if (result.isTranslated) {
          setClientTranslation(item.contentId, item.fieldName, result, targetLanguage);
        }
        results[item.key] = result;
      } else {
        results[item.key] = {
          text: item.sourceText,
          isTranslated: false,
          sourceLanguage: item.sourceLanguage,
          targetLanguage,
        };
      }
    }
  } catch (err) {
    // 네트워크 에러 등 — 원문 반환
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('[batchTranslate] failed:', err);
    }
    for (const item of toFetch) {
      results[item.key] = {
        text: item.sourceText,
        isTranslated: false,
        sourceLanguage: item.sourceLanguage,
        targetLanguage,
      };
    }
  }

  return results;
}
