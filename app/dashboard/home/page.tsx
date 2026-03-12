'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

interface PostSummary {
  id: string
  title: string
  created_at: string
  like_count: number
  nickname: string | null
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

export default function HomePage() {
  const [currentBanner, setCurrentBanner] = useState(0)
  const [recentPosts, setRecentPosts] = useState<PostSummary[]>([])
  const [trendingPosts, setTrendingPosts] = useState<PostSummary[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      setPostsLoading(true)

      // Recent Posts: 최신 3개
      const { data: recent } = await supabase
        .from('post')
        .select('id, title, created_at, like_count, profile(nickname)')
        .order('created_at', { ascending: false })
        .limit(3)

      // Trending Posts: 3일 이내 like_count 높은 순 3개
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: trending } = await supabase
        .from('post')
        .select('id, title, created_at, like_count, public_profile(nickname)')
        .gte('created_at', threeDaysAgo)
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)

      const normalize = (rows: any[]): PostSummary[] =>
        (rows || []).map((r) => ({
          id: r.id,
          title: r.title,
          created_at: r.created_at,
          like_count: r.like_count,
          nickname: Array.isArray(r.public_profile) ? r.public_profile[0]?.nickname : r.public_profile?.nickname ?? null,
        }))

      setRecentPosts(normalize(recent ?? []))
      setTrendingPosts(normalize(trending ?? []))
      setPostsLoading(false)
    }
    fetchPosts()
  }, [])

  const banners = [
    { title: 'Support Policies for Foreigners', description: '2024 New Policies and Funding Information', icon: '🏛️' },
    { title: 'Visa & Residence Updates', description: 'Latest Visa Regulations and Changes', icon: '📄' },
    { title: 'Services for Internationals', description: 'Discover All ANNYEONG Services', icon: '✨' },
    { title: 'ANNYEONG Announcements', description: 'Community Updates & New Features', icon: '📢' },
  ]

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

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
        <h2 className="text-2xl font-bold mb-4">Recent Posts</h2>
        {postsLoading ? (
          <div className="text-gray-400 text-sm py-4 text-center">Loading...</div>
        ) : recentPosts.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">No recent posts yet.</div>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Link href={`/dashboard/community/${post.id}`} key={post.id}>
                <div className="p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <p className="font-semibold text-gray-900">{post.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    by {post.nickname ?? 'Unknown'} • {timeAgo(post.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trending Posts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-4">Trending Posts</h2>
        {postsLoading ? (
          <div className="text-gray-400 text-sm py-4 text-center">Loading...</div>
        ) : trendingPosts.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">No trending posts right now.</div>
        ) : (
          <div className="space-y-3">
            {trendingPosts.map((post) => (
              <Link href={`/dashboard/community/${post.id}`} key={post.id}>
                <div className="p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <p className="font-semibold text-gray-900">{post.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    by {post.nickname ?? 'Unknown'} • {timeAgo(post.created_at)} • ♡ {post.like_count}
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
