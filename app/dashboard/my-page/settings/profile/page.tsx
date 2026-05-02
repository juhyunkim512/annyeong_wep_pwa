'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { Trash2 } from 'lucide-react';

const NICKNAME_REGEX = /^[a-z0-9_]{3,15}$/;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  /** DB에 현재 저장된 닉네임 — 변경 여부 감지에 사용 */
  const [savedNickname, setSavedNickname] = useState('');
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 확인 팝업 ─────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  // 중복 요청 방지 ref
  const confirmInFlight = useRef(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/dashboard/my-page'); return; }
      setUserId(session.user.id);

      const { data } = await supabase
        .from('profile')
        .select('nickname, image_url')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data) {
        setNickname(data.nickname ?? '');
        setSavedNickname(data.nickname ?? '');
        setSavedImageUrl(data.image_url ?? null);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const showMsg = (text: string, error = false) => {
    setMsg(text);
    setIsError(error);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (/[^\x00-\x7F]/.test(file.name)) {
      showMsg(t('settings.imageFileNameEnglishOnly'), true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(heic|heif)$/i)) {
      showMsg('Unsupported image format', true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showMsg('Image must be under 10MB', true);
      return;
    }
    setPendingDelete(false);
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  /** 이미지만 저장 (닉네임 미변경 시 또는 닉네임 변경 성공 후 호출) */
  const saveImage = useCallback(async (currentUserId: string, currentSavedImageUrl: string | null, file: File | null) => {
    if (!file) return currentSavedImageUrl;
    const filePath = `${currentUserId}/${Date.now()}-${file.name}`;
    const contentType = file.type || 'image/jpeg';
    const { error: uploadErr } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, { upsert: false, contentType });
    if (uploadErr) {
      console.error('[Profile] 이미지 업로드 실패:', uploadErr.message);
      throw new Error('imageUploadFailed');
    }
    const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, []);

  const handleDeletePhoto = () => {
    setPendingDelete(true);
    setPreviewUrl(null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 폼 제출: validation → 팝업 또는 이미지만 저장 ─────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || saving) return;

    const trimmed = nickname.trim();

    // empty check
    if (!trimmed) {
      showMsg(t('settings.nicknameEmpty'), true);
      return;
    }

    // format validation (팝업 띄우기 전에 먼저 검사)
    if (!NICKNAME_REGEX.test(trimmed)) {
      showMsg(t('settings.nicknameInvalid'), true);
      return;
    }

    // 닉네임 변경 시 → 확인 팝업
    if (trimmed !== savedNickname) {
      setShowConfirm(true);
      return;
    }

    // 닉네임 동일 → 이미지만 저장
    if (!avatarFile && !pendingDelete) {
      showMsg(t('settings.savedSuccess'));
      return;
    }

    setSaving(true);
    try {
      let newImageUrl: string | null = savedImageUrl;
      if (pendingDelete) {
        if (savedImageUrl) {
          const match = savedImageUrl.match(/profile-images\/(.+)$/);
          if (match) await supabase.storage.from('profile-images').remove([match[1]]);
        }
        newImageUrl = null;
      } else if (avatarFile) {
        newImageUrl = await saveImage(userId, savedImageUrl, avatarFile);
      }
      const { error: updateErr } = await supabase
        .from('profile')
        .update({ image_url: newImageUrl })
        .eq('id', userId);
      if (updateErr) throw new Error('updateFailed');
      setSavedImageUrl(newImageUrl);
      setPendingDelete(false);
      setAvatarFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showMsg(t('settings.savedSuccess'));
    } catch (err: any) {
      showMsg(t(err.message === 'imageUploadFailed' ? 'settings.imageUploadFailed' : 'settings.saveFailed'), true);
    } finally {
      setSaving(false);
    }
  };

  // ── 팝업 확인: 닉네임 변경 API 호출 ─────────────────────────
  const handleNicknameConfirm = async () => {
    if (confirmInFlight.current) return;
    confirmInFlight.current = true;
    setConfirmSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !userId) {
        showMsg(t('settings.saveFailed'), true);
        setShowConfirm(false);
        return;
      }

      const trimmed = nickname.trim();

      const res = await fetch('/api/profile/change-nickname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nickname: trimmed }),
      });

      const data = await res.json();
      setShowConfirm(false);

      if (!data.success) {
        // 30일 쿨다운
        if (res.status === 429 && data.nextAvailableAt) {
          const date = new Date(data.nextAvailableAt);
          const formatted = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
          showMsg(`${t('settings.nicknameChangeCooldown')} ${t('settings.nicknameNextAvailable')}: ${formatted}`, true);
        } else if (res.status === 409) {
          showMsg(t('settings.nicknameAlreadyInUse'), true);
        } else if (res.status === 400) {
          showMsg(t('settings.nicknameInvalid'), true);
        } else {
          showMsg(data.message || t('settings.saveFailed'), true);
        }
        return;
      }

      // 닉네임 변경 성공 → savedNickname 갱신
      setSavedNickname(trimmed);

      // 이미지도 변경됐으면 이어서 저장
      if (pendingDelete || avatarFile) {
        try {
          let newImageUrl: string | null = savedImageUrl;
          if (pendingDelete) {
            if (savedImageUrl) {
              const match = savedImageUrl.match(/profile-images\/(.+)$/);
              if (match) await supabase.storage.from('profile-images').remove([match[1]]);
            }
            newImageUrl = null;
          } else if (avatarFile) {
            newImageUrl = await saveImage(userId, savedImageUrl, avatarFile);
          }
          const { error: imgErr } = await supabase
            .from('profile')
            .update({ image_url: newImageUrl })
            .eq('id', userId);
          if (!imgErr) {
            setSavedImageUrl(newImageUrl);
            setPendingDelete(false);
            setAvatarFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        } catch {
          // 이미지 실패해도 닉네임은 성공 — 메시지는 닉네임 성공으로 표시
        }
      }

      showMsg(t('settings.nicknameChanged'));
    } finally {
      setConfirmSaving(false);
      confirmInFlight.current = false;
    }
  };

  const displayImage = pendingDelete ? null : (previewUrl ?? savedImageUrl);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
          <h1 className="text-3xl font-bold">{t('settings.editProfileTitle')}</h1>
        </div>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-2xl font-bold">{t('settings.editProfileTitle')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        {msg && (
          <p className={`text-sm font-medium ${isError ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile Photo */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('settings.profilePhoto')}</p>
            <div className="flex items-center gap-4">
              <AvatarImage src={displayImage} size={64} />
              <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                <img src="/icons/camera.png" className="w-4 h-4 object-contain" />
                {t('settings.choosePhoto')}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {!pendingDelete && (savedImageUrl || previewUrl) && (
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Nickname */}
          <div className="border-t border-gray-100 pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('settings.nickname')}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('settings.nicknamePlaceholder')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
            />
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition">
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </form>
      </div>

      {/* ── 닉네임 변경 확인 팝업 ── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget && !confirmSaving) setShowConfirm(false); }}
        >
          <div className="w-full sm:w-auto sm:min-w-[320px] sm:max-w-sm bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">{t('settings.nicknameChangeConfirmTitle')}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{t('settings.nicknameChangeConfirmDesc')}</p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={confirmSaving}
                onClick={() => !confirmSaving && setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {t('settings.cancel')}
              </button>
              <button
                type="button"
                disabled={confirmSaving}
                onClick={handleNicknameConfirm}
                className="flex-1 py-2.5 rounded-lg bg-[#9DB8A0] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {confirmSaving ? t('settings.nicknameChanging') : t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

