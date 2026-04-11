'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, LANG_LABELS, normalizeDbLang, type AppLang } from '@/lib/i18n';
import { useI18nLang } from '@/lib/hooks/useI18nLang';

const LANG_FLAG: Record<AppLang, string> = {
  en: '🇬🇧',
  ko: '🇰🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  es: '🇪🇸',
  vi: '🇻🇳',
};

export default function LanguageSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { currentLang, changeLang } = useI18nLang();
  const [userId, setUserId] = useState<string | null>(null);
  const [savedLang, setSavedLang] = useState<AppLang>('en');
  const [selected, setSelected] = useState<AppLang>(currentLang);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/dashboard/my-page'); return; }
      setUserId(session.user.id);

      const { data } = await supabase
        .from('profile')
        .select('uselanguage')
        .eq('id', session.user.id)
        .single();

      const lang = normalizeDbLang(data?.uselanguage);
      setSavedLang(lang);
      setSelected(lang);
      setLoading(false);
    };
    init();
  }, [router]);

  // currentLang 바뀌면 선택값도 동기화
  useEffect(() => {
    setSelected(currentLang);
  }, [currentLang]);

  const handleConfirm = async () => {
    if (!userId || saving) return;
    setSaving(true);
    await changeLang(selected);          // i18n + DB 동시 업데이트
    setSavedLang(selected);
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
          <h1 className="text-3xl font-bold">{t('settings.chooseLanguage')}</h1>
        </div>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-3xl font-bold">{t('settings.chooseLanguage')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <p className="text-sm text-gray-500">{t('settings.chooseLanguageHint')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SUPPORTED_LANGS.map((code) => (
            <button
              key={code}
              onClick={() => setSelected(code)}
              className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition ${
                selected === code
                  ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#9DB8A0] hover:text-[#9DB8A0]'
              }`}
            >
              {LANG_FLAG[code]} {LANG_LABELS[code].split(' ').slice(1).join(' ') || LANG_LABELS[code]}
              {selected === code && <span className="ml-1.5">✓</span>}
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={saving || selected === savedLang}
          className="w-full bg-[#9DB8A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-40 transition"
        >
          {saving ? t('settings.saving') : t('settings.confirmSelection')}
        </button>

        {toast && (
          <p className="text-center text-sm text-[#9DB8A0] font-medium">
            {t('settings.languageUpdated')}
          </p>
        )}
      </div>
    </div>
  );
}
