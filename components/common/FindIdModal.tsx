'use client';

import { useState } from 'react';
import { maskEmail } from '@/lib/utils/maskEmail';

interface FindIdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FindIdModal({ isOpen, onClose }: FindIdModalProps) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  const handleFind = async () => {
    if (!nickname.trim()) {
      setError('Please enter your nickname.');
      return;
    }

    setError('');
    setMaskedEmail(null);
    setLoading(true);

    try {
      // API 호출: 닉네임으로 프로필 찾기
      const response = await fetch('/api/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || 'Nickname not found. Please check and try again.'
        );
        return;
      }

      // 이메일 마스킹
      const masked = maskEmail(data.email);
      setMaskedEmail(masked);
    } catch {
      setError('Failed to find ID. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNickname('');
    setError('');
    setMaskedEmail(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Find ID</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4">
          Please enter the nickname you used when signing up.
        </p>

        {/* Nickname Input */}
        <div className="mb-4">
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
              setMaskedEmail(null);
            }}
            placeholder="Your nickname"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
            disabled={loading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        {/* Masked Email Result */}
        {maskedEmail && (
          <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-gray-600 mb-1">Your email</p>
            <p className="text-sm font-mono text-green-700">{maskedEmail}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleFind}
            disabled={loading || !nickname.trim()}
            className="flex-1 bg-[#9DB8A0] text-white py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Find'}
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
