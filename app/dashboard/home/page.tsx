'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

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
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ contentType: 'post', contentId, fieldName: 'title', sourceText, sourceLanguage }),
      signal,
    })
    if (!res.ok) return { text: sourceText, isTranslated: false }
    return await res.json()
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
  const [currentBanner, setCurrentBanner] = useState(0)

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
        const [{ data: recent }, { data: trending }] = await Promise.all([
          supabase
            .from('post')
            .select('id, title, language, created_at, like_count, public_profile(nickname)')
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('post')
            .select('id, title, language, created_at, like_count, public_profile(nickname)')
            .gte('like_count', 10)
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

        // ── 제목 번역 ───────────────────────────────────
        const { data: { session } } = await supabase.auth.getSession()
        if (session && reqRef.current === reqId) {
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
            if (reqRef.current === reqId && !controller.signal.aborted) {
              const map: Record<string, string> = {}
              toTranslate.forEach((p, i) => { if (results[i].isTranslated) map[p.id] = results[i].text })
              setTranslatedTitles(map)
            }
          }
        }
      } catch (err) {
        if (reqRef.current !== reqId) return
        console.error('[Home] fetchPosts error:', err)
      } finally {
        if (reqRef.current === reqId) setPostsLoading(false)
      }
    }
    fetchPosts()
    return () => controller.abort()
  }, [])

  const banners = [
    { title: t('home.banners.services.title'), description: t('home.banners.services.desc'), icon: '✨' },
    { title: t('home.banners.policy.title'), description: t('home.banners.policy.desc'), icon: '🏙️' },
    { title: t('home.banners.announcements.title'), description: t('home.banners.announcements.desc'), icon: '📢' },
  ]

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  // 2초마다 자동 슬라이드 — cleanup으로 메모리 누수 방지
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
        <div className="bg-gradient-to-r from-[#9DB8A0] to-[#7A9380] rounded-2xl p-8 text-white overflow-hidden">
          <div className="flex items-center justify-between">
            <button
              onClick={prevBanner}
              className="absolute left-4 z-10 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              ←
            </button>

            <div className="flex-1 mx-16 text-center">
              <div className="text-5xl mb-3">{banners[currentBanner].icon}</div>
              <h3 className="text-2xl font-bold mb-2">{banners[currentBanner].title}</h3>
              <p className="text-white/90">{banners[currentBanner].description}</p>
            </div>

            <button
              onClick={nextBanner}
              className="absolute right-4 z-10 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              →
            </button>
          </div>
        </div>

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
    </div>
  )
}
