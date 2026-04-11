'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import FindIdModal from './FindIdModal';
import ResetPasswordModal from './ResetPasswordModal';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

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
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setTimeout(() => {
        onClose();
        setFormData({ email: '', password: '' });
        router.push('/dashboard/home');
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
