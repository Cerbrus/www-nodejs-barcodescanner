import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError, timeout } from 'rxjs';

import { AuthState } from '../models';
import { EventsService } from './events.service';
import { saveOutbox } from './outbox';
import { SettingsService } from './settings/settings.service';
import { clearSnapshot } from './snapshot';

const UNAUTHORIZED = 401;
const LOGIN_ROUTE = '/login';
const AUTH_KEY = 'auth-state';
const AUTH_TIMEOUT_MS = 5000;
const UNREACHABLE: AuthState = { enabled: false, authenticated: true, owner: false };

@Injectable({ providedIn: 'root' })
export class AuthService {
    public readonly state = signal<AuthState | undefined>(undefined);

    private readonly http = inject(HttpClient);
    private readonly settings = inject(SettingsService);
    private readonly events = inject(EventsService);

    public readonly owner = computed(() => this.state()?.owner ?? false);

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
            timeout(AUTH_TIMEOUT_MS),
            tap((state) => rememberState(state)),
            catchError(() => of(recalledState() ?? UNREACHABLE)),
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
                clearSnapshot();
                forgetState();
                saveOutbox([]);
                window.location.hash = `#${LOGIN_ROUTE}`;
                window.location.reload();
            })
        );
    }
}

function rememberState(state: AuthState): void {
    try {
        if (state.enabled && state.authenticated) {
            localStorage.setItem(AUTH_KEY, JSON.stringify(state));
        } else {
            localStorage.removeItem(AUTH_KEY);
        }
    } catch {
        return;
    }
}

function recalledState(): AuthState | undefined {
    try {
        const stored = localStorage.getItem(AUTH_KEY);
        const state = stored ? (JSON.parse(stored) as AuthState) : undefined;

        return state?.enabled && state.authenticated ? state : undefined;
    } catch {
        return undefined;
    }
}

function forgetState(): void {
    try {
        localStorage.removeItem(AUTH_KEY);
    } catch {
        return;
    }
}

export const requireLogin: CanActivateFn = () => {
    const router = inject(Router);

    return inject(AuthService)
        .load()
        .pipe(map((state) => state.authenticated || router.parseUrl(LOGIN_ROUTE)));
};

export const requireOwner: CanActivateFn = () => {
    const router = inject(Router);

    return inject(AuthService)
        .load()
        .pipe(map((state) => state.owner || router.parseUrl('/system')));
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
