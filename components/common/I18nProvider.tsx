'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { normalizeDbLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // onAuthStateChange의 INITIAL_SESSION 이벤트를 이용해 언어 초기화
    // initLang()과 SIGNED_IN 핸들러를 별도로 두면 동시에 두 번 호출되어
    // i18n.changeLanguage()가 race condition을 일으킴 → 단일 리스너로 통합
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session) {
          const { data: profile } = await supabase
            .from('profile')
            .select('uselanguage')
            .eq('id', session.user.id)
            .maybeSingle();

          const lang = normalizeDbLang(profile?.uselanguage);
          if (i18n.language !== lang) {
            await i18n.changeLanguage(lang);
          }
        } else if (event === 'INITIAL_SESSION') {
          // 비로그인 초기 세션: 영어로 설정
          if (i18n.language !== 'en') {
            await i18n.changeLanguage('en');
          }
        }
      } else if (event === 'SIGNED_OUT') {
        await i18n.changeLanguage('en');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
