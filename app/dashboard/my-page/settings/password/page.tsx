'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function PasswordSettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  // Step 1: verify current password
  const [currentPw, setCurrentPw] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Step 2: set new password
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/dashboard/my-page'); return; }
      setEmail(session.user.email ?? '');
    };
    init();
  }, [router]);

  // Re-authenticate with current password to verify identity
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw) { setVerifyError('Please enter your current password.'); return; }
    setVerifyLoading(true);
    setVerifyError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    setVerifyLoading(false);
    if (error) {
      setVerifyError('Current password is incorrect.');
    } else {
      setVerified(true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateMsg('');
    if (next !== confirm) { setUpdateError('Passwords do not match.'); return; }
    setUpdateLoading(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setUpdateLoading(false);
    if (error) {
      setUpdateError(error.message);
    } else {
      setUpdateMsg('Password updated successfully!');
      setNext('');
      setConfirm('');
      setVerified(false);
      setCurrentPw('');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-3xl font-bold">reset password</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        {/* Success message */}
        {updateMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-sm text-green-700 font-medium">{updateMsg}</p>
          </div>
        )}

        {/* Step 1 — Current Password */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Password</label>
            <input
              type="password"
              placeholder="Enter your current password"
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setVerifyError(''); }}
              disabled={verified}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] transition ${
                verified
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-300'
              }`}
            />
            {verifyError && <p className="text-red-500 text-xs mt-1.5">{verifyError}</p>}
            {verified && <p className="text-green-600 text-xs mt-1.5 font-medium">✓ Password verified</p>}
          </div>
          {!verified && (
            <button
              type="submit"
              disabled={verifyLoading || !currentPw}
              className="w-full bg-gray-700 text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-40 transition text-sm"
            >
              {verifyLoading ? 'Verifying...' : 'Verify'}
            </button>
          )}
        </form>

        {/* Step 2 — New Password (shown only after verification) */}
        {verified && (
          <form onSubmit={handleUpdate} className="space-y-4 border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">Enter your new password below.</p>
            {updateError && <p className="text-red-500 text-sm">{updateError}</p>}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              />
            </div>
            <button
              type="submit"
              disabled={updateLoading}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {updateLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
