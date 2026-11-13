import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://shop.example';
const SOURCE = readFileSync(join(process.cwd(), 'apps/product-front/src/sw.js'), 'utf-8');

type Handler = (event: Record<string, unknown>) => void;
type CacheKey = string | { url: string };

class FakeCache {
    public readonly entries = new Map<string, Response>();

    public match(key: CacheKey): Promise<Response | undefined> {
        return Promise.resolve(this.entries.get(nameOf(key))?.clone());
    }

    public put(key: CacheKey, response: Response): Promise<void> {
        this.entries.set(nameOf(key), response);

        return Promise.resolve();
    }
}

const nameOf = (key: CacheKey): string => (typeof key === 'string' ? key : key.url);
const settle = async (): Promise<void> => {
    for (let round = 0; round < 30; round++) {
        await Promise.resolve();
    }
};

describe('service worker', () => {
    let handlers: Map<string, Handler>;
    let caches: Map<string, FakeCache>;
    let online: boolean;
    let windows: Array<{ postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>;
    const fetched: Array<string> = [];
    const showNotification = vi.fn(() => Promise.resolve());
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());
    const openWindow = vi.fn(() => Promise.resolve());
    const skipWaiting = vi.fn();
    const claim = vi.fn(() => Promise.resolve());

    const cache = (name: string): FakeCache => {
        if (!caches.has(name)) {
            caches.set(name, new FakeCache());
        }

        return caches.get(name) as FakeCache;
    };
    const appFiles = (): FakeCache => cache('app-files-v1');
    const fire = async (type: string, event: Record<string, unknown> = {}): Promise<void> => {
        const waits: Array<Promise<unknown>> = [];
        handlers.get(type)?.({ waitUntil: (work: Promise<unknown>) => waits.push(work), ...event });
        await Promise.all(waits);
        await settle();
    };
    const request = async (address: string, init: { method?: string; mode?: string } = {}): Promise<Response | undefined> => {
        let answer: Promise<Response> | undefined;
        handlers.get('fetch')?.({
            request: { url: new URL(address, SITE).href, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' },
            respondWith: (response: Promise<Response>) => (answer = response)
        });
        const response = await answer;
        await settle();

        return response;
    };
    const textOf = async (response?: Response): Promise<string | undefined> => response?.text();

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = new Map();
        caches = new Map();
        online = true;
        windows = [];
        fetched.length = 0;

        const scope = {
            location: { origin: SITE },
            addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
            skipWaiting,
            clients: { claim, matchAll: () => Promise.resolve(windows), openWindow },
            registration: { showNotification },
            navigator: { setAppBadge, clearAppBadge },
            caches: {
                open: (name: string) => Promise.resolve(cache(name)),
                keys: () => Promise.resolve([...caches.keys()]),
                delete: (name: string) => Promise.resolve(caches.delete(name))
            },
            fetch: (target: CacheKey) => {
                const address = new URL(nameOf(target), SITE);
                fetched.push(address.pathname);
                if (!online) {
                    return Promise.reject(new Error('offline'));
                }
                if (address.pathname === '/app-files.json') {
                    return Promise.resolve(new Response(JSON.stringify(['main-AAAAAAAA.js', 'styles-BBBBBBBB.css'])));
                }

                return Promise.resolve(new Response(`fresh ${address.pathname}`));
            }
        };

        new Function('self', SOURCE)(scope);
    });

    it('takes over at once and removes caches it does not know', async () => {
        cache('old-cache');
        cache('notification-state');
        cache('app-files-v1');

        await fire('install');
        await fire('activate');

        expect(skipWaiting).toHaveBeenCalledTimes(1);
        expect(claim).toHaveBeenCalledTimes(1);
        expect([...caches.keys()].sort()).toEqual(['app-files-v1', 'notification-state']);
    });

    it('never touches API calls, its own file, the file list, or anything that is not a read', async () => {
        for (const [address, method] of [
            ['/api/v1/list', 'GET'],
            ['/sw.js', 'GET'],
            ['/app-files.json', 'GET'],
            ['/main-AAAAAAAA.js', 'POST'],
            ['https://elsewhere.example/a.js', 'GET']
        ]) {
            expect(await request(address, { method })).toBeUndefined();
        }

        expect(fetched).toEqual([]);
        expect(appFiles().entries.size).toBe(0);
    });

    it('takes the page from the network and keeps a copy for when there is no connection', async () => {
        expect(await textOf(await request('/', { mode: 'navigate' }))).toBe('fresh /');

        online = false;

        expect(await textOf(await request('/some/page', { mode: 'navigate' }))).toBe('fresh /');
    });

    it('answers with an error page when there is no connection and no copy', async () => {
        online = false;

        expect((await request('/', { mode: 'navigate' }))?.type).toBe('error');
    });

    it('serves a file with a version in its name from the cache after the first time', async () => {
        await request('/main-AAAAAAAA.js');
        await request('/main-AAAAAAAA.js');
        online = false;

        expect(await textOf(await request('/main-AAAAAAAA.js'))).toBe('fresh /main-AAAAAAAA.js');
        expect(fetched).toEqual(['/main-AAAAAAAA.js']);
    });

    it('serves other files from the cache and refreshes them in the background', async () => {
        await request('/assets/i18n/nl.json');
        appFiles().entries.set(`${SITE}/assets/i18n/nl.json`, new Response('older'));

        expect(await textOf(await request('/assets/i18n/nl.json'))).toBe('older');
        expect(await textOf(await appFiles().match(`${SITE}/assets/i18n/nl.json`))).toBe('fresh /assets/i18n/nl.json');

        online = false;

        expect(await textOf(await request('/assets/i18n/nl.json'))).toBe('fresh /assets/i18n/nl.json');
    });

    it('keeps font files from the font host', async () => {
        await request('https://fonts.gstatic.com/s/font.woff2');
        online = false;

        expect(await request('https://fonts.gstatic.com/s/font.woff2')).toBeDefined();
    });

    it('keeps the files the page names and the published ones, but no API answers and nothing twice', async () => {
        appFiles().entries.set(`${SITE}/main-AAAAAAAA.js`, new Response('already there'));

        await fire('message', { data: { type: 'keep-files', urls: [`${SITE}/`, `${SITE}/chunk-CCCCCCCC.js`, `${SITE}/api/v1/list`, `${SITE}/sw.js`] } });

        expect([...appFiles().entries.keys()].sort()).toEqual(['/', `${SITE}/chunk-CCCCCCCC.js`, `${SITE}/main-AAAAAAAA.js`, `${SITE}/styles-BBBBBBBB.css`]);
        expect(await textOf(await appFiles().match(`${SITE}/main-AAAAAAAA.js`))).toBe('already there');
        expect(fetched).not.toContain('/api/v1/list');
    });

    it('ignores messages it does not know', async () => {
        await fire('message', { data: { type: 'other' } });
        await fire('message', { data: { type: 'keep-files' } });

        expect(fetched).toEqual([]);
    });

    it('shows a pushed notification and sets the number on the app icon', async () => {
        const message = { web_push: 8030, notification: { title: 'Onbekend product', body: '8710400000001', tag: 'inbox', navigate: `${SITE}/#/inbox`, app_badge: '3' } };

        await fire('push', { data: { json: () => message } });

        expect(showNotification).toHaveBeenCalledWith('Onbekend product', expect.objectContaining({ body: '8710400000001', tag: 'inbox', data: { url: '/#/inbox' } }));
        expect(setAppBadge).toHaveBeenCalledWith(3);
    });

    it('clears the number on the app icon when the inbox is empty, and shows a title of its own when none is sent', async () => {
        await fire('push', { data: { json: () => ({ body: 'x', badge: 0 }) } });

        expect(showNotification).toHaveBeenCalledWith('Boodschappen', expect.objectContaining({ data: { url: '/' } }));
        expect(clearAppBadge).toHaveBeenCalledTimes(1);
    });

    it('on a tap, tells the open app which page to show and brings it to the front', async () => {
        windows = [{ postMessage: vi.fn(), focus: vi.fn() }];

        await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/#/inbox' } } });

        expect(await textOf(await cache('notification-state').match('/pending-navigation'))).toBe('/#/inbox');
        expect(windows[0].postMessage).toHaveBeenCalledWith({ type: 'navigate' });
        expect(windows[0].focus).toHaveBeenCalledTimes(1);
        expect(openWindow).not.toHaveBeenCalled();
    });

    it('on a tap with the app closed, opens it on that page', async () => {
        await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/#/inbox' } } });

        expect(openWindow).toHaveBeenCalledWith('/#/inbox');
    });
});
