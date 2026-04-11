import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const admin = createAdminClient();

    // Verify token and get user
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password, reason } = await req.json();
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    // Re-verify password using a fresh anonymous Supabase client
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (signInError) {
      return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
    }

    // Insert delete log
    await admin.from('user_delete_log').insert({
      user_id: user.id,
      reason: reason ?? '',
    });

    // Soft delete: set is_deleted = true on profile
    const { error: updateError } = await admin
      .from('profile')
      .update({ is_deleted: true })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[account/delete]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
