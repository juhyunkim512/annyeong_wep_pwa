/**
 * /api/gather/[id]/participants
 *
 * GET  → 해당 모여라 글의 참석자 목록 조회
 * POST → 참석하기
 * DELETE → 참석 취소
 *
 * Auth: Authorization: Bearer <access_token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

async function getUser(token: string) {
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ─── GET: 참석자 목록 ──────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: participants, error } = await admin
      .from('gather_participant')
      .select('user_id, created_at, public_profile(nickname, image_url, flag)')
      .eq('gather_post_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[gather participants GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (participants || []).map((p: any) => ({
      user_id: p.user_id,
      created_at: p.created_at,
      nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
      image_url: Array.isArray(p.public_profile) ? p.public_profile[0]?.image_url : p.public_profile?.image_url ?? null,
      flag: Array.isArray(p.public_profile) ? p.public_profile[0]?.flag : p.public_profile?.flag ?? null,
    }));

    return NextResponse.json({ participants: result });
  } catch (err) {
    console.error('[gather participants GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 참석하기 ────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const admin = createAdminClient();

    // 만료 여부 + 인원 초과 여부 + 확정 여부 확인
    const { data: post } = await admin
      .from('gather_post')
      .select('id, max_participants, expires_at, confirmed')
      .eq('id', id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Gathering not found' }, { status: 404 });
    }

    // ✅ 확정된 모임은 신규 참석 불가
    if (post.confirmed) {
      return NextResponse.json({ error: 'Cannot join a confirmed gathering' }, { status: 409 });
    }

    if (new Date(post.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Gathering has expired' }, { status: 410 });
    }

    // 현재 참석자 수 확인
    const { count } = await admin
      .from('gather_participant')
      .select('id', { count: 'exact', head: true })
      .eq('gather_post_id', id);

    if (count !== null && count >= post.max_participants) {
      return NextResponse.json({ error: 'Gathering is full' }, { status: 409 });
    }

    const { error } = await admin
      .from('gather_participant')
      .insert({ gather_post_id: id, user_id: user.id });

    // unique_violation(23505) = 이미 참석 → 성공으로 처리
    if (error && error.code !== '23505') {
      console.error('[gather join POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[gather join POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 참석 취소 ─────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const admin = createAdminClient();

    // ✅ 확정된 모임이면 참석 취소 불가 (기준: confirmed)
    const { data: post } = await admin
      .from('gather_post')
      .select('confirmed')
      .eq('id', id)
      .maybeSingle();

    if (post?.confirmed) {
      return NextResponse.json({ error: 'Cannot leave a confirmed gathering' }, { status: 409 });
    }

    const { error } = await admin
      .from('gather_participant')
      .delete()
      .eq('gather_post_id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[gather leave DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[gather leave DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
