'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ResetStep = 1 | 2 | 3 | 4;

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResetPasswordModal({
  isOpen,
  onClose,
}: ResetPasswordModalProps) {
  const [step, setStep] = useState<ResetStep>(1);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Supabase OTP recovery 이메일 발송 (redirectTo 없이 = OTP 방식)
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: undefined }
      );

      if (sendError) {
        // Supabase는 미등록 이메일도 200을 반환하므로 일반 에러만 처리
        setError('Failed to send verification code. Please try again.');
        return;
      }

      setCodeSent(true);
      setStep(2);
    } catch {
      setError('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    if (verificationCode.length !== 8) {
      setError('Verification code must be 8 digits.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // OTP 검증 — type: 'recovery' 는 비밀번호 재설정용
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: verificationCode,
        type: 'recovery',
      });

      if (verifyError) {
        if (verifyError.message.toLowerCase().includes('expired')) {
          setError('Verification code has expired. Please request a new one.');
        } else {
          setError('Invalid verification code. Please check and try again.');
        }
        return;
      }

      // 검증 성공 → verifyOtp 이 세션을 자동 설정함
      setStep(3);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // verifyOtp 이 세션을 설정했으므로 updateUser 로 바로 변경 가능
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to reset password. Please try again.');
        return;
      }

      // 비밀번호 변경 후 세션 정리
      await supabase.auth.signOut();
      setStep(4);
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setEmail('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setCodeSent(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Reset Password</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 h-1 rounded ${
                stepNum <= step ? 'bg-[#9DB8A0]' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Email */}
        {step === 1 && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the email associated with your account.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] mb-4"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-600 text-center mb-4">{error}</p>
            )}
            <button
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim()}
              className="w-full bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </div>
        )}

        {/* Step 2: Verification Code */}
        {step === 2 && (
          <div>
            {codeSent && (
              <p className="text-sm text-[#9DB8A0] font-medium mb-3">
                Verification code sent to <span className="font-semibold">{email}</span>.
              </p>
            )}
            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit verification code sent to your email.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              placeholder="00000000"
              maxLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-center text-xl tracking-[0.4em] mb-4"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-600 text-center mb-4">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(1);
                  setVerificationCode('');
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleVerificationSubmit}
                disabled={loading || verificationCode.length !== 8}
                className="flex-1 bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter your new password.
            </p>

            {/* New Password */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(2);
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={loading || !newPassword || !confirmPassword}
                className="flex-1 bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h4 className="text-lg font-semibold mb-2">
              Password Reset Successful
            </h4>
            <p className="text-sm text-gray-600 mb-6">
              Your password has been successfully reset. Please log in with your new password.
            </p>
            <button
              onClick={handleClose}
              className="w-full bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
