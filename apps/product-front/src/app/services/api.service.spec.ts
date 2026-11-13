import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { QUIET_FAILURE, QUIET_WITHOUT_CONNECTION } from './failed-change.interceptor';
import { loadOutbox, saveOutbox } from './outbox';
import { SettingsService } from './settings/settings.service';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './snapshot';
import { ThemeService } from './theme.service';

describe('ApiService', () => {
    let api: ApiService;
    let server: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        TestBed.inject(SettingsService).init({ api: { core: 'https://shop.example/api' } });
        api = TestBed.inject(ApiService);
        server = TestBed.inject(HttpTestingController);
    });

    afterEach(() => server.verify());

    it('builds its addresses from the settings', () => {
        expect(api.baseUrl).toBe('https://shop.example/api/v1');
        expect(api.iconsUrl).toBe('https://shop.example/icons');
    });

    it('calls the right route, with the right method and body, for every action', () => {
        const calls: Array<[() => Observable<unknown>, string, string, unknown?]> = [
            [() => api.getHealth(), 'GET', '/health'],
            [() => api.getAgentStatus(), 'GET', '/agent/status'],
            [() => api.getSections(), 'GET', '/sections'],
            [() => api.getCatalog(), 'GET', '/catalog'],
            [() => api.getCatalogItem(7), 'GET', '/catalog/7'],
            [() => api.createCatalogItem({ name: 'Kwark', sectionId: 'zuivel' }), 'POST', '/catalog', { name: 'Kwark', sectionId: 'zuivel' }],
            [() => api.updateCatalogItem(7, { name: 'Kwark', sectionId: 'zuivel' }), 'PATCH', '/catalog/7', { name: 'Kwark', sectionId: 'zuivel' }],
            [() => api.deleteCatalogItem(7), 'DELETE', '/catalog/7'],
            [() => api.getList(), 'GET', '/list'],
            [() => api.changeListEntry(7, { state: 'recent' }), 'PATCH', '/list/7', { state: 'recent' }],
            [() => api.removeListEntry(7), 'DELETE', '/list/7'],
            [() => api.getInbox(), 'GET', '/barcodes?unmapped=true'],
            [() => api.getBarcode('871'), 'GET', '/barcodes/871'],
            [() => api.mapBarcode('871', 7), 'PUT', '/barcodes/871', { catalogItemId: 7 }],
            [() => api.repeatLookup('871'), 'POST', '/barcodes/871/lookup', {}],
            [() => api.unmapBarcode('871'), 'DELETE', '/barcodes/871'],
            [() => api.discardBarcode('871'), 'POST', '/barcodes/871/discard', {}],
            [() => api.getIcons(), 'GET', '/icons'],
            [() => api.scan('871'), 'POST', '/scans', { code: '871' }],
            [() => api.undoScan(), 'POST', '/scans/undo', {}],
            [() => api.getScans(), 'GET', '/scans?limit=100'],
            [() => api.getLogs(), 'GET', '/logs?limit=300'],
            [() => api.getPushKey(), 'GET', '/push/key'],
            [() => api.savePushSubscription({ endpoint: 'e' }), 'POST', '/push/subscriptions', { endpoint: 'e' }],
            [() => api.deletePushSubscription('e'), 'DELETE', '/push/subscriptions', { endpoint: 'e' }],
            [() => api.sendTestPush(), 'POST', '/push/test', {}],
            [() => api.getFeedbackSettings(), 'GET', '/feedback/settings'],
            [() => api.setFeedbackSound('added', 'blip'), 'PUT', '/feedback/settings/added', { soundId: 'blip' }],
            [() => api.testSound('blip'), 'POST', '/feedback/test', { soundId: 'blip' }]
        ];

        for (const [call, method, path, body] of calls) {
            call().subscribe();
            const request = server.expectOne(`https://shop.example/api/v1${path}`).request;

            expect(`${request.method} ${path}`).toBe(`${method} ${path}`);
            if (body !== undefined) {
                expect(request.body).toEqual(body);
            }
        }
    });

    it('sends the waiting changes in one call', () => {
        const changes = [{ catalogItemId: 7, state: 'recent' as const, changedAt: '2026-11-13T10:00:00.000Z' }];
        api.sendOfflineChanges(changes).subscribe();
        const request = server.expectOne('https://shop.example/api/v1/list/offline-changes').request;

        expect(request.body).toEqual({ changes });
        expect(request.context.get(QUIET_FAILURE)).toBe(true);
    });

    it('marks the calls whose failure the caller handles itself, so no second message appears', () => {
        api.scan('871').subscribe();
        api.savePushSubscription({ endpoint: 'e' }).subscribe();
        api.changeListEntry(7, { state: 'recent' }).subscribe();
        api.removeListEntry(7).subscribe();

        expect(server.expectOne('https://shop.example/api/v1/scans').request.context.get(QUIET_FAILURE)).toBe(true);
        expect(server.expectOne('https://shop.example/api/v1/push/subscriptions').request.context.get(QUIET_FAILURE)).toBe(true);
        const [change, removal] = server.match('https://shop.example/api/v1/list/7').map((call) => call.request);

        expect(change.context.get(QUIET_WITHOUT_CONNECTION)).toBe(true);
        expect(removal.context.get(QUIET_WITHOUT_CONNECTION)).toBe(false);
        expect(removal.context.get(QUIET_FAILURE)).toBe(false);
    });
});

