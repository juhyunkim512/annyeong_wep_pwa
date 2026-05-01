import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 서버측 이메일 마스킹
 * 규칙: @ 앞부분은 첫 글자만 보이고 나머지는 ***, 도메인은 그대로
 * 예: user@example.com → u***@example.com
 */
function maskEmailServer(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawNickname: string = body?.nickname ?? '';
    const nickname = rawNickname.trim();

    if (!nickname) {
      return NextResponse.json(
        { message: 'Please enter your nickname.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. public.profile 에서 nickname 검색 (case-insensitive)
    const { data: profileData, error: profileError } = await admin
      .from('profile')
      .select('id')
      .ilike('nickname', nickname)
      .maybeSingle();

    if (profileError) {
      console.error('[find-id] profile query error:', profileError);
      return NextResponse.json(
        { message: 'Server error. Please try again.' },
        { status: 500 }
      );
    }

    if (!profileData) {
      return NextResponse.json(
        { message: 'Nickname not found. Please check and try again.' },
        { status: 404 }
      );
    }

    // 2. profile.id 로 auth.users 이메일 조회 (service role 전용)
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(
      profileData.id
    );

    if (userError || !userData?.user?.email) {
      console.error('[find-id] auth user lookup error:', userError);
      return NextResponse.json(
        { message: 'Could not retrieve account information. Please contact support.' },
        { status: 500 }
      );
    }

    // 3. 서버에서 마스킹 후 반환 (원본 이메일 노출 방지)
    return NextResponse.json({ email: maskEmailServer(userData.user.email) }, { status: 200 });
  } catch (err) {
    console.error('[find-id] unexpected error:', err);
    return NextResponse.json(
      { message: 'Unexpected server error. Please try again.' },
      { status: 500 }
    );
  }
}
