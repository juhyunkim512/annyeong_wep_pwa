'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AvatarImage from '@/components/common/AvatarImage';
import LoginModal from '@/components/common/LoginModal';
import UserProfileModal from '@/components/common/UserProfileModal';
import { useTranslation } from 'react-i18next';

const FLAG_EMOJI_MAP: { [key: string]: string } = {
  korea: '🇰🇷',
  usa: '🇺🇸',
  jpan: '🇯🇵',
  china: '🇨🇳',
  vietnam: '🇻🇳',
  spain: '🇪🇸',
  france: '🇫🇷',
  germany: '🇩🇪',
  thailand: '🇹🇭',
  philippines: '🇵🇭',
};
const getFlagEmoji = (v?: string) => FLAG_EMOJI_MAP[v || ''] || '';

interface BlockedUser {
  blocked_id: string;
  nickname: string;
  flag?: string;
  image_url?: string;
}

interface FollowingUser {
  following_id: string;
  nickname: string;
  flag?: string;
  image_url?: string;
}

// [추가] Follower 인터페이스
interface FollowerUser {
  follower_id: string;
  nickname: string;
  flag?: string;
  image_url?: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  // [수정] followers 탭 추가
  const [tab, setTab] = useState<'following' | 'followers' | 'blocked'>('following');
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [followerUsers, setFollowerUsers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        if (!sessionData.session) {
          setIsLoggedIn(false);
          return;
        }
        setIsLoggedIn(true);
        const userId = sessionData.session.user.id;
        setCurrentUserId(userId);

        // Following users — 2단계 조회 (FK 조인 대신)
        const { data: followRows, error: followError } = await supabase
          .from('user_follow')
          .select('following_id')
          .eq('follower_id', userId)
          .order('created_at', { ascending: false });

        if (followError) {
          console.error('[Friends] user_follow 조회 실패:', followError);
        }

        if (!controller.signal.aborted && followRows && followRows.length > 0) {
          const followingIds = followRows.map((r: any) => r.following_id);

          const { data: profileRows, error: profileError } = await supabase
            .from('profile')
            .select('id, nickname, flag, image_url, is_deleted')
            .in('id', followingIds);

          if (profileError) {
            console.error('[Friends] profile 조회 실패:', profileError);
          }

          const profileMap: Record<string, any> = {};
          (profileRows || []).forEach((p: any) => { profileMap[p.id] = p; });

          const following: FollowingUser[] = followRows
            .filter((row: any) => !profileMap[row.following_id]?.is_deleted)
            .map((row: any) => ({
              following_id: row.following_id,
              nickname: profileMap[row.following_id]?.nickname || 'Unknown',
              flag: profileMap[row.following_id]?.flag,
              image_url: profileMap[row.following_id]?.image_url,
            }));
          setFollowingUsers(following);
        } else if (!controller.signal.aborted) {
          setFollowingUsers([]);
        }

        // [추가] Followers — following_id = 현재 유저인 row 조회
        const { data: followerRows, error: followerError } = await supabase
          .from('user_follow')
          .select('follower_id')
          .eq('following_id', userId)
          .order('created_at', { ascending: false });

        if (followerError) {
          console.error('[Friends] followers 조회 실패:', followerError);
        }

        if (!controller.signal.aborted && followerRows && followerRows.length > 0) {
          const followerIds = followerRows.map((r: any) => r.follower_id);
          const { data: followerProfileRows } = await supabase
            .from('profile')
            .select('id, nickname, flag, image_url, is_deleted')
            .in('id', followerIds);

          const followerProfileMap: Record<string, any> = {};
          (followerProfileRows || []).forEach((p: any) => { followerProfileMap[p.id] = p; });

          const followers: FollowerUser[] = followerRows
            .filter((row: any) => !followerProfileMap[row.follower_id]?.is_deleted)
            .map((row: any) => ({
              follower_id: row.follower_id,
              nickname: followerProfileMap[row.follower_id]?.nickname || 'Unknown',
              flag: followerProfileMap[row.follower_id]?.flag,
              image_url: followerProfileMap[row.follower_id]?.image_url,
            }));
          setFollowerUsers(followers);
        } else if (!controller.signal.aborted) {
          setFollowerUsers([]);
        }

        const { data: blockRows } = await supabase
          .from('user_block')
          .select('blocked_id, profile:blocked_id(nickname, flag, image_url)')
          .eq('blocker_id', userId)
          .order('created_at', { ascending: false });

        if (controller.signal.aborted) return;

        const users: BlockedUser[] = (blockRows || []).map((row: any) => ({
          blocked_id: row.blocked_id,
          nickname: row.profile?.nickname || 'Unknown',
          flag: row.profile?.flag,
          image_url: row.profile?.image_url,
        }));
        setBlockedUsers(users);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('[Friends] fetchData exception:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  const handleUnblock = async (blockedId: string) => {
    setUnblockLoading(blockedId);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      setUnblockLoading(null);
      return;
    }
    await supabase
      .from('user_block')
      .delete()
      .eq('blocker_id', sessionData.session.user.id)
      .eq('blocked_id', blockedId);
    setBlockedUsers((prev) => prev.filter((u) => u.blocked_id !== blockedId));
    setUnblockLoading(null);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-800 transition text-xl"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold">{t('friends.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        <button
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'following'
              ? 'border-[#9DB8A0] text-[#9DB8A0]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('following')}
        >
          {t('friends.followingTab')}
        </button>
        {/* [추가] Followers 탭 */}
        <button
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'followers'
              ? 'border-[#9DB8A0] text-[#9DB8A0]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('followers')}
        >
          {t('friends.followersTab')}
        </button>
        <button
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'blocked'
              ? 'border-[#9DB8A0] text-[#9DB8A0]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('blocked')}
        >
          {t('friends.blockedTab')}
        </button>
      </div>

      {!isLoggedIn && !loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">
            {t('friends.loginToView')}
          </p>
          <button
            className="bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90"
            onClick={() => setIsLoginOpen(true)}
          >
            {t('auth.login')}
          </button>
        </div>
      ) : loading ? (
        <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
      ) : tab === 'following' ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {followingUsers.length === 0 ? (
            <div className="p-8 text-center">
              <img src="/icons/tab-mypage.png" className="w-10 h-10 object-contain mb-3" />
              <p className="text-gray-400 text-sm">{t('friends.noFollowing')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {followingUsers.map((u) => (
                <div
                  key={u.following_id}
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setProfileModalUserId(u.following_id)}
                >
                  <AvatarImage src={u.image_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-800">{u.nickname}</span>
                    {u.flag && (
                      <span className="ml-2 text-lg">{getFlagEmoji(u.flag)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'followers' ? (
        // [추가] Followers 목록
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {followerUsers.length === 0 ? (
            <div className="p-8 text-center">
              <img src="/icons/tab-mypage.png" className="w-10 h-10 object-contain mb-3" />
              <p className="text-gray-400 text-sm">{t('friends.noFollowers')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {followerUsers.map((u) => (
                <div
                  key={u.follower_id}
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setProfileModalUserId(u.follower_id)}
                >
                  <AvatarImage src={u.image_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-800">{u.nickname}</span>
                    {u.flag && (
                      <span className="ml-2 text-lg">{getFlagEmoji(u.flag)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {blockedUsers.length === 0 ? (
            <div className="p-8 text-center">
              <img src="/icons/no.png" className="w-10 h-10 object-contain mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{t('friends.noBlocked')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {blockedUsers.map((u) => (
                <div
                  key={u.blocked_id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <AvatarImage src={u.image_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-800">
                      {u.nickname}
                    </span>
                    {u.flag && (
                      <span className="ml-2 text-lg">{getFlagEmoji(u.flag)}</span>
                    )}
                  </div>
                  <button
                    className="text-sm text-blue-500 hover:text-blue-700 font-medium disabled:opacity-50 transition"
                    onClick={() => handleUnblock(u.blocked_id)}
                    disabled={unblockLoading === u.blocked_id}
                  >
                    {unblockLoading === u.blocked_id ? t('friends.unblocking') : t('friends.unblock')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          currentUserId={currentUserId}
          isOpen={!!profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onLoginRequired={() => { setProfileModalUserId(null); setIsLoginOpen(true); }}
        />
      )}
    </div>
  );
}
