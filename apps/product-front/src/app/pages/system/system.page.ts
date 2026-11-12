import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { Theme, ThemeService } from '../../services/theme.service';

const LANGUAGES = ['nl', 'en'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const VERSION_LENGTH = 7;
const THEME_OPTIONS: Array<{ theme: Theme; icon: string }> = [
    { theme: 'auto', icon: 'brightness_auto' },
    { theme: 'light', icon: 'light_mode' },
    { theme: 'dark', icon: 'dark_mode' }
];

@Component({
    selector: 'app-system-page',
    standalone: true,
    imports: [RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'nav.system' | translate }}</h1>

            <div class="flex flex-col gap-2">
                <a class="card flex items-center gap-3" routerLink="/history">
                    <i class="material-symbols-outlined">history</i>
                    <span class="grow font-semibold">{{ 'history.title' | translate }}</span>
                    <i class="material-symbols-outlined muted">chevron_right</i>
                </a>
                <a class="card flex items-center gap-3" routerLink="/log">
                    <i class="material-symbols-outlined">terminal</i>
                    <span class="grow font-semibold">{{ 'log.title' | translate }}</span>
                    <i class="material-symbols-outlined muted">chevron_right</i>
                </a>
            </div>

            <h2 class="section-title">{{ 'system.language' | translate }}</h2>
            <div class="flex gap-2">
                @for (language of languages; track language) {
                    <button
                        type="button"
                        class="btn basis-0 grow"
                        [class.primary]="currentLanguage() === language"
                        (click)="useLanguage(language)"
                    >
                        {{ 'language.' + language | translate }}
                    </button>
                }
            </div>

            <h2 class="section-title">{{ 'system.theme' | translate }}</h2>
            <div class="flex gap-2">
                @for (option of themeOptions; track option.theme) {
                    <button
                        type="button"
                        class="btn basis-0 grow"
                        [class.primary]="theme.theme() === option.theme"
                        (click)="theme.use(option.theme)"
                    >
                        <i class="material-symbols-outlined">{{ option.icon }}</i>
                        {{ 'theme.' + option.theme | translate }}
                    </button>
                }
            </div>

            <h2 class="section-title">{{ 'system.status' | translate }}</h2>
            <div class="card text-sm">
                <p>
                    {{ 'system.connection' | translate }}:
                    <strong>{{ (events.connected() ? 'log.live' : 'log.disconnected') | translate }}</strong>
                </p>
                <p>
                    {{ 'system.version' | translate }}:
                    <span class="font-mono">{{ version() }}</span>
                </p>
            </div>
        </div>
    `
})
export class SystemPage {
    protected readonly events = inject(EventsService);
    protected readonly theme = inject(ThemeService);
    protected readonly languages = LANGUAGES;
    protected readonly themeOptions = THEME_OPTIONS;
    protected readonly currentLanguage = signal(inject(TranslateService).currentLang || 'nl');

    protected readonly health = toSignal(
        inject(ApiService)
            .getHealth()
            .pipe(catchError(() => of(undefined)))
    );

    private readonly translate = inject(TranslateService);

    protected version(): string {
        return this.health()?.version.slice(0, VERSION_LENGTH) ?? '…';
    }

    protected useLanguage(language: string): void {
        this.translate.use(language);
        this.currentLanguage.set(language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
}
