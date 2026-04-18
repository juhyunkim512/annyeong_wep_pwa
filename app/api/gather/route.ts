/**
 * /api/gather
 *
 * GET  → 만료 안 된 모여라 글 목록 조회 (참석자 수 포함)
 * POST → 모여라 글 생성
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

// ─── GET: 모여라 목록 조회 ─────────────────────────────────────────────────
export async function GET() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: posts, error } = await admin
      .from('gather_post')
      .select('*, public_profile(nickname, image_url, flag)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[gather GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 글의 참석자 수 조회
    const postIds = (posts || []).map((p: any) => p.id);
    let participantCounts: Record<string, number> = {};

    if (postIds.length > 0) {
      const { data: participants } = await admin
        .from('gather_participant')
        .select('gather_post_id')
        .in('gather_post_id', postIds);

      if (participants) {
        for (const p of participants) {
          participantCounts[p.gather_post_id] = (participantCounts[p.gather_post_id] || 0) + 1;
        }
      }
    }

    const result = (posts || []).map((p: any) => ({
      ...p,
      nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
      author_image_url: Array.isArray(p.public_profile) ? p.public_profile[0]?.image_url : p.public_profile?.image_url ?? null,
      author_flag: Array.isArray(p.public_profile) ? p.public_profile[0]?.flag : p.public_profile?.flag ?? null,
      participant_count: participantCounts[p.id] || 0,
      public_profile: undefined,
    }));

    return NextResponse.json({ posts: result });
  } catch (err) {
    console.error('[gather GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 모여라 글 생성 ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, content, category, location_type, location_label, lat, lng, meet_at, max_participants, language } = body;

    if (!title || !category || !location_label || !meet_at || !max_participants) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();
    const created_at = new Date().toISOString();
    const expires_at = meet_at; // 모임 시간과 동일

    const { data, error } = await admin
      .from('gather_post')
      .insert({
        author_id: user.id,
        title,
        content: content || null,
        category,
        location_type: location_type || 'quick',
        location_label,
        lat: lat || null,
        lng: lng || null,
        meet_at,
        max_participants,
        language: language || 'korean',
        created_at,
        expires_at,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[gather POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 작성자를 자동으로 첫 참석자로 추가
    await admin
      .from('gather_participant')
      .insert({ gather_post_id: data.id, user_id: user.id });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[gather POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 본인 글 삭제 ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });

    const admin = createAdminClient();

    // 본인 글인지 + 확정 여부 확인
    const { data: post } = await admin
      .from('gather_post')
      .select('author_id, confirmed')
      .eq('id', postId)
      .maybeSingle();

    if (!post || post.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ✅ 확정된 모임은 삭제 불가 (기준: confirmed)
    if (post.confirmed) {
      return NextResponse.json({ error: 'Cannot delete a confirmed gathering' }, { status: 409 });
    }

    const { error } = await admin
      .from('gather_post')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('[gather DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[gather DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
