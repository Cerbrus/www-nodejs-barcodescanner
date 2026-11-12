import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of, startWith, switchMap, tap } from 'rxjs';

import { ApiService } from './services/api.service';
import { printConsoleBanner } from './services/console-banner';

const LANGUAGE_STORAGE_KEY = 'language';
const SUPPORTED_LANGUAGES = ['nl', 'en'];
const DEFAULT_LANGUAGE = 'nl';

@Component({
    standalone: true,
    imports: [RouterOutlet],
    selector: 'app-root',
    template: '<router-outlet />'
})
export class AppComponent {
    constructor() {
        const translate = inject(TranslateService);
        const api = inject(ApiService);
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? '';
        const language = SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
        translate.use(language);

        translate.onLangChange
            .pipe(
                startWith(undefined),
                switchMap(() => translate.get('common.appName')),
                tap((appName: string) => {
                    document.title = appName;
                    document.documentElement.lang = translate.currentLang;
                }),
                takeUntilDestroyed()
            )
            .subscribe();

        api.getHealth()
            .pipe(
                catchError(() => of(undefined)),
                tap((health) => printConsoleBanner({ version: health?.version, apiBase: api.baseUrl, language })),
                takeUntilDestroyed()
            )
            .subscribe();
    }
}
