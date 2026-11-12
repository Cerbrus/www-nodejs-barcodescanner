const FALLBACK_TITLE = 'Boodschappen';
const ICON = '/assets/icons/icon-192.png';
const STATE_CACHE = 'notification-state';
const PENDING_KEY = '/pending-navigation';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = readMessage(event.data ? event.data.json() : {});
    const tasks = [
        self.registration.showNotification(data.title || FALLBACK_TITLE, {
            body: data.body,
            icon: ICON,
            tag: data.tag,
            data: { url: data.url || '/' }
        })
    ];

    if (Number.isFinite(data.badge) && 'setAppBadge' in self.navigator) {
        tasks.push(data.badge ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
    }

    event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = event.notification.data?.url || '/';

    event.waitUntil(
        self.caches
            .open(STATE_CACHE)
            .then((cache) => cache.put(PENDING_KEY, new Response(path)))
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then((windows) => {
                const open = windows[0];
                report(`notification tapped, ${windows.length} open window(s)`);
                if (!open) {
                    return self.clients.openWindow(path);
                }

                open.postMessage({ type: 'navigate' });
                return open.focus();
            })
    );
});

function report(message) {
    return self
        .fetch('/api/v1/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: 'info', message: `phone: ${message}` })
        })
        .catch(() => undefined);
}

function readMessage(message) {
    const notification = message.notification;
    if (!notification) {
        return message;
    }

    const target = new URL(notification.navigate || '/', self.location.origin);
    return {
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        url: target.pathname + target.search,
        badge: Number(notification.app_badge)
    };
}
