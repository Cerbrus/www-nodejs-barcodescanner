/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MicroserviceKey } from '../settings/app-settings.model';
import { SettingsService } from '../settings/settings.service';

export abstract class BaseApiClient {
    protected constructor(
        private readonly http: HttpClient,
        private readonly settings: SettingsService,
        private readonly microService: MicroserviceKey
    ) {
    }

    protected get<T = any>(resource: string, options?: Parameters<HttpClient['get']>[1]): Observable<T> {
        return this.http.get<T>(this.getApiUrl(resource), options);
    }

    protected delete<T = any>(resource: string): Observable<T> {
        return this.http.delete<T>(this.getApiUrl(resource));
    }

    protected head<T = any>(resource: string): Observable<T> {
        return this.http.head<T>(this.getApiUrl(resource));
    }

    protected post<T = any>(resource: string, data?: any): Observable<T> {
        return this.http.post<T>(this.getApiUrl(resource), data);
    }

    protected put<T = any>(resource: string, data?: any): Observable<T> {
        return this.http.put<T>(this.getApiUrl(resource), data);
    }

    protected patch<T = any>(resource: string, data?: any): Observable<T> {
        return this.http.patch<T>(this.getApiUrl(resource), data);
    }

    private getApiUrl(resource: string, apiVersion: ApiVersion = 'v1'): string {
        const coreApiUrl = this.settings.getApiUrl(this.microService);
        return `${coreApiUrl}/${apiVersion}${resource.startsWith('/') ? resource : '/' + resource}`;
    }
}

export type ApiVersion = 'v1' | 'v2';
