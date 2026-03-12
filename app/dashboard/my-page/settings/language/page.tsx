'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const LANGUAGES = [
  { label: 'English', value: 'english' },
  { label: 'Korean', value: 'korean' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'Japanese', value: 'japanese' },
  { label: 'Vietnamese', value: 'vietnamese' },
  { label: 'Spanish', value: 'spanish' },
  { label: 'French', value: 'french' },
];

export default function LanguageSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [savedLang, setSavedLang] = useState('');
  const [selected, setSelected] = useState('');
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

      const lang = data?.uselanguage ?? '';
      setSavedLang(lang);
      setSelected(lang);
      setLoading(false);
    };
    init();
  }, [router]);

  const handleConfirm = async () => {
    if (!userId || !selected || saving) return;
    setSaving(true);
    await supabase.from('profile').update({ uselanguage: selected }).eq('id', userId);
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
          <h1 className="text-3xl font-bold">choose language</h1>
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
        <h1 className="text-3xl font-bold">choose language</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <p className="text-sm text-gray-500">Choose the language used for content translation and preferences.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => setSelected(lang.value)}
              className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition ${
                selected === lang.value
                  ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#9DB8A0] hover:text-[#9DB8A0]'
              }`}
            >
              {lang.label}
              {selected === lang.value && <span className="ml-1.5">✓</span>}
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={saving || selected === savedLang}
          className="w-full bg-[#9DB8A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-40 transition"
        >
          {saving ? 'Saving...' : '선택 완료'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-full shadow-lg z-50 animate-fade-in">
          Language updated!
        </div>
      )}
    </div>
  );
}
