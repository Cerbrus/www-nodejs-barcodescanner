import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { appRoutes } from './providers/routes.provider';
import { provideSettings } from './providers/settings.provider';
import { provideTranslation } from './providers/translation.provider';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes, withComponentInputBinding()),
        provideSettings(),
        provideHttpClient(),
        provideTranslation()
    ]
};
