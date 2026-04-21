'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import FindIdModal from './FindIdModal';
import ResetPasswordModal from './ResetPasswordModal';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';

async function signInWithOAuthProvider(provider: 'google' | 'kakao') {
  console.log(`[${provider}-login] click`);
  const redirectTo = `${window.location.origin}/auth/callback`;
  console.log(`[${provider}-login] signInWithOAuth start, redirectTo:`, redirectTo);
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === 'kakao'
        ? { prompt: 'login' }           // 카카오: 매번 로그인 화면 강제 표시
        : { prompt: 'select_account' }, // Google: 계정 선택 화면 표시
    },
  });
  console.log(`[${provider}-login] signInWithOAuth returned, error:`, error?.message ?? 'none');
  if (error) {
    console.error(`[LoginModal] ${provider} OAuth error:`, error);
    return error.message;
  }
  // success: browser will redirect to Google/Kakao — no further action needed
  return null;
}

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  useBodyScrollLock(isOpen);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'kakao' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setError('');
    setOauthLoading(provider);
    const err = await signInWithOAuthProvider(provider);
    if (err) {
      setError(err);
      setOauthLoading(null);
    }
    // On success, browser redirects — no setOauthLoading(null) needed
  };

  // Find ID 모달
  const [showFindIdModal, setShowFindIdModal] = useState(false);

  // Reset Password 모달
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email) {
      setError(t('auth.emailRequired'));
      return;
    }

    if (!formData.password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Check if account has been soft-deleted
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profile')
          .select('is_deleted')
          .eq('id', user.id)
          .maybeSingle();
        if (profileData?.is_deleted) {
          await supabase.auth.signOut();
          setError(t('auth.accountDeleted'));
          return;
        }
      }

      setSuccess(t('auth.loginSuccess'));
      setTimeout(async () => {
        onClose();
        setFormData({ email: '', password: '' });
        // profile row 존재 여부로 온보딩 완료 판단
        const { data: { user: loggedInUser } } = await supabase.auth.getUser();
        if (loggedInUser) {
          const { data: profile } = await supabase
            .from('profile')
            .select('id')
            .eq('id', loggedInUser.id)
            .maybeSingle();
          if (profile) {
            router.push('/dashboard/home');
          } else {
            router.push('/onboarding/country');
          }
        } else {
          router.push('/dashboard/home');
        }
      }, 1500);
    } catch (err) {
      setError(t('auth.loginFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm overscroll-none flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full">
          {/* Header */}
          <div className="border-b border-gray-200 p-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('auth.login')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">{t('auth.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={t('auth.enterEmail')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-2">{t('auth.password')}</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Error & Success Messages */}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {success && (
              <p className="text-sm text-green-600 text-center">{success}</p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.email || !formData.password}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 mt-6"
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </button>

            {/* Helper Links */}
            <div className="flex justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowFindIdModal(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
                disabled={loading}
              >
                {t('auth.findId')}
              </button>
              <div className="text-gray-300">•</div>
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
                disabled={loading}
              >
                {t('auth.resetPasswordLink')}
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full text-gray-600 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>

            {/* ── Social Login ── */}
            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400 shrink-0">또는 소셜 로그인</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
                <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" fill="#FF3D00"/>
                <path d="M24 45c5.5 0 10.5-1.9 14.4-5.1l-6.7-5.7C29.5 35.9 26.9 37 24 37c-5.8 0-10.7-3.9-12.4-9.3l-7 5.4C8 39.6 15.4 45 24 45z" fill="#4CAF50"/>
                <path d="M44.5 20H24v8.5h11.8c-.8 2.3-2.4 4.3-4.4 5.7l6.7 5.7C42 36.5 45 31 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
              </svg>
              {oauthLoading === 'google' ? '연결 중...' : 'Google로 계속하기'}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('kakao')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-[#FEE500] rounded-lg py-3 font-medium text-[#191919] hover:brightness-95 disabled:opacity-50 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.477 3 2 6.477 2 10.846c0 2.73 1.618 5.13 4.073 6.618l-.83 3.088a.25.25 0 0 0 .384.272L9.45 18.61A11.5 11.5 0 0 0 12 18.69c5.523 0 10-3.477 10-7.846S17.523 3 12 3z"/>
              </svg>
              {oauthLoading === 'kakao' ? '연결 중...' : '카카오로 계속하기'}
            </button>
          </form>
        </div>
      </div>

      {/* Find ID Modal */}
      <FindIdModal
        isOpen={showFindIdModal}
        onClose={() => setShowFindIdModal(false)}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
      />
    </>
  );
}
