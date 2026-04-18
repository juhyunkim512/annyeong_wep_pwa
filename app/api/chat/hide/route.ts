import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { roomId, roomType } = await req.json();
  if (!roomId || !roomType) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  if (roomType === 'direct') {
    const { data: room } = await admin
      .from('chat_room')
      .select('user_a, user_b')
      .eq('id', roomId)
      .maybeSingle();

    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (room.user_a !== user.id && room.user_b !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const field = room.user_a === user.id ? 'user_a_hidden' : 'user_b_hidden';
    const hiddenAtField = room.user_a === user.id ? 'user_a_hidden_at' : 'user_b_hidden_at';
    const { error } = await admin
      .from('chat_room')
      .update({ [field]: true, [hiddenAtField]: new Date().toISOString() })
      .eq('id', roomId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (roomType === 'gather') {
    const { error } = await admin
      .from('gather_chat_member')
      .update({ hidden: true, hidden_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: 'Invalid roomType' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
