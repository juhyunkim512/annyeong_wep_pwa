/**
 * lib/server/buildSearchIndex.ts
 *
 * Server-only utility: post 생성/수정 시 post_search_index 테이블에
 * 지원 언어 6개의 검색 인덱스 row를 upsert한다.
 *
 * 기존 getOrTranslateContent / content_translation_cache 구조를 재사용하므로
 * Google Translation API 호출 횟수는 캐시에 의해 자동 최소화된다.
 *
 * ⚠️ 서버 전용 — 'use client' 컴포넌트에서 직접 import 금지.
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrTranslateContent, normalizeLang } from './getOrTranslate';

// 지원 언어 목록 (profile.uselanguage / post.language 저장 형식)
const SUPPORTED_LANGUAGES = [
  'korean',
  'english',
  'chinese',
  'japanese',
  'vietnamese',
  'spanish',
] as const;

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * @param postId        post.id (uuid)
 * @param title         post.title (원문)
 * @param postLanguage  post.language (e.g. 'korean', 'english', …)
 */
export async function buildSearchIndex(
  postId: string,
  title: string,
  postLanguage: string,
): Promise<void> {
  const admin = createAdminClient();
  const sourceHash = sha256(title);
  const now = new Date().toISOString();

  await Promise.all(
    SUPPORTED_LANGUAGES.map(async (targetLang) => {
      let titleText = title;

      // 원문 언어와 대상 언어가 다르면 제목만 번역 (캐시 우선)
      if (normalizeLang(targetLang) !== normalizeLang(postLanguage)) {
        const titleRes = await getOrTranslateContent('post', postId, 'title', title, postLanguage, targetLang);
        titleText = titleRes.text;
      }

      const { error } = await admin.from('post_search_index').upsert(
        {
          post_id: postId,
          language: targetLang,
          title_text: titleText,
          source_hash: sourceHash,
          updated_at: now,
        },
        {
          onConflict: 'post_id,language',
          ignoreDuplicates: false,
        },
      );

      if (error) {
        console.error(`[buildSearchIndex] upsert error lang=${targetLang}:`, error.message);
      }
    }),
  );
}
