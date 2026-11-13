import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AppComponent } from './app.component';
import { appRoutes } from './providers/routes.provider';
import { provideSettings } from './providers/settings.provider';
import { ApiService } from './services/api.service';
import { requireLogin, requireOwner } from './services/auth.service';
import { printConsoleBanner } from './services/console-banner';
import { PushService } from './services/push.service';
import { SettingsService } from './services/settings/settings.service';
import { UpdateService } from './services/update.service';

describe('AppComponent', () => {
    const startPush = vi.fn(() => Promise.resolve());
    const startUpdates = vi.fn();
    const api = { baseUrl: '/api/v1', getHealth: vi.fn() };
    let log: ReturnType<typeof vi.spyOn>;

    const start = (): HTMLElement => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();

        return fixture.nativeElement as HTMLElement;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        api.getHealth.mockReturnValue(of({ status: 'ok', version: '1.1.32', commit: 'abc' }));
        TestBed.configureTestingModule({
            imports: [AppComponent, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: ApiService, useValue: api },
                { provide: PushService, useValue: { start: startPush } },
                { provide: UpdateService, useValue: { start: startUpdates } }
            ]
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it('starts in Dutch, starts push and the update check, and sets the page language', () => {
        start();

        expect(TestBed.inject(TranslateService).currentLang).toBe('nl');
        expect(document.documentElement.lang).toBe('nl');
        expect(startPush).toHaveBeenCalledTimes(1);
        expect(startUpdates).toHaveBeenCalledTimes(1);
    });

    it('starts in the remembered language, and ignores one it does not have', () => {
        localStorage.setItem('language', 'en');
        start();
        expect(TestBed.inject(TranslateService).currentLang).toBe('en');

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [AppComponent, TranslateModule.forRoot()],
            providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: PushService, useValue: { start: startPush } }, { provide: UpdateService, useValue: { start: startUpdates } }]
        });
        localStorage.setItem('language', 'fr');
        start();

        expect(TestBed.inject(TranslateService).currentLang).toBe('nl');
    });

    it('prints the version in the console, also when the server cannot be reached', () => {
        start();
        expect(log.mock.calls.flat().join(' ')).toContain('1.1.32');

        log.mockClear();
        api.getHealth.mockReturnValue(throwError(() => new Error('down')));
        start();

        expect(log.mock.calls.flat().join(' ')).toContain('unknown (server not reachable)');
    });

    it('closes the keyboard on a tap outside a text field, but not on a tap on a field, a label or a dropdown', () => {
        start();
        document.body.insertAdjacentHTML('beforeend', '<div id="zone"><input id="field" /><label id="label">x</label><select id="choice"></select><p id="text">y</p></div>');
        const field = document.getElementById('field') as HTMLInputElement;
        const tap = (id: string): void => {
            document.getElementById(id)?.dispatchEvent(new Event('pointerup', { bubbles: true }));
        };

        for (const id of ['field', 'label', 'choice']) {
            field.focus();
            tap(id);
            expect(document.activeElement).toBe(field);
        }

        tap('text');
        expect(document.activeElement).not.toBe(field);

        document.getElementById('zone')?.remove();
    });
});

describe('routes, settings and the console banner', () => {
    const shell = appRoutes.find((route) => route.path === '') as Route;
    const child = (path: string): Route => shell.children?.find((route) => route.path === path) as Route;

    it('puts every page behind the login, except the login page itself', () => {
        expect(shell.canActivate).toEqual([requireLogin]);
        expect(appRoutes.find((route) => route.path === 'login')?.canActivate).toBeUndefined();
    });

    it('keeps history, log and sounds for the owner, and nothing else', () => {
        const ownerOnly = shell.children?.filter((route) => route.canActivate?.includes(requireOwner)).map((route) => route.path);

        expect(ownerOnly).toEqual(['history', 'log', 'sounds']);
    });

    it('starts on the list, and sends an unknown address there', () => {
        expect(child('').redirectTo).toBe('list');
        expect(appRoutes.at(-1)).toEqual({ path: '**', redirectTo: 'list' });
    });

    it('can load every page', async () => {
        const pages = await Promise.all([...appRoutes, ...(shell.children ?? [])].filter((route) => route.loadComponent).map((route) => route.loadComponent?.()));

        expect(pages.length).toBe(10);
        expect(pages.every((page) => typeof page === 'function')).toBe(true);
    });

    it('reads the API address from the settings file before the app starts', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ api: { core: '/api' } }) }))
        );
        TestBed.configureTestingModule({ providers: [provideSettings()] });

        await TestBed.inject(ApplicationInitStatus).donePromise;

        expect(fetch).toHaveBeenCalledWith('assets/appsettings.json');
        expect(TestBed.inject(SettingsService).getApiUrl('core')).toBe('/api');
        vi.unstubAllGlobals();
    });

    it('prints what helps to find a problem: version, address, language, installed or not', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.stubGlobal('matchMedia', () => ({ matches: true }));

        printConsoleBanner({ version: '1.1.32', commit: 'abc', builtAt: 'today', apiBase: '/api/v1', language: 'nl' });
        const printed = log.mock.calls.flat().join('\n');

        expect(printed).toContain('1.1.32');
        expect(printed).toContain('/api/v1');
        expect(printed).toContain('yes, running as an app');

        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
});
