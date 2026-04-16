/**
 * /api/gather/chat/[roomId]
 *
 * GET  → 채팅 메시지 조회
 * POST → 메시지 전송
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

// ─── GET: 메시지 목록 ─────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // 멤버인지 확인
    const { data: member } = await admin
      .from('gather_chat_member')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // 방 정보
    const { data: room } = await admin
      .from('gather_chat_room')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    // 1. 메시지 조회
    const { data: messages, error } = await admin
      .from('gather_chat_message')
      .select('id, sender_id, content, language, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[gather chat GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. sender_id 목록 추출 (중복 제거)
    const senderIds = [...new Set((messages || []).map((m: any) => m.sender_id))];

    // 3. public_profile 별도 조회
    const profileMap: Record<string, { nickname: string | null; image_url: string | null; flag: string | null }> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await admin
        .from('public_profile')
        .select('id, nickname, image_url, flag')
        .in('id', senderIds);
      for (const p of profiles || []) profileMap[p.id] = p;
    }

    // 4. 코드에서 합치기
    const formatted = (messages || []).map((m: any) => ({
      id: m.id,
      sender_id: m.sender_id,
      content: m.content,
      language: m.language,
      created_at: m.created_at,
      nickname: profileMap[m.sender_id]?.nickname ?? null,
      image_url: profileMap[m.sender_id]?.image_url ?? null,
      flag: profileMap[m.sender_id]?.flag ?? null,
    }));

    return NextResponse.json({ room, messages: formatted });
  } catch (err) {
    console.error('[gather chat GET] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 메시지 전송 ─────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // 멤버인지 확인
    const { data: member } = await admin
      .from('gather_chat_member')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // 방 만료 확인
    const { data: room } = await admin
      .from('gather_chat_room')
      .select('expires_at')
      .eq('id', roomId)
      .maybeSingle();

    if (room && new Date(room.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Chat room has expired' }, { status: 410 });
    }

    const { content, language } = await req.json();
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const { data: msg, error } = await admin
      .from('gather_chat_message')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content: content.trim().slice(0, 1000),
        language: language || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[gather chat POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // last_message / last_message_at 업데이트
    await admin
      .from('gather_chat_room')
      .update({ last_message: msg.content, last_message_at: msg.created_at })
      .eq('id', roomId);

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error('[gather chat POST] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
