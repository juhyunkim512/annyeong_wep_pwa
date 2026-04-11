'use client'

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import SignupModal from '@/components/common/SignupModal';
import LoginModal from '@/components/common/LoginModal';
import Link from 'next/link';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';

interface ProfileData {
  nickname: string;
  flag?: string;
  uselanguage?: string;
  image_url?: string;
}

const FLAG_EMOJI_MAP: { [key: string]: string } = {
  korea: '🇰🇷', usa: '🇺🇸', jpan: '🇯🇵', china: '🇨🇳', vietnam: '🇻🇳',
  spain: '🇪🇸', france: '🇫🇷', germany: '🇩🇪', thailand: '🇹🇭', philippines: '🇵🇭',
};
const getFlagEmoji = (v?: string) => FLAG_EMOJI_MAP[v || ''] || '';


export default function MyPagePage() {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const { t } = useTranslation('common');

  const MENU_ITEMS = [
    { icon: '📝', label: t('myPage.myPosts'), desc: t('myPage.myPostsDesc'), href: '/dashboard/my-page/posts' },
    { icon: '❤️', label: t('myPage.likedPosts'), desc: t('myPage.likedPostsDesc'), href: '/dashboard/my-page/liked' },
    { icon: '👥', label: t('myPage.friends'), desc: t('myPage.friendsDesc'), href: '/dashboard/my-page/friends' },
    { icon: '⚙️', label: t('myPage.settings'), desc: t('myPage.settingsDesc'), href: '/dashboard/my-page/settings' },
  ];


  // request id ref: 최신 요청만 상태 반영
  const reqRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqRef.current;
    const init = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (reqRef.current !== reqId) return;
        if (!session) {
          setIsLoggedIn(false);
          // session 없음 → return 후 finally에서 loading 종료
          return;
        }
        setIsLoggedIn(true);
        const { data: profileData, error } = await supabase
          .from('profile')
          .select('nickname, flag, uselanguage, image_url')
          .eq('id', session.user.id)
          .single();
        if (reqRef.current !== reqId) return;
        if (error) {
          console.error('[MyPage] profile fetch error:', error);
        }
        setProfile(profileData ?? null);
      } catch (err) {
        if (reqRef.current !== reqId) return;
        console.error('[MyPage] init exception:', err);
      } finally {
        // 최신 요청만 loading 종료 — 비로그인 early return 포함 모든 경로에서 실행
        if (reqRef.current === reqId) setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setProfile(null);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl font-bold">{t('myPage.title')}</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <AvatarImage src={profile?.image_url} size={64} />
          <div className="flex-1">
            {loading ? (
              <p className="text-gray-400 text-sm">{t('common.loading')}</p>
            ) : isLoggedIn && profile ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-900 font-semibold text-lg">{profile.nickname}</p>
                  {profile.flag && <span className="text-xl">{getFlagEmoji(profile.flag)}</span>}
                </div>
                {profile.uselanguage && <p className="text-gray-500 text-sm capitalize">{profile.uselanguage}</p>}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">{t('myPage.signInPrompt')}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {loading ? (
            <button disabled className="flex-1 bg-gray-200 text-white py-3 rounded-lg font-semibold cursor-not-allowed">{t('common.loading')}</button>
          ) : isLoggedIn ? (
            <button onClick={handleLogout} className="flex-1 bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition">{t('auth.logout')}</button>
          ) : (
            <>
              <button onClick={() => setIsLoginOpen(true)} className="flex-1 bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition">{t('auth.login')}</button>
              <button onClick={() => setIsSignupOpen(true)} className="flex-1 bg-white text-[#9DB8A0] border-2 border-[#9DB8A0] py-3 rounded-lg font-semibold hover:bg-[#9DB8A0]/5 transition">{t('auth.signUp')}</button>
            </>
          )}
        </div>
      </div>

      {/* Menu Items — 로그인한 경우만 */}
      {isLoggedIn && (
        <div className="space-y-3">
          {MENU_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </div>
  );
}
