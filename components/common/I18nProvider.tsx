'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { normalizeDbLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';

export const LANG_STORAGE_KEY = 'app-lang';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Supabase 쿼리 없이 localStorage에서 즉시 언어 읽기
    // (프로필 쿼리와 경합하던 race condition 제거)
    const cached = localStorage.getItem(LANG_STORAGE_KEY);
    const lang = normalizeDbLang(cached);
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }

    // 로그아웃 시에만 언어 초기화
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(LANG_STORAGE_KEY);
        i18n.changeLanguage('ko');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
