/**
 * POST /api/profile/change-nickname
 *
 * Body: { nickname: string }
 * Auth: Authorization: Bearer <access_token>
 *
 * 검사 순서:
 *  1. Bearer token → 유저 인증
 *  2. Nickname format validation (3-15자, 소문자/숫자/_ only)
 *  3. 30일 쿨다운 검사 (nickname_updated_at)
 *  4. 중복 검사 (자기 자신 제외)
 *  5. profile.nickname + profile.nickname_updated_at = now() 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const NICKNAME_REGEX = /^[a-z0-9_]{3,15}$/;
const COOLDOWN_DAYS = 30;

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. 인증 ──────────────────────────────────────────────
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. 바디 파싱 + format validation ─────────────────────
    const body = await req.json().catch(() => null);
    const nickname: string = typeof body?.nickname === 'string' ? body.nickname.trim() : '';

    if (!nickname) {
      return NextResponse.json(
        { success: false, message: 'Nickname cannot be empty.' },
        { status: 400 },
      );
    }

    if (!NICKNAME_REGEX.test(nickname)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Nickname must be 3-15 characters using lowercase letters, numbers, or _ only.',
        },
        { status: 400 },
      );
    }

    // ── 3. 현재 프로필 조회 (nickname_updated_at + 현재 닉네임) ──
    const { data: profile, error: profileErr } = await admin
      .from('profile')
      .select('id, nickname, nickname_updated_at')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { success: false, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    // 동일 닉네임이면 변경 불필요
    if (profile.nickname === nickname) {
      return NextResponse.json({ success: true, nickname });
    }

    // ── 4. 30일 쿨다운 검사 ──────────────────────────────────
    if (profile.nickname_updated_at) {
      const lastChanged = new Date(profile.nickname_updated_at).getTime();
      const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      const nextAvailable = new Date(lastChanged + cooldownMs);
      if (Date.now() < nextAvailable.getTime()) {
        return NextResponse.json(
          {
            success: false,
            message: 'Nickname can only be changed once every 30 days',
            nextAvailableAt: nextAvailable.toISOString(),
          },
          { status: 429 },
        );
      }
    }

    // ── 5. 중복 검사 (자신 제외) ─────────────────────────────
    const { data: existing } = await admin
      .from('profile')
      .select('id')
      .eq('nickname', nickname)
      .neq('id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Nickname already in use' },
        { status: 409 },
      );
    }

    // ── 6. 업데이트 ──────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('profile')
      .update({ nickname, nickname_updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[change-nickname] update error:', updateErr);
      return NextResponse.json(
        { success: false, message: 'Failed to update nickname.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, nickname });
  } catch (err) {
    console.error('[change-nickname] unexpected error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
