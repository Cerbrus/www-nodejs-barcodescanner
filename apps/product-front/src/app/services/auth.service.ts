import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

import { AuthState } from '../models';
import { EventsService } from './events.service';
import { SettingsService } from './settings/settings.service';

const UNAUTHORIZED = 401;
const LOGIN_ROUTE = '/login';

@Injectable({ providedIn: 'root' })
export class AuthService {
    public readonly state = signal<AuthState | undefined>(undefined);

    private readonly http = inject(HttpClient);
    private readonly settings = inject(SettingsService);
    private readonly events = inject(EventsService);

    public get loginUrl(): string {
        return `${this.baseUrl}/auth/google`;
    }

    private get baseUrl(): string {
        return `${this.settings.getApiUrl('core')}/v1`;
    }

    public load(): Observable<AuthState> {
        const known = this.state();
        if (known) {
            return of(known);
        }

        return this.http.get<AuthState>(`${this.baseUrl}/auth/me`).pipe(
            catchError(() => of<AuthState>({ enabled: false, authenticated: true })),
            tap((state) => this.state.set(state))
        );
    }

    public markLoggedOut(): void {
        this.events.stop();
        this.state.update((state) => (state?.enabled ? { ...state, authenticated: false, email: undefined } : state));
    }

    public logout(): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}).pipe(
            tap(() => {
                window.location.hash = `#${LOGIN_ROUTE}`;
                window.location.reload();
            })
        );
    }
}

export const requireLogin: CanActivateFn = () => {
    const router = inject(Router);

    return inject(AuthService)
        .load()
        .pipe(map((state) => state.authenticated || router.parseUrl(LOGIN_ROUTE)));
};

export const redirectOnUnauthorized: HttpInterceptorFn = (request, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === UNAUTHORIZED && auth.state()?.authenticated) {
                auth.markLoggedOut();
                void router.navigateByUrl(LOGIN_ROUTE);
            }

            return throwError(() => error);
        })
    );
};
