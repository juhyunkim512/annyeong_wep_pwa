/**
 * /api/gather/[id]/confirm
 *
 * POST → 모임 확정: 임시 단톡방 생성
 *
 * - 작성자만 확정 가능
 * - gather_post.confirmed = true 이면 즉시 409
 * - gather_chat_room 생성 → gather_chat_member에 참석자 전원 추가
 * - gather_post.confirmed = true / confirmed_at / confirmed_chat_room_id 업데이트
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // 글 정보 확인
    const { data: post, error: postError } = await admin
      .from('gather_post')
      .select('id, author_id, title, meet_at, confirmed, confirmed_chat_room_id, chat_room_id')
      .eq('id', postId)
      .maybeSingle();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // 작성자만 확정 가능
    if (post.author_id !== user.id) {
      return NextResponse.json({ error: 'Only the author can confirm' }, { status: 403 });
    }

    // ✅ 확정 기준: gather_post.confirmed
    if (post.confirmed) {
      return NextResponse.json(
        { error: 'Already confirmed', chat_room_id: post.confirmed_chat_room_id ?? post.chat_room_id },
        { status: 409 }
      );
    }

    // 참석자 목록 조회
    const { data: participants } = await admin
      .from('gather_participant')
      .select('user_id')
      .eq('gather_post_id', postId);

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'No participants' }, { status: 400 });
    }

    // 단톡방 생성 (UNIQUE(gather_post_id) 제약으로 중복 방지)
    const { data: room, error: roomError } = await admin
      .from('gather_chat_room')
      .insert({
        gather_post_id: postId,
        title: post.title,
        expires_at: post.meet_at,
      })
      .select()
      .single();

    let finalRoomId: string;

    if (roomError) {
      // 23505 = unique violation → 다른 요청이 이미 생성했다 → 기존 방 재사용
      if (roomError.code === '23505') {
        const { data: existing } = await admin
          .from('gather_chat_room')
          .select('id')
          .eq('gather_post_id', postId)
          .maybeSingle();
        if (!existing) {
          console.error('[gather confirm] room race condition fallback failed');
          return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
        }
        finalRoomId = existing.id;
      } else {
        console.error('[gather confirm] room create error:', roomError);
        return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
      }
    } else {
      if (!room) {
        return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
      }
      finalRoomId = room.id;

      // 멤버 추가 (작성자 포함 전원)
      const memberUserIds = participants.map((p: any) => p.user_id);
      if (!memberUserIds.includes(user.id)) memberUserIds.push(user.id);
      const members = memberUserIds.map((uid: string) => ({ room_id: finalRoomId, user_id: uid }));

      const { error: memberError } = await admin
        .from('gather_chat_member')
        .insert(members);

      if (memberError && memberError.code !== '23505') {
        console.error('[gather confirm] member insert error:', memberError);
      }
    }

    // ✅ gather_post에 confirmed 상태 업데이트 (단일 기준으로 통일)
    const { error: updateError } = await admin
      .from('gather_post')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_chat_room_id: finalRoomId,
        chat_room_id: finalRoomId, // 하위 호환성 유지
      })
      .eq('id', postId)
      .eq('confirmed', false); // 동시성 안전: 이미 확정된 경우 UPDATE skip

    if (updateError) {
      console.error('[gather confirm] post update error:', updateError);
      // 업데이트 실패해도 방은 만들어졌으므로 성공 반환
    }

    return NextResponse.json({ chat_room_id: finalRoomId });
  } catch (err) {
    console.error('[gather confirm] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
