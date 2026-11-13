const FALLBACK_TITLE = 'Boodschappen';
const ICON = '/assets/icons/icon-192.png';
const STATE_CACHE = 'notification-state';
const PENDING_KEY = '/pending-navigation';
const APP_CACHE = 'app-files-v1';
const PAGE_KEY = '/';
const KEPT_CACHES = [STATE_CACHE, APP_CACHE];
const CACHEABLE_FILE = /\.(?:js|css|png|svg|ico|woff2?|otf|json|webmanifest)$/;
const VERSIONED_FILE = /-[A-Z0-9]{8}\.[a-z0-9]+$/;
const FONT_HOST = 'fonts.gstatic.com';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([self.clients.claim(), dropOtherCaches()])));

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET') {
        return;
    }

    if (url.origin !== self.location.origin) {
        if (url.hostname === FONT_HOST) {
            event.respondWith(cacheFirst(request));
        }
        return;
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(pageFromNetworkOrCache(request));
    } else if (VERSIONED_FILE.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
    } else if (CACHEABLE_FILE.test(url.pathname)) {
        event.respondWith(cacheThenRefresh(request));
    }
});

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
            body: JSON.stringify({ level: 'info', message })
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
        url: target.pathname + target.search + target.hash,
        badge: Number(notification.app_badge)
    };
}

function dropOtherCaches() {
    return self.caches
        .keys()
        .then((names) => Promise.all(names.filter((name) => !KEPT_CACHES.includes(name)).map((name) => self.caches.delete(name))));
}

function keep(key, response) {
    if (response.ok || response.type === 'opaque') {
        const copy = response.clone();
        self.caches.open(APP_CACHE).then((cache) => cache.put(key, copy));
    }

    return response;
}

function pageFromNetworkOrCache(request) {
    return self
        .fetch(request)
        .then((response) => keep(PAGE_KEY, response))
        .catch(() =>
            self.caches
                .open(APP_CACHE)
                .then((cache) => cache.match(PAGE_KEY))
                .then((cached) => cached || Response.error())
        );
}

function cacheFirst(request) {
    return self.caches
        .open(APP_CACHE)
        .then((cache) => cache.match(request))
        .then((cached) => cached || self.fetch(request).then((response) => keep(request, response)));
}

function cacheThenRefresh(request) {
    return self.caches
        .open(APP_CACHE)
        .then((cache) => cache.match(request))
        .then((cached) => {
            const fresh = self.fetch(request).then((response) => keep(request, response));
            if (!cached) {
                return fresh;
            }

            fresh.catch(() => undefined);

            return cached;
        });
}
