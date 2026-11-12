import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';

export type PushStatus = 'unsupported' | 'off' | 'on' | 'denied';

const WORKER_URL = '/sw.js';
const STATE_CACHE = 'notification-state';
const PENDING_KEY = '/pending-navigation';
const PENDING_CHECK_MILLISECONDS = 1500;

@Injectable({ providedIn: 'root' })
export class PushService {
    public readonly status = signal<PushStatus>('unsupported');
    public readonly busy = signal(false);

    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);
    private registration?: ServiceWorkerRegistration;

    public async start(): Promise<void> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            return;
        }

        navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
            if (event.data.type === 'navigate') {
                void this.followPendingNavigation();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void this.followPendingNavigation();
            }
        });
        window.addEventListener('focus', () => void this.followPendingNavigation());
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                void this.followPendingNavigation();
            }
        }, PENDING_CHECK_MILLISECONDS);
        void this.followPendingNavigation();

        try {
            this.registration = await navigator.serviceWorker.register(WORKER_URL);
            const subscription = await this.registration.pushManager.getSubscription();
            if (subscription) {
                await this.save(subscription);
            }
            this.status.set(this.statusFor(subscription));
        } catch {
            this.status.set('unsupported');
        }
    }

    public async enable(): Promise<void> {
        if (!this.registration) {
            return;
        }

        this.busy.set(true);
        try {
            if ((await Notification.requestPermission()) !== 'granted') {
                this.status.set('denied');
                return;
            }

            const { publicKey } = await firstValueFrom(this.api.getPushKey());
            const subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.decodeKey(publicKey)
            });
            await this.save(subscription);
            this.status.set('on');
        } finally {
            this.busy.set(false);
        }
    }

    public async disable(): Promise<void> {
        const subscription = await this.registration?.pushManager.getSubscription();
        if (subscription) {
            await firstValueFrom(this.api.deletePushSubscription(subscription.endpoint));
            await subscription.unsubscribe();
        }
        this.status.set(this.statusFor(undefined));
    }

    private async followPendingNavigation(): Promise<void> {
        try {
            const cache = await caches.open(STATE_CACHE);
            const pending = await cache.match(PENDING_KEY);
            if (!pending) {
                return;
            }

            await cache.delete(PENDING_KEY);
            const target = await pending.text();
            await this.router.navigateByUrl(target.includes('#') ? target.slice(target.indexOf('#') + 1) : target);
        } catch {
            return;
        }
    }

    private statusFor(subscription?: PushSubscription | null): PushStatus {
        if (Notification.permission === 'denied') {
            return 'denied';
        }

        return subscription ? 'on' : 'off';
    }

    private save(subscription: PushSubscription): Promise<void> {
        const keys = subscription.toJSON().keys ?? {};
        return firstValueFrom(
            this.api.savePushSubscription({
                endpoint: subscription.endpoint,
                p256dh: keys['p256dh'],
                auth: keys['auth'],
                language: this.translate.currentLang,
                origin: window.location.origin
            })
        );
    }

    private decodeKey(key: string): Uint8Array<ArrayBuffer> {
        const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
        return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    }
}
