const FALLBACK_TITLE = 'Boodschappen';
const ICON = '/assets/icons/icon-192.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const tasks = [
        self.registration.showNotification(data.title || FALLBACK_TITLE, {
            body: data.body,
            icon: ICON,
            tag: data.tag,
            data: { url: data.url || '/' }
        })
    ];

    if (typeof data.badge === 'number' && 'setAppBadge' in self.navigator) {
        tasks.push(data.badge ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
    }

    event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows[0];
            if (!open) {
                return self.clients.openWindow(path);
            }

            open.postMessage({ type: 'navigate', url: path });
            return open.focus();
        })
    );
});
