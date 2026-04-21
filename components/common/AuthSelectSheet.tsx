'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import Image from 'next/image'

async function signInWithOAuthProvider(provider: 'google' | 'kakao') {
  console.log(`[${provider}-login] click`)
  const redirectTo = `${window.location.origin}/auth/callback`
  console.log(`[${provider}-login] signInWithOAuth start, redirectTo:`, redirectTo)
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === 'kakao'
        ? { prompt: 'login' }           // 카카오: 매번 로그인 화면 강제 표시
        : { prompt: 'select_account' }, // Google: 계정 선택 화면 표시
    },
  })
  console.log(`[${provider}-login] signInWithOAuth returned, error:`, error?.message ?? 'none')
  if (error) console.error(`[AuthSelectSheet] ${provider} OAuth error:`, error)
  // success: browser will redirect to Google/Kakao — no further action needed
}

interface AuthSelectSheetProps {
  onClose: () => void
  onLoginClick: () => void
  onSignupClick: () => void
}

export default function AuthSelectSheet({ onClose, onLoginClick, onSignupClick }: AuthSelectSheetProps) {
  // 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 transition"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
        {/* 로고 */}
            <div className="flex flex-col items-center gap-1 mb-4">
            <Image
                src="/logo.png"
                alt="ANNYEONG logo"
                width={32}
                height={32}
                className="h-8 w-8"
            />
            <p className="text-base font-bold tracking-widest text-[#5E8B7E] mt-1">ANNYEONG</p>
            </div>

        {/* Google 버튼 */}
        <button
          onClick={() => signInWithOAuthProvider('google')}
          className="w-full max-w-xs flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition"
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.97-4.33 2.97-7.31z" fill="#4285F4"/>
            <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H1.06v2.58A10 10 0 0 0 10 20z" fill="#34A853"/>
            <path d="M4.4 11.91A5.97 5.97 0 0 1 4.08 10c0-.66.12-1.3.32-1.91V5.51H1.06A10 10 0 0 0 0 10c0 1.61.39 3.13 1.06 4.49l3.34-2.58z" fill="#FBBC05"/>
            <path d="M10 3.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87C14.95.99 12.7 0 10 0A10 10 0 0 0 1.06 5.51l3.34 2.58C5.19 5.73 7.4 3.98 10 3.98z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>

        {/* 카카오 버튼 */}
        <button
          onClick={() => signInWithOAuthProvider('kakao')}
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-[#FEE500] rounded-lg py-3.5 text-sm font-medium text-[#191919] hover:brightness-95 active:brightness-90 transition"
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd" d="M10 2C5.58 2 2 4.84 2 8.33c0 2.21 1.47 4.16 3.7 5.27l-.93 3.43a.3.3 0 0 0 .44.33L9.1 14.9c.29.03.59.04.9.04 4.42 0 8-2.84 8-6.33S14.42 2 10 2z" fill="#191919"/>
          </svg>
          카카오톡으로 계속하기
        </button>

        {/* 이메일 로그인 / 회원가입 */}
        <div className="flex items-center gap-6 mt-2">
          <button
            onClick={onLoginClick}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            이메일로 로그인
          </button>
          <span className="text-gray-300 text-xs">|</span>
          <button
            onClick={onSignupClick}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            이메일로 회원가입
          </button>
        </div>
      </div>
    </div>
  )
}
