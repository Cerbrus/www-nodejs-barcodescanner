import { FactoryProvider } from '@angular/core';
import { Observable, lastValueFrom } from 'rxjs';

import { SettingsService } from '../services/settings/settings.service';
import { provideSettings } from './settings.provider';

describe('settings at start', () => {
    const start = async (): Promise<SettingsService> => {
        const settings = new SettingsService();
        const factory = (provideSettings() as FactoryProvider).useFactory as (
            service: SettingsService
        ) => () => Observable<void>;
        await lastValueFrom(factory(settings)());

        return settings;
    };

    afterEach(() => vi.unstubAllGlobals());

    it('reads the settings file', async () => {
        vi.stubGlobal('fetch', () => Promise.resolve({ json: () => Promise.resolve({ api: { core: '/x' } }) }));

        expect((await start()).getApiUrl('core')).toBe('/x');
    });

    it('starts with the default address when the settings file cannot be loaded', async () => {
        vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));

        expect((await start()).getApiUrl('core')).toBe('/api');
    });
});
