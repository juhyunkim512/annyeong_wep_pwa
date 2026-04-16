'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import AvatarImage from '@/components/common/AvatarImage';
import LoginModal from '@/components/common/LoginModal';
import WriteGatherModal from '@/components/gather/WriteGatherModal';
import GatherDetailModal from '@/components/gather/GatherDetailModal';
import { GatherMapView } from '@/components/gather/GatherMap';
import { normalizeLang } from '@/lib/utils/normalizeLang';
import { batchTranslate } from '@/lib/utils/batchTranslate';

interface GatherItem {
  id: string;
  author_id: string;
  title: string;
  content: string | null;
  category: string;
  language: string;
  location_label: string;
  lat: number | null;
  lng: number | null;
  meet_at: string;
  max_participants: number;
  expires_at: string;
  created_at: string;
  nickname: string | null;
  author_image_url: string | null;
  author_flag: string | null;
  participant_count: number;
  // ✅ 확정 상태
  confirmed: boolean;
  confirmed_chat_room_id: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  language: '🗣️', drink: '🍺', sports: '💪', food: '☕', talk: '💬',
  game: '🎮', pet: '🐾', travel: '✈️', sing: '🎤', movie: '🎬', etc: '📌',
};

export default function GatherPage() {
  const { t } = useTranslation('common');
  const [posts, setPosts] = useState<GatherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [translatedContents, setTranslatedContents] = useState<Record<string, string>>({});
  const [translatedLocations, setTranslatedLocations] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  // ── community와 동일한 batchTranslate 기반 번역 헬퍼 ──
  const translateGatherPosts = useCallback(async (postList: GatherItem[], signal: AbortSignal) => {
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

      // 언어가 다른 post만 번역 (최대 30개 — community와 동일)
      const toTranslate = postList
        .filter((p) => normalizeLang(p.language) !== userLang)
        .slice(0, 30);

      if (toTranslate.length === 0) return;

      // title + content + location_label 한 번에 batch
      const items: import('@/lib/utils/batchTranslate').BatchTranslateItem[] = [];
      for (const p of toTranslate) {
        items.push({
          key: `title-${p.id}`,
          contentType: 'post' as const,
          contentId: p.id,
          fieldName: 'title' as const,
          sourceText: p.title,
          sourceLanguage: p.language,
        });
        if (p.content) {
          items.push({
            key: `content-${p.id}`,
            contentType: 'post' as const,
            contentId: p.id,
            fieldName: 'content' as const,
            sourceText: p.content,
            sourceLanguage: p.language,
          });
        }
        if (p.location_label) {
          // location_label은 별도 contentId('-loc' suffix)로 content 필드에 캐싱
          items.push({
            key: `loc-${p.id}`,
            contentType: 'post' as const,
            contentId: `${p.id}-loc`,
            fieldName: 'content' as const,
            sourceText: p.location_label,
            sourceLanguage: p.language,
          });
        }
      }

      const results = await batchTranslate(items, userLang, accessToken, signal);
      if (signal.aborted) return;

      const titleMap: Record<string, string> = {};
      const contentMap: Record<string, string> = {};
      const locationMap: Record<string, string> = {};
      for (const [key, r] of Object.entries(results)) {
        if (!r.isTranslated) continue;
        if (key.startsWith('title-')) titleMap[key.slice(6)] = r.text;
        else if (key.startsWith('content-')) contentMap[key.slice(8)] = r.text;
        else if (key.startsWith('loc-')) locationMap[key.slice(4)] = r.text;
      }
      setTranslatedTitles((prev) => ({ ...prev, ...titleMap }));
      setTranslatedContents((prev) => ({ ...prev, ...contentMap }));
      setTranslatedLocations((prev) => ({ ...prev, ...locationMap }));
    } catch { /* 번역 실패는 무시 — 원문 fallback */ }
  }, []);

  const fetchPosts = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/gather', { signal });
      if (res.ok && !signal.aborted) {
        const data = await res.json();
        const posts = data.posts || [];
        setPosts(posts);
        void translateGatherPosts(posts, signal);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[Gather] fetch error:', err);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [translateGatherPosts]);

  useEffect(() => {
    const controller = new AbortController();
    setTranslatedTitles({});
    setTranslatedContents({});
    setTranslatedLocations({});
    fetchPosts(controller.signal);
    return () => controller.abort();
  }, [fetchPosts, refreshCount]);

  // 1분마다 자동 갱신 (남은 시간 표시 + 만료 글 제거)
  useEffect(() => {
    const interval = setInterval(() => {
      setPosts((prev) => prev.filter((p) => new Date(p.expires_at).getTime() > Date.now()));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return t('gather.expired');
    const totalMin = Math.floor(diff / 60000);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0) return t('gather.timeLeftHour', { hours, minutes });
    return t('gather.timeLeft', { minutes });
  };

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
    } else {
      setIsWriteOpen(true);
    }
  };

  const handleCardClick = (id: string) => {
    setSelectedPostId(id);
    setIsDetailOpen(true);
  };

  const handlePinClick = useCallback((id: string) => {
    setSelectedPostId(id);
    setIsDetailOpen(true);
  }, []);

  const mapPins = posts
    .filter((p) => p.lat && p.lng)
    .map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      lat: p.lat!,
      lng: p.lng!,
      participant_count: p.participant_count,
      max_participants: p.max_participants,
    }));

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">{t('gather.title')}</h1>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 hover:border-[#9DB8A0] transition bg-white"
        >
          {viewMode === 'list' ? t('gather.mapView') : t('gather.listView')}
        </button>
      </div>

      {/* View */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('gather.noGatherings')}</div>
      ) : viewMode === 'list' ? (
        /* ── 리스트 뷰 ── */
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => handleCardClick(post.id)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* 카테고리 + 제목 + 남은 시간 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                      {t(`gather.categories.${post.category}`)}
                    </span>
                    {post.confirmed && (
                      <span className="text-xs bg-[#fff3cd] text-[#856404] px-2 py-0.5 rounded-full font-semibold shrink-0">
                        {t('gather.detail.confirmedBadge')}
                      </span>
                    )}
                    <span className="text-xs text-[#9DB8A0] font-medium whitespace-nowrap shrink-0 ml-auto">
                      {getTimeRemaining(post.expires_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold truncate">{translatedTitles[post.id] ?? post.title}</h3>

                  {/* 내용 (있으면) */}
                  {(translatedContents[post.id] ?? post.content) && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{translatedContents[post.id] ?? post.content}</p>
                  )}

                  {/* 하단 정보 */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      📍 {translatedLocations[post.id] ?? post.location_label}
                    </span>
                    <span className="flex items-center gap-1">
                      👥 {t('gather.participants', { current: post.participant_count, max: post.max_participants })}
                    </span>
                  </div>

                  {/* 작성자 */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <AvatarImage src={post.author_image_url} size={18} />
                    <span className="text-xs text-gray-400">{post.nickname || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── 지도 뷰 ── */
        <GatherMapView pins={mapPins} onPinClick={handlePinClick} />
      )}

      {/* FAB */}
      <button
        className="fixed bottom-8 right-8 z-50 bg-[#9DB8A0] text-white px-5 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition flex items-center gap-2"
        onClick={handleWriteClick}
      >
        + {t('gather.writeGather')}
      </button>

      {/* Modals */}
      <WriteGatherModal
        isOpen={isWriteOpen}
        onClose={() => { setIsWriteOpen(false); setRefreshCount((c) => c + 1); }}
        onRequireLogin={() => { setIsWriteOpen(false); setIsLoginOpen(true); }}
      />
      <GatherDetailModal
        postId={selectedPostId}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedPostId(null); }}
        onRequireLogin={() => { setIsDetailOpen(false); setIsLoginOpen(true); }}
        onChanged={() => setRefreshCount((c) => c + 1)}
      />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
