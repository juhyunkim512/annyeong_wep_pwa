'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import WritePostModal from '@/components/common/WritePostModal';
import LoginModal from '@/components/common/LoginModal';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { normalizeLang } from '@/lib/utils/normalizeLang';
import { batchTranslate } from '@/lib/utils/batchTranslate';

interface Post {
  id: string;
  title: string;
  category: string;
  language: string;
  author_id: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  nickname: string | null;
}

// ── 번역 헬퍼 (모듈 레벨) ─────────────────────────

export default function CommunityPage() {
  const { t } = useTranslation('common');

  const CATEGORIES = [
    { label: t('community.categories.all'), value: '' },
    { label: t('community.categories.food'), value: 'food' },
    { label: t('community.categories.housing'), value: 'housing' },
    { label: t('community.categories.school'), value: 'school' },
    { label: t('community.categories.job'), value: 'job' },
    { label: t('community.categories.hospital'), value: 'hospital' },
    { label: t('community.categories.info'), value: 'info' },
    { label: t('community.categories.free'), value: 'free' },
  ];

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return t('common.justNow');
    if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) });
    if (diff < 86400 * 7) return t('common.daysAgo', { count: Math.floor(diff / 86400) });
    if (diff < 86400 * 30) return t('common.weeksAgo', { count: Math.floor(diff / (86400 * 7)) });
    if (diff < 86400 * 365) return t('common.monthsAgo', { count: Math.floor(diff / (86400 * 30)) });
    return t('common.yearsAgo', { count: Math.floor(diff / (86400 * 365)) });
  };

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  // ── 번역 헬퍼 ──
  const translatePosts = useCallback(async (postList: Post[], signal: AbortSignal) => {
    try {
      if (signal.aborted) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || signal.aborted) return;
      const { data: userProfile } = await supabase
        .from('profile')
        .select('uselanguage')
        .eq('id', session.user.id)
        .maybeSingle();
      const userLang = normalizeLang(userProfile?.uselanguage);
      const accessToken = session.access_token;
      const toTranslate = postList
        .filter((p) => normalizeLang(p.language) !== userLang)
        .slice(0, 30);
      if (toTranslate.length > 0) {
        const items = toTranslate.map((p) => ({
          key: p.id,
          contentType: 'post' as const,
          contentId: p.id,
          fieldName: 'title' as const,
          sourceText: p.title,
          sourceLanguage: p.language,
        }));
        const results = await batchTranslate(items, userLang, accessToken);
        if (!signal.aborted) {
          const map: Record<string, string> = {};
          for (const [key, r] of Object.entries(results)) { if (r.isTranslated) map[key] = r.text; }
          setTranslatedTitles((prev) => ({ ...prev, ...map }));
        }
      }
    } catch { /* 번역 실패는 무시 */ }
  }, []);

  // ── 게시글 fetchPosts (cursor pagination) ──
  const fetchPosts = useCallback(async (cursor: string | null, signal: AbortSignal) => {
    let query = supabase
      .from('post')
      .select('id, title, category, language, author_id, created_at, like_count, comment_count, public_profile(nickname)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (activeCategory) query = query.eq('category', activeCategory);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (signal.aborted) return null;
    if (error) throw error;
    const normalized = (data || []).map((p: any) => ({
      ...p,
      nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
    }));
    return normalized;
  }, [activeCategory]);

  // ── 초기 로드 + 카테고리 / 리프레시 변경 시 ──
  useEffect(() => {
    const controller = new AbortController();
    cursorRef.current = null;
    setHasMore(true);
    setTranslatedTitles({});

    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchPosts(null, controller.signal);
        if (!result || controller.signal.aborted) return;
        setPosts(result);
        setHasMore(result.length >= PAGE_SIZE);
        if (result.length > 0) cursorRef.current = result[result.length - 1].created_at;
        void translatePosts(result, controller.signal);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('[Community] fetchPosts error:', err);
        setError('Failed to load posts');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [refreshCount, activeCategory, fetchPosts, translatePosts]);

  // ── 다음 페이지 로드 ──
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    const controller = new AbortController();
    try {
      const result = await fetchPosts(cursorRef.current, controller.signal);
      if (!result || controller.signal.aborted) return;
      setPosts((prev) => [...prev, ...result]);
      setHasMore(result.length >= PAGE_SIZE);
      if (result.length > 0) cursorRef.current = result[result.length - 1].created_at;
      void translatePosts(result, controller.signal);
    } catch (err) {
      console.error('[Community] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchPosts, translatePosts]);

  // ── IntersectionObserver 무한스크롤 ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
    } else {
      setIsWriteOpen(true);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Title + Search Icon */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">{t('community.title')}</h1>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
              activeCategory === cat.value
                ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#9DB8A0]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{t('community.failedToLoad')}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {t('community.noPostsYet')}
          </div>
        ) : (
          <>
            {posts.map((post) => (
            <Link href={`/dashboard/community/${post.id}`} key={post.id}>
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition cursor-pointer">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                        {post.category || post.language}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold hover:text-[#9DB8A0]">{translatedTitles[post.id] ?? post.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {post.nickname ?? 'Unknown'} · {timeAgo(post.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-500 shrink-0">
                    <span>♡ {post.like_count}</span>
                    <span>💬 {post.comment_count}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
            {/* 무한스크롤 sentinel */}
            <div ref={sentinelRef} />
            {loadingMore && (
              <div className="text-center py-4 text-gray-400 text-sm">{t('common.loading')}</div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-4 text-gray-300 text-xs">{t('community.noMorePosts', '더 이상 게시글이 없습니다')}</div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-50 bg-[#9DB8A0] text-white px-5 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition flex items-center gap-2"
        onClick={handleWriteClick}
      >
        + {t('community.writePost')}
      </button>

      <WritePostModal
        isOpen={isWriteOpen}
        onClose={() => { setIsWriteOpen(false); setRefreshCount((c) => c + 1); }}
        onRequireLogin={() => setIsLoginOpen(true)}
      />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
