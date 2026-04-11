'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase/client';
import '@/lib/i18n';

interface SignupFormData {
  email: string;
  password: string;
  nickname: string;
  flag: string;
  purpose: 'community' | 'service' | 'information';
  current_status: 'living_in_korea' | 'planning_to_move';
}

interface ValidationStatus {
  nickname: boolean | null;
}

// UI 표시 / DB 저장값 분리 - Flag Options
const FLAG_OPTIONS = [
  { label: '🇰🇷 Korea', value: 'korea' },
  { label: '🇺🇸 USA', value: 'usa' },
  { label: '🇯🇵 Japan', value: 'japan' },
  { label: '🇨🇳 China', value: 'china' },
  { label: '🇻🇳 Vietnam', value: 'vietnam' },
  { label: '🇪🇸 Spain', value: 'spain' },
  { label: '🇫🇷 France', value: 'france' },
  { label: '🇩🇪 Germany', value: 'germany' },
  { label: '🇹🇭 Thailand', value: 'thailand' },
  { label: '🇵🇭 Philippines', value: 'philippines' },
];


interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignupModal({ isOpen, onClose }: SignupModalProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  // 초기값: 직접 문자열 코드값 사용 (null.value 에러 방지)
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    nickname: '',
    flag: 'korea',
    purpose: 'community',
    current_status: 'living_in_korea',
  });

  const PURPOSE_OPTIONS = [
    { label: t('signup.purposeOptions.community'), value: 'community' as const },
    { label: t('signup.purposeOptions.service'), value: 'service' as const },
    { label: t('signup.purposeOptions.information'), value: 'information' as const },
  ];

  const STATUS_OPTIONS = [
    { label: t('signup.statusOptions.living'), value: 'living_in_korea' as const },
    { label: t('signup.statusOptions.planning'), value: 'planning_to_move' as const },
  ];

  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({
    nickname: null,
  });

  const [validationMessages, setValidationMessages] = useState({
    email: '',
    nickname: '',
  });

  // OTP 관련 상태
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkedFields, setCheckedFields] = useState({
    nickname: false,
  });

  const [showLanguageWarning, setShowLanguageWarning] = useState(false);
  const [languageToConfirm, setLanguageToConfirm] = useState<string | null>(null);

  // 6개 언어 경고 메시지
  const LANGUAGE_WARNINGS = [
    '한 번 선택하면 나중에 변경하기 어려울 수 있습니다.',
    'Once selected, this may be difficult to change later.',
    '一旦选择，之后可能很难更改。',
    '一度選択すると、後から変更するのが難しい場合があります。',
    'Una vez seleccionado, puede ser difícil cambiarlo más adelante.',
    'Sau khi chọn, bạn có thể sẽ khó thay đổi lại sau này.',
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
    setSuccess('');

    // 이메일이 바뀌면 OTP 인증 초기화
    if (name === 'email') {
      setOtpSent(false);
      setOtpCode('');
      setIsEmailVerified(false);
      setValidationMessages((prev) => ({ ...prev, email: '' }));
    }
    if (name === 'nickname') {
      setValidationStatus((prev) => ({ ...prev, nickname: null }));
      setCheckedFields((prev) => ({ ...prev, nickname: false }));
    }
  };

  const handleToggle = (field: 'purpose' | 'current_status', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value as any,
    }));
  };

  // 이메일 인증코드 발송 (자체 서버 — auth user 생성 없음)
  const sendOtp = async () => {
    if (!formData.email) {
      setValidationMessages((prev) => ({ ...prev, email: t('signup.enterEmail') }));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationMessages((prev) => ({ ...prev, email: t('signup.invalidEmailFormat') }));
      return;
    }

    setSendingOtp(true);
    setError('');
    setValidationMessages((prev) => ({ ...prev, email: '' }));

    try {
      const res = await fetch('/api/auth/send-signup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setValidationMessages((prev) => ({ ...prev, email: t('signup.emailAlreadyRegistered') }));
        } else {
          setError(data.message || t('signup.emailCheckFailed'));
        }
        return;
      }
      setOtpSent(true);
      setValidationMessages((prev) => ({ ...prev, email: t('signup.otpSent') }));
    } catch {
      setError(t('signup.emailCheckFailed'));
    } finally {
      setSendingOtp(false);
    }
  };

  // 인증번호 검증 (자체 서버 — auth user / session 생성 없음)
  const verifyOtp = async () => {
    if (!otpCode) return;

    setVerifyingOtp(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-signup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errorType === 'codeExpired') {
          setError(t('signup.codeExpired'));
        } else if (data.errorType === 'tooManyAttempts') {
          setError(t('signup.tooManyAttempts'));
        } else {
          setError(t('signup.invalidCode'));
        }
        return;
      }
      setIsEmailVerified(true);
      setValidationMessages((prev) => ({ ...prev, email: t('signup.emailVerified') }));
    } catch {
      setError(t('signup.invalidCode'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const checkNickname = async () => {
    if (!formData.nickname) {
      setValidationMessages((prev) => ({
        ...prev,
        nickname: t('signup.enterNickname'),
      }));
      return;
    }

    setLoading(true);
    setError('');
    setValidationMessages((prev) => ({ ...prev, nickname: '' }));

    try {
      const response = await fetch('/api/check-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: formData.nickname }),
      });

      const data = await response.json();

      setValidationStatus((prev) => ({
        ...prev,
        nickname: data.available,
      }));

      setValidationMessages((prev) => ({
        ...prev,
        nickname: data.message,
      }));

      setCheckedFields((prev) => ({ ...prev, nickname: true }));
    } catch {
      setError(t('signup.nicknameCheckFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFlagChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newValue = e.currentTarget.value;
    if (newValue === formData.flag) return; // 동일 값 선택 시 경고창 표시 안 함
    setLanguageToConfirm(newValue);
    setShowLanguageWarning(true);
  };

  const handleConfirmLanguage = () => {
    if (languageToConfirm) {
      setFormData((prev) => ({
        ...prev,
        flag: languageToConfirm,
      }));
    }
    setShowLanguageWarning(false);
    setLanguageToConfirm(null);
  };

  const handleCancelLanguage = () => {
    setShowLanguageWarning(false);
    setLanguageToConfirm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isEmailVerified) {
      setError(t('signup.verifyFirst'));
      return;
    }

    if (!validationStatus.nickname) {
      setError(t('signup.nicknameRequired'));
      return;
    }

    if (!formData.password) {
      setError(t('signup.passwordRequired'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nickname: formData.nickname,
          flag: formData.flag,
          purpose: formData.purpose,
          current_status: formData.current_status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t('signup.failed'));
        return;
      }

      // 가입 성공 → 자동 로그인
      await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      setSuccess(t('signup.success'));
      setTimeout(() => {
        onClose();
        // Reset form
        setFormData({
          email: '',
          password: '',
          nickname: '',
          flag: 'korea',
          purpose: 'community',
          current_status: 'living_in_korea',
        });
        setValidationStatus({ nickname: null });
        setCheckedFields({ nickname: false });
        setOtpSent(false);
        setOtpCode('');
        setIsEmailVerified(false);
        setValidationMessages({ email: '', nickname: '' });
        router.push('/dashboard/home');
      }, 1500);
    } catch {
      setError(t('signup.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('signup.title')}</h2>
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
          {/* Email + OTP */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('signup.email')}</label>
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                disabled={loading || isEmailVerified || sendingOtp}
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sendingOtp || verifyingOtp || loading || !formData.email || isEmailVerified}
                className="whitespace-nowrap px-4 py-2 bg-[#9DB8A0] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                {sendingOtp ? t('signup.sending') : t('signup.sendCode')}
              </button>
            </div>

            {/* OTP 상태 메시지 */}
            {validationMessages.email && (
              <p className={`text-xs mt-1 ${isEmailVerified ? 'text-green-600' : otpSent ? 'text-blue-600' : 'text-red-600'}`}>
                {validationMessages.email}
              </p>
            )}

            {/* 인증번호 입력 (OTP 발송 후, 인증 전) */}
            {otpSent && !isEmailVerified && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={t('signup.verificationCode')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-center tracking-widest"
                  maxLength={6}
                  disabled={verifyingOtp || loading}
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={verifyingOtp || loading || otpCode.length < 6}
                  className="whitespace-nowrap px-4 py-2 bg-[#9DB8A0] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {verifyingOtp ? t('signup.verifying') : t('signup.verifyCode')}
                </button>
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              {t('signup.password')}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              disabled={loading}
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('signup.nickname')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
                placeholder="username"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                disabled={loading}
              />
              <button
                type="button"
                onClick={checkNickname}
                disabled={loading || !formData.nickname}
                className="px-4 py-2 bg-[#9DB8A0] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                {t('signup.check')}
              </button>
            </div>

            {checkedFields.nickname && validationMessages.nickname && (
              <p
                className={`text-xs mt-1 ${
                  validationStatus.nickname ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {validationMessages.nickname}
              </p>
            )}
          </div>

          {/* Flag - Select with code values */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('signup.country')}</label>
            <select
              name="flag"
              value={formData.flag}
              onChange={handleFlagChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              disabled={loading}
            >
              {FLAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('signup.purpose')}</label>
            <div className="flex gap-2 flex-wrap">
              {PURPOSE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleToggle('purpose', item.value)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    formData.purpose === item.value
                      ? 'bg-[#9DB8A0] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Status */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('signup.status')}</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleToggle('current_status', item.value)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    formData.current_status === item.value
                      ? 'bg-[#9DB8A0] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {success && (
            <p className="text-sm text-green-600 text-center">{success}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              loading ||
              !isEmailVerified ||
              !validationStatus.nickname ||
              !formData.password
            }
            className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 mt-6"
          >
            {loading ? t('signup.signingUp') : t('signup.title')}
          </button>

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

      {/* Language Confirmation Modal */}
      {showLanguageWarning && languageToConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            {/* Header */}
            <h3 className="text-lg font-bold mb-4">{t('signup.confirmLanguageTitle')}</h3>

            {/* Warning Messages - 6 Languages */}
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {LANGUAGE_WARNINGS.map((message, idx) => (
                <p
                  key={idx}
                  className="text-sm text-gray-700 leading-relaxed p-2 rounded border border-blue-200"
                  style={{ backgroundColor: '#d6f2ff' }}
                >
                  {message}
                </p>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmLanguage}
                className="flex-1 bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90 transition"
              >
                {t('signup.confirm')}
              </button>
              <button
                onClick={handleCancelLanguage}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
