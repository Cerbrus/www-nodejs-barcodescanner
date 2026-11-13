import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';

import { AuthService, redirectOnUnauthorized, requireLogin, requireOwner } from './auth.service';
import { EventsService } from './events.service';
import { loadOutbox, saveOutbox } from './outbox';
import { SettingsService } from './settings/settings.service';
import { loadSnapshot, saveSnapshot } from './snapshot';
import { AuthState } from '../models';

type GuardResult = boolean | { redirect: string };

const owner: AuthState = { enabled: true, authenticated: true, owner: true, email: 'owner@example.com' };
const guest: AuthState = { enabled: true, authenticated: true, owner: false, email: 'guest@example.com' };
const anonymous: AuthState = { enabled: true, authenticated: false, owner: false };

describe('login in the web app', () => {
    let server: HttpTestingController;
    let http: HttpClient;
    const stopEvents = vi.fn();
    const navigate = vi.fn();

    const run = (guard: typeof requireLogin, state: AuthState | 'unreachable'): GuardResult => {
        let result: GuardResult = false;
        const outcome = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<GuardResult>;
        outcome.subscribe((value) => (result = value));

        const request = server.match('/api/v1/auth/me')[0];
        if (state === 'unreachable') {
            request?.error(new ProgressEvent('error'));
        } else {
            request?.flush(state);
        }

        return result;
    };

    beforeEach(() => {
        stopEvents.mockClear();
        navigate.mockClear();
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([redirectOnUnauthorized])),
                provideHttpClientTesting(),
                { provide: SettingsService, useValue: { getApiUrl: (): string => '/api' } },
                { provide: EventsService, useValue: { stop: stopEvents } },
                { provide: Router, useValue: { parseUrl: (redirect: string): GuardResult => ({ redirect }), navigateByUrl: navigate } }
            ]
        });
        server = TestBed.inject(HttpTestingController);
        http = TestBed.inject(HttpClient);
    });

    afterEach(() => vi.restoreAllMocks());

    it('lets a logged-in account in and sends anyone else to the login page', () => {
        expect(run(requireLogin, guest)).toBe(true);

        TestBed.inject(AuthService).state.set(undefined);

        expect(run(requireLogin, anonymous)).toEqual({ redirect: '/login' });
    });

    it('asks the server once and remembers the answer', () => {
        run(requireLogin, owner);
        run(requireLogin, owner);
        run(requireOwner, owner);

        server.expectNone('/api/v1/auth/me');
        expect(TestBed.inject(AuthService).state()?.email).toBe('owner@example.com');
    });

    it('opens the owner pages for the owner and sends other accounts back to the System page', () => {
        expect(run(requireOwner, owner)).toBe(true);
        expect(TestBed.inject(AuthService).owner()).toBe(true);

        TestBed.inject(AuthService).state.set(undefined);

        expect(run(requireOwner, guest)).toEqual({ redirect: '/system' });
        expect(TestBed.inject(AuthService).owner()).toBe(false);
    });

    it('lets the app start when the login state cannot be fetched, without owner rights', () => {
        expect(run(requireLogin, 'unreachable')).toBe(true);
        expect(run(requireOwner, 'unreachable')).toEqual({ redirect: '/system' });
    });

    it('goes to the login page and stops the event stream when the server says the login ran out', () => {
        run(requireLogin, owner);

        http.get('/api/v1/list').subscribe({ error: () => undefined });
        server.expectOne('/api/v1/list').flush('', { status: 401, statusText: 'Unauthorized' });

        expect(navigate).toHaveBeenCalledWith('/login');
        expect(stopEvents).toHaveBeenCalledTimes(1);
        expect(TestBed.inject(AuthService).state()?.authenticated).toBe(false);
        expect(TestBed.inject(AuthService).state()?.email).toBeUndefined();
    });

    it('does not redirect for other failures, or when nobody was logged in', () => {
        run(requireLogin, owner);
        http.get('/api/v1/list').subscribe({ error: () => undefined });
        server.expectOne('/api/v1/list').flush('', { status: 500, statusText: 'Error' });

        TestBed.inject(AuthService).state.set(anonymous);
        http.get('/api/v1/list').subscribe({ error: () => undefined });
        server.expectOne('/api/v1/list').flush('', { status: 401, statusText: 'Unauthorized' });

        expect(navigate).not.toHaveBeenCalled();
    });

    it('removes the saved list and waiting changes at logout and reloads on the login page', () => {
        const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        saveSnapshot({ savedAt: '2026-11-13T10:00:00.000Z', sections: [], items: [], entries: [], inbox: [] });
        saveOutbox([{ catalogItemId: 1, state: 'recent', changedAt: '2026-11-13T10:00:00.000Z' }]);

        TestBed.inject(AuthService).logout().subscribe();
        server.expectOne('/api/v1/auth/logout').flush(null);

        expect(loadSnapshot()).toBeUndefined();
        expect(loadOutbox()).toEqual([]);
        expect(window.location.hash).toBe('#/login');
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
