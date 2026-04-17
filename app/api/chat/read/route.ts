import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// POST /api/chat/read — 채팅방 읽음 상태 갱신
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { roomId, roomType } = await req.json();
  if (!roomId || !roomType) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const { error } = await admin
    .from('chat_room_read_state')
    .upsert(
      { room_id: roomId, room_type: roomType, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'room_id,room_type,user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
