import { Injectable, inject } from '@angular/core';

import { ApiService } from './api.service';

const MAX_LENGTH = 500;
const DEVICE = /iPhone|iPad|Android|Windows|Macintosh|Linux/;

@Injectable({ providedIn: 'root' })
export class PageLogService {
    private readonly api = inject(ApiService);

    public add(message: string): void {
        void fetch(`${this.api.baseUrl}/logs`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'info',
                message: `web app on ${this.device()}: ${message}`.slice(0, MAX_LENGTH)
            })
        }).catch(() => undefined);
    }

    private device(): string {
        const name = DEVICE.exec(navigator.userAgent)?.[0] ?? 'unknown device';
        const installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

        return installed ? `${name}, installed` : name;
    }
}
