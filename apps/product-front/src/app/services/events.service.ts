import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

import { ApiService } from './api.service';

export type AppEventType = 'scan' | 'list' | 'barcode' | 'catalog' | 'log';

interface AppEvent {
    type: AppEventType;
    data: unknown;
}

const EVENT_TYPES: Array<AppEventType> = ['scan', 'list', 'barcode', 'catalog', 'log'];
const RETRY_MILLISECONDS = 3000;
const SILENCE_LIMIT_MILLISECONDS = 40000;

@Injectable({ providedIn: 'root' })
export class EventsService {
    public readonly connected = signal(false);

    private readonly api = inject(ApiService);
    private readonly events$ = new Subject<AppEvent>();
    private readonly resumed$ = new Subject<void>();
    private source?: EventSource;
    private retryTimer?: ReturnType<typeof setTimeout>;
    private started = false;
    private openedBefore = false;
    private lastActivity = 0;

    public get resumed(): Observable<void> {
        this.start();

        return this.resumed$.asObservable();
    }

    public on<T>(...types: Array<AppEventType>): Observable<T> {
        this.start();

        return this.events$.pipe(
            filter((event) => types.includes(event.type)),
            map((event) => event.data as T)
        );
    }

    private start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.connect();
        document.addEventListener('visibilitychange', () => this.onVisibilityChange());
        window.addEventListener('online', () => this.reconnect());
    }

    private connect(): void {
        clearTimeout(this.retryTimer);
        const source = new EventSource(`${this.api.baseUrl}/events`);
        this.source = source;

        source.onopen = (): void => {
            this.markActive();
            if (this.openedBefore) {
                this.resumed$.next();
            }
            this.openedBefore = true;
        };
        source.onerror = (): void => {
            this.connected.set(false);
            if (source.readyState === EventSource.CLOSED) {
                this.retryTimer = setTimeout(() => this.reconnect(), RETRY_MILLISECONDS);
            }
        };
        source.addEventListener('ping', () => this.markActive());

        for (const type of EVENT_TYPES) {
            source.addEventListener(type, (event) => {
                this.markActive();
                this.events$.next({ type, data: JSON.parse((event as MessageEvent<string>).data) });
            });
        }
    }

    private reconnect(): void {
        this.source?.close();
        this.connect();
    }

    private markActive(): void {
        this.lastActivity = Date.now();
        this.connected.set(true);
    }

    private onVisibilityChange(): void {
        if (document.visibilityState !== 'visible') {
            return;
        }

        const silent = Date.now() - this.lastActivity > SILENCE_LIMIT_MILLISECONDS;
        if (this.source?.readyState !== EventSource.OPEN || silent) {
            this.reconnect();
        } else {
            this.resumed$.next();
        }
    }
}
