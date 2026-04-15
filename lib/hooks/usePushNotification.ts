'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotification() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;

      // 이미 구독 중이면 재사용, 없으면 새로 구독
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(subscription),
      });
    };

    subscribe().catch(() => {});
  }, []);

  // 앱이 포그라운드로 올 때 배지 제거
  useEffect(() => {
    const clear = () => {
      if ('clearAppBadge' in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> })
          .clearAppBadge()
          .catch(() => {});
      }
    };
    window.addEventListener('focus', clear);
    clear(); // 진입 시 즉시 제거
    return () => window.removeEventListener('focus', clear);
  }, []);
}
