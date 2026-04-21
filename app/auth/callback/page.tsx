'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// ★ 수동 exchangeCodeForSession 호출 금지:
//   createBrowserClient의 detectSessionInUrl: true가 페이지 최초 로드 시
//   자동으로 exchange를 실행한다. 중복 호출 시 code가 소진되어 두 번째 exchange가 hang됨.
//   onAuthStateChange로 SIGNED_IN / INITIAL_SESSION(+session) 이벤트를 catch해서 redirect.

export default function AuthCallbackPage() {
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errorParam = params.get('error')

    console.log('[callback-page] mounted, code:', !!code, 'error:', errorParam ?? 'none')

    if (errorParam) {
      console.error('[callback-page] OAuth error:', errorParam)
      router.replace('/dashboard/home')
      return
    }

    const doRedirect = async (userId: string) => {
      if (redirected.current) return
      redirected.current = true
      console.log('[callback-page] redirecting, user:', userId)
      try {
        const res = await fetch('/api/onboarding/check-profile')
        const data = await res.json()
        const target = data.hasProfile ? '/dashboard/home' : '/onboarding/country'
        console.log('[callback-page] final redirect →', target)
        router.replace(target)
      } catch {
        router.replace('/dashboard/home')
      }
    }

    // detectSessionInUrl: true → 자동 exchange 후 SIGNED_IN or INITIAL_SESSION 발화
    // 자동 exchange가 subscription 등록 전에 완료된 경우 → INITIAL_SESSION with session
    // 자동 exchange가 subscription 등록 후 완료된 경우 → SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[callback-page] auth event:', event, 'session:', !!session, 'user:', session?.user?.id ?? null)
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        doRedirect(session.user.id)
      }
    })

    // code가 없으면 즉시 홈으로
    if (!code) {
      redirected.current = true
      router.replace('/dashboard/home')
      subscription.unsubscribe()
      return
    }

    // timeout 안전망: exchange 실패 or 이벤트 미발화 시
    const timeout = setTimeout(() => {
      if (!redirected.current) {
        console.log('[callback-page] timeout fallback → /dashboard/home')
        redirected.current = true
        router.replace('/dashboard/home')
      }
    }, 6000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex items-center justify-center">
      <p className="text-[#9DB8A0] text-sm font-medium">로그인 중...</p>
    </div>
  )
}
