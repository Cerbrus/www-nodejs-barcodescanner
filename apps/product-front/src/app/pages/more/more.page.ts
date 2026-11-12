import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';

const LANGUAGES = ['nl', 'en'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const VERSION_LENGTH = 7;

@Component({
    selector: 'app-more-page',
    standalone: true,
    imports: [RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'nav.more' | translate }}</h1>

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

            <h2 class="section-title">{{ 'more.language' | translate }}</h2>
            <div class="flex gap-2">
                @for (language of languages; track language) {
                    <button
                        type="button"
                        class="btn grow"
                        [class.primary]="currentLanguage() === language"
                        (click)="useLanguage(language)"
                    >
                        {{ 'language.' + language | translate }}
                    </button>
                }
            </div>

            <h2 class="section-title">{{ 'more.status' | translate }}</h2>
            <div class="card text-sm">
                <p>
                    {{ 'more.connection' | translate }}:
                    <strong>{{ (events.connected() ? 'log.live' : 'log.disconnected') | translate }}</strong>
                </p>
                <p>
                    {{ 'more.version' | translate }}:
                    <span class="font-mono">{{ version() }}</span>
                </p>
            </div>
        </div>
    `
})
export class MorePage {
    protected readonly events = inject(EventsService);
    protected readonly languages = LANGUAGES;
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
