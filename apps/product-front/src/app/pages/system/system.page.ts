import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { FocusOnShowDirective } from '../../directives/focus-on-show.directive';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PushService } from '../../services/push.service';
import { RemarkService } from '../../services/remark.service';
import { Theme, ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';

const LANGUAGES = ['nl', 'en'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const COMMIT_LENGTH = 7;
const AGENT_REFRESH_MILLISECONDS = 60 * 1000;
const MANAGEMENT_LINKS = [
    { path: '/sounds', icon: 'volume_up', title: 'sound.title' },
    { path: '/history', icon: 'history', title: 'history.title' },
    { path: '/log', icon: 'terminal', title: 'log.title' }
];
const THEME_OPTIONS: Array<{ theme: Theme; icon: string }> = [
    { theme: 'auto', icon: 'brightness_auto' },
    { theme: 'light', icon: 'light_mode' },
    { theme: 'dark', icon: 'dark_mode' }
];

@Component({
    selector: 'app-system-page',
    standalone: true,
    imports: [DatePipe, LowerCasePipe, RouterLink, TranslatePipe, FocusOnShowDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './system.page.html',
    styleUrl: './system.page.scss'
})
export class SystemPage {
    protected readonly events = inject(EventsService);
    protected readonly theme = inject(ThemeService);
    protected readonly push = inject(PushService);
    protected readonly auth = inject(AuthService);
    protected readonly remarks = inject(RemarkService);
    protected readonly touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    protected readonly confirmingLogout = signal(false);
    protected readonly languages = LANGUAGES;
    protected readonly themeOptions = THEME_OPTIONS;
    protected readonly managementLinks = MANAGEMENT_LINKS;
    protected readonly currentLanguage = signal(inject(TranslateService).getCurrentLang() || 'nl');

    private readonly agentApi = inject(ApiService);

    protected readonly agent = toSignal(
        merge(interval(AGENT_REFRESH_MILLISECONDS), this.events.on('agent', 'scan')).pipe(
            startWith(undefined),
            switchMap(() =>
                this.auth.owner() ? this.agentApi.getAgentStatus().pipe(catchError(() => of(undefined))) : of(undefined)
            )
        )
    );

    protected readonly scannerState = computed(() => {
        const agent = this.agent();

        return agent?.agentOnline ? (agent.scanner ?? 'waiting') : 'offline';
    });

    protected readonly health = toSignal(
        inject(ApiService)
            .getHealth()
            .pipe(catchError(() => of(undefined)))
    );

    private readonly translate = inject(TranslateService);
    private readonly api = inject(ApiService);
    private readonly toasts = inject(ToastService);

    protected version(): string {
        const health = this.health();
        if (!health) {
            return '…';
        }

        return health.commit ? `${health.version} (${health.commit.slice(0, COMMIT_LENGTH)})` : health.version;
    }

    protected logout(): void {
        this.auth.logout().subscribe();
    }

    protected enablePush(): void {
        this.push
            .enable()
            .catch(() => this.toasts.show({ kind: 'error', text: this.translate.instant('push.failed') }));
    }

    protected testPush(): void {
        this.api
            .sendTestPush()
            .pipe(
                tap((result) =>
                    this.toasts.show({ kind: 'ok', text: this.translate.instant('push.testResult', result) })
                )
            )
            .subscribe();
    }

    protected useLanguage(language: string): void {
        this.translate.use(language);
        this.currentLanguage.set(language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
}
