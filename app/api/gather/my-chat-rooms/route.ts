/**
 * GET /api/gather/my-chat-rooms
 * 현재 유저가 속한 gather_chat_room 목록 반환 (admin client — RLS 우회)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // 유저 확인
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1단계: 내가 속한 room_id 목록
    const { data: memberRows } = await admin
      .from('gather_chat_member')
      .select('room_id')
      .eq('user_id', user.id);

    const roomIds = (memberRows || []).map((m: any) => m.room_id).filter(Boolean);
    if (roomIds.length === 0) return NextResponse.json({ rooms: [] });

    // 2단계: gather_chat_room 조회
    const { data: rooms } = await admin
      .from('gather_chat_room')
      .select('id, title, last_message, last_message_at')
      .in('id', roomIds);

    return NextResponse.json({ rooms: rooms || [] });
  } catch (err) {
    console.error('[my-chat-rooms]', err);
    return NextResponse.json({ rooms: [] });
  }
}
