/**
 * app/api/translate/route.ts
 *
 * 유저 생성 텍스트(post title/content, comment content) 번역 API.
 * 클라이언트 컴포넌트는 이 endpoint 만 호출한다.
 * Google Cloud API key 및 Supabase service role key는 서버에서만 사용된다.
 *
 * POST /api/translate
 * Body (JSON):
 *   contentType     : 'post' | 'comment'
 *   contentId       : string  (uuid)
 *   fieldName       : 'title' | 'content'
 *   sourceText      : string
 *   sourceLanguage  : string  (e.g. 'korean', 'ko')
 *   ※ targetLanguage 는 body에서 받지 않고 서버에서 profile.uselanguage 로 결정
 *
 * 허용 조합:
 *   post    → title, content
 *   comment → content 만 허용 (title 은 400)
 *
 * Response (JSON):
 *   text            : string
 *   isTranslated    : boolean
 *   sourceLanguage  : string  (short code)
 *   targetLanguage  : string  (short code)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getOrTranslateContent,
  normalizeLang,
  ContentType,
  FieldName,
} from '@/lib/server/getOrTranslate';

// ─────────────────────────────────────────────
// Allowed value sets
// ─────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES: ContentType[] = ['post', 'comment'];
const ALLOWED_FIELD_NAMES: FieldName[] = ['title', 'content'];

// contentType → 허용 fieldName 조합
const ALLOWED_COMBOS: Record<ContentType, FieldName[]> = {
  post: ['title', 'content'],
  comment: ['content'],        // comment 에는 title 없음
};

// ─────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. 로그인 사용자 검증 ──────────────────
  // 클라이언트 컴포넌트에서 fetch()로 호출되므로 쿠키 기반 세션 대신
  // Authorization: Bearer <access_token> 헤더를 읽어 admin client로 검증한다.
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

  const {
    contentType,
    contentId,
    fieldName,
    sourceText,
    sourceLanguage,
  } = body as Record<string, string>;

  // ── 3. 입력 검증 ───────────────────────────

  if (!ALLOWED_CONTENT_TYPES.includes(contentType as ContentType)) {
    return NextResponse.json(
      { error: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!ALLOWED_FIELD_NAMES.includes(fieldName as FieldName)) {
    return NextResponse.json(
      { error: `fieldName must be one of: ${ALLOWED_FIELD_NAMES.join(', ')}` },
      { status: 400 },
    );
  }

  // contentType + fieldName 조합 검증
  // 예: comment + title → 400
  const allowedFields = ALLOWED_COMBOS[contentType as ContentType];
  if (!allowedFields.includes(fieldName as FieldName)) {
    return NextResponse.json(
      { error: `fieldName '${fieldName}' is not allowed for contentType '${contentType}'` },
      { status: 400 },
    );
  }

  if (!contentId || typeof contentId !== 'string') {
    return NextResponse.json({ error: 'contentId is required' }, { status: 400 });
  }

  if (typeof sourceText !== 'string') {
    return NextResponse.json({ error: 'sourceText must be a string' }, { status: 400 });
  }

  if (!sourceLanguage) {
    return NextResponse.json({ error: 'sourceLanguage is required' }, { status: 400 });
  }

  // ── 4. targetLanguage: 클라이언트를 믿지 않고 서버에서 profile.uselanguage 조회 ──
  // service role 로 조회 (RLS 무관하게 안정적으로 읽기 위함)
  const { data: profile } = await admin
    .from('profile')
    .select('uselanguage')
    .eq('id', user.id)
    .maybeSingle();

  // profile 이 없거나 uselanguage 가 비어 있으면 'en' fallback
  const targetLanguage = normalizeLang(profile?.uselanguage ?? 'en');

  // ── 5. 번역 실행 ───────────────────────────
  try {
    const result = await getOrTranslateContent(
      contentType as ContentType,
      contentId,
      fieldName as FieldName,
      sourceText,
      sourceLanguage,
      targetLanguage,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/translate] unexpected error:', err);
    // 번역 실패 시 원문 그대로 반환 — UI 중단 방지
    return NextResponse.json({
      text: sourceText,
      isTranslated: false,
      sourceLanguage: normalizeLang(sourceLanguage),
      targetLanguage,
      error: 'Translation failed, returning original text',
    });
  }
}

