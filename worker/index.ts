declare const self: ServiceWorkerGlobalScope;

// 푸쉬 알림 수신 → 알림 표시 + 앱 아이콘 배지 증가
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; url?: string };
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const nav = self.navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'ANNYEONG', {
        body: data.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: { url: data.url || '/dashboard/community' },
        tag: 'annyeong-notification',
        renotify: true,
      }),
      nav.setAppBadge?.().catch(() => {}),
    ])
  );
});

// 알림 클릭 → 앱 열기/포커스 + 배지 제거
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string | undefined) || '/dashboard/community';

  const nav = self.navigator as Navigator & {
    clearAppBadge?: () => Promise<void>;
  };

  event.waitUntil(
    Promise.all([
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) {
              void client.focus();
              return;
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(url);
          }
        }),
      nav.clearAppBadge?.().catch(() => {}),
    ])
  );
});
