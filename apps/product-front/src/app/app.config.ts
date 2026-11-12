import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { appRoutes } from './providers/routes.provider';
import { provideSettings } from './providers/settings.provider';
import { provideTranslation } from './providers/translation.provider';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes),
        provideSettings(),
        provideHttpClient(withInterceptorsFromDi()),
        importProvidersFrom([BrowserAnimationsModule]),
        provideTranslation()
    ]
};

export function redirectUri(): string {
    return [window.location.origin, ...window.location.pathname.split('/').filter(Boolean)].join('/');
}
