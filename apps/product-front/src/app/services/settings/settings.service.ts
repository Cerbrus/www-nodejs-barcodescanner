import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, filter } from 'rxjs';

import { AppSettings, MicroserviceKey } from './app-settings.model';

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    private readonly _settings = new BehaviorSubject<AppSettings | undefined>(undefined); // Note: initialized with APP_INITIALIZER.
    private rootUrl?: Record<MicroserviceKey, string>;

    public getApiUrl(key: MicroserviceKey): string {
        if (!this.rootUrl) {
            throw new Error('Root URL is not set');
        }
        return this.rootUrl[key];
    }

    public get settings(): Observable<AppSettings> {
        return this._settings.pipe(filter(Boolean));
    }

    public init(settings: AppSettings): void {
        if (this._settings.value !== undefined) {
            throw new Error('Cannot initialize settings if settings has already been initialized');
        }
        // Initialize settings
        this._settings.next(settings);
        // Configure dependents
        this.rootUrl = settings.api;
    }

    public update(settings: Partial<AppSettings>): void {
        if (this._settings.value) {
            this._settings.next({ ...this._settings.value, ...settings });
        } else {
            throw new Error('Cannot update settings if settings has not been initialized');
        }
    }
}