describe('settings, saved data and appearance', () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset['theme'];
    });

    it('refuses to hand out an address before the settings are loaded, and to load them twice', () => {
        const settings = TestBed.inject(SettingsService);
        expect(() => settings.getApiUrl('core')).toThrow();
        expect(() => settings.update({})).toThrow();

        settings.init({ api: { core: '/api' } });
        let seen = '';
        settings.settings.subscribe((value) => (seen = value.api.core));
        settings.update({ api: { core: '/other' } });

        expect(settings.getApiUrl('core')).toBe('/api');
        expect(seen).toBe('/other');
        expect(() => settings.init({ api: { core: '/again' } })).toThrow();
    });

    it('reads a broken or foreign outbox and snapshot as empty instead of failing', () => {
        localStorage.setItem('outbox', '{not json');
        localStorage.setItem('snapshot', '{not json');
        expect(loadOutbox()).toEqual([]);
        expect(loadSnapshot()).toBeUndefined();

        localStorage.setItem('outbox', '{"a":1}');
        localStorage.setItem('snapshot', '{"savedAt":"x"}');
        expect(loadOutbox()).toEqual([]);
        expect(loadSnapshot()).toBeUndefined();
    });

    it('keeps the outbox and the snapshot across a restart, and can clear the snapshot', () => {
        saveOutbox([{ catalogItemId: 1, state: 'recent', changedAt: '2026-11-13T10:00:00.000Z' }]);
        saveSnapshot({ savedAt: '2026-11-13T10:00:00.000Z', sections: [], items: [], entries: [], inbox: [] });
        expect(loadOutbox().length).toBe(1);
        expect(loadSnapshot()?.savedAt).toBe('2026-11-13T10:00:00.000Z');

        clearSnapshot();
        expect(loadSnapshot()).toBeUndefined();
    });

    it('survives a browser that refuses to store anything', () => {
        const refuse = (): never => {
            throw new Error('QuotaExceededError');
        };
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse);

        expect(() => saveOutbox([])).not.toThrow();
        expect(() => saveSnapshot({ savedAt: 'x', sections: [], items: [], entries: [], inbox: [] })).not.toThrow();
        expect(() => clearSnapshot()).not.toThrow();

        vi.restoreAllMocks();
    });

    it('starts with the remembered appearance, and with automatic when the stored value is unknown', () => {
        localStorage.setItem('theme', 'dark');
        expect(TestBed.inject(ThemeService).theme()).toBe('dark');
        expect(document.documentElement.dataset['theme']).toBe('dark');

        TestBed.resetTestingModule();
        localStorage.setItem('theme', 'purple');
        delete document.documentElement.dataset['theme'];

        expect(TestBed.inject(ThemeService).theme()).toBe('auto');
        expect(document.documentElement.dataset['theme']).toBeUndefined();
    });
});
