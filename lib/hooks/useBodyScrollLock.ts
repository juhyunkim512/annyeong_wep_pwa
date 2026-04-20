import { useEffect, useRef } from 'react';

/**
 * 모달이 열려 있는 동안 pull-to-refresh + body 스크롤 완전 차단.
 *
 * iOS Safari는 position:fixed 만으로 pull-to-refresh가 막히지 않기 때문에
 * touchmove 이벤트를 passive:false 로 등록해 직접 preventDefault 처리한다.
 *
 * 모달 내부 스크롤 가능 영역(overflow: auto/scroll)은 경계(상단/하단)에서만
 * preventDefault 를 호출해 내부 스크롤은 정상 유지한다.
 */

function getScrollableParent(el: Element | null): Element | null {
  while (el && el !== document.body) {
    const { overflowY } = window.getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function useBodyScrollLock(isLocked: boolean) {
  const scrollYRef = useRef(0);
  const touchStartYRef = useRef(0);

  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return;

    // ── body 고정 ──────────────────────────────────────
    scrollYRef.current = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    body.style.position = 'fixed';
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = '100%';
    body.style.overflowY = 'scroll';
    // Chrome Android / PWA pull-to-refresh CSS 레벨 차단
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    // ── iOS Safari pull-to-refresh 직접 차단 ──────────
    const onTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const scrollable = getScrollableParent(e.target as Element);

      if (!scrollable) {
        // 스크롤 가능 영역 밖 → 무조건 차단
        e.preventDefault();
        return;
      }

      // 스크롤 가능 영역 내부 → 경계에서만 차단
      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      const atTop = scrollable.scrollTop <= 0 && deltaY > 0;
      const atBottom =
        scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight && deltaY < 0;

      if (atTop || atBottom) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overflowY = '';
      html.style.overscrollBehavior = '';
      body.style.overscrollBehavior = '';
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      window.scrollTo(0, scrollYRef.current);
    };
  }, [isLocked]);
}
