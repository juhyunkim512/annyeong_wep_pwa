/**
 * app/api/translate/batch/route.ts
 *
 * 다건 번역 API — 한 번의 HTTP 요청으로 여러 텍스트를 번역한다.
 * 인증 1회, DB 캐시 조회를 배치로 처리하여 N+1 문제를 해결한다.
 *
 * POST /api/translate/batch
 * Body (JSON):
 *   targetLanguage : string  (e.g. 'ko', 'en')
 *   items          : Array<{
 *     key            : string  — 클라이언트 식별용 키 (응답에 그대로 반환)
 *     contentType    : 'post' | 'comment' | 'chat_message'
 *     contentId      : string  (uuid)
 *     fieldName      : 'title' | 'content'
 *     sourceText     : string
 *     sourceLanguage : string
 *   }>
 *
 * Response (JSON):
 *   results: Record<key, {
 *     text           : string
 *     isTranslated   : boolean
 *     sourceLanguage : string
 *     targetLanguage : string
 *     error?         : string  — 개별 항목 실패 시
 *   }>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getOrTranslateContent,
  ContentType,
  FieldName,
} from '@/lib/server/getOrTranslate';
import { normalizeLang, isSupportedLanguage } from '@/lib/utils/normalizeLang';

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES: ContentType[] = ['post', 'comment', 'chat_message'];
const ALLOWED_FIELD_NAMES: FieldName[] = ['title', 'content'];
const ALLOWED_COMBOS: Record<ContentType, FieldName[]> = {
  post: ['title', 'content'],
  comment: ['content'],
  chat_message: ['content'],
};

const MAX_BATCH_SIZE = 30;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface BatchItem {
  key: string;
  contentType: string;
  contentId: string;
  fieldName: string;
  sourceText: string;
  sourceLanguage: string;
}

// ─────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. 인증 (1회) ──────────────────────────
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. body 파싱 ───────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetLanguage: rawTargetLanguage, items } = body as {
    targetLanguage?: string;
    items?: BatchItem[];
  };

  // ── 3. targetLanguage 검증 ─────────────────
  if (!rawTargetLanguage) {
    return NextResponse.json({ error: 'targetLanguage is required' }, { status: 400 });
  }

  const targetLanguage = normalizeLang(rawTargetLanguage);
  if (!isSupportedLanguage(targetLanguage)) {
    return NextResponse.json({ error: 'targetLanguage is not supported' }, { status: 400 });
  }

  // ── 4. items 검증 ─────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
  }

  if (items.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `items exceeds maximum batch size of ${MAX_BATCH_SIZE}` },
      { status: 400 },
    );
  }

  // ── 5. 배치 번역 실행 ─────────────────────
  const results: Record<string, {
    text: string;
    isTranslated: boolean;
    sourceLanguage: string;
    targetLanguage: string;
    error?: string;
  }> = {};

  await Promise.all(
    items.map(async (item) => {
      const { key, contentType, contentId, fieldName, sourceText, sourceLanguage } = item;

      // 개별 항목 검증
      if (!key || typeof key !== 'string') {
        results[key ?? 'unknown'] = {
          text: sourceText ?? '',
          isTranslated: false,
          sourceLanguage: normalizeLang(sourceLanguage),
          targetLanguage,
          error: 'key is required',
        };
        return;
      }

      if (!ALLOWED_CONTENT_TYPES.includes(contentType as ContentType)) {
        results[key] = {
          text: sourceText ?? '',
          isTranslated: false,
          sourceLanguage: normalizeLang(sourceLanguage),
          targetLanguage,
          error: `invalid contentType: ${contentType}`,
        };
        return;
      }

      const allowedFields = ALLOWED_COMBOS[contentType as ContentType];
      if (!allowedFields || !allowedFields.includes(fieldName as FieldName)) {
        results[key] = {
          text: sourceText ?? '',
          isTranslated: false,
          sourceLanguage: normalizeLang(sourceLanguage),
          targetLanguage,
          error: `invalid fieldName '${fieldName}' for contentType '${contentType}'`,
        };
        return;
      }

      if (!contentId || typeof sourceText !== 'string' || !sourceLanguage) {
        results[key] = {
          text: sourceText ?? '',
          isTranslated: false,
          sourceLanguage: normalizeLang(sourceLanguage),
          targetLanguage,
          error: 'missing required field (contentId, sourceText, or sourceLanguage)',
        };
        return;
      }

      // 번역 실행 (캐시 조회 → miss 시 번역)
      try {
        const result = await getOrTranslateContent(
          contentType as ContentType,
          contentId,
          fieldName as FieldName,
          sourceText,
          sourceLanguage,
          targetLanguage,
        );
        results[key] = result;
      } catch (err) {
        console.error(`[/api/translate/batch] item ${key} failed:`, err);
        results[key] = {
          text: sourceText,
          isTranslated: false,
          sourceLanguage: normalizeLang(sourceLanguage),
          targetLanguage,
          error: 'Translation failed',
        };
      }
    })
  );

  return NextResponse.json({ results });
}
