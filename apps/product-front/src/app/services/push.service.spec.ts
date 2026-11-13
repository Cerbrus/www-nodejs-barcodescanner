import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ApiService } from './api.service';
import { PushService } from './push.service';

interface FakeSubscription {
    endpoint: string;
    toJSON(): { keys: Record<string, string> };
    unsubscribe: ReturnType<typeof vi.fn>;
}

const subscription = (): FakeSubscription => ({
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'key-1', auth: 'key-2' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true))
});

describe('PushService', () => {
    let service: PushService;
    let existing: FakeSubscription | undefined;
    let permission: NotificationPermission;
    let answer: NotificationPermission;
    let pending: string | undefined;
    let workerMessage: ((event: { data: { type?: string } }) => void) | undefined;

    const api = { getPushKey: vi.fn(), savePushSubscription: vi.fn(), deletePushSubscription: vi.fn() };
    const navigate = vi.fn(() => Promise.resolve(true));
    const postMessage = vi.fn();
    const register = vi.fn();
    const subscribe = vi.fn();

    const settle = async (): Promise<void> => {
        for (let round = 0; round < 20; round++) {
            await Promise.resolve();
        }
    };
    const offerServiceWorker = (): void => {
        const registration = { pushManager: { getSubscription: () => Promise.resolve(existing), subscribe } };
        register.mockReturnValue(Promise.resolve(registration));
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                register,
                ready: Promise.resolve({ active: { postMessage } }),
                addEventListener: (_: string, listener: typeof workerMessage) => (workerMessage = listener)
            }
        });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        existing = undefined;
        permission = 'default';
        answer = 'granted';
        pending = undefined;
        workerMessage = undefined;
        api.getPushKey.mockReturnValue(of({ publicKey: 'AQID' }));
        api.savePushSubscription.mockReturnValue(of(undefined));
        api.deletePushSubscription.mockReturnValue(of(undefined));
        subscribe.mockImplementation(() => Promise.resolve((existing = subscription())));

        vi.stubGlobal('PushManager', class {});
        vi.stubGlobal('Notification', {
            get permission(): NotificationPermission {
                return permission;
            },
            requestPermission: () => Promise.resolve((permission = answer))
        });
        vi.stubGlobal('caches', {
            open: () =>
                Promise.resolve({
                    match: () => {
                        const stored = pending;

                        return Promise.resolve(stored === undefined ? undefined : { text: () => Promise.resolve(stored) });
                    },
                    delete: () => Promise.resolve((pending = undefined))
                })
        });

        TestBed.configureTestingModule({
            providers: [
                { provide: ApiService, useValue: api },
                { provide: Router, useValue: { navigateByUrl: navigate } },
                { provide: TranslateService, useValue: { currentLang: 'nl' } }
            ]
        });
        service = TestBed.inject(PushService);
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, 'serviceWorker');
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('stays unsupported in a browser without service workers', async () => {
        await service.start();

        expect(service.status()).toBe('unsupported');
        expect(register).not.toHaveBeenCalled();
    });

    it('registers the service worker, asks it to keep the app files, and is off without a subscription', async () => {
        offerServiceWorker();
        await service.start();
        await settle();

        expect(register).toHaveBeenCalledWith('/sw.js');
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'keep-files' }));
        expect(service.status()).toBe('off');
    });

    it('sends an existing subscription to the server again at start, and is on', async () => {
        existing = subscription();
        offerServiceWorker();
        await service.start();

        expect(api.savePushSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ endpoint: 'https://push.example/abc', p256dh: 'key-1', auth: 'key-2', language: 'nl' })
        );
        expect(service.status()).toBe('on');
    });

    it('says blocked when the device refuses notifications', async () => {
        permission = 'denied';
        offerServiceWorker();
        await service.start();

        expect(service.status()).toBe('denied');
    });

    it('turns on: asks permission, subscribes with the server key and saves the subscription', async () => {
        offerServiceWorker();
        await service.start();
        await service.enable();

        expect(Array.from(subscribe.mock.calls[0][0].applicationServerKey as Uint8Array)).toEqual([1, 2, 3]);
        expect(subscribe.mock.calls[0][0].userVisibleOnly).toBe(true);
        expect(api.savePushSubscription).toHaveBeenCalledTimes(1);
        expect(service.status()).toBe('on');
        expect(service.busy()).toBe(false);
    });

    it('does not subscribe when the user refuses permission', async () => {
        answer = 'denied';
        offerServiceWorker();
        await service.start();
        await service.enable();

        expect(subscribe).not.toHaveBeenCalled();
        expect(service.status()).toBe('denied');
        expect(service.busy()).toBe(false);
    });

    it('turns off: removes the subscription on the server and on the device', async () => {
        existing = subscription();
        const current = existing;
        offerServiceWorker();
        await service.start();
        existing = undefined;
        await service.disable();

        expect(service.status()).toBe('off');
        expect(current.unsubscribe).not.toHaveBeenCalled();

        existing = current;
        await service.disable();

        expect(api.deletePushSubscription).toHaveBeenCalledWith('https://push.example/abc');
        expect(current.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('opens the page of a tapped notification, once, when the service worker says so', async () => {
        offerServiceWorker();
        await service.start();
        await settle();
        expect(navigate).not.toHaveBeenCalled();

        pending = '/#/inbox';
        workerMessage?.({ data: { type: 'navigate' } });
        await settle();
        workerMessage?.({ data: { type: 'navigate' } });
        await settle();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('/inbox');
    });

    it('also finds a tapped notification by looking every second and a half', async () => {
        offerServiceWorker();
        await service.start();
        await settle();

        pending = '/inbox';
        vi.advanceTimersByTime(1500);
        await settle();

        expect(navigate).toHaveBeenCalledWith('/inbox');
    });
});
