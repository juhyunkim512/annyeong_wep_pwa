'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { type AppLang, normalizeDbLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';

/**
 * i18n 현재 언어 + 언어 변경 (DB 동기) 훅
 */
export function useI18nLang() {
  const { i18n: i18nInstance } = useTranslation();

  const currentLang = normalizeDbLang(i18nInstance.language) as AppLang;

  const changeLang = useCallback(
    async (lang: string) => {
      const code = lang as AppLang;
      // 즉시 UI 업데이트
      await i18n.changeLanguage(code);
      localStorage.setItem('app-lang', code);

      // DB 저장은 백그라운드에서 비동기 처리
      supabase.auth.getSession().then(({ data: sessionData }) => {
        if (sessionData.session) {
          supabase
            .from('profile')
            .update({ uselanguage: code })
            .eq('id', sessionData.session.user.id);
        }
      });
    },
    []
  );

  return { currentLang, changeLang };
}
