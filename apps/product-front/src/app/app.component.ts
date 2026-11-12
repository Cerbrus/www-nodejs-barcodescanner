import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { startWith, switchMap, tap } from 'rxjs';

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
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? '';
        translate.use(SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE);

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
    }
}
