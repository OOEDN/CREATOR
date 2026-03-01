// OOEDN Push Notification Service Worker
// This file runs in the background and handles push events

self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activated');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('[SW] Push event received');

    let data = { title: 'OOEDN Tracker', body: 'New notification', url: '/' };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.warn('[SW] Could not parse push data:', e);
    }

    const options = {
        body: data.body || 'New notification',
        icon: '/ooedn-icon.png',
        badge: '/ooedn-badge.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'ooedn-notification',
        renotify: true,
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'OOEDN Tracker', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'dismiss') return;

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
