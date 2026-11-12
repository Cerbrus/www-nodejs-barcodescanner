import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { Observable, defer, map, switchMap } from 'rxjs';

import { SettingsService } from '../services/settings/settings.service';

export function provideSettings(): Provider | EnvironmentProviders {
    return {
        provide: APP_INITIALIZER,
        useFactory: initSettingsFactory,
        deps: [SettingsService],
        multi: true,
    };
}

function initSettingsFactory(settingsService: SettingsService) {
    return (): Observable<void> =>
        defer(() => fetch('assets/appsettings.json')).pipe(
            switchMap((data) => data.json()),
            map((settingsJson) => settingsService.init(settingsJson)),
        );
}
