import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { Observable, catchError, defer, map, of, switchMap, timeout } from 'rxjs';

import { AppSettings } from '../services/settings/app-settings.model';
import { SettingsService } from '../services/settings/settings.service';

export function provideSettings(): Provider | EnvironmentProviders {
    return {
        provide: APP_INITIALIZER,
        useFactory: initSettingsFactory,
        deps: [SettingsService],
        multi: true
    };
}

const SETTINGS_TIMEOUT_MS = 5000;
const FALLBACK_SETTINGS = { api: { core: '/api' } } as AppSettings;

function initSettingsFactory(settingsService: SettingsService) {
    return (): Observable<void> =>
        defer(() => fetch('assets/appsettings.json')).pipe(
            switchMap((data) => data.json()),
            timeout(SETTINGS_TIMEOUT_MS),
            catchError(() => of(FALLBACK_SETTINGS)),
            map((settingsJson) => settingsService.init(settingsJson))
        );
}
