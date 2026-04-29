'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { normalizeLang } from '@/lib/utils/normalizeLang';
import { batchTranslate } from '@/lib/utils/batchTranslate';
import UserProfileModal from '@/components/common/UserProfileModal';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';



interface Participant {
  user_id: string;
  nickname: string | null;
  image_url: string | null;
  flag: string | null;
}

interface GatherDetailModalProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
  onChanged: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  language: '🗣️', drink: '🍺', sports: '💪', food: '☕', talk: '💬',
  game: '🎮', pet: '🐾', travel: '✈️', sing: '🎤', movie: '🎬', etc: '📌',
};

const FLAG_EMOJI_MAP: Record<string, string> = {
  korea: '🇰🇷', usa: '🇺🇸', japan: '🇯🇵', china: '🇨🇳',
  vietnam: '🇻🇳', spain: '🇪🇸', france: '🇫🇷', germany: '🇩🇪',
  thailand: '🇹🇭', philippines: '🇵🇭',
};

export default function GatherDetailModal({
  postId,
  isOpen,
  onClose,
  onRequireLogin,
  onChanged,
}: GatherDetailModalProps) {
  const { t } = useTranslation('common');
  useBodyScrollLock(isOpen);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [translatedPost, setTranslatedPost] = useState<{
    
    title: string;
    content: string | null;
    locationLabel: string;
  } | null>(null);

  const isJoined = participants.some((p) => p.user_id === currentUserId);
  const isFull = post && participants.length >= post.max_participants;
  const isAuthor = post && currentUserId && post.author_id === currentUserId;
  // ✅ 확정 상태의 단일 기준: gather_post.confirmed
  const isConfirmed = !!(post?.confirmed);

  const fetchDetail = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setTranslatedPost(null);

    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);

    // 글 정보 + 참석자 병렬 조회
    const [postResult, partResult] = await Promise.all([
      supabase
        .from('gather_post')
        .select('*, public_profile(nickname, image_url, flag)')
        .eq('id', postId)
        .maybeSingle(),
      supabase
        .from('gather_participant')
        .select('user_id, public_profile(nickname, image_url, flag)')
        .eq('gather_post_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    const postData = postResult.data;
    if (postData) {
      const normalizedPost = {
        ...postData,
        nickname: Array.isArray(postData.public_profile) ? postData.public_profile[0]?.nickname : postData.public_profile?.nickname ?? null,
        author_image_url: Array.isArray(postData.public_profile) ? postData.public_profile[0]?.image_url : postData.public_profile?.image_url ?? null,
        author_flag: Array.isArray(postData.public_profile) ? postData.public_profile[0]?.flag : postData.public_profile?.flag ?? null,
      };
      setPost(normalizedPost);

      // ── 번역: 백그라운드로 실행 (로딩 UI에 영향 없음) ──
      if (session) {
        void (async () => {
          try {
            const { data: userProfile } = await supabase
              .from('profile')
              .select('uselanguage')
              .eq('id', session.user.id)
              .maybeSingle();
            const userLang = normalizeLang(userProfile?.uselanguage);
            const postLang = normalizeLang(postData.language);

            if (userLang !== postLang) {
              const items: import('@/lib/utils/batchTranslate').BatchTranslateItem[] = [
                { key: 'title', contentType: 'post', contentId: postData.id, fieldName: 'title', sourceText: postData.title, sourceLanguage: postData.language },
              ];
              if (postData.content) {
                items.push({ key: 'content', contentType: 'post', contentId: postData.id, fieldName: 'content', sourceText: postData.content, sourceLanguage: postData.language });
              }
              if (postData.location_label) {
                items.push({ key: 'loc', contentType: 'post', contentId: `${postData.id}-loc`, fieldName: 'content', sourceText: postData.location_label, sourceLanguage: postData.language });
              }
              const results = await batchTranslate(items, userLang, session.access_token);
              setTranslatedPost({
                title: results['title']?.isTranslated ? results['title'].text : postData.title,
                content: results['content']?.isTranslated ? results['content'].text : postData.content,
                locationLabel: results['loc']?.isTranslated ? results['loc'].text : postData.location_label,
              });
            }
          } catch { /* 번역 실패 시 원문 표시 */ }
        })();
      }
    }

    if (partResult.data) {
      setParticipants(partResult.data.map((p: any) => ({
        user_id: p.user_id,
        nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
        image_url: Array.isArray(p.public_profile) ? p.public_profile[0]?.image_url : p.public_profile?.image_url ?? null,
        flag: Array.isArray(p.public_profile) ? p.public_profile[0]?.flag : p.public_profile?.flag ?? null,
      })));
    }

    setLoading(false);
  }, [postId]);

  useEffect(() => {
    if (isOpen && postId) fetchDetail();
  }, [isOpen, postId, fetchDetail]);

  const getTimeRemaining = () => {
    if (!post) return '';
    const diff = new Date(post.expires_at).getTime() - Date.now();
    if (diff <= 0) return t('gather.expired');
    const totalMin = Math.floor(diff / 60000);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0) return t('gather.timeLeftHour', { hours, minutes });
    return t('gather.timeLeft', { minutes });
  };

  const formatMeetTime = () => {
    if (!post) return '';
    const d = new Date(post.meet_at);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const handleParticipantClick = (userId: string) => {
  setSelectedProfileUserId(userId);
  setIsProfileOpen(true);
  };


  const handleJoin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { onRequireLogin(); return; }

    setJoining(true);
    try {
      await fetch(`/api/gather/${postId}/participants`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await fetchDetail();
      onChanged();
    } catch { /* ignore */ }
    setJoining(false);
  };

  const handleLeave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLeaving(true);
    try {
      await fetch(`/api/gather/${postId}/participants`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await fetchDetail();
      onChanged();
    } catch { /* ignore */ }
    setLeaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(t('gather.detail.deleteConfirm'))) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setDeleting(true);
    try {
      await fetch('/api/gather', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ postId }),
      });
      onChanged();
      onClose();
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const handleConfirm = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setConfirming(true);
    try {
      const res = await fetch(`/api/gather/${postId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        await fetchDetail();
        onChanged();
        onClose();
        router.push('/dashboard/gather');
      }
    } catch { /* ignore */ }
    setConfirming(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>

        {loading ? (
          <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
        ) : !post ? (
          <div className="text-center py-12 text-gray-400">{t('gather.noGatherings')}</div>
        ) : (
          <div className="space-y-4">
            {/* 카테고리 + 제목 */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t(`gather.categories.${post.category}`)}
                </span>
                {isAuthor && (
                  <span className="text-xs bg-[#f0f5f1] text-[#6b8f6e] px-2 py-0.5 rounded-full">
                    {t('gather.detail.myGathering')}
                  </span>
                )}
                {isConfirmed && (
                  <span className="text-xs bg-[#fff3cd] text-[#856404] px-2 py-0.5 rounded-full font-semibold">
                    {t('gather.detail.confirmedBadge')}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold">{translatedPost?.title ?? post.title}</h3>
            </div>

            {/* 내용 */}
            {(translatedPost?.content ?? post.content) && (
              <p className="text-sm text-gray-600">{translatedPost?.content ?? post.content}</p>
            )}

            {/* 정보 카드 */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('gather.detail.location')}</span>
                <span className="font-medium">📍 {translatedPost?.locationLabel ?? post.location_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('gather.detail.meetTime')}</span>
                <span className="font-medium">{formatMeetTime()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('gather.detail.timeRemaining')}</span>
                <span className="font-medium text-[#9DB8A0]">{getTimeRemaining()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('gather.detail.participants')}</span>
                <span className="font-medium">{t('gather.participants', { current: participants.length, max: post.max_participants })}</span>
              </div>
            </div>

            {/* 작성자 */}
            <div className="flex items-center gap-2">
              <AvatarImage src={post.author_image_url} size={28} />
              <span className="text-sm text-gray-700">
                {post.author_flag && FLAG_EMOJI_MAP[post.author_flag] ? FLAG_EMOJI_MAP[post.author_flag] + ' ' : ''}
                {post.nickname || 'Unknown'}
              </span>
            </div>

            {/* 참석자 목록 */}
            {participants.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">{t('gather.detail.participants')} ({participants.length})</p>
                <div className="flex flex-wrap gap-3">
                  {participants.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => handleParticipantClick(p.user_id)}
                      className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-3 py-1 hover:bg-gray-100 transition"
                    >
                      <AvatarImage src={p.image_url} size={24} />
                      <span className="text-xs text-gray-700">
                        {p.flag && FLAG_EMOJI_MAP[p.flag] ? FLAG_EMOJI_MAP[p.flag] + ' ' : ''}
                        {p.nickname || 'Unknown'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
            )}

            {/* 액션 버튼 */}
            <div className="pt-2 space-y-2">
              {/* 단톡방 이동 버튼 (확정 후 참석자) */}
              {isConfirmed && isJoined && (
                <button
                  onClick={() => {
                    // ✅ confirmed_chat_room_id 우선, fallback chat_room_id
                    const roomId = post.confirmed_chat_room_id ?? post.chat_room_id;
                    router.push(`/dashboard/gather/chat/${roomId}`);
                    onClose();
                  }}
                  className="w-full py-3 rounded-lg font-semibold text-white bg-[#7BA17E] hover:opacity-90 transition"
                >
                  💬 {t('gather.detail.chatCreated')}
                </button>
              )}

              {/* 모임 확정 버튼 (작성자 + 미확정 + 참석자 2명 이상) */}
              {isAuthor && !isConfirmed && participants.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-400 text-center mb-1">{t('gather.detail.confirmDesc')}</p>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="w-full py-3 rounded-lg font-semibold text-white bg-[#9DB8A0] hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {confirming ? t('gather.detail.confirming') : `🎉 ${t('gather.detail.confirm')}`}
                  </button>
                </div>
              )}

              {/* 참석/취소 버튼 (미확정일 때만) */}
              {!isConfirmed && (
                isJoined ? (
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="w-full py-3 rounded-lg font-semibold border-2 border-[#9DB8A0] text-[#9DB8A0] hover:bg-[#f0f5f1] disabled:opacity-50 transition"
                  >
                    {leaving ? '...' : t('gather.detail.leave')}
                  </button>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joining || isFull}
                    className="w-full py-3 rounded-lg font-semibold text-white bg-[#9DB8A0] hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {joining ? '...' : isFull ? t('gather.detail.full') : t('gather.detail.join')}
                  </button>
                )
              )}

              {/* 모임 삭제 버튼 (작성자 + 미확정일 때만) */}
              {isAuthor && !isConfirmed && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition"
                >
                  {deleting ? '...' : t('gather.detail.delete')}
                </button>
                
              )}
              
            </div>
          </div>
        )}
        
{selectedProfileUserId && (
  <UserProfileModal
    userId={selectedProfileUserId}
    currentUserId={currentUserId}
    isOpen={isProfileOpen}
    onClose={() => {
      setIsProfileOpen(false);
      setSelectedProfileUserId(null);
    }}
    onLoginRequired={onRequireLogin}
  />
)}


        
      </div>
    </div>
  );
}

