'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import { type AppLang } from '@/lib/i18n'
import { useI18nLang } from '@/lib/hooks/useI18nLang'
import Link from 'next/link'
import Image from 'next/image'
import SignupModal from '@/components/common/SignupModal'

const GUIDE_LANGS: { code: AppLang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
]

function GuidePageContent() {
  const { t } = useTranslation('common')
  const { changeLang, currentLang } = useI18nLang()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLangModalOpen, setIsLangModalOpen] = useState(false)
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)

  // ?lang= 파라미터로 언어 초기화
  useEffect(() => {
    const langParam = searchParams.get('lang') as AppLang | null
    if (langParam && GUIDE_LANGS.some((l) => l.code === langParam) && langParam !== currentLang) {
      changeLang(langParam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLangSelect = (code: AppLang) => {
    changeLang(code)
    setIsLangModalOpen(false)
    router.replace(`/guide?lang=${code}`, { scroll: false })
  }

  const handleDeviceSelect = (device: 'ios' | 'android') => {
    setIsDeviceModalOpen(false)
    router.push(`/guide/install/${device}`)
  }

  const currentLangMeta = GUIDE_LANGS.find((l) => l.code === currentLang)

  return (
    <div className="min-h-screen bg-[#F7FAF8]">
      {/* Sticky Header — 언어 버튼 제거 */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link
            href="/dashboard/home"
            className="flex items-center gap-2 text-lg font-bold text-[#9DB8A0]"
          >
            <Image
              src="/logo.png"
              alt="ANNYEONG"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
            ANNYEONG
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Hero Banner — 버튼 없음 */}
        <section className="bg-gradient-to-br from-[#9DB8A0] to-[#7A9380] rounded-2xl p-8 text-white text-center shadow-md">
          <div className="text-5xl mb-4"></div>
          <h1 className="text-xl font-bold mb-3 leading-snug">{t('guide.hero.title')}</h1>
          <p className="text-white/85 text-sm leading-relaxed">{t('guide.hero.subtitle')}</p>
        </section>

        {/* Section 1 — Why */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">{t('guide.why.title')}</h2>
          <ul className="space-y-3">
            {[
              t('guide.why.item1'),
              t('guide.why.item2'),
              t('guide.why.item3'),
              t('guide.why.item4'),
              t('guide.why.item5'),
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#EEF4EF] text-[#9DB8A0] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2 — Language */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">{t('guide.language.title')}</h2>
          <ul className="space-y-3">
            {[
              t('guide.language.item1'),
              t('guide.language.item2'),
              t('guide.language.item3'),
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#EEF4EF] text-[#9DB8A0] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3 — App Install */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">{t('guide.app.title')}</h2>
          <ul className="space-y-3 mb-5">
            {[t('guide.app.item1'), t('guide.app.item2')].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#EEF4EF] text-[#9DB8A0] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a
            href="https://cod-clay-40439412.figma.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full sm:w-auto text-center bg-[#EEF4EF] text-[#6B9E7A] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#ddeee0] transition"
          >
            {t('guide.app.installBtn')} →
          </a>
        </section>

        {/* Bottom CTA — 2개 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
          <Link
            href="/dashboard/home"
            className="flex-1 text-center bg-white border border-[#9DB8A0] text-[#7A9380] font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#EEF4EF] transition"
          >
            {t('guide.cta.home')}
          </Link>
          <button
            onClick={() => setIsSignupOpen(true)}
            className="flex-1 text-center bg-[#9DB8A0] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#8AAD91] transition shadow-sm"
          >
            {t('guide.cta.signUp')}
          </button>
        </div>
      </main>

      {/* Signup Modal */}
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />

      {/* Language Selection Modal */}
      {isLangModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setIsLangModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">{t('guide.langModal.title')}</h3>
              <button
                onClick={() => setIsLangModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GUIDE_LANGS.map(({ code, flag, label }) => (
                <button
                  key={code}
                  onClick={() => handleLangSelect(code)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    currentLang === code
                      ? 'border-[#9DB8A0] bg-[#EEF4EF] text-[#6B9E7A]'
                      : 'border-gray-200 text-gray-700 hover:border-[#9DB8A0] hover:bg-[#EEF4EF]'
                  }`}
                >
                  <span className="text-xl">{flag}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Device Selection Modal */}
      {isDeviceModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setIsDeviceModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">{t('guide.deviceModal.title')}</h3>
              <button
                onClick={() => setIsDeviceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleDeviceSelect('ios')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border border-gray-200 hover:border-[#9DB8A0] hover:bg-[#EEF4EF] transition text-left"
              >
                <span className="text-3xl">🍎</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">iPhone</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('guide.deviceModal.iosDesc')}</p>
                </div>
              </button>
              <button
                onClick={() => handleDeviceSelect('android')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border border-gray-200 hover:border-[#9DB8A0] hover:bg-[#EEF4EF] transition text-left"
              >
                <span className="text-3xl">🤖</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Android</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('guide.deviceModal.androidDesc')}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuidePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7FAF8]" />}>
      <GuidePageContent />
    </Suspense>
  )
}
