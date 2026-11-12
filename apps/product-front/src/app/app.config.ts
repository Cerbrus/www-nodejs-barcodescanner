import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';

import { appRoutes } from './providers/routes.provider';
import { provideSettings } from './providers/settings.provider';
import { provideTranslation } from './providers/translation.provider';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes, withComponentInputBinding(), withHashLocation()),
        provideSettings(),
        provideHttpClient(),
        provideTranslation()
    ]
};
