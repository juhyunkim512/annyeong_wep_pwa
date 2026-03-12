'use client';

import { useState } from 'react';

interface SignupFormData {
  email: string;
  password: string;
  nickname: string;
  flag: string;
  uselanguage: string;
  purpose: 'community' | 'service' | 'information';
  current_status: 'living_in_korea' | 'planning_to_move';
}

interface ValidationStatus {
  email: boolean | null;
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

// UI 표시 / DB 저장값 분리 - Language Options
const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'english' },
  { label: '한국어', value: 'korean' },
  { label: '中文', value: 'chinese' },
  { label: '日本語', value: 'japanese' },
  { label: 'Tiếng Việt', value: 'vietnamese' },
  { label: 'Español', value: 'spanish' },
];

// Purpose Options
const PURPOSE_OPTIONS = [
  { label: 'Community', value: 'community' },
  { label: 'Service', value: 'service' },
  { label: 'Information', value: 'information' },
] as const;

// Current Status Options
const STATUS_OPTIONS = [
  { label: 'Currently Living in Korea', value: 'living_in_korea' },
  { label: 'Planning to Move to Korea', value: 'planning_to_move' },
] as const;

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignupModal({ isOpen, onClose }: SignupModalProps) {
  // 초기값: 직접 문자열 코드값 사용 (null.value 에러 방지)
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    nickname: '',
    flag: 'kr', // 코드값: kr
    uselanguage: 'en', // 코드값: en
    purpose: 'community',
    current_status: 'living_in_korea',
  });

  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({
    email: null,
    nickname: null,
  });

  const [validationMessages, setValidationMessages] = useState({
    email: '',
    nickname: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkedFields, setCheckedFields] = useState({
    email: false,
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

  // Helper function: 코드값으로 UI 레이블 가져오기
  const getFlagLabel = (value: string): string => {
    return FLAG_OPTIONS.find((opt) => opt.value === value)?.label || '';
  };

  const getLanguageLabel = (value: string): string => {
    return LANGUAGE_OPTIONS.find((opt) => opt.value === value)?.label || '';
  };

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

    // Reset validation when user edits the field
    if (name === 'email') {
      setValidationStatus((prev) => ({ ...prev, email: null }));
      setCheckedFields((prev) => ({ ...prev, email: false }));
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

  const checkEmail = async () => {
    if (!formData.email) {
      setValidationMessages((prev) => ({
        ...prev,
        email: 'Please enter an email.',
      }));
      return;
    }

    setLoading(true);
    setError('');
    setValidationMessages((prev) => ({ ...prev, email: '' }));

    try {
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      setValidationStatus((prev) => ({
        ...prev,
        email: data.available,
      }));

      setValidationMessages((prev) => ({
        ...prev,
        email: data.message,
      }));

      setCheckedFields((prev) => ({ ...prev, email: true }));
    } catch {
      setError('Failed to check email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkNickname = async () => {
    if (!formData.nickname) {
      setValidationMessages((prev) => ({
        ...prev,
        nickname: 'Please enter a nickname.',
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
      setError('Failed to check nickname. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newValue = e.currentTarget.value;
    setLanguageToConfirm(newValue);
    setShowLanguageWarning(true);
  };

  const handleConfirmLanguage = () => {
    if (languageToConfirm) {
      setFormData((prev) => ({
        ...prev,
        uselanguage: languageToConfirm,
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

    // Validation
    if (!validationStatus.email) {
      setError('Please check that your email is available.');
      return;
    }

    if (!validationStatus.nickname) {
      setError('Please check that your nickname is available.');
      return;
    }

    if (!formData.password) {
      setError('Please enter a password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sign up failed. Please try again.');
        return;
      }

      setSuccess('Sign up completed successfully.');
      setTimeout(() => {
        onClose();
        // Reset form - 코드값 기반으로 초기화
        setFormData({
          email: '',
          password: '',
          nickname: '',
          flag: 'kr',
          uselanguage: 'en',
          purpose: 'community',
          current_status: 'living_in_korea',
        });
        setValidationStatus({ email: null, nickname: null });
        setCheckedFields({ email: false, nickname: false });
      }, 1500);
    } catch {
      setError('Sign up failed. Please try again.');
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
          <h2 className="text-2xl font-bold">Sign Up</h2>
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
            <label className="block text-sm font-semibold mb-2">Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                disabled={loading}
              />
              <button
                type="button"
                onClick={checkEmail}
                disabled={loading || !formData.email}
                className="px-4 py-2 bg-[#9DB8A0] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                Check
              </button>
            </div>
            {checkedFields.email && validationMessages.email && (
              <p
                className={`text-xs mt-2 ${
                  validationStatus.email ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {validationMessages.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Password
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
            <label className="block text-sm font-semibold mb-2">Nickname</label>
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
                Check
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
            <label className="block text-sm font-semibold mb-2">Country</label>
            <select
              name="flag"
              value={formData.flag}
              onChange={handleInputChange}
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

          {/* Use Language - Select with code values */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Preferred Language
            </label>
            <select
              name="uselanguage"
              value={formData.uselanguage}
              onChange={handleLanguageChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              disabled={loading}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-semibold mb-2">Purpose</label>
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
            <label className="block text-sm font-semibold mb-2">Status</label>
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
              !validationStatus.email ||
              !validationStatus.nickname ||
              !formData.password
            }
            className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 mt-6"
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full text-gray-600 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </form>
      </div>

      {/* Language Confirmation Modal */}
      {showLanguageWarning && languageToConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            {/* Header */}
            <h3 className="text-lg font-bold mb-4">Confirm Language Selection</h3>

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
                Confirm
              </button>
              <button
                onClick={handleCancelLanguage}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
