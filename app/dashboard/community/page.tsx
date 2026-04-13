'use client'

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import WritePostModal from '@/components/common/WritePostModal';
import LoginModal from '@/components/common/LoginModal';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { getClientTranslation, setClientTranslation } from '@/lib/utils/clientTranslateCache';

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
const LANG_MAP: Record<string, string> = {
  english: 'en', korean: 'ko', japanese: 'ja',
  chinese: 'zh', spanish: 'es', vietnamese: 'vi',
  en: 'en', ko: 'ko', ja: 'ja', zh: 'zh', es: 'es', vi: 'vi',
  'zh-cn': 'zh', 'zh-tw': 'zh', 'zh-hant': 'zh', 'zh-hans': 'zh',
};
function normalizeLang(v?: string | null): string {
  if (!v) return 'en';
  return LANG_MAP[v.toLowerCase().trim()] ?? 'en';
}
async function callTranslate(
  contentId: string,
  sourceText: string,
  sourceLanguage: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<{ text: string; isTranslated: boolean }> {
  const cached = getClientTranslation(contentId, 'title')
  if (cached) return cached
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ contentType: 'post', contentId, fieldName: 'title', sourceText, sourceLanguage }),
      signal,
    });
    if (!res.ok) return { text: sourceText, isTranslated: false };
    const result = await res.json()
    setClientTranslation(contentId, 'title', result)
    return result
  } catch {
    return { text: sourceText, isTranslated: false };
  }
}

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchPosts = async () => {
      setLoading(true);
      setError('');
      try {
        // category는 DB에서 필터, limit 50
        let query = supabase
          .from('post')
          .select('id, title, category, language, author_id, created_at, like_count, comment_count, public_profile(nickname)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (activeCategory) {
          query = query.eq('category', activeCategory);
        }
        const { data, error } = await query;

        if (controller.signal.aborted) return;

        if (error) {
          console.error('[Community] fetchPosts error:', error);
          setError('Failed to load posts');
          setPosts([]);
        } else {
          const normalized = (data || []).map((p: any) => ({
            ...p,
            nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
          }));
          setPosts(normalized);
          // ✅ 포스트 로딩 즉시 해제 — 번역은 백그라운드에서 진행
          setLoading(false);

          // ── 제목 번역 (백그라운드, 로딩 이미 해제 후) ───────────────────
          if (!controller.signal.aborted) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: userProfile } = await supabase
                .from('profile')
                .select('uselanguage')
                .eq('id', session.user.id)
                .maybeSingle();
              const userLang = normalizeLang(userProfile?.uselanguage);
              const accessToken = session.access_token;
              const toTranslate = normalized
                .filter((p) => normalizeLang(p.language) !== userLang)
                .slice(0, 30);
              if (toTranslate.length > 0) {
                const results = await Promise.all(
                  toTranslate.map((p) => callTranslate(p.id, p.title, p.language, accessToken, controller.signal))
                );
                if (!controller.signal.aborted) {
                  const map: Record<string, string> = {};
                  toTranslate.forEach((p, i) => { if (results[i].isTranslated) map[p.id] = results[i].text; });
                  setTranslatedTitles(map);
                }
              }
            }
          }
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('[Community] fetchPosts exception:', err);
        setError('Failed to load posts');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
    return () => controller.abort();
  }, [refreshCount, activeCategory]);

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
    } else {
      setIsWriteOpen(true);
    }
  };

  const filteredPosts = posts;

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
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {t('community.noPostsYet')}
          </div>
        ) : (
          filteredPosts.map((post) => (
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
          ))
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-8 right-8 z-50 bg-[#9DB8A0] text-white px-5 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition flex items-center gap-2"
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
