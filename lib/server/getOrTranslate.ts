/**
 * lib/server/getOrTranslate.ts
 *
 * 유저 생성 텍스트(post title/content, comment content)의 번역을 담당하는
 * 서버 전용 유틸. 고정 UI 번역(i18next/locales)과 완전히 분리된다.
 *
 * 동작 순서:
 *  1. 빈 텍스트 또는 동일 언어 → 원문 반환
 *  2. sourceText SHA-256 hash 생성
 *  3. content_translation_cache 조회 (unique: type+id+field+target+hash)
 *  4. 캐시 히트 → 즉시 반환
 *  5. 캐시 미스 → Google Cloud Translation 호출
 *  6. 번역 결과 캐시에 upsert (hash 기반 누적 방식 — 기존 row 삭제 없음)
 *  7. 번역 결과 반환
 *
 * ⚠️ 이 파일은 서버 전용 코드입니다. 'use client' 컴포넌트에서 직접 import 금지.
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { v2 } from '@google-cloud/translate';
import { llmTranslate } from '@/lib/translations/llm';
import { normalizeLang } from '@/lib/utils/normalizeLang';

export { normalizeLang };

const { Translate } = v2;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ContentType = 'post' | 'comment' | 'chat_message';
export type FieldName = 'title' | 'content';

export interface TranslationResult {
  text: string;
  isTranslated: boolean;
  sourceLanguage: string; // 정규화된 short code (e.g. 'ko')
  targetLanguage: string; // 정규화된 short code (e.g. 'en')
}

// ─────────────────────────────────────────────
// Google Translate client (singleton)
// ─────────────────────────────────────────────

let _translateClient: v2.Translate | null = null;

function getTranslateClient(): v2.Translate {
  if (!_translateClient) {
    _translateClient = new Translate({
      key: process.env.GOOGLE_CLOUD_API_KEY,
    });
  }
  return _translateClient;
}

// ─────────────────────────────────────────────
// Hash utility
// ─────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ─────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────

/**
 * @param contentType  'post' | 'comment'
 * @param contentId    post.id 또는 comment.id (uuid string)
 * @param fieldName    'title' | 'content'
 * @param sourceText   번역 대상 원문 텍스트
 * @param sourceLanguage  원문 언어 (DB 저장값 또는 short code)
 * @param targetLanguage  목표 언어 (profile.uselanguage 또는 short code)
 */
export async function getOrTranslateContent(
  contentType: ContentType,
  contentId: string,
  fieldName: FieldName,
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  const srcLang = normalizeLang(sourceLanguage);
  const tgtLang = normalizeLang(targetLanguage);

  // 1. 빈 텍스트 → 원문 반환
  if (!sourceText || !sourceText.trim()) {
    return { text: sourceText, isTranslated: false, sourceLanguage: srcLang, targetLanguage: tgtLang };
  }

  // 2. 동일 언어 → 번역 불필요
  if (srcLang === tgtLang) {
    return { text: sourceText, isTranslated: false, sourceLanguage: srcLang, targetLanguage: tgtLang };
  }

  // 3. SHA-256 hash
  const hash = sha256(sourceText);

  // 4. Supabase 캐시 조회 (service role — RLS 무관하게 캐시 read/write)
  const admin = createAdminClient();
  const { data: cached, error: cacheReadErr } = await admin
    .from('content_translation_cache')
    .select('translated_text')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .eq('field_name', fieldName)
    .eq('target_language', tgtLang)
    .eq('source_text_hash', hash)
    .maybeSingle();

  if (cacheReadErr) {
    console.error('[getOrTranslateContent] cache read error:', cacheReadErr.message);
  }

  // 5. 캐시 히트
  if (cached?.translated_text) {
    return {
      text: cached.translated_text,
      isTranslated: true,
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
    };
  }

  // 6. LLM 번역 시도 → 실패 시 Google fallback
  let translatedText = sourceText;
  let usedProvider: 'llm' | 'google' = 'llm';

  const llmResult = await llmTranslate(sourceText, srcLang, tgtLang);

  if (llmResult) {
    translatedText = llmResult;
  } else {
    // LLM 실패 → Google Cloud Translation fallback
    console.warn('[getOrTranslateContent] LLM failed, falling back to Google');
    usedProvider = 'google';
    try {
      const client = getTranslateClient();
      const [result] = await client.translate(sourceText, tgtLang);
      translatedText = Array.isArray(result) ? result[0] : result;
    } catch (err) {
      console.error('[getOrTranslateContent] Google Translation error:', err);
      return { text: sourceText, isTranslated: false, sourceLanguage: srcLang, targetLanguage: tgtLang };
    }
  }

  // 7. 캐시 저장 (upsert — hash 기반 누적, 기존 row 삭제 없음)
  const now = new Date().toISOString();
  const { error: upsertErr } = await admin
    .from('content_translation_cache')
    .upsert(
      {
        content_type: contentType,
        content_id: contentId,
        field_name: fieldName,
        source_language: srcLang,
        target_language: tgtLang,
        source_text_hash: hash,
        translated_text: translatedText,
        provider: usedProvider,
        created_at: now,
        updated_at: now,
      },
      {
        onConflict: 'content_type,content_id,field_name,target_language,source_text_hash',
        ignoreDuplicates: false, // updated_at 갱신을 허용
      },
    );

  if (upsertErr) {
    console.error('[getOrTranslateContent] cache upsert error:', {
      message: upsertErr.message,
      details: upsertErr.details,
      hint: upsertErr.hint,
      code: upsertErr.code,
      contentType,
      contentId,
      fieldName,
    });
    // 캐시 저장 실패해도 번역 결과는 반환
  }

  return {
    text: translatedText,
    isTranslated: true,
    sourceLanguage: srcLang,
    targetLanguage: tgtLang,
  };
}
