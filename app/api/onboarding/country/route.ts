import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FLAG_TO_LANG: Record<string, string> = {
  korea:   'korean',
  china:   'chinese',
  japan:   'japanese',
  vietnam: 'vietnamese',
  usa:     'english',
  spain:   'spanish',
}

const ALLOWED_FLAGS = Object.keys(FLAG_TO_LANG)
const NICKNAME_REGEX = /^[a-z0-9_]{3,15}$/

export async function POST(req: Request) {
  try {
    // 1. 세션 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // 2. 요청 바디
    const { flag, nickname } = await req.json()

    if (!flag || !ALLOWED_FLAGS.includes(flag)) {
      return NextResponse.json({ success: false, message: 'Invalid country.' }, { status: 400 })
    }

    if (!nickname || !NICKNAME_REGEX.test(nickname)) {
      return NextResponse.json({
        success: false,
        message: 'Nickname must be 3-15 characters using lowercase letters, numbers, or _ only.',
      }, { status: 400 })
    }

    const uselanguage = FLAG_TO_LANG[flag]
    const admin = createAdminClient()

    // 3. 이미 profile이 있으면 온보딩 중복 — 홈으로 보냄
    const { data: existingProfile } = await admin
      .from('profile')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      console.log('[onboarding/country] profile already exists for', user.id)
      return NextResponse.json({ success: true, alreadyComplete: true })
    }

    // 4. 닉네임 중복 확인
    const { data: takenNickname } = await admin
      .from('profile')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle()

    if (takenNickname) {
      return NextResponse.json({ success: false, message: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
    }

    // 5. 단일 INSERT (온보딩 완료)
    const { error: insertError } = await admin
      .from('profile')
      .insert({
        id: user.id,
        nickname,
        flag,
        uselanguage,
        purpose: 'community',
        current_status: 'living_in_korea',
      })

    if (insertError) {
      // unique violation on nickname
      if (insertError.code === '23505') {
        return NextResponse.json({ success: false, message: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
      }
      console.error('[onboarding/country] insert error:', insertError)
      return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
    }

    console.log('[onboarding/country] profile created for', user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[onboarding/country] exception:', err)
    return NextResponse.json({ success: false, message: 'Server error.' }, { status: 500 })
  }
}
