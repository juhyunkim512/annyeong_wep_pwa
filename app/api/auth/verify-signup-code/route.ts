import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_ATTEMPTS = 5;

function hashCode(email: string, code: string): string {
  return createHash('sha256').update(email + code).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'Email and code are required.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 해당 이메일의 가장 최근 verification row 조회
    const { data: rows, error: fetchError } = await admin
      .from('signup_email_verification')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No verification request found. Please request a new code.',
          errorType: 'notFound',
        },
        { status: 404 }
      );
    }

    const row = rows[0];

    // 시도 횟수 초과
    if (row.attempt_count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many failed attempts. Please request a new code.',
          errorType: 'tooManyAttempts',
        },
        { status: 429 }
      );
    }

    // 만료 확인
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Verification code has expired. Please request a new one.',
          errorType: 'codeExpired',
        },
        { status: 400 }
      );
    }

    // hash 비교
    const inputHash = hashCode(email, code);
    if (inputHash !== row.code_hash) {
      await admin
        .from('signup_email_verification')
        .update({ attempt_count: row.attempt_count + 1 })
        .eq('id', row.id);

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid verification code.',
          errorType: 'invalidCode',
        },
        { status: 400 }
      );
    }

    // 검증 성공 — is_verified = true 로 업데이트
    await admin
      .from('signup_email_verification')
      .update({ is_verified: true })
      .eq('id', row.id);

    return NextResponse.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('[verify-signup-code] error:', err);
    return NextResponse.json(
      { success: false, message: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
