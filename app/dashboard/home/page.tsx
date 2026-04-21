'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import { type AppLang } from '@/lib/i18n'
import { normalizeLang } from '@/lib/utils/normalizeLang'
import { batchTranslate } from '@/lib/utils/batchTranslate'

const GUIDE_LANGS: { code: AppLang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
]

const CATEGORY_EMOJI: Record<string, string> = {
  language: '🗣️', drink: '🍺', sports: '💪', food: '☕', talk: '💬',
  game: '🎮', pet: '🐾', travel: '✈️', sing: '🎤', movie: '🎬', etc: '📌',
}

interface PostSummary {
  id: string
  title: string
  language: string
  created_at: string
  like_count: number
  nickname: string | null
}

interface GatherSummary {
  id: string
  title: string
  category: string
  language: string
  location_label: string
  meet_at: string
  participant_count: number
  max_participants: number
  expires_at: string
  nickname: string | null
}

export default function HomePage() {
  const { t } = useTranslation('common')
  const router = useRouter()
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

  const [trendingPosts, setTrendingPosts] = useState<PostSummary[]>([])
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({})
  const [postsLoading, setPostsLoading] = useState(true)

  const [gatherItems, setGatherItems] = useState<GatherSummary[]>([])
  const [gatherLoading, setGatherLoading] = useState(true)

  // request id ref: 최신 요청만 상태 반영
  const reqRef = useRef(0)

  useEffect(() => {
    const reqId = ++reqRef.current
    const controller = new AbortController()
    const fetchData = async () => {
      // 세션 상태 디버그 로그
      const { data: { session: dbgSession } } = await supabase.auth.getSession()
      console.log('[home] session exists:', !!dbgSession, 'user id:', dbgSession?.user?.id ?? 'null')

      setPostsLoading(true)
      setGatherLoading(true)
      try {
        const threeDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        // Trending posts + Gather 병렬 fetch
        const [{ data: trending }, gatherRes] = await Promise.all([
          supabase
            .from('post')
            .select('id, title, language, created_at, like_count, public_profile(nickname)')
            .gte('created_at', threeDaysAgo)
            .gte('like_count', 1)
            .order('like_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(3),
          fetch('/api/gather', { signal: controller.signal }),
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

        const normalizedTrending = normalize(trending ?? [])
        setTrendingPosts(normalizedTrending)
        setPostsLoading(false)

        if (gatherRes.ok) {
          const gatherData = await gatherRes.json()
          const now = Date.now()
          const items: GatherSummary[] = ((gatherData.posts || []) as any[])
            .filter((p: any) => new Date(p.expires_at).getTime() > now)
            .slice(0, 3)
            .map((p: any) => ({
              id: p.id,
              title: p.title,
              category: p.category,
              language: p.language ?? 'english',
              location_label: p.location_label ?? '',
              meet_at: p.meet_at,
              participant_count: p.participant_count ?? 0,
              max_participants: p.max_participants ?? 0,
              expires_at: p.expires_at,
              nickname: p.nickname ?? null,
            }))
          if (reqRef.current === reqId) {
            setGatherItems(items)
          }
        }
        setGatherLoading(false)

        // ── 번역: 트렌딩 포스트 제목 번역 ──
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
            const toTranslate = normalizedTrending.filter((p) => normalizeLang(p.language) !== userLang)
            if (toTranslate.length > 0) {
              const batchItems = toTranslate.map((p) => ({
                key: p.id,
                contentType: 'post' as const,
                contentId: p.id,
                fieldName: 'title' as const,
                sourceText: p.title,
                sourceLanguage: p.language,
              }))
              const batchResults = await batchTranslate(batchItems, userLang, accessToken, controller.signal)
              if (reqRef.current === reqId) {
                const map: Record<string, string> = {}
                for (const p of toTranslate) {
                  const res = batchResults[p.id]
                  if (res?.isTranslated) map[p.id] = res.text
                }
                setTranslatedTitles(map)
              }
            }
          } catch (err) {
            if ((err as Error)?.name !== 'AbortError') {
              console.warn('[Home] translation batch failed:', err)
            }
          }
        })()
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[Home] fetchData error:', err)
        }
      } finally {
        if (reqRef.current === reqId) {
          setPostsLoading(false)
          setGatherLoading(false)
        }
      }
    }
    fetchData()
    return () => controller.abort()
  }, [])

  const banner1 = { image: '/banner1.png', isGuide: false, href: 'https://cod-clay-40439412.figma.site/', communityLink: false }

  const handleBannerClick = () => {
    if (banner1.communityLink) {
      router.push('/dashboard/community')
    } else if (banner1.isGuide) {
      setIsGuideLangModalOpen(true)
    } else if (banner1.href) {
      window.open(banner1.href, '_blank', 'noopener,noreferrer')
    }
  }

  const handleGuideLangSelect = (code: AppLang) => {
    setIsGuideLangModalOpen(false)
    router.push(`/guide?lang=${code}`)
  }

  return (
    <div className="max-w-6xl space-y-8">
      {/* Banner */}
      <section className="relative">
        <div
          className="relative rounded-2xl overflow-hidden cursor-pointer active:opacity-90"
          onClick={handleBannerClick}
        >
          <Image
            src={banner1.image}
            alt="banner 1"
            width={1200}
            height={400}
            className="w-full object-cover"
            priority
          />
          {/* 오른쪽 텍스트 오버레이 */}
          <div className="absolute inset-y-0 right-0 w-1/2 flex flex-col items-start justify-center px-6 gap-2 pointer-events-none">
            <p className="text-[#2d4a35] font-extrabold text-sm sm:text-base leading-snug drop-shadow-sm">
              {t('home.banners.banner1.title')}
            </p>
            <p className="text-[#3d5c45] text-xs sm:text-sm leading-snug">
              {t('home.banners.banner1.desc')}
            </p>
            <span className="pointer-events-auto mt-1 inline-block bg-[#3a5c42] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow">
              {t('home.banners.banner1.cta')}
            </span>
          </div>
        </div>
      </section>

      {/* Trending Posts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{t('home.trendingPosts')}</h2>
          <Link href="/dashboard/community" className="text-sm text-[#9DB8A0] font-medium hover:underline">
            {t('home.viewAll')}
          </Link>
        </div>
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

      {/* 모여라 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{t('gather.title')}</h2>
          <Link href="/dashboard/gather" className="text-sm text-[#9DB8A0] font-medium hover:underline">
            {t('home.viewAll')}
          </Link>
        </div>
        {gatherLoading ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('common.loading')}</div>
        ) : gatherItems.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">{t('gather.noGatherings')}</div>
        ) : (
          <div className="space-y-3">
            {gatherItems.map((item) => {
              const diff = new Date(item.expires_at).getTime() - Date.now()
              const totalMin = Math.floor(diff / 60000)
              const hours = Math.floor(totalMin / 60)
              const minutes = totalMin % 60
              const timeLeft = hours > 0
                ? t('gather.timeLeftHour', { hours, minutes })
                : t('gather.timeLeft', { minutes })
              return (
                <Link href="/dashboard/gather" key={item.id}>
                  <div className="p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {CATEGORY_EMOJI[item.category] ?? '📌'} {item.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          📍 {item.location_label} • {t('gather.participants', { current: item.participant_count, max: item.max_participants })}
                        </p>
                      </div>
                      <span className="text-xs text-[#9DB8A0] font-medium whitespace-nowrap shrink-0">{timeLeft}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
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

