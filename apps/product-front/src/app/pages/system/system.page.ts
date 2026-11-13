import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { SoundTestComponent } from '../../components/sound-test/sound-test.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PushService } from '../../services/push.service';
import { Theme, ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';

const LANGUAGES = ['nl', 'en'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const COMMIT_LENGTH = 7;
const AGENT_REFRESH_MILLISECONDS = 60 * 1000;
const THEME_OPTIONS: Array<{ theme: Theme; icon: string }> = [
    { theme: 'auto', icon: 'brightness_auto' },
    { theme: 'light', icon: 'light_mode' },
    { theme: 'dark', icon: 'dark_mode' }
];

@Component({
    selector: 'app-system-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslateModule, SoundTestComponent],
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

            <h2 class="section-title">{{ 'push.title' | translate }}</h2>
            <div class="card text-sm">
                <p class="muted">{{ 'push.intro' | translate }}</p>
                <p class="mt-2 font-semibold">{{ 'push.' + push.status() | translate }}</p>
                @if (push.status() === 'off') {
                    <button type="button" class="btn primary mt-3 w-full" [disabled]="push.busy()" (click)="enablePush()">
                        <i class="material-symbols-outlined">notifications_active</i>
                        {{ 'push.enable' | translate }}
                    </button>
                } @else if (push.status() === 'on') {
                    <div class="mt-3 flex gap-2">
                        <button type="button" class="btn basis-0 grow" (click)="testPush()">
                            <i class="material-symbols-outlined">send</i>
                            {{ 'push.test' | translate }}
                        </button>
                        <button type="button" class="btn basis-0 grow" (click)="push.disable()">
                            <i class="material-symbols-outlined">notifications_off</i>
                            {{ 'push.disable' | translate }}
                        </button>
                    </div>
                }
            </div>

            <h2 class="section-title">{{ 'sound.title' | translate }}</h2>
            <app-sound-test />

            @if (auth.state()?.enabled) {
                <h2 class="section-title">{{ 'login.account' | translate }}</h2>
                <div class="card text-sm">
                    <div class="flex items-center gap-3">
                        <i class="material-symbols-outlined muted">account_circle</i>
                        <span class="grow truncate">{{ auth.state()?.email }}</span>
                        @if (!confirmingLogout()) {
                            <button type="button" class="btn danger" (click)="confirmingLogout.set(true)">
                                <i class="material-symbols-outlined">logout</i>
                                {{ 'login.logout' | translate }}
                            </button>
                        }
                    </div>
                    @if (confirmingLogout()) {
                        <p class="mt-3">{{ 'login.logoutConfirm' | translate }}</p>
                        <div class="mt-3 flex gap-2">
                            <button type="button" class="btn danger basis-0 grow" (click)="logout()">
                                <i class="material-symbols-outlined">logout</i>
                                {{ 'login.logout' | translate }}
                            </button>
                            <button type="button" class="btn basis-0 grow" (click)="confirmingLogout.set(false)">
                                <i class="material-symbols-outlined">close</i>
                                {{ 'common.cancel' | translate }}
                            </button>
                        </div>
                    }
                </div>
            }

            <h2 class="section-title">{{ 'system.status' | translate }}</h2>
            <div class="card text-sm">
                <p>
                    {{ 'system.connection' | translate }}:
                    <strong>{{ (events.connected() ? 'log.live' : 'log.disconnected') | translate }}</strong>
                </p>
                <p>
                    {{ 'system.scanner' | translate }}:
                    <strong [style.color]="scannerState() === 'connected' ? null : 'var(--danger)'">
                        {{ 'system.scannerState.' + scannerState() | translate }}
                    </strong>
                    @if (agent()?.device; as device) {
                        <span class="muted">({{ device }})</span>
                    }
                </p>
                @if (agent()?.lastHandheldScanAt; as lastScan) {
                    <p>
                        {{ 'system.lastHandheldScan' | translate }}:
                        {{ lastScan | date: 'd MMM y HH:mm' }}
                    </p>
                }
                <p>
                    {{ 'system.version' | translate }}:
                    <span class="font-mono">{{ version() }}</span>
                </p>
                @if (health()?.builtAt; as builtAt) {
                    <p>
                        {{ 'system.built' | translate }}:
                        {{ builtAt | date: 'd MMM y HH:mm' }}
                    </p>
                }
            </div>
        </div>
    `
})
export class SystemPage {
    protected readonly events = inject(EventsService);
    protected readonly theme = inject(ThemeService);
    protected readonly push = inject(PushService);
    protected readonly auth = inject(AuthService);
    protected readonly confirmingLogout = signal(false);
    protected readonly languages = LANGUAGES;
    protected readonly themeOptions = THEME_OPTIONS;
    protected readonly currentLanguage = signal(inject(TranslateService).currentLang || 'nl');

    private readonly agentApi = inject(ApiService);

    protected readonly agent = toSignal(
        merge(interval(AGENT_REFRESH_MILLISECONDS), this.events.on('agent', 'scan')).pipe(
            startWith(undefined),
            switchMap(() => this.agentApi.getAgentStatus().pipe(catchError(() => of(undefined))))
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
        this.push.enable().catch(() => this.toasts.show({ kind: 'error', text: this.translate.instant('push.failed') }));
    }

    protected testPush(): void {
        this.api
            .sendTestPush()
            .pipe(tap((result) => this.toasts.show({ kind: 'ok', text: this.translate.instant('push.testResult', result) })))
            .subscribe();
    }

    protected useLanguage(language: string): void {
        this.translate.use(language);
        this.currentLanguage.set(language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
}
