'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from './AvatarImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

const FLAG_EMOJI_MAP: { [key: string]: string } = {
  korea: '🇰🇷',
  usa: '🇺🇸',
  japan: '🇯🇵',
  china: '🇨🇳',
  vietnam: '🇻🇳',
  spain: '🇪🇸',
  france: '🇫🇷',
  germany: '🇩🇪',
  thailand: '🇹🇭',
  philippines: '🇵🇭',
};
const getFlagEmoji = (v?: string) => FLAG_EMOJI_MAP[v || ''] || '';

interface UserProfile {
  nickname: string;
  flag?: string;
  image_url?: string;
}

interface UserPost {
  id: string;
  title: string;
  created_at: string;
}

interface UserProfileModalProps {
  userId: string;
  currentUserId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
  onBlockChange?: () => void;
}

export default function UserProfileModal({
  userId,
  currentUserId,
  isOpen,
  onClose,
  onLoginRequired,
  onBlockChange,
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [blockSuccess, setBlockSuccess] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const { t } = useTranslation('common');
  const router = useRouter();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

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

  // Profile + block status + 첫 페이지 posts: 모달 열릴 때 실행
  useEffect(() => {
    if (!isOpen || !userId) return;
    setPage(0);
    const fetchData = async () => {
      setLoading(true);
      setMenuOpen(false);
      setBlockError('');
      setBlockSuccess('');

      // Profile
      const { data: profileData } = await supabase
        .from('profile')
        .select('nickname, flag, image_url')
        .eq('id', userId)
        .maybeSingle();
      setProfile(profileData);

      // Posts: 6개 fetch → 5개 표시 + hasMore 감지
      const { data: postData } = await supabase
        .from('post')
        .select('id, title, created_at')
        .eq('author_id', userId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .range(0, 5);
      setPosts((postData || []).slice(0, 5));
      setHasMore((postData || []).length > 5);

      // Block status
      if (currentUserId) {
        const { data: blockRow } = await supabase
          .from('user_block')
          .select('id')
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', userId)
          .maybeSingle();
        setIsBlocked(!!blockRow);
      } else {
        setIsBlocked(false);
      }

      // Follow status
      if (currentUserId && currentUserId !== userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const res = await fetch(`/api/follow?targetUserId=${userId}`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const json = await res.json();
              setIsFollowing(json.isFollowing ?? false);
            }
          } catch { setIsFollowing(false); }
        } else {
          setIsFollowing(false);
        }
      } else {
        setIsFollowing(false);
      }

      setLoading(false);
    };
    fetchData();
  }, [isOpen, userId, currentUserId]);

  // page > 0 일 때 posts만 재조회
  useEffect(() => {
    if (!isOpen || !userId || page === 0) return;
    const fetchPosts = async () => {
      const { data: postData } = await supabase
        .from('post')
        .select('id, title, created_at')
        .eq('author_id', userId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .range(page * 5, page * 5 + 5);
      setPosts((postData || []).slice(0, 5));
      setHasMore((postData || []).length > 5);
    };
    fetchPosts();
  }, [isOpen, userId, page]);

  const handleBlock = async () => {
    if (!currentUserId) {
      onLoginRequired();
      return;
    }
    setBlockLoading(true);
    setBlockError('');
    setBlockSuccess('');
    const { error } = await supabase
      .from('user_block')
      .insert({ blocker_id: currentUserId, blocked_id: userId });
    if (error) {
      if (error.code === '23505') {
        setBlockError(t('community.blockAlready'));
      } else {
        setBlockError(t('community.blockFailed'));
      }
    } else {
      setIsBlocked(true);
      setBlockSuccess(t('community.blockSuccess'));
      onBlockChange?.();
    }
    setBlockLoading(false);
    setMenuOpen(false);
  };

  const handleUnblock = async () => {
    if (!currentUserId) {
      onLoginRequired();
      return;
    }
    setBlockLoading(true);
    setBlockError('');
    setBlockSuccess('');
    const { error } = await supabase
      .from('user_block')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId);
    if (error) {
      setBlockError(t('community.unblockFailed'));
    } else {
      setIsBlocked(false);
      setBlockSuccess(t('community.unblockSuccess'));
      onBlockChange?.();
    }
    setBlockLoading(false);
    setMenuOpen(false);
  };

  const handleFollow = async () => {
    if (!currentUserId) { onLoginRequired(); return; }
    setFollowLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setFollowLoading(false); onLoginRequired(); return; }
    const method = isFollowing ? 'DELETE' : 'POST';
    try {
      const res = await fetch('/api/follow', {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (res.ok) setIsFollowing(!isFollowing);
    } catch { /* ignore */ }
    setFollowLoading(false);
  };

  const handleChat = async () => {
    if (!currentUserId) { onLoginRequired(); return; }
    setChatLoading(true);
    // user_a < user_b 보장 (중복 방지)
    const userA = currentUserId < userId ? currentUserId : userId;
    const userB = currentUserId < userId ? userId : currentUserId;
    // upsert: 이미 있으면 그 방으로, 없으면 생성
    const { data, error } = await supabase
      .from('chat_room')
      .upsert({ user_a: userA, user_b: userB }, { onConflict: 'user_a,user_b', ignoreDuplicates: false })
      .select('id')
      .maybeSingle();
    if (!error && data?.id) {
      // 내 hidden 플래그 해제 (나갔다가 다시 들어오는 경우)
      const field = currentUserId < userId ? 'user_a_hidden' : 'user_b_hidden';
      await supabase.from('chat_room').update({ [field]: false }).eq('id', data.id);
      onClose();
      router.push(`/dashboard/chat/${data.id}`);
    }
    setChatLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-5 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">{t('community.userProfile')}</h2>
          <div className="flex items-center gap-2">
            {/* ••• menu — only show if not self and logged in */}
            {currentUserId && currentUserId !== userId && (
              <div className="relative">
                <button
                  className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded text-base leading-none"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  •••
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-36">
                      {isBlocked ? (
                        <button
                          className="w-full text-center py-3 text-sm text-blue-500 hover:bg-gray-50"
                          onClick={handleUnblock}
                          disabled={blockLoading}
                        >
                          {t('community.unblockUser')}
                        </button>
                      ) : (
                        <button
                          className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50"
                          onClick={handleBlock}
                          disabled={blockLoading}
                        >
                          {t('community.blockUser')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl ml-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
          ) : !profile ? (
            <div className="text-center py-8 text-gray-400">{t('community.userNotFound')}</div>
          ) : (
            <>
              {/* Profile info */}
              <div className="flex items-center gap-4 mb-5">
                <AvatarImage src={profile.image_url} size={64} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{profile.nickname}</span>
                    {profile.flag && (
                      <span className="text-2xl">{getFlagEmoji(profile.flag)}</span>
                    )}
                  </div>
                  {isBlocked && (
                    <span className="text-xs text-orange-500 mt-1 block">
                      {t('community.youAreBlocked')}
                    </span>
                  )}
                  {currentUserId && currentUserId !== userId && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                          isFollowing
                            ? 'bg-white text-[#9DB8A0] border-[#9DB8A0] hover:bg-red-50 hover:text-red-500 hover:border-red-400'
                            : 'bg-[#9DB8A0] text-white border-[#9DB8A0] hover:opacity-90'
                        } disabled:opacity-60`}
                      >
                        {followLoading ? '...' : isFollowing ? t('common.following') : t('common.follow')}
                      </button>
                      <button
                        onClick={handleChat}
                        disabled={chatLoading}
                        className="px-3 py-1 rounded-full text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition"
                      >
                        {chatLoading ? '...' : t('chat.button')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback messages */}
              {blockError && (
                <p className="text-sm text-red-500 mb-3 text-center">{blockError}</p>
              )}
              {blockSuccess && (
                <p className="text-sm text-[#9DB8A0] mb-3 text-center">{blockSuccess}</p>
              )}

              {/* Posts */}
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">
                {t('community.posts')}
              </h3>
              {posts.length === 0 ? (
                <p className="text-sm text-gray-400">{t('community.noPostsAvailable')}</p>
              ) : (
                <div className="space-y-2">
                  {posts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/community/${p.id}`}
                      onClick={onClose}
                    >
                      <div className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {p.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {timeAgo(p.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {/* 페이지네이션 */}
                  {(page > 0 || hasMore) && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                      <button
                        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 0}
                      >
                        ← {t('common.prev')}
                      </button>
                      <span className="text-xs text-gray-400">{page + 1}</span>
                      <button
                        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!hasMore}
                      >
                        {t('common.next')} →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
