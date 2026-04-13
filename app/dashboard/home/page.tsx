'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import { type AppLang } from '@/lib/i18n'
import { getClientTranslation, setClientTranslation } from '@/lib/utils/clientTranslateCache'

const GUIDE_LANGS: { code: AppLang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
]

// ── 번역 헬퍼 (모듈 레벨) ─────────────────────────
const LANG_MAP: Record<string, string> = {
  english: 'en', korean: 'ko', japanese: 'ja',
  chinese: 'zh', spanish: 'es', vietnamese: 'vi',
  en: 'en', ko: 'ko', ja: 'ja', zh: 'zh', es: 'es', vi: 'vi',
  'zh-cn': 'zh', 'zh-tw': 'zh', 'zh-hant': 'zh', 'zh-hans': 'zh',
}
function normalizeLang(v?: string | null): string {
  if (!v) return 'en'
  return LANG_MAP[v.toLowerCase().trim()] ?? 'en'
}
async function callTranslate(
  contentId: string,
  sourceText: string,
  sourceLanguage: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<{ text: string; isTranslated: boolean }> {
  // 클라이언트 캐시 히트 → 즉시 반환
  const cached = getClientTranslation(contentId, 'title')
  if (cached) return cached
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ contentType: 'post', contentId, fieldName: 'title', sourceText, sourceLanguage }),
      signal,
    })
    if (!res.ok) return { text: sourceText, isTranslated: false }
    const result = await res.json()
    setClientTranslation(contentId, 'title', result)
    return result
  } catch {
    return { text: sourceText, isTranslated: false }
  }
}

interface PostSummary {
  id: string
  title: string
  language: string
  created_at: string
  like_count: number
  nickname: string | null
}

