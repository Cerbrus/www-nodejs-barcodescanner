import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

import { ApiService } from './api.service';

export type AppEventType = 'scan' | 'list' | 'barcode' | 'catalog' | 'log';

interface AppEvent {
    type: AppEventType;
    data: unknown;
}

const EVENT_TYPES: Array<AppEventType> = ['scan', 'list', 'barcode', 'catalog', 'log'];

@Injectable({ providedIn: 'root' })
export class EventsService {
    public readonly connected = signal(false);

    private readonly api = inject(ApiService);
    private readonly events$ = new Subject<AppEvent>();
    private source?: EventSource;

    public on<T>(...types: Array<AppEventType>): Observable<T> {
        this.connect();

        return this.events$.pipe(
            filter((event) => types.includes(event.type)),
            map((event) => event.data as T)
        );
    }

    private connect(): void {
        if (this.source) {
            return;
        }

        this.source = new EventSource(`${this.api.baseUrl}/events`);
        this.source.onopen = (): void => this.connected.set(true);
        this.source.onerror = (): void => this.connected.set(false);
        this.source.addEventListener('ping', () => this.connected.set(true));

        for (const type of EVENT_TYPES) {
            this.source.addEventListener(type, (event) => {
                this.events$.next({ type, data: JSON.parse((event as MessageEvent<string>).data) });
            });
        }
    }
}
