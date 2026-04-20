'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  useBodyScrollLock(isOpen);

  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setStep(1);
    setPassword('');
    setReason('');
    setError('');
    setShowPassword(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError('');
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep(3);
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError(t('auth.loginFailed'));
        setLoading(false);
        return;
      }

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'wrong_password') {
          setError(t('settings.deletePasswordWrong'));
          setStep(1);
        } else {
          setError(t('settings.deleteFailed'));
        }
        return;
      }

      // Success: sign out and redirect
      await supabase.auth.signOut();
      handleClose();
      router.push('/');
    } catch {
      setError(t('settings.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const stepTitles: Record<Step, string> = {
    1: t('settings.deleteStep1Title'),
    2: t('settings.deleteStep2Title'),
    3: t('settings.deleteStep3Title'),
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm overscroll-none flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-red-600">{t('settings.deleteAccount')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{stepTitles[step]}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Step indicator */}
          <div className="flex gap-2 mb-4">
            {([1, 2, 3] as Step[]).map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-red-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Password */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <p className="text-sm text-gray-600">{t('settings.deleteAccountDesc')}</p>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('auth.password')}</label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button
                type="submit"
                disabled={!password}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition"
              >
                {t('common.next') ?? 'Next'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-gray-600 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition"
              >
                {t('common.cancel')}
              </button>
            </form>
          )}

          {/* Step 2: Reason */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">{t('settings.deleteStep2Title')}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('settings.deleteReasonPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
              >
                {t('common.next') ?? 'Next'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-full text-gray-600 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition"
              >
                {t('common.prev') ?? 'Back'}
              </button>
            </form>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">{t('settings.deleteConfirmText')}</p>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {loading ? t('settings.deleting') : t('settings.deleteBtn')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => { setStep(2); setError(''); }}
                className="w-full text-gray-600 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {t('common.prev') ?? 'Back'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
