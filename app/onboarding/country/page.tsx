'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import '@/lib/i18n'

const COUNTRY_OPTIONS = [
  { flag: '🇰🇷', label: 'Korea',         flagValue: 'korea',   lang: 'ko' },
  { flag: '🇨🇳', label: 'China',         flagValue: 'china',   lang: 'zh' },
  { flag: '🇯🇵', label: 'Japan',         flagValue: 'japan',   lang: 'ja' },
  { flag: '🇻🇳', label: 'Vietnam',       flagValue: 'vietnam', lang: 'vi' },
  { flag: '🇺🇸', label: 'United States', flagValue: 'usa',     lang: 'en' },
  { flag: '🇪🇸', label: 'Spain',         flagValue: 'spain',   lang: 'es' },
]

type Step = 'country' | 'nickname'
type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function CountryOnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const [step, setStep] = useState<Step>('country')
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle')
  const [nicknameMessage, setNicknameMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    console.log('[onboarding] init start')

    // onAuthStateChange가 일정 시간 안에 session을 못 주면 비로그인으로 판단
    const fallbackTimer = setTimeout(() => {
      console.log('[onboarding] fallback: no auth event → /')
      router.replace('/')
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[onboarding] auth event:', event, 'user:', session?.user?.id ?? 'null')
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return
      // INITIAL_SESSION에서 session이 null이면 SIGNED_IN 이벤트를 기다림
      if (event === 'INITIAL_SESSION' && !session) {
        console.log('[onboarding] INITIAL_SESSION null → waiting for SIGNED_IN')
        return
      }
      if (!session) {
        console.log('[onboarding] no session → /')
        clearTimeout(fallbackTimer)
        router.replace('/')
        return
      }

      // 세션 있음 → 클라이언트에서 직접 profile 조회
      clearTimeout(fallbackTimer)
      console.log('[onboarding] session ok, checking profile via supabase client')
      try {
        const { data: profile } = await supabase
          .from('profile')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle()
        console.log('[onboarding] profile exists:', !!profile)
        if (profile) {
          router.replace('/dashboard/home')
          return
        }
      } catch (err) {
        console.error('[onboarding] profile check failed:', err)
      }
      setSessionLoading(false)
    })
    return () => {
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckNickname = async () => {
    if (!nickname) return
    setNicknameStatus('checking')
    setNicknameMessage('')
    try {
      const res = await fetch('/api/check-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      })
      const data = await res.json()
      if (data.available) {
        setNicknameStatus('available')
        setNicknameMessage(t('onboarding.nicknameAvailable'))
      } else {
        setNicknameStatus(res.status === 400 ? 'invalid' : 'taken')
        setNicknameMessage(data.message || t('onboarding.nicknameUnavailable'))
      }
    } catch (err) {
      console.error('[onboarding] check-nickname error:', err)
      setNicknameStatus('idle')
      setNicknameMessage(t('onboarding.checkError'))
    }
  }

  const handleSave = async () => {
    if (!selectedFlag || nicknameStatus !== 'available') return
    setLoading(true)
    setError(null)
    try {
      // 세션 쿠키 강제 갱신 (OAuth 직후 쿠키 정착 타이밍 보완)
      await supabase.auth.refreshSession()

      const res = await fetch('/api/onboarding/country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: selectedFlag, nickname }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('[onboarding] API error:', data)
        setError(data.message || t('onboarding.saveFailed'))
        return
      }
      router.replace('/dashboard/home')
    } catch (err) {
      console.error('[onboarding] handleSave exception:', err)
      setError(t('onboarding.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAF8]">
        <div className="w-10 h-10 border-4 border-[#9DB8A0] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8 space-y-6">

        {/* Step 1: Country */}
        {step === 'country' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">어떤 언어를 사용하시겠어요?</h1>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COUNTRY_OPTIONS.map((option) => (
                <button
                  key={option.flagValue}
                  onClick={() => setSelectedFlag(option.flagValue)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition ${
                    selectedFlag === option.flagValue
                      ? 'border-[#9DB8A0] bg-[#EEF4EF] text-gray-900'
                      : 'border-gray-200 text-gray-700 hover:border-[#9DB8A0] hover:bg-[#EEF4EF]'
                  }`}
                >
                  <span className="text-xl shrink-0">{option.flag}</span>
                  <span className="text-left leading-tight">{option.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const option = COUNTRY_OPTIONS.find(o => o.flagValue === selectedFlag)
                if (option) i18n.changeLanguage(option.lang)
                setStep('nickname')
              }}
              disabled={!selectedFlag}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              다음
            </button>
          </>
        )}

        {/* Step 2: Nickname */}
        {step === 'nickname' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">{t('onboarding.setNickname')}</h1>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value)
                    setNicknameStatus('idle')
                    setNicknameMessage('')
                  }}
                  placeholder="nickname"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-sm"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleCheckNickname}
                  disabled={!nickname || nicknameStatus === 'checking' || loading}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition whitespace-nowrap"
                >
                  {nicknameStatus === 'checking' ? t('onboarding.checking') : t('onboarding.checkDuplicate')}
                </button>
              </div>
              {nicknameMessage && (
                <p className={`text-xs ${nicknameStatus === 'available' ? 'text-green-600' : 'text-red-500'}`}>
                  {nicknameMessage}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('country'); setError(null); i18n.changeLanguage('ko') }}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition"
              >
                이전
              </button>
              <button
                onClick={handleSave}
                disabled={nicknameStatus !== 'available' || loading}
                className="flex-1 bg-[#9DB8A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {loading ? t('onboarding.saving') : t('onboarding.start')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