export default function HomePage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const [currentBanner, setCurrentBanner] = useState(0)
  const [isGuideLangModalOpen, setIsGuideLangModalOpen] = useState(false)

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return t('common.justNow')
    if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) })
    if (diff < 86400 * 7) return t('common.daysAgo', { count: Math.floor(diff / 86400) })
    if (diff < 86400 * 30) return t('common.weeksAgo', { count: Math.floor(diff / (86400 * 7)) })
    if (diff < 86400 * 365) return t('common.monthsAgo', { count: Math.floor(diff / (86400 * 30)) })
    return t('common.yearsAgo', { count: Math.floor(diff / (86400 * 365)) })
  }
  const [recentPosts, setRecentPosts] = useState<PostSummary[]>([])
  const [trendingPosts, setTrendingPosts] = useState<PostSummary[]>([])
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({})
  const [postsLoading, setPostsLoading] = useState(true)
  // request id ref: 최신 요청만 상태 반영, stale 응답은 loading 건드리지 않음
  const reqRef = useRef(0)

  useEffect(() => {
    const reqId = ++reqRef.current
    const controller = new AbortController()
    const fetchPosts = async () => {
      setPostsLoading(true)
      try {
        // Recent + Trending 병렬 fetch
        const threeDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const [{ data: recent }, { data: trending }] = await Promise.all([
          supabase
            .from('post')
            .select('id, title, language, created_at, like_count, public_profile(nickname)')
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('post')
            .select('id, title, language, created_at, like_count, public_profile(nickname)')
            .gte('created_at', threeDaysAgo)
            .gte('like_count', 1)
            .order('like_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(3),
        ])

        if (reqRef.current !== reqId) return

        const normalize = (rows: any[]): PostSummary[] =>
          (rows || []).map((r) => ({
            id: r.id,
            title: r.title,
            language: r.language ?? 'english',
            created_at: r.created_at,
            like_count: r.like_count,
            nickname: Array.isArray(r.public_profile) ? r.public_profile[0]?.nickname : r.public_profile?.nickname ?? null,
          }))

        const normalizedRecent = normalize(recent ?? [])
        const normalizedTrending = normalize(trending ?? [])
        setRecentPosts(normalizedRecent)
        setTrendingPosts(normalizedTrending)
        setPostsLoading(false)

        // ── 번역: 완전히 분리된 비동기 컨텍스트 (I18nProvider auth 충돌 방지) ──
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session || reqRef.current !== reqId) return
            const { data: userProfile } = await supabase
              .from('profile')
              .select('uselanguage')
              .eq('id', session.user.id)
              .maybeSingle()
            const userLang = normalizeLang(userProfile?.uselanguage)
            const accessToken = session.access_token
            const allPosts = [...normalizedRecent, ...normalizedTrending]
            const unique = allPosts.filter((p, i) => allPosts.findIndex((q) => q.id === p.id) === i)
            const toTranslate = unique.filter((p) => normalizeLang(p.language) !== userLang)
            if (toTranslate.length > 0) {
              const results = await Promise.all(
                toTranslate.map((p) => callTranslate(p.id, p.title, p.language, accessToken, controller.signal))
              )
              if (reqRef.current === reqId) {
                const map: Record<string, string> = {}
                toTranslate.forEach((p, i) => { if (results[i].isTranslated) map[p.id] = results[i].text })
                setTranslatedTitles(map)
              }
            }
          } catch { /* 번역 실패는 무시 */ }
        })()
      } catch (err) {
        console.error('[Home] fetchPosts error:', err)
      } finally {
        setPostsLoading(false)
      }
    }
    fetchPosts()
    return () => controller.abort()
  }, [])

  const banners = [
    { title: t('home.banners.services.title'), description: t('home.banners.services.desc'), icon: '✨', isGuide: true, href: null, image: '/banner1.png' },
    { title: t('home.banners.policy.title'), description: t('home.banners.policy.desc'), icon: '🏙️', isGuide: false, href: 'https://gauge-rope-63895960.figma.site', image: '/banner2.png' },
    { title: t('home.banners.announcements.title'), description: t('home.banners.announcements.desc'), icon: '📢', isGuide: false, href: null, image: null },
  ]

  const handleBannerClick = () => {
    const banner = banners[currentBanner]
    if (banner.isGuide) {
      setIsGuideLangModalOpen(true)
    } else if (banner.href) {
      window.open(banner.href, '_blank', 'noopener,noreferrer')
    }
  }

  const handleGuideLangSelect = (code: AppLang) => {
    setIsGuideLangModalOpen(false)
    router.push(`/guide?lang=${code}`)
  }

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  // 3초마다 자동 슬라이드
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [banners.length])

  return (
    <div className="max-w-6xl space-y-8">
      {/* Banner Carousel */}
      <section className="relative">
        {banners[currentBanner].image ? (
          /* 이미지 배너 */
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer active:opacity-90"
            onClick={handleBannerClick}
          >
            <Image
              src={banners[currentBanner].image!}
              alt={banners[currentBanner].title}
              width={1200}
              height={400}
              className="w-full object-cover"
              priority
            />
            <button
              onClick={(e) => { e.stopPropagation(); prevBanner() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/20 hover:bg-black/30 rounded-full w-10 h-10 flex items-center justify-center transition text-white"
            >
              ←
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextBanner() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/20 hover:bg-black/30 rounded-full w-10 h-10 flex items-center justify-center transition text-white"
            >
              →
            </button>
          </div>
        ) : (
          /* 일반 배너 — gradient */
          <div
            className="bg-gradient-to-r from-[#9DB8A0] to-[#7A9380] rounded-2xl p-8 text-white overflow-hidden relative"
            onClick={handleBannerClick}
          >
            <button
              onClick={(e) => { e.stopPropagation(); prevBanner() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              ←
            </button>
            <div className="flex-1 mx-16 text-center">
              <div className="text-5xl mb-3">{banners[currentBanner].icon}</div>
              <h3 className="text-2xl font-bold mb-2">{banners[currentBanner].title}</h3>
              <p className="text-white/90">{banners[currentBanner].description}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); nextBanner() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              →
            </button>
          </div>
        )}

        {/* Indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBanner(idx)}
              className={`w-2 h-2 rounded-full transition ${
                idx === currentBanner ? 'bg-[#9DB8A0] w-8' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Recent Posts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-4">{t('home.recentPosts')}</h2>
        {postsLoading ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('common.loading')}</div>
        ) : recentPosts.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('home.noRecentPosts')}</div>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Link href={`/dashboard/community/${post.id}`} key={post.id}>
                <div className="p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <p className="font-semibold text-gray-900">{translatedTitles[post.id] ?? post.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('common.by')} {post.nickname ?? t('common.unknown')} • {timeAgo(post.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trending Posts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-4">{t('home.trendingPosts')}</h2>
        {postsLoading ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('common.loading')}</div>
        ) : trendingPosts.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('home.noTrendingPosts')}</div>
        ) : (
          <div className="space-y-3">
            {trendingPosts.map((post) => (
              <Link href={`/dashboard/community/${post.id}`} key={post.id}>
                <div className="p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <p className="font-semibold text-gray-900">{translatedTitles[post.id] ?? post.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('common.by')} {post.nickname ?? t('common.unknown')} • {timeAgo(post.created_at)} • ♡ {post.like_count}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Guide 언어 선택 모달 */}
      {isGuideLangModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setIsGuideLangModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900">{t('guide.langModal.title')}</h3>
              <button
                onClick={() => setIsGuideLangModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{t('home.banners.services.langHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              {GUIDE_LANGS.map(({ code, flag, label }) => (
                <button
                  key={code}
                  onClick={() => handleGuideLangSelect(code)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#9DB8A0] hover:bg-[#EEF4EF] transition"
                >
                  <span className="text-xl">{flag}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
