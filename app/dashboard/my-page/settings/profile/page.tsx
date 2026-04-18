'use client'

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null); // DB에 저장된 값
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);       // 선택 후 미리보기 (미저장)
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/dashboard/my-page'); return; }
      setUserId(session.user.id);

      const { data } = await supabase
        .from('profile')
        .select('nickname, image_url')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setNickname(data.nickname ?? '');
        setSavedImageUrl(data.image_url ?? null);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const showMsg = (text: string, error = false) => {
    setMsg(text);
    setIsError(error);
    setTimeout(() => setMsg(''), 2500);
  };

  // [수정] MIME 타입 + 10MB 제한 + 에러 로그
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(heic|heif)$/i)) {
      console.error('[Profile] 차단된 MIME 타입:', file.type, file.name);
      showMsg('Unsupported image format', true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      console.error('[Profile] 파일 용량 초과:', (file.size / 1024 / 1024).toFixed(1) + 'MB');
      showMsg('Image must be under 10MB', true);
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Save Changes → 닉네임 + 사진(있으면) 한 번에 저장
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!nickname.trim()) { showMsg(t('settings.nicknameEmpty'), true); return; }
    setSaving(true);

    let newImageUrl = savedImageUrl;

    // 사진이 새로 선택됐으면 매번 고유한 파일명으로 업로드
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${userId}/${Date.now()}-${avatarFile.name}`;
      const contentType = avatarFile.type || `image/${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('profile-images')
        .upload(filePath, avatarFile, { upsert: false, contentType });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
        newImageUrl = urlData.publicUrl;
      } else {
        console.error('[Profile] 이미지 업로드 실패:', uploadErr.message, avatarFile.name);
        showMsg(t('settings.imageUploadFailed'), true);
        setSaving(false);
        return;
      }
    }

    const { error: updateErr } = await supabase.from('profile').update({
      nickname: nickname.trim(),
      image_url: newImageUrl,
    }).eq('id', userId);

    if (updateErr) {
      showMsg(t('settings.saveFailed'), true);
      setSaving(false);
      return;
    }

    // 저장 성공 후 상태 초기화
    setSavedImageUrl(newImageUrl);
    setAvatarFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSaving(false);
    showMsg(t('settings.savedSuccess'));
  };

  const displayImage = previewUrl ?? savedImageUrl;

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
              {previewUrl && (
                <span className="text-xs text-[#9DB8A0] font-medium"></span>
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
    </div>
  );
}
