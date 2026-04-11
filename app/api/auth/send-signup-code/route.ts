import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/server/sendEmail';

function hashCode(email: string, code: string): string {
  return createHash('sha256').update(email + code).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 이미 인증 완료된(email_confirmed_at 있는) 유저만 중복으로 판단
    const { data: listData } = await admin.auth.admin.listUsers();
    const alreadyRegistered = (listData?.users ?? []).some(
      (u) => u.email === email && !!u.email_confirmed_at
    );
    if (alreadyRegistered) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered.' },
        { status: 409 }
      );
    }

    // 6자리 인증코드 생성 및 hash
    const code = String(randomInt(100000, 999999));
    const codeHash = hashCode(email, code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 기존 row 삭제 후 새 row 삽입 (email unique 제약 없음)
    await admin.from('signup_email_verification').delete().eq('email', email);

    const { error: insertError } = await admin
      .from('signup_email_verification')
      .insert({
        email,
        code_hash: codeHash,
        is_verified: false,
        expires_at: expiresAt,
        attempt_count: 0,
      });

    if (insertError) {
      console.error('[send-signup-code] insert error:', insertError);
      return NextResponse.json(
        { success: false, message: 'Failed to save verification code.' },
        { status: 500 }
      );
    }

    // 이메일 발송 (서버 직접 발송 — Supabase OTP 아님)
    await sendEmail({
      to: email,
      subject: 'Your ANNYEONG verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\nDo not share this code with anyone.`,
    });

    return NextResponse.json({ success: true, message: 'Verification code sent.' });
  } catch (err) {
    console.error('[send-signup-code] error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to send verification code. Please try again.' },
      { status: 500 }
    );
  }
}
