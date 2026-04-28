'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupModal from '@/components/common/SignupModal';
import LoginModal from '@/components/common/LoginModal';
import AuthSelectSheet from '@/components/common/AuthSelectSheet';
import Link from 'next/link';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';
import i18n, { normalizeDbLang } from '@/lib/i18n';
import { LANG_STORAGE_KEY } from '@/components/common/I18nProvider';

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
  const [isAuthSheetOpen, setIsAuthSheetOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const router = useRouter();
  const { t } = useTranslation('common');

  const MENU_ITEMS = [
    { icon: '/icons/post.png', label: t('myPage.myPosts'), desc: t('myPage.myPostsDesc'), href: '/dashboard/my-page/posts' },
    { icon: '/icons/like.png', label: t('myPage.likedPosts'), desc: t('myPage.likedPostsDesc'), href: '/dashboard/my-page/liked' },
    { icon: '/icons/tab-community.png', label: t('myPage.friends'), desc: t('myPage.friendsDesc'), href: '/dashboard/my-page/friends' },
    { icon: '/icons/question.png', label: t('myPage.help'), desc: t('myPage.helpDesc'), href: '/dashboard/my-page/help' },
    { icon: '/icons/services.png', label: t('nav.services'), desc: t('nav.services'), href: '/dashboard/my-page/services' },
    { icon: '/icons/setting.png', label: t('myPage.settings'), desc: t('myPage.settingsDesc'), href: '/dashboard/my-page/settings' },
  ];

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (cancelled) return;
      if (!session) {
        setIsLoggedIn(false);
        setIsAuthSheetOpen(true); // 비로그인 → 로그인 선택 시트 자동 오픈
        setLoading(false);
        return;
      }
      console.log('[my-page] session exists: true, user id:', session.user.id);
      setIsLoggedIn(true);
      try {
        // Promise.race로 타임아웃 추가: Web Locks 데드락으로 쿼리가 hang될 경우 5초 후 포기
        const result = await Promise.race([
          supabase
            .from('profile')
            .select('nickname, flag, uselanguage, image_url')
            .eq('id', session.user.id)
            .maybeSingle(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
        if (cancelled) return;
        if (result && 'data' in result) {
          if (result.error) console.error('[MyPage] profile fetch error:', result.error);
          const profileData = result.data ?? null;
          setProfile(profileData);
          // 프로필 로드 후 언어 반영 및 localStorage 저장
          if (profileData?.uselanguage) {
            const lang = normalizeDbLang(profileData.uselanguage);
            localStorage.setItem(LANG_STORAGE_KEY, lang);
            if (i18n.language !== lang) i18n.changeLanguage(lang);
          }
        }
      } catch (err) {
        if (!cancelled) console.error('[MyPage] init exception:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    let loaded = false;
    const tryLoad = (session: Parameters<typeof loadProfile>[0]) => {
      if (loaded || cancelled) return;
      loaded = true;
      loadProfile(session);
    };

    // INITIAL_SESSION: 캐시된 세션으로 즉시 발화 (정상 케이스)
    // SIGNED_IN: Web Locks 데드락으로 INITIAL_SESSION이 지연될 때 fallback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        tryLoad(session);
      }
    });

    // 두 이벤트 모두 발화하지 않는 완전 데드락 상황 안전망
    const safetyTimer = setTimeout(() => {
      if (!loaded && !cancelled) setLoading(false);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setProfile(null);
    router.push('/dashboard/home');
  };

  const handleAuthSheetClose = () => {
    setIsAuthSheetOpen(false);
  };

  const handleLoginClick = () => {
    setIsAuthSheetOpen(false);
    setIsLoginOpen(true);
  };

  const handleSignupClick = () => {
    setIsAuthSheetOpen(false);
    setIsSignupOpen(true);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold mt-4 text-gray-800">{t('myPage.title')}</h1>

      {/* Profile Card — 로그인 상태일 때만 렌더링 */}
      {(loading || isLoggedIn) && (
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
              ) : null}
            </div>
          </div>

          <div className="flex gap-3">
            {loading ? (
              <button disabled className="flex-1 bg-gray-200 text-white py-3 rounded-lg font-semibold cursor-not-allowed">{t('common.loading')}</button>
            ) : isLoggedIn ? (
              <button onClick={handleLogout} className="flex-1 bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition">{t('auth.logout')}</button>
            ) : null}
          </div>
        </div>
      )}

      {/* Menu Items — 로그인한 경우만 */}
      {isLoggedIn && (
        <div className="space-y-3">
          {MENU_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false}>
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer">
                <div className="flex items-center gap-4">
                  <img src={item.icon} alt={item.label} className="w-7 h-7 object-contain" />
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

      {/* 로그인 선택 시트 (비로그인 시 자동 노출) */}
      {isAuthSheetOpen && (
        <AuthSelectSheet
          onClose={handleAuthSheetClose}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
        />
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </div>
  );
}
